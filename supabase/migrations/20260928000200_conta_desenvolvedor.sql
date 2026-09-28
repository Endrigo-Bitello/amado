-- =============================================================================
-- CRM Amado & Amado Jr. — 19. Conta de desenvolvimento
-- Contas listadas em "desenvolvedores" (hoje: dev@amadoeamadojr.com.br) não
-- têm travas: todas as permissões, leitura e escrita direta em todas as
-- tabelas (inclusive financeiro, linha do tempo e auditoria), exclusão em
-- cascata de clientes, casos e lançamentos financeiros e dispensa das regras
-- de negócio (motivos obrigatórios, cobranças canceladas, datas futuras,
-- dependências de tarefas...). Validações de integridade continuam valendo.
-- A lista só é alterada por SQL (sem acesso pela interface ou pela API).
-- =============================================================================

create table public.desenvolvedores (
  email text primary key check (email = lower(trim(email))),
  created_at timestamptz not null default now()
);

comment on table public.desenvolvedores is
  'E-mails das contas de desenvolvimento, sem travas no CRM. Mantida somente por SQL.';

alter table public.desenvolvedores enable row level security;
revoke all on public.desenvolvedores from anon, authenticated;

insert into public.desenvolvedores (email) values ('dev@amadoeamadojr.com.br');

create or replace function public.eh_desenvolvedor_usuario(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select u.ativo
    from public.usuarios u
    join public.desenvolvedores d on d.email = lower(u.email)
    where u.id = p_usuario
  ), false)
$$;

create or replace function public.eh_desenvolvedor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.eh_desenvolvedor_usuario(public.usuario_atual()) $$;

grant execute on function public.eh_desenvolvedor_usuario(uuid) to service_role;
grant execute on function public.eh_desenvolvedor() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Permissões: a conta de desenvolvimento tem todas, sem exceções nem modo
-- simplificado, e conta como administradora nas regras que usam eh_admin().
-- -----------------------------------------------------------------------------

create or replace function public.tem_permissao_usuario(p_usuario uuid, p_permissao text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select u.ativo
       and (
         exists (select 1 from public.desenvolvedores d where d.email = lower(u.email))
         or (
           not (p_permissao = any (u.permissoes_negadas))
           and not (u.modo_simplificado and p_permissao like '%.excluir')
           and (
             u.perfil_id = 'admin'
             or p_permissao = any (pf.permissoes)
             or p_permissao = any (u.permissoes_extra)
           )
         )
       )
    from public.usuarios u
    join public.perfis pf on pf.id = u.perfil_id
    where u.id = p_usuario
  ), false)
$$;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select u.ativo and (u.perfil_id = 'admin' or exists (select 1 from public.desenvolvedores d where d.email = lower(u.email)))
    from public.usuarios u
    where u.id = public.usuario_atual()
  ), false)
$$;

create or replace function public.modo_simplificado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select u.modo_simplificado and not public.eh_desenvolvedor_usuario(u.id)
    from public.usuarios u
    where u.id = public.usuario_atual()
  ), false)
$$;

create or replace function public.meu_perfil()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', u.id,
    'nome', u.nome,
    'email', u.email,
    'cargo', u.cargo,
    'oab', u.oab,
    'telefone', u.telefone,
    'cor', u.cor,
    'ativo', u.ativo,
    'perfil_id', pf.id,
    'perfil_nome', pf.nome,
    'modo_simplificado', u.modo_simplificado and not public.eh_desenvolvedor_usuario(u.id),
    'desenvolvedor', public.eh_desenvolvedor_usuario(u.id),
    'permissoes', to_jsonb(public.permissoes_efetivas(u.id))
  )
  from public.usuarios u
  join public.perfis pf on pf.id = u.perfil_id
  where u.id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- Acesso direto a todas as tabelas (inclusive financeiro, históricos, linha do
-- tempo e auditoria). As demais contas continuam limitadas pelas políticas
-- existentes; para elas nada muda.
-- ATENÇÃO (manutenção): as tabelas antes fechadas por REVOKE (financeiro,
-- usuários, perfis, históricos, auditoria...) passam a depender só da RLS.
-- Elas não têm políticas de escrita além desta; não crie outras sem avaliar.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relname <> 'desenvolvedores'
    order by c.relname
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select public.eh_desenvolvedor())) with check ((select public.eh_desenvolvedor()))',
      t || '_desenvolvedor', t
    );
  end loop;
end
$$;

create policy "desenvolvedor: acesso total aos arquivos do CRM"
  on storage.objects for all to authenticated
  using (bucket_id in ('crm-documentos', 'crm-financeiro') and (select public.eh_desenvolvedor()))
  with check (bucket_id in ('crm-documentos', 'crm-financeiro') and (select public.eh_desenvolvedor()));

-- -----------------------------------------------------------------------------
-- Exclusão em cascata (clientes, casos e lançamentos financeiros). Devolve os
-- arquivos removidos do banco para a interface apagá-los do armazenamento.
-- -----------------------------------------------------------------------------

create or replace function public.dev_excluir(p_tipo text, p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_arquivos jsonb := '[]'::jsonb;
  v_linhas integer;
begin
  if not public.eh_desenvolvedor() then
    raise exception 'Somente a conta de desenvolvimento pode fazer esta exclusão.' using errcode = '42501';
  end if;
  perform public.servico_contexto(public.usuario_atual(), 'dev:excluir');

  if p_tipo in ('cliente', 'caso') then
    select coalesce(jsonb_agg(jsonb_build_object('bucket', a.bucket, 'caminho', a.caminho)), '[]'::jsonb)
      into v_arquivos
    from public.arquivos a
    where (p_tipo = 'cliente' and (a.cliente_id = p_id or a.caso_id in (select k.id from public.casos k where k.cliente_id = p_id)))
       or (p_tipo = 'caso' and a.caso_id = p_id);
  end if;

  case p_tipo
    when 'cliente' then
      delete from public.pagamentos where cliente_id = p_id;
      delete from public.reembolsos where cliente_id = p_id;
      delete from public.despesas where cliente_id = p_id;
      delete from public.cobrancas where cliente_id = p_id;
      delete from public.contratos where cliente_id = p_id;
      delete from public.casos where cliente_id = p_id;
      delete from public.clientes where id = p_id;
    when 'caso' then
      delete from public.casos where id = p_id;
    when 'contrato' then
      delete from public.pagamentos where cobranca_id in (select c.id from public.cobrancas c where c.contrato_id = p_id);
      delete from public.reembolsos where cobranca_id in (select c.id from public.cobrancas c where c.contrato_id = p_id);
      delete from public.cobrancas where contrato_id = p_id;
      delete from public.contratos where id = p_id;
    when 'cobranca' then
      delete from public.pagamentos where cobranca_id = p_id;
      delete from public.reembolsos where cobranca_id = p_id;
      delete from public.cobrancas where id = p_id;
    when 'pagamento' then
      delete from public.pagamentos where id = p_id;
    when 'reembolso' then
      delete from public.reembolsos where id = p_id;
    when 'despesa' then
      delete from public.despesas where id = p_id;
    else
      raise exception 'Tipo de registro inválido.';
  end case;

  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Registro não encontrado ou já excluído.';
  end if;
  return v_arquivos;
end
$$;

grant execute on function public.dev_excluir(text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Regras de negócio que a conta de desenvolvimento dispensa. Cópias das
-- funções originais (migrações 09 e 11) com a condição "and not
-- eh_desenvolvedor" nas travas; o restante do comportamento é idêntico.
-- -----------------------------------------------------------------------------

create or replace function public.tg_leads_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_categoria text;
  v_nome_etapa text;
  v_auto record;
begin
  if tg_op = 'INSERT' then
    if new.etapa_id is null then
      new.etapa_id := public.etapa_inicial('lead');
    end if;
    if new.etapa_id is null then
      raise exception 'Nenhuma etapa ativa está configurada para o funil de leads.';
    end if;
    new.codigo := coalesce(new.codigo, 'L-' || lpad(nextval('public.leads_codigo_seq')::text, 5, '0'));
    new.created_by := coalesce(new.created_by, public.usuario_atual());
    new.etapa_alterada_em := now();
    new.ultima_atividade_em := now();
    if new.responsavel_id is null then
      select a.* into v_auto from public.automacoes a
      where a.tipo = 'lead_novo_primeiro_contato' and a.ativo
      order by a.created_at limit 1;
      if found and (
        jsonb_typeof(v_auto.parametros -> 'origens') is distinct from 'array'
        or jsonb_array_length(v_auto.parametros -> 'origens') = 0
        or (v_auto.parametros -> 'origens') ? new.origem
      ) then
        new.responsavel_id := public.escolher_responsavel(v_auto.parametros -> 'atribuir');
      end if;
    end if;
  else
    if new.etapa_id is distinct from old.etapa_id then
      new.etapa_alterada_em := now();
    end if;
    if (new.etapa_id, new.responsavel_id, new.proxima_acao, new.proxima_acao_em, new.observacoes,
        new.temperatura, new.prioridade, new.motivo_perda)
       is distinct from
       (old.etapa_id, old.responsavel_id, old.proxima_acao, old.proxima_acao_em, old.observacoes,
        old.temperatura, old.prioridade, old.motivo_perda) then
      new.ultima_atividade_em := now();
    end if;
    if new.arquivado_em is not null and old.arquivado_em is null then
      new.arquivado_por := public.usuario_atual();
    elsif new.arquivado_em is null then
      new.arquivado_por := null;
    end if;
  end if;

  select e.categoria, e.nome into v_categoria, v_nome_etapa from public.etapas e where e.id = new.etapa_id;
  if tg_op = 'INSERT' or new.etapa_id is distinct from old.etapa_id then
    if v_categoria = 'perdida' then
      if coalesce(trim(new.motivo_perda), '') = '' and not public.eh_desenvolvedor() then
        raise exception 'Informe o motivo da perda para mover o lead para "%".', v_nome_etapa;
      end if;
    elsif tg_op = 'UPDATE' then
      new.motivo_perda := null;
      new.motivo_perda_detalhe := null;
    end if;
  end if;
  return new;
end
$$;

create or replace function public.tg_tarefas_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dep_status text;
  v_dep_titulo text;
  v_atual uuid;
  v_nivel integer := 0;
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, public.usuario_atual());
  end if;

  if new.depende_de is not null and (tg_op = 'INSERT' or new.depende_de is distinct from old.depende_de) then
    if new.depende_de = new.id then
      raise exception 'Uma tarefa não pode depender dela mesma.';
    end if;
    v_atual := new.depende_de;
    while v_atual is not null and v_nivel < 50 loop
      select t.depende_de into v_atual from public.tarefas t where t.id = v_atual;
      if v_atual = new.id then
        raise exception 'Dependência circular entre tarefas.';
      end if;
      v_nivel := v_nivel + 1;
    end loop;
  end if;

  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status is distinct from 'concluida') then
    if new.depende_de is not null then
      select t.status, t.titulo into v_dep_status, v_dep_titulo from public.tarefas t where t.id = new.depende_de;
      if v_dep_status is not null and v_dep_status not in ('concluida', 'cancelada') and not public.eh_desenvolvedor() then
        raise exception 'Esta tarefa depende de "%", que ainda não foi concluída.', v_dep_titulo;
      end if;
    end if;
    new.concluida_em := now();
    new.concluida_por := public.usuario_atual();
  elsif new.status <> 'concluida' then
    new.concluida_em := null;
    new.concluida_por := null;
  end if;

  if new.cliente_id is null and new.caso_id is not null then
    select c.cliente_id into new.cliente_id from public.casos c where c.id = new.caso_id;
  end if;
  return new;
end
$$;

create or replace function public.tg_prazos_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator uuid := public.usuario_atual();
  v_motivo text;
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, v_ator);
    if new.conferido then
      if not public.tem_permissao('prazos.conferir') then
        raise exception 'Somente profissionais com permissão de conferência podem confirmar prazos.';
      end if;
      new.conferido_por := v_ator;
      new.conferido_em := now();
    else
      new.conferido_por := null;
      new.conferido_em := null;
    end if;
    if new.status = 'cumprido' then
      new.cumprido_em := coalesce(new.cumprido_em, now());
      new.cumprido_por := v_ator;
    end if;
    new.motivo_alteracao := null;
    return new;
  end if;

  v_motivo := nullif(trim(coalesce(new.motivo_alteracao, '')), '');

  if new.vencimento is distinct from old.vencimento then
    if v_motivo is null and not public.eh_desenvolvedor() then
      raise exception 'Informe o motivo da correção do vencimento do prazo.';
    end if;
    insert into public.prazos_historico (prazo_id, campo, valor_anterior, valor_novo, motivo, usuario_id)
    values (new.id, 'vencimento', public.formatar_data_hora(old.vencimento), public.formatar_data_hora(new.vencimento), v_motivo, v_ator);
    if not (new.conferido and not old.conferido) then
      new.conferido := false;
    end if;
  end if;

  if new.conferido and not old.conferido then
    if not public.tem_permissao('prazos.conferir') then
      raise exception 'Somente profissionais com permissão de conferência podem confirmar prazos.';
    end if;
    new.conferido_por := v_ator;
    new.conferido_em := now();
    insert into public.prazos_historico (prazo_id, campo, valor_anterior, valor_novo, motivo, usuario_id)
    values (new.id, 'conferido', 'Não conferido', 'Conferido', v_motivo, v_ator);
  elsif not new.conferido and old.conferido then
    new.conferido_por := null;
    new.conferido_em := null;
    insert into public.prazos_historico (prazo_id, campo, valor_anterior, valor_novo, motivo, usuario_id)
    values (new.id, 'conferido', 'Conferido', 'Não conferido', coalesce(v_motivo, case when new.vencimento is distinct from old.vencimento then 'Vencimento corrigido — requer nova conferência' end), v_ator);
  end if;

  if new.responsavel_id is distinct from old.responsavel_id then
    insert into public.prazos_historico (prazo_id, campo, valor_anterior, valor_novo, motivo, usuario_id)
    values (new.id, 'responsavel', public.nome_usuario(old.responsavel_id), public.nome_usuario(new.responsavel_id), v_motivo, v_ator);
  end if;

  if new.status is distinct from old.status then
    insert into public.prazos_historico (prazo_id, campo, valor_anterior, valor_novo, motivo, usuario_id)
    values (new.id, 'status', old.status, new.status, v_motivo, v_ator);
    if new.status = 'cumprido' then
      new.cumprido_em := coalesce(new.cumprido_em, now());
      new.cumprido_por := v_ator;
    else
      new.cumprido_em := null;
      new.cumprido_por := null;
    end if;
  end if;

  if new.titulo is distinct from old.titulo then
    insert into public.prazos_historico (prazo_id, campo, valor_anterior, valor_novo, motivo, usuario_id)
    values (new.id, 'titulo', old.titulo, new.titulo, v_motivo, v_ator);
  end if;

  new.motivo_alteracao := null;
  return new;
end
$$;

create or replace function public.tg_documentos_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator uuid := public.usuario_atual();
  v_clinico boolean;
  v_financeiro boolean;
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, v_ator);
    if new.cliente_id is null and new.caso_id is not null then
      select c.cliente_id into new.cliente_id from public.casos c where c.id = new.caso_id;
    end if;
  end if;

  if tg_op = 'INSERT' or new.categoria_id is distinct from old.categoria_id then
    select c.clinico, c.financeiro into v_clinico, v_financeiro from public.categorias_documento c where c.id = new.categoria_id;
    new.clinico := coalesce(v_clinico, false);
    new.financeiro := coalesce(v_financeiro, false);
  end if;

  if (tg_op = 'INSERT' and new.status <> 'nao_solicitado') or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if new.status in ('aprovado', 'rejeitado') and (select auth.uid()) is not null
       and not public.tem_permissao('documentos.revisar') then
      raise exception 'Somente usuários com permissão de revisão podem aprovar ou rejeitar documentos.';
    end if;
    if new.status = 'rejeitado' and coalesce(trim(new.rejeitado_motivo), '') = '' and not public.eh_desenvolvedor() then
      raise exception 'Informe o motivo da rejeição do documento.';
    end if;
    if new.status = 'dispensado' and coalesce(trim(new.dispensado_motivo), '') = '' and not public.eh_desenvolvedor() then
      raise exception 'Informe o motivo da dispensa do documento.';
    end if;

    case new.status
      when 'solicitado' then
        new.solicitado_em := now();
        new.solicitado_por := coalesce(v_ator, new.solicitado_por);
      when 'recebido' then
        new.recebido_em := now();
        new.recebido_por := v_ator;
      when 'em_revisao' then
        new.revisado_por := v_ator;
        new.revisado_em := now();
      when 'aprovado' then
        new.aprovado_por := v_ator;
        new.aprovado_em := now();
        if new.revisado_em is null or (tg_op = 'UPDATE' and old.status <> 'em_revisao') then
          new.revisado_por := v_ator;
          new.revisado_em := now();
        end if;
        if new.validade_dias is not null and (tg_op = 'INSERT' or new.valido_ate is not distinct from old.valido_ate) then
          new.valido_ate := public.hoje_sp() + new.validade_dias;
        end if;
      when 'rejeitado' then
        new.revisado_por := v_ator;
        new.revisado_em := now();
      else
        null;
    end case;
    -- Um novo ciclo (nova versão, rejeição etc.) invalida a aprovação anterior;
    -- o histórico preserva quem aprovou cada versão.
    if new.status in ('nao_solicitado', 'solicitado', 'recebido', 'em_revisao', 'rejeitado') then
      new.aprovado_por := null;
      new.aprovado_em := null;
    end if;
  end if;
  return new;
end
$$;

create or replace function public.tg_arquivos_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documentos%rowtype;
begin
  if tg_op = 'INSERT' then
    new.enviado_por := coalesce(new.enviado_por, public.usuario_atual());
    if new.documento_id is not null then
      perform pg_advisory_xact_lock(hashtext('arquivo_versao:' || new.documento_id::text));
      select d.* into v_doc from public.documentos d where d.id = new.documento_id;
      new.lead_id := coalesce(new.lead_id, v_doc.lead_id);
      new.cliente_id := coalesce(new.cliente_id, v_doc.cliente_id);
      new.caso_id := coalesce(new.caso_id, v_doc.caso_id);
      new.categoria_id := coalesce(new.categoria_id, v_doc.categoria_id);
      new.clinico := new.clinico or coalesce(v_doc.clinico, false);
      new.financeiro := new.financeiro or coalesce(v_doc.financeiro, false);
      select coalesce(max(a.versao), 0) + 1 into new.versao from public.arquivos a where a.documento_id = new.documento_id;
    elsif new.categoria_id is not null then
      new.clinico := new.clinico or coalesce((select c.clinico from public.categorias_documento c where c.id = new.categoria_id), false);
      new.financeiro := new.financeiro or coalesce((select c.financeiro from public.categorias_documento c where c.id = new.categoria_id), false);
    end if;
    if new.cliente_id is null and new.caso_id is not null then
      select c.cliente_id into new.cliente_id from public.casos c where c.id = new.caso_id;
    end if;
    new.financeiro := new.financeiro or new.bucket = 'crm-financeiro';
    return new;
  end if;

  if (new.bucket is distinct from old.bucket or new.caminho is distinct from old.caminho
      or new.documento_id is distinct from old.documento_id or new.versao is distinct from old.versao)
     and not public.eh_desenvolvedor() then
    raise exception 'O arquivo enviado não pode ser substituído; envie uma nova versão.';
  end if;
  if new.removido_em is not null and old.removido_em is null then
    new.removido_por := public.usuario_atual();
  elsif new.removido_em is null then
    new.removido_por := null;
  end if;
  return new;
end
$$;

create or replace function public.tg_comentarios_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.autor_id := coalesce(public.usuario_atual(), new.autor_id);
  else
    -- A mesclagem de leads (função mesclar_leads) pode mover comentários.
    if (new.autor_id is distinct from old.autor_id or new.entidade is distinct from old.entidade
        or new.registro_id is distinct from old.registro_id)
       and coalesce(current_setting('app.mesclagem', true), '') <> 'on'
       and not public.eh_desenvolvedor() then
      raise exception 'Não é permitido alterar o autor ou o registro de um comentário.';
    end if;
    if new.texto is distinct from old.texto then
      new.editado_em := now();
    end if;
  end if;
  return new;
end
$$;

create or replace function public.fin_editar_cobranca(p_ator uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.cobrancas%rowtype;
  v_pago numeric(14, 2);
  v_valor numeric(14, 2);
  v_desconto numeric(14, 2);
  v_acrescimo numeric(14, 2);
  v_venc date;
  v_desc text;
  v_obs text;
  v_muda_outros boolean;
begin
  perform public.servico_contexto(p_ator, 'edge:crm-financeiro');
  select c.* into v_c from public.cobrancas c where c.id = (p ->> 'id')::uuid for update;
  if not found then
    raise exception 'Cobrança não encontrada.';
  end if;
  if v_c.cancelada_em is not null and not public.eh_desenvolvedor_usuario(p_ator) then
    raise exception 'Cobrança cancelada não pode ser alterada.';
  end if;

  v_valor := case when p ? 'valor' then round((p ->> 'valor')::numeric, 2) else v_c.valor end;
  v_desconto := case when p ? 'desconto' then round(coalesce(nullif(p ->> 'desconto', '')::numeric, 0), 2) else v_c.desconto end;
  v_acrescimo := case when p ? 'acrescimo' then round(coalesce(nullif(p ->> 'acrescimo', '')::numeric, 0), 2) else v_c.acrescimo end;
  v_venc := case when p ? 'vencimento' then (p ->> 'vencimento')::date else v_c.vencimento end;
  v_desc := case when p ? 'descricao' then coalesce(nullif(trim(p ->> 'descricao'), ''), v_c.descricao) else v_c.descricao end;
  v_obs := case when p ? 'observacoes' then nullif(trim(coalesce(p ->> 'observacoes', '')), '') else v_c.observacoes end;

  v_muda_outros := (v_valor, v_acrescimo, v_venc, v_desc, v_obs) is distinct from
                   (v_c.valor, v_c.acrescimo, v_c.vencimento, v_c.descricao, v_c.observacoes);
  if v_muda_outros then
    perform public.exigir_permissao(p_ator, 'financeiro.contratos');
  end if;
  if v_desconto is distinct from v_c.desconto then
    perform public.exigir_permissao(p_ator, 'financeiro.desconto');
  end if;
  if v_valor < 0 or v_desconto < 0 or v_acrescimo < 0 then
    raise exception 'Os valores não podem ser negativos.';
  end if;
  if v_desconto > v_valor + v_acrescimo then
    raise exception 'O desconto não pode ser maior que o valor da cobrança.';
  end if;

  select coalesce(sum(pg.valor), 0) into v_pago from public.pagamentos pg
  where pg.cobranca_id = v_c.id and pg.estornado_em is null;
  if v_valor - v_desconto + v_acrescimo < v_pago and not public.eh_desenvolvedor_usuario(p_ator) then
    raise exception 'O novo valor (%) ficaria menor que o total já pago (%).',
      public.formatar_moeda(v_valor - v_desconto + v_acrescimo), public.formatar_moeda(v_pago);
  end if;

  update public.cobrancas c set valor = v_valor, desconto = v_desconto, acrescimo = v_acrescimo,
    vencimento = v_venc, descricao = v_desc, observacoes = v_obs
  where c.id = v_c.id;
end
$$;

create or replace function public.fin_cancelar_cobranca(p_ator uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.cobrancas%rowtype;
begin
  perform public.servico_contexto(p_ator, 'edge:crm-financeiro');
  perform public.exigir_permissao(p_ator, 'financeiro.contratos');
  select c.* into v_c from public.cobrancas c where c.id = (p ->> 'id')::uuid for update;
  if not found or v_c.cancelada_em is not null then
    raise exception 'Cobrança não encontrada ou já cancelada.';
  end if;
  if coalesce(trim(p ->> 'motivo'), '') = '' and not public.eh_desenvolvedor_usuario(p_ator) then
    raise exception 'Informe o motivo do cancelamento.';
  end if;
  if exists (select 1 from public.pagamentos pg where pg.cobranca_id = v_c.id and pg.estornado_em is null)
     and not public.eh_desenvolvedor_usuario(p_ator) then
    raise exception 'Esta cobrança possui pagamentos. Estorne o lançamento ou registre um reembolso antes de cancelar.';
  end if;
  update public.cobrancas c set cancelada_em = now(), cancelada_por = p_ator, motivo_cancelamento = nullif(trim(coalesce(p ->> 'motivo', '')), '')
  where c.id = v_c.id;
end
$$;

create or replace function public.fin_registrar_pagamento(p_ator uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c record;
  v_valor numeric(14, 2) := round(nullif(p ->> 'valor', '')::numeric, 2);
  v_data date := nullif(p ->> 'data_pagamento', '')::date;
  v_id uuid;
  v_arquivo uuid := nullif(p ->> 'comprovante_arquivo_id', '')::uuid;
  v_res jsonb;
begin
  perform public.servico_contexto(p_ator, 'edge:crm-financeiro');
  perform public.exigir_permissao(p_ator, 'financeiro.lancar');
  perform 1 from public.cobrancas c where c.id = (p ->> 'cobranca_id')::uuid for update;
  select v.* into v_c from public.v_cobrancas v where v.id = (p ->> 'cobranca_id')::uuid;
  if v_c.id is null then
    raise exception 'Cobrança não encontrada.';
  end if;
  if v_c.cancelada_em is not null and not public.eh_desenvolvedor_usuario(p_ator) then
    raise exception 'Não é possível registrar pagamento em cobrança cancelada.';
  end if;
  if v_valor is null or v_valor <= 0 then
    raise exception 'Informe um valor maior que zero.';
  end if;
  if v_data is null then
    raise exception 'Informe a data do pagamento.';
  end if;
  if v_data > public.hoje_sp() and not public.eh_desenvolvedor_usuario(p_ator) then
    raise exception 'A data do pagamento não pode ser futura.';
  end if;
  if v_valor > v_c.saldo and not public.eh_desenvolvedor_usuario(p_ator) then
    raise exception 'O valor informado (%) é maior que o saldo em aberto (%).',
      public.formatar_moeda(v_valor), public.formatar_moeda(v_c.saldo);
  end if;
  perform public.fin_validar_comprovante(v_arquivo, v_c.cliente_id);

  insert into public.pagamentos (cobranca_id, cliente_id, caso_id, valor, data_pagamento, forma, comprovante_arquivo_id,
                                 observacao, registrado_por)
  values (v_c.id, v_c.cliente_id, v_c.caso_id, v_valor, v_data, coalesce(nullif(p ->> 'forma', ''), 'pix'), v_arquivo,
          nullif(trim(coalesce(p ->> 'observacao', '')), ''), p_ator)
  returning id into v_id;

  select jsonb_build_object('pagamento_id', v_id, 'situacao', v.situacao, 'saldo', v.saldo, 'valor_pago', v.valor_pago)
    into v_res from public.v_cobrancas v where v.id = v_c.id;
  return v_res;
end
$$;

create or replace function public.fin_estornar_pagamento(p_ator uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.pagamentos%rowtype;
begin
  perform public.servico_contexto(p_ator, 'edge:crm-financeiro');
  perform public.exigir_permissao(p_ator, 'financeiro.lancar');
  select pg.* into v_p from public.pagamentos pg where pg.id = (p ->> 'id')::uuid for update;
  if not found or v_p.estornado_em is not null then
    raise exception 'Pagamento não encontrado ou já estornado.';
  end if;
  if v_p.registrado_por <> p_ator then
    perform public.exigir_permissao(p_ator, 'financeiro.contratos');
  end if;
  if coalesce(trim(p ->> 'motivo'), '') = '' and not public.eh_desenvolvedor_usuario(p_ator) then
    raise exception 'Informe o motivo do estorno.';
  end if;
  if (select coalesce(sum(r.valor), 0) from public.reembolsos r where r.cobranca_id = v_p.cobranca_id) >
     (select coalesce(sum(pg.valor), 0) from public.pagamentos pg
      where pg.cobranca_id = v_p.cobranca_id and pg.estornado_em is null and pg.id <> v_p.id)
     and not public.eh_desenvolvedor_usuario(p_ator) then
    raise exception 'Há reembolsos vinculados a este pagamento. O estorno deixaria o reembolso sem pagamento correspondente.';
  end if;
  update public.pagamentos pg set estornado_em = now(), estornado_por = p_ator, motivo_estorno = nullif(trim(coalesce(p ->> 'motivo', '')), '')
  where pg.id = v_p.id;
end
$$;

create or replace function public.fin_registrar_reembolso(p_ator uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c record;
  v_valor numeric(14, 2) := round(nullif(p ->> 'valor', '')::numeric, 2);
  v_id uuid;
  v_arquivo uuid := nullif(p ->> 'comprovante_arquivo_id', '')::uuid;
begin
  perform public.servico_contexto(p_ator, 'edge:crm-financeiro');
  perform public.exigir_permissao(p_ator, 'financeiro.contratos');
  perform 1 from public.cobrancas c where c.id = (p ->> 'cobranca_id')::uuid for update;
  select v.* into v_c from public.v_cobrancas v where v.id = (p ->> 'cobranca_id')::uuid;
  if v_c.id is null then
    raise exception 'Cobrança não encontrada.';
  end if;
  if v_valor is null or v_valor <= 0 then
    raise exception 'Informe um valor maior que zero.';
  end if;
  if v_valor > v_c.valor_pago - v_c.valor_reembolsado and not public.eh_desenvolvedor_usuario(p_ator) then
    raise exception 'O reembolso (%) não pode superar o valor pago e ainda não reembolsado (%).',
      public.formatar_moeda(v_valor), public.formatar_moeda(v_c.valor_pago - v_c.valor_reembolsado);
  end if;
  if coalesce(trim(p ->> 'motivo'), '') = '' and not public.eh_desenvolvedor_usuario(p_ator) then
    raise exception 'Informe o motivo do reembolso.';
  end if;
  perform public.fin_validar_comprovante(v_arquivo, v_c.cliente_id);
  insert into public.reembolsos (cobranca_id, cliente_id, caso_id, valor, data, forma, motivo, comprovante_arquivo_id, registrado_por)
  values (v_c.id, v_c.cliente_id, v_c.caso_id, v_valor, coalesce(nullif(p ->> 'data', '')::date, public.hoje_sp()),
          coalesce(nullif(p ->> 'forma', ''), 'pix'), coalesce(nullif(trim(p ->> 'motivo'), ''), 'Não informado'), v_arquivo, p_ator)
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.fin_cancelar_despesa(p_ator uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.despesas%rowtype;
begin
  perform public.servico_contexto(p_ator, 'edge:crm-financeiro');
  perform public.exigir_permissao(p_ator, 'financeiro.lancar');
  select d.* into v_d from public.despesas d where d.id = (p ->> 'id')::uuid for update;
  if not found or v_d.cancelada_em is not null then
    raise exception 'Despesa não encontrada ou já cancelada.';
  end if;
  if coalesce(trim(p ->> 'motivo'), '') = '' and not public.eh_desenvolvedor_usuario(p_ator) then
    raise exception 'Informe o motivo do cancelamento.';
  end if;
  if v_d.cobranca_reembolso_id is not null then
    if exists (select 1 from public.pagamentos pg where pg.cobranca_id = v_d.cobranca_reembolso_id and pg.estornado_em is null)
       and not public.eh_desenvolvedor_usuario(p_ator) then
      raise exception 'O reembolso desta despesa já recebeu pagamentos. Estorne-os antes de cancelar.';
    end if;
    update public.cobrancas c set cancelada_em = now(), cancelada_por = p_ator,
      motivo_cancelamento = 'Despesa cancelada' || coalesce(': ' || nullif(trim(p ->> 'motivo'), ''), '')
    where c.id = v_d.cobranca_reembolso_id and c.cancelada_em is null;
  end if;
  update public.despesas d set cancelada_em = now(), cancelada_por = p_ator, motivo_cancelamento = nullif(trim(coalesce(p ->> 'motivo', '')), '')
  where d.id = v_d.id;
end
$$;
