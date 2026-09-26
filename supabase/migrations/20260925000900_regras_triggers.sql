-- =============================================================================
-- CRM Amado & Amado Jr. — 09. Regras de negócio em triggers
-- Códigos sequenciais, linha do tempo, histórico de prazos e documentos,
-- notificações de atribuição/menção e auditoria.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Auxiliares
-- -----------------------------------------------------------------------------

create or replace function public.nome_usuario(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select u.nome from public.usuarios u where u.id = p_id), 'Sem responsável') $$;

create or replace function public.formatar_moeda(p_valor numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || translate(to_char(coalesce(p_valor, 0), 'FM999,999,999,990.00'), ',.', '.,')
$$;

create or replace function public.formatar_data_hora(p_valor timestamptz)
returns text
language sql
stable
set search_path = ''
as $$ select to_char(p_valor at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') $$;

create or replace function public.rotulo_status_documento(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'nao_solicitado' then 'Não solicitado'
    when 'solicitado' then 'Solicitado'
    when 'recebido' then 'Recebido'
    when 'em_revisao' then 'Em revisão'
    when 'aprovado' then 'Aprovado'
    when 'rejeitado' then 'Rejeitado'
    when 'dispensado' then 'Dispensado'
    else p_status
  end
$$;

create or replace function public.rotulo_opcao(p_lista text, p_valor text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select o.rotulo from public.opcoes o where o.lista = p_lista and o.valor = p_valor), p_valor)
$$;

create or replace function public.link_registro(p_entidade text, p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v text;
begin
  case p_entidade
    when 'lead' then v := '/crm/leads?item=' || p_id;
    when 'cliente' then v := '/crm/clientes/' || p_id;
    when 'caso' then v := '/crm/casos/' || p_id;
    when 'tarefa' then v := '/crm/tarefas?item=' || p_id;
    when 'compromisso' then v := '/crm/agenda?item=' || p_id;
    when 'cobranca' then v := '/crm/financeiro?item=' || p_id;
    when 'prazo' then
      select '/crm/casos/' || p.caso_id || '?aba=prazos&prazo=' || p.id into v from public.prazos p where p.id = p_id;
    when 'processo' then
      select '/crm/casos/' || p.caso_id || '?aba=processos' into v from public.processos p where p.id = p_id;
    when 'documento' then
      select case
               when d.caso_id is not null then '/crm/casos/' || d.caso_id || '?aba=documentos'
               when d.cliente_id is not null then '/crm/clientes/' || d.cliente_id || '?aba=documentos'
               else '/crm/leads?item=' || d.lead_id
             end
        into v
        from public.documentos d where d.id = p_id;
    else
      v := '/crm';
  end case;
  return coalesce(v, '/crm');
end
$$;

create or replace function public.registrar_evento(
  p_tipo text,
  p_titulo text,
  p_lead uuid default null,
  p_cliente uuid default null,
  p_caso uuid default null,
  p_entidade text default null,
  p_registro uuid default null,
  p_detalhes jsonb default '{}',
  p_automatico boolean default false,
  p_restrito text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_lead is null and p_cliente is null and p_caso is null then
    return;
  end if;
  insert into public.eventos (tipo, titulo, lead_id, cliente_id, caso_id, entidade, registro_id, detalhes, autor_id, automatico, restrito)
  values (p_tipo, left(p_titulo, 300), p_lead, p_cliente, p_caso, p_entidade, p_registro,
          coalesce(p_detalhes, '{}'), public.usuario_atual(), coalesce(p_automatico, false), p_restrito);
end
$$;

create or replace function public.notificar(
  p_usuario uuid,
  p_tipo text,
  p_titulo text,
  p_mensagem text default null,
  p_link text default null,
  p_entidade text default null,
  p_registro uuid default null,
  p_chave text default null,
  p_automacao uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_usuario is null or not exists (select 1 from public.usuarios u where u.id = p_usuario and u.ativo) then
    return false;
  end if;
  insert into public.notificacoes (usuario_id, tipo, titulo, mensagem, link, entidade, registro_id, chave_dedupe, automacao_id)
  values (p_usuario, p_tipo, left(p_titulo, 200), left(p_mensagem, 1000), p_link, p_entidade, p_registro, p_chave, p_automacao)
  on conflict (usuario_id, chave_dedupe) do nothing;
  return found;
end
$$;

create or replace function public.notificar_atribuicao(p_usuario uuid, p_titulo text, p_entidade text, p_registro uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator uuid := public.usuario_atual();
begin
  if p_usuario is null or p_usuario is not distinct from v_ator then
    return;
  end if;
  perform public.notificar(
    p_usuario, 'atribuicao', p_titulo,
    case when v_ator is null then 'Atribuído automaticamente pelo sistema.' else 'Atribuído por ' || public.nome_usuario(v_ator) || '.' end,
    public.link_registro(p_entidade, p_registro), p_entidade, p_registro, null, null
  );
end
$$;

-- Escolha de responsável para novos leads (usada pela automação de primeiro contato).
create or replace function public.escolher_responsavel(p_config jsonb)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_modo text := coalesce(p_config ->> 'modo', 'nenhum');
  v uuid;
begin
  if v_modo = 'fixo' then
    select u.id into v from public.usuarios u
    where u.id = nullif(p_config ->> 'usuario_id', '')::uuid and u.ativo;
    return v;
  elsif v_modo = 'rodizio' then
    select u.id into v
    from public.usuarios u
    where u.ativo
      and (coalesce(p_config ->> 'perfil_id', '') = '' or u.perfil_id = p_config ->> 'perfil_id')
      and (
        jsonb_typeof(p_config -> 'usuarios') is distinct from 'array'
        or jsonb_array_length(p_config -> 'usuarios') = 0
        or (p_config -> 'usuarios') ? u.id::text
      )
    order by (select max(l.created_at) from public.leads l where l.responsavel_id = u.id) asc nulls first, u.nome
    limit 1;
    return v;
  end if;
  return null;
end
$$;

-- Lista legível de campos alterados (para a linha do tempo).
create or replace function public.campos_alterados(p_antigo jsonb, p_novo jsonb, p_rotulos jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(p_rotulos ->> k, ', ' order by p_rotulos ->> k)
  from jsonb_object_keys(p_rotulos) k
  where (p_antigo -> k) is distinct from (p_novo -> k)
$$;

-- -----------------------------------------------------------------------------
-- Leads
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
      if coalesce(trim(new.motivo_perda), '') = '' then
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

create trigger leads_antes before insert or update on public.leads
  for each row execute function public.tg_leads_antes();

create or replace function public.tg_leads_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auto record;
  v_de text;
  v_para text;
  v_campos text;
  v_rotulos constant jsonb := jsonb_build_object(
    'nome', 'Nome', 'whatsapp', 'WhatsApp', 'email', 'E-mail', 'cpf', 'CPF', 'estado', 'Estado',
    'municipio', 'Município', 'profissao', 'Profissão', 'faixa_renda', 'Faixa de renda', 'origem', 'Origem',
    'tipo_demanda_id', 'Tipo de demanda', 'temperatura', 'Temperatura', 'prioridade', 'Prioridade',
    'proxima_acao', 'Próxima ação', 'proxima_acao_em', 'Data da próxima ação', 'observacoes', 'Observações',
    'etiquetas', 'Etiquetas'
  );
begin
  if tg_op = 'INSERT' then
    perform public.registrar_evento(
      'criacao',
      case new.origem
        when 'quiz_site' then 'Lead recebido pelo quiz do site'
        when 'importacao' then 'Lead importado'
        else 'Lead cadastrado'
      end,
      new.id, null, null, 'lead', new.id, jsonb_build_object('origem', new.origem), public.usuario_atual() is null
    );

    for v_auto in
      select a.* from public.automacoes a where a.tipo = 'lead_novo_primeiro_contato' and a.ativo
    loop
      if jsonb_typeof(v_auto.parametros -> 'origens') = 'array'
         and jsonb_array_length(v_auto.parametros -> 'origens') > 0
         and not ((v_auto.parametros -> 'origens') ? new.origem) then
        continue;
      end if;
      insert into public.tarefas (titulo, descricao, status, prioridade, responsavel_id, prazo, prazo_dia_inteiro,
                                  lead_id, origem, automacao_id)
      values (
        'Primeiro contato: ' || new.nome,
        'Tarefa criada automaticamente pela automação "' || v_auto.nome || '". Registre o contato no histórico do lead ao concluir.',
        'a_fazer',
        coalesce(nullif(v_auto.parametros ->> 'prioridade', ''), 'alta'),
        new.responsavel_id,
        now() + make_interval(hours => greatest(coalesce((v_auto.parametros ->> 'prazo_horas')::integer, 24), 1)),
        false,
        new.id,
        'automacao',
        v_auto.id
      );
      update public.automacoes set ultima_execucao_em = now() where id = v_auto.id;
      insert into public.automacoes_execucoes (automacao_id, itens_afetados) values (v_auto.id, 1);
    end loop;

    if new.responsavel_id is not null then
      perform public.notificar_atribuicao(new.responsavel_id, 'Novo lead atribuído a você: ' || new.nome, 'lead', new.id);
    end if;
    return null;
  end if;

  if new.etapa_id is distinct from old.etapa_id then
    select e.nome into v_de from public.etapas e where e.id = old.etapa_id;
    select e.nome into v_para from public.etapas e where e.id = new.etapa_id;
    perform public.registrar_evento('etapa', format('Etapa: %s → %s', coalesce(v_de, '—'), coalesce(v_para, '—')),
      new.id, new.cliente_id, null, 'lead', new.id,
      jsonb_build_object('de', old.etapa_id, 'para', new.etapa_id, 'motivo_perda', new.motivo_perda));
  end if;

  if new.responsavel_id is distinct from old.responsavel_id then
    perform public.registrar_evento('responsavel',
      format('Responsável: %s → %s', public.nome_usuario(old.responsavel_id), public.nome_usuario(new.responsavel_id)),
      new.id, new.cliente_id, null, 'lead', new.id, '{}'::jsonb, public.usuario_atual() is null);
    perform public.notificar_atribuicao(new.responsavel_id, 'Lead atribuído a você: ' || new.nome, 'lead', new.id);
  end if;

  if new.arquivado_em is distinct from old.arquivado_em then
    perform public.registrar_evento('arquivamento',
      case when new.arquivado_em is null then 'Lead restaurado' else 'Lead arquivado' end,
      new.id, new.cliente_id, null, 'lead', new.id);
  end if;

  if new.cliente_id is not null and old.cliente_id is null then
    perform public.registrar_evento('conversao', 'Lead convertido em cliente',
      new.id, new.cliente_id, null, 'lead', new.id);
  end if;

  if new.mesclado_em_id is not null and old.mesclado_em_id is null then
    perform public.registrar_evento('mesclagem', 'Lead mesclado em outro registro duplicado',
      new.id, null, null, 'lead', new.id, jsonb_build_object('destino', new.mesclado_em_id));
  end if;

  v_campos := public.campos_alterados(to_jsonb(old), to_jsonb(new), v_rotulos);
  if v_campos is not null then
    perform public.registrar_evento('campo', 'Dados atualizados: ' || v_campos,
      new.id, null, null, 'lead', new.id);
  end if;
  return null;
end
$$;

create trigger leads_depois after insert or update on public.leads
  for each row execute function public.tg_leads_depois();

-- -----------------------------------------------------------------------------
-- Clientes
-- -----------------------------------------------------------------------------

create or replace function public.tg_clientes_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.codigo := coalesce(new.codigo, 'C-' || lpad(nextval('public.clientes_codigo_seq')::text, 5, '0'));
    new.created_by := coalesce(new.created_by, public.usuario_atual());
  else
    if new.arquivado_em is not null and old.arquivado_em is null then
      new.arquivado_por := public.usuario_atual();
    elsif new.arquivado_em is null then
      new.arquivado_por := null;
    end if;
  end if;
  if new.cpf_cnpj is not null and trim(new.cpf_cnpj) = '' then
    new.cpf_cnpj := null;
  end if;
  return new;
end
$$;

create trigger clientes_antes before insert or update on public.clientes
  for each row execute function public.tg_clientes_antes();

create or replace function public.tg_clientes_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campos text;
  v_rotulos constant jsonb := jsonb_build_object(
    'nome', 'Nome', 'nome_social', 'Nome social', 'cpf_cnpj', 'CPF/CNPJ', 'rg', 'RG',
    'data_nascimento', 'Data de nascimento', 'email', 'E-mail', 'whatsapp', 'WhatsApp',
    'telefone_secundario', 'Telefone secundário', 'cep', 'CEP', 'logradouro', 'Endereço', 'numero', 'Número',
    'complemento', 'Complemento', 'bairro', 'Bairro', 'cidade', 'Cidade', 'uf', 'UF',
    'profissao', 'Profissão', 'estado_civil', 'Estado civil', 'nacionalidade', 'Nacionalidade',
    'possui_representante', 'Representante legal', 'representante_nome', 'Nome do representante',
    'status', 'Situação', 'observacoes', 'Observações', 'etiquetas', 'Etiquetas'
  );
begin
  if tg_op = 'INSERT' then
    perform public.registrar_evento('criacao',
      case new.origem when 'importacao' then 'Cliente importado de planilha' when 'lead' then 'Cliente criado a partir de lead' else 'Cliente cadastrado' end,
      new.lead_origem_id, new.id, null, 'cliente', new.id);
    perform public.notificar_atribuicao(new.responsavel_id, 'Cliente sob sua responsabilidade: ' || new.nome, 'cliente', new.id);
    return null;
  end if;

  if new.responsavel_id is distinct from old.responsavel_id then
    perform public.registrar_evento('responsavel',
      format('Responsável: %s → %s', public.nome_usuario(old.responsavel_id), public.nome_usuario(new.responsavel_id)),
      null, new.id, null, 'cliente', new.id);
    perform public.notificar_atribuicao(new.responsavel_id, 'Cliente sob sua responsabilidade: ' || new.nome, 'cliente', new.id);
  end if;

  if new.arquivado_em is distinct from old.arquivado_em then
    perform public.registrar_evento('arquivamento',
      case when new.arquivado_em is null then 'Cliente restaurado' else 'Cliente arquivado' end,
      null, new.id, null, 'cliente', new.id);
  end if;

  v_campos := public.campos_alterados(to_jsonb(old), to_jsonb(new), v_rotulos);
  if v_campos is not null then
    perform public.registrar_evento('campo', 'Dados atualizados: ' || v_campos, null, new.id, null, 'cliente', new.id);
  end if;
  return null;
end
$$;

create trigger clientes_depois after insert or update on public.clientes
  for each row execute function public.tg_clientes_depois();

create or replace function public.tg_dados_clinicos_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := public.usuario_atual();
  return new;
end
$$;

create trigger dados_clinicos_antes before insert or update on public.dados_clinicos
  for each row execute function public.tg_dados_clinicos_antes();

create or replace function public.tg_dados_clinicos_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.registrar_evento('clinico', 'Dados clínicos atualizados', null, new.cliente_id, null,
    'cliente', new.cliente_id, '{}'::jsonb, false, 'saude');
  return null;
end
$$;

create trigger dados_clinicos_depois after insert or update on public.dados_clinicos
  for each row execute function public.tg_dados_clinicos_depois();

-- -----------------------------------------------------------------------------
-- Contatos / interações
-- -----------------------------------------------------------------------------

create or replace function public.tg_interacoes_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.usuario_id := coalesce(new.usuario_id, public.usuario_atual());
  if new.cliente_id is null and new.caso_id is not null then
    select c.cliente_id into new.cliente_id from public.casos c where c.id = new.caso_id;
  end if;
  return new;
end
$$;

create trigger interacoes_antes before insert on public.interacoes
  for each row execute function public.tg_interacoes_antes();

create or replace function public.tg_interacoes_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contato boolean;
begin
  select coalesce((o.meta ->> 'contato')::boolean, true) into v_contato
  from public.opcoes o where o.lista = 'tipo_interacao' and o.valor = new.tipo;
  v_contato := coalesce(v_contato, new.tipo <> 'nota');

  if new.lead_id is not null then
    update public.leads l set
      primeiro_contato_em = case when v_contato then least(coalesce(l.primeiro_contato_em, new.ocorrida_em), new.ocorrida_em) else l.primeiro_contato_em end,
      ultimo_contato_em = case when v_contato then greatest(coalesce(l.ultimo_contato_em, new.ocorrida_em), new.ocorrida_em) else l.ultimo_contato_em end,
      ultima_atividade_em = now()
    where l.id = new.lead_id;
  end if;

  perform public.registrar_evento('contato',
    public.rotulo_opcao('tipo_interacao', new.tipo) || ': ' || left(new.resumo, 160),
    new.lead_id, new.cliente_id, new.caso_id, 'interacao', new.id,
    jsonb_build_object('tipo', new.tipo, 'resultado', new.resultado));
  return null;
end
$$;

create trigger interacoes_depois after insert on public.interacoes
  for each row execute function public.tg_interacoes_depois();

-- -----------------------------------------------------------------------------
-- Casos, processos e andamentos
-- -----------------------------------------------------------------------------

create or replace function public.tg_casos_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.codigo := coalesce(new.codigo, 'CS-' || lpad(nextval('public.casos_codigo_seq')::text, 5, '0'));
    new.created_by := coalesce(new.created_by, public.usuario_atual());
    if new.fase_id is null then
      new.fase_id := public.etapa_inicial('caso');
    end if;
    new.fase_alterada_em := now();
  else
    if new.fase_id is distinct from old.fase_id then
      new.fase_alterada_em := now();
    end if;
    if new.arquivado_em is not null and old.arquivado_em is null then
      new.arquivado_por := public.usuario_atual();
    elsif new.arquivado_em is null then
      new.arquivado_por := null;
    end if;
  end if;
  if new.status = 'concluido' and (tg_op = 'INSERT' or old.status is distinct from 'concluido') then
    new.data_encerramento := coalesce(new.data_encerramento, public.hoje_sp());
  elsif new.status <> 'concluido' and tg_op = 'UPDATE' and old.status = 'concluido' then
    new.data_encerramento := null;
  end if;
  return new;
end
$$;

create trigger casos_antes before insert or update on public.casos
  for each row execute function public.tg_casos_antes();

create or replace function public.tg_casos_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_de text;
  v_para text;
  v_campos text;
  v_rotulos constant jsonb := jsonb_build_object(
    'titulo', 'Título', 'objeto', 'Objeto', 'tipo_demanda_id', 'Tipo de demanda', 'prioridade', 'Prioridade',
    'equipe', 'Equipe', 'data_protocolo', 'Data de protocolo', 'resultado', 'Resultado',
    'valor_causa', 'Valor da causa', 'segredo_justica', 'Segredo de justiça', 'links', 'Links externos',
    'observacoes', 'Observações', 'etiquetas', 'Etiquetas'
  );
begin
  if tg_op = 'INSERT' then
    perform public.registrar_evento('criacao',
      format('%s aberto: %s', case new.natureza when 'judicial' then 'Processo judicial' else 'Caso interno' end, new.titulo),
      new.lead_id, new.cliente_id, new.id, 'caso', new.id);
    perform public.notificar_atribuicao(new.responsavel_id, 'Caso sob sua responsabilidade: ' || new.titulo, 'caso', new.id);
    return null;
  end if;

  if new.fase_id is distinct from old.fase_id then
    select e.nome into v_de from public.etapas e where e.id = old.fase_id;
    select e.nome into v_para from public.etapas e where e.id = new.fase_id;
    perform public.registrar_evento('fase', format('Fase: %s → %s', coalesce(v_de, '—'), coalesce(v_para, '—')),
      null, new.cliente_id, new.id, 'caso', new.id, jsonb_build_object('de', old.fase_id, 'para', new.fase_id));
  end if;

  if new.status is distinct from old.status then
    perform public.registrar_evento('status',
      format('Situação do caso: %s → %s',
        case old.status when 'ativo' then 'Ativo' when 'suspenso' then 'Suspenso' else 'Concluído' end,
        case new.status when 'ativo' then 'Ativo' when 'suspenso' then 'Suspenso' else 'Concluído' end),
      null, new.cliente_id, new.id, 'caso', new.id);
  end if;

  if new.natureza is distinct from old.natureza then
    perform public.registrar_evento('natureza',
      case new.natureza when 'judicial' then 'Caso interno passou a ser processo judicial' else 'Registro alterado para caso interno' end,
      null, new.cliente_id, new.id, 'caso', new.id);
  end if;

  if new.responsavel_id is distinct from old.responsavel_id then
    perform public.registrar_evento('responsavel',
      format('Responsável: %s → %s', public.nome_usuario(old.responsavel_id), public.nome_usuario(new.responsavel_id)),
      null, new.cliente_id, new.id, 'caso', new.id);
    perform public.notificar_atribuicao(new.responsavel_id, 'Caso sob sua responsabilidade: ' || new.titulo, 'caso', new.id);
  end if;

  if new.arquivado_em is distinct from old.arquivado_em then
    perform public.registrar_evento('arquivamento',
      case when new.arquivado_em is null then 'Caso restaurado' else 'Caso arquivado' end,
      null, new.cliente_id, new.id, 'caso', new.id);
  end if;

  v_campos := public.campos_alterados(to_jsonb(old), to_jsonb(new), v_rotulos);
  if v_campos is not null then
    perform public.registrar_evento('campo', 'Dados do caso atualizados: ' || v_campos, null, new.cliente_id, new.id, 'caso', new.id);
  end if;
  return null;
end
$$;

create trigger casos_depois after insert or update on public.casos
  for each row execute function public.tg_casos_depois();

create or replace function public.tg_processos_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, public.usuario_atual());
    if not exists (select 1 from public.processos p where p.caso_id = new.caso_id) then
      new.principal := true;
    end if;
  end if;
  if new.numero is not null and trim(new.numero) = '' then
    new.numero := null;
  end if;
  if new.principal and (tg_op = 'INSERT' or not old.principal) then
    update public.processos p set principal = false
    where p.caso_id = new.caso_id and p.id <> new.id and p.principal;
  end if;
  return new;
end
$$;

create trigger processos_antes before insert or update on public.processos
  for each row execute function public.tg_processos_antes();

create or replace function public.tg_processos_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente uuid;
begin
  select c.cliente_id into v_cliente from public.casos c where c.id = new.caso_id;
  if tg_op = 'INSERT' then
    perform public.registrar_evento('processo',
      'Processo cadastrado' || coalesce(': nº ' || new.numero, ' (sem número)') || coalesce(' — ' || new.tribunal, ''),
      null, v_cliente, new.caso_id, 'processo', new.id);
    update public.casos c set natureza = 'judicial' where c.id = new.caso_id and c.natureza <> 'judicial';
  elsif new.numero is distinct from old.numero then
    perform public.registrar_evento('processo',
      format('Número do processo: %s → %s', coalesce(old.numero, 'sem número'), coalesce(new.numero, 'sem número')),
      null, v_cliente, new.caso_id, 'processo', new.id);
  elsif new.situacao is distinct from old.situacao then
    perform public.registrar_evento('processo',
      format('Situação do processo %s alterada', coalesce(new.numero, '')),
      null, v_cliente, new.caso_id, 'processo', new.id, jsonb_build_object('de', old.situacao, 'para', new.situacao));
  end if;
  return null;
end
$$;

create trigger processos_depois after insert or update on public.processos
  for each row execute function public.tg_processos_depois();

create or replace function public.tg_andamentos_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente uuid;
begin
  select c.cliente_id into v_cliente from public.casos c where c.id = new.caso_id;
  perform public.registrar_evento('andamento',
    'Andamento (' || public.rotulo_opcao('tipo_andamento', new.tipo) || '): ' || left(new.descricao, 160),
    null, v_cliente, new.caso_id, 'andamento', new.id,
    jsonb_build_object('data', new.data, 'fonte', new.fonte, 'importante', new.importante));
  return null;
end
$$;

create trigger andamentos_depois after insert on public.andamentos
  for each row execute function public.tg_andamentos_depois();

-- -----------------------------------------------------------------------------
-- Tarefas
-- -----------------------------------------------------------------------------

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
      if v_dep_status is not null and v_dep_status not in ('concluida', 'cancelada') then
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

create trigger tarefas_antes before insert or update on public.tarefas
  for each row execute function public.tg_tarefas_antes();

create or replace function public.tg_tarefas_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar_evento('tarefa',
      case when new.origem = 'automacao' then 'Tarefa criada automaticamente: ' else 'Tarefa criada: ' end || new.titulo,
      new.lead_id, new.cliente_id, new.caso_id, 'tarefa', new.id,
      jsonb_build_object('responsavel_id', new.responsavel_id, 'prazo', new.prazo), new.origem = 'automacao');
    perform public.notificar_atribuicao(new.responsavel_id, 'Nova tarefa: ' || new.titulo, 'tarefa', new.id);
    return null;
  end if;

  if new.status = 'concluida' and old.status is distinct from 'concluida' then
    perform public.registrar_evento('tarefa', 'Tarefa concluída: ' || new.titulo,
      new.lead_id, new.cliente_id, new.caso_id, 'tarefa', new.id);
    if new.lead_id is not null then
      update public.leads l set ultima_atividade_em = now() where l.id = new.lead_id;
    end if;
  end if;

  if new.responsavel_id is distinct from old.responsavel_id then
    perform public.notificar_atribuicao(new.responsavel_id, 'Tarefa atribuída a você: ' || new.titulo, 'tarefa', new.id);
  end if;
  return null;
end
$$;

create trigger tarefas_depois after insert or update on public.tarefas
  for each row execute function public.tg_tarefas_depois();

-- -----------------------------------------------------------------------------
-- Agenda
-- -----------------------------------------------------------------------------

create or replace function public.tg_compromissos_antes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, public.usuario_atual());
    new.responsavel_id := coalesce(new.responsavel_id, new.created_by);
  end if;
  if new.cliente_id is null and new.caso_id is not null then
    select c.cliente_id into new.cliente_id from public.casos c where c.id = new.caso_id;
  end if;
  return new;
end
$$;

create trigger compromissos_antes before insert or update on public.compromissos
  for each row execute function public.tg_compromissos_antes();

create or replace function public.tg_compromissos_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participante uuid;
  v_rotulo text := public.rotulo_opcao('tipo_compromisso', new.tipo);
begin
  if tg_op = 'INSERT' then
    perform public.registrar_evento('agenda',
      format('%s agendado(a): %s — %s', v_rotulo, new.titulo, public.formatar_data_hora(new.inicio)),
      new.lead_id, new.cliente_id, new.caso_id, 'compromisso', new.id);
    perform public.notificar_atribuicao(new.responsavel_id,
      format('%s: %s (%s)', v_rotulo, new.titulo, public.formatar_data_hora(new.inicio)), 'compromisso', new.id);
    foreach v_participante in array new.participantes loop
      if v_participante is distinct from new.responsavel_id then
        perform public.notificar_atribuicao(v_participante,
          format('Você participa de: %s (%s)', new.titulo, public.formatar_data_hora(new.inicio)), 'compromisso', new.id);
      end if;
    end loop;
    return null;
  end if;

  if new.inicio is distinct from old.inicio then
    perform public.registrar_evento('agenda',
      format('%s remarcado(a): %s — %s', v_rotulo, new.titulo, public.formatar_data_hora(new.inicio)),
      new.lead_id, new.cliente_id, new.caso_id, 'compromisso', new.id);
  end if;
  if new.status is distinct from old.status then
    perform public.registrar_evento('agenda',
      format('%s "%s": %s', v_rotulo, new.titulo,
        case new.status when 'realizado' then 'realizado' when 'cancelado' then 'cancelado'
          when 'remarcado' then 'remarcado' when 'nao_compareceu' then 'não compareceu' else 'agendado' end),
      new.lead_id, new.cliente_id, new.caso_id, 'compromisso', new.id);
  end if;
  if new.responsavel_id is distinct from old.responsavel_id then
    perform public.notificar_atribuicao(new.responsavel_id,
      format('%s: %s (%s)', v_rotulo, new.titulo, public.formatar_data_hora(new.inicio)), 'compromisso', new.id);
  end if;
  return null;
end
$$;

create trigger compromissos_depois after insert or update on public.compromissos
  for each row execute function public.tg_compromissos_depois();

-- -----------------------------------------------------------------------------
-- Prazos processuais: conferência, correções com motivo e histórico
-- -----------------------------------------------------------------------------

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
    if v_motivo is null then
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

create trigger prazos_antes before insert or update on public.prazos
  for each row execute function public.tg_prazos_antes();

create or replace function public.tg_prazos_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente uuid;
begin
  select c.cliente_id into v_cliente from public.casos c where c.id = new.caso_id;
  if tg_op = 'INSERT' then
    insert into public.prazos_historico (prazo_id, campo, valor_anterior, valor_novo, motivo, usuario_id)
    values (new.id, 'criacao', null, public.formatar_data_hora(new.vencimento), null, public.usuario_atual());
    perform public.registrar_evento('prazo',
      format('Prazo cadastrado: %s — vence em %s%s', new.titulo, public.formatar_data_hora(new.vencimento),
        case when new.conferido then '' else ' (aguardando conferência)' end),
      null, v_cliente, new.caso_id, 'prazo', new.id);
    perform public.notificar_atribuicao(new.responsavel_id,
      format('Prazo sob sua responsabilidade: %s (%s)', new.titulo, public.formatar_data_hora(new.vencimento)), 'prazo', new.id);
    return null;
  end if;

  if new.vencimento is distinct from old.vencimento then
    perform public.registrar_evento('prazo',
      format('Prazo corrigido: %s — de %s para %s', new.titulo, public.formatar_data_hora(old.vencimento), public.formatar_data_hora(new.vencimento)),
      null, v_cliente, new.caso_id, 'prazo', new.id);
  end if;
  if new.conferido and not old.conferido then
    perform public.registrar_evento('prazo',
      format('Prazo conferido por %s: %s', public.nome_usuario(new.conferido_por), new.titulo),
      null, v_cliente, new.caso_id, 'prazo', new.id);
  end if;
  if new.status is distinct from old.status then
    perform public.registrar_evento('prazo',
      format('Prazo %s: %s', case new.status when 'cumprido' then 'cumprido' when 'cancelado' then 'cancelado' else 'reaberto' end, new.titulo),
      null, v_cliente, new.caso_id, 'prazo', new.id);
  end if;
  if new.responsavel_id is distinct from old.responsavel_id then
    perform public.notificar_atribuicao(new.responsavel_id,
      format('Prazo sob sua responsabilidade: %s (%s)', new.titulo, public.formatar_data_hora(new.vencimento)), 'prazo', new.id);
  end if;
  return null;
end
$$;

create trigger prazos_depois after insert or update on public.prazos
  for each row execute function public.tg_prazos_depois();

-- -----------------------------------------------------------------------------
-- Documentos: situação, responsáveis por cada etapa e histórico
-- -----------------------------------------------------------------------------

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
    if new.status = 'rejeitado' and coalesce(trim(new.rejeitado_motivo), '') = '' then
      raise exception 'Informe o motivo da rejeição do documento.';
    end if;
    if new.status = 'dispensado' and coalesce(trim(new.dispensado_motivo), '') = '' then
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

create trigger documentos_antes before insert or update on public.documentos
  for each row execute function public.tg_documentos_antes();

create or replace function public.tg_documentos_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_via text := coalesce(nullif(current_setting('app.via', true), ''), case when public.usuario_atual() is null then 'sistema' else 'crm' end);
begin
  if tg_op = 'INSERT' then
    insert into public.documentos_historico (documento_id, de, para, via, usuario_id)
    values (new.id, null, new.status, v_via, public.usuario_atual());
    return null;
  end if;
  if new.status is distinct from old.status then
    insert into public.documentos_historico (documento_id, de, para, via, comentario, usuario_id)
    values (new.id, old.status, new.status, v_via,
            case new.status when 'rejeitado' then new.rejeitado_motivo when 'dispensado' then new.dispensado_motivo end,
            public.usuario_atual());
    perform public.registrar_evento('documento',
      format('Documento "%s": %s → %s', new.nome, public.rotulo_status_documento(old.status), public.rotulo_status_documento(new.status)),
      new.lead_id, new.cliente_id, new.caso_id, 'documento', new.id,
      jsonb_build_object('de', old.status, 'para', new.status, 'via', v_via), v_via in ('automacao', 'sistema'),
      case when new.clinico then 'saude' when new.financeiro then 'financeiro' end);
  end if;
  return null;
end
$$;

create trigger documentos_depois after insert or update on public.documentos
  for each row execute function public.tg_documentos_depois();

-- -----------------------------------------------------------------------------
-- Arquivos: versões e vínculo com documentos
-- -----------------------------------------------------------------------------

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

  if new.bucket is distinct from old.bucket or new.caminho is distinct from old.caminho
     or new.documento_id is distinct from old.documento_id or new.versao is distinct from old.versao then
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

create trigger arquivos_antes before insert or update on public.arquivos
  for each row execute function public.tg_arquivos_antes();

create or replace function public.tg_arquivos_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.documento_id is not null then
      update public.documentos d
         set status = 'recebido',
             enviado_pelo_cliente = new.enviado_pelo_cliente
       where d.id = new.documento_id
         and d.status in ('nao_solicitado', 'solicitado', 'rejeitado', 'aprovado');
    end if;
    if new.tipo not in ('comprovante_financeiro') then
      perform public.registrar_evento('arquivo',
        format('Arquivo %s: %s%s', case when new.enviado_pelo_cliente then 'enviado pelo cliente' else 'anexado' end,
          new.nome, case when new.versao > 1 then ' (versão ' || new.versao || ')' else '' end),
        new.lead_id, new.cliente_id, new.caso_id, 'arquivo', new.id, '{}'::jsonb, false,
        case when new.financeiro then 'financeiro' when new.clinico then 'saude' end);
    end if;
  elsif new.removido_em is distinct from old.removido_em then
    perform public.registrar_evento('arquivo',
      case when new.removido_em is null then 'Arquivo restaurado: ' else 'Arquivo removido: ' end || new.nome,
      new.lead_id, new.cliente_id, new.caso_id, 'arquivo', new.id, '{}'::jsonb, false,
      case when new.financeiro then 'financeiro' when new.clinico then 'saude' end);
  end if;
  return null;
end
$$;

create trigger arquivos_depois after insert or update on public.arquivos
  for each row execute function public.tg_arquivos_depois();

create or replace function public.tg_midias_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente uuid := new.cliente_id;
begin
  if v_cliente is null and new.caso_id is not null then
    select c.cliente_id into v_cliente from public.casos c where c.id = new.caso_id;
  end if;
  perform public.registrar_evento('midia', 'Vídeo/mídia adicionado: ' || new.titulo,
    null, v_cliente, new.caso_id, 'midia', new.id, '{}'::jsonb, false,
    case when new.visibilidade = 'saude' then 'saude' end);
  return null;
end
$$;

create trigger midias_depois after insert on public.midias
  for each row execute function public.tg_midias_depois();

-- -----------------------------------------------------------------------------
-- Comentários: menções geram notificação
-- -----------------------------------------------------------------------------

create or replace function public.tg_comentarios_depois()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid;
begin
  if tg_op = 'INSERT' then
    foreach v_usuario in array new.mencoes loop
      if v_usuario is distinct from new.autor_id then
        perform public.notificar(v_usuario, 'mencao',
          public.nome_usuario(new.autor_id) || ' mencionou você em um comentário',
          left(new.texto, 180), public.link_registro(new.entidade, new.registro_id), new.entidade, new.registro_id, null, null);
      end if;
    end loop;
    if new.entidade = 'lead' then
      update public.leads l set ultima_atividade_em = now() where l.id = new.registro_id;
    end if;
  end if;
  return null;
end
$$;

create trigger comentarios_depois after insert on public.comentarios
  for each row execute function public.tg_comentarios_depois();

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
       and coalesce(current_setting('app.mesclagem', true), '') <> 'on' then
      raise exception 'Não é permitido alterar o autor ou o registro de um comentário.';
    end if;
    if new.texto is distinct from old.texto then
      new.editado_em := now();
    end if;
  end if;
  return new;
end
$$;

create trigger comentarios_antes before insert or update on public.comentarios
  for each row execute function public.tg_comentarios_antes();

-- -----------------------------------------------------------------------------
-- Financeiro: eventos restritos na linha do tempo
-- -----------------------------------------------------------------------------

create or replace function public.tg_financeiro_eventos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- IFs aninhados por tabela: cada expressão só referencia colunas da própria
  -- tabela (o PL/pgSQL não garante curto-circuito entre condições com AND).
  if tg_table_name = 'contratos' then
    if tg_op = 'INSERT' then
      perform public.registrar_evento('financeiro',
        format('Contrato registrado: %s — %s', new.descricao, public.formatar_moeda(new.valor_total)),
        null, new.cliente_id, new.caso_id, 'contrato', new.id, '{}'::jsonb, false, 'financeiro');
    elsif new.status is distinct from old.status then
      perform public.registrar_evento('financeiro',
        format('Contrato "%s": situação alterada para %s', new.descricao, new.status),
        null, new.cliente_id, new.caso_id, 'contrato', new.id, '{}'::jsonb, false, 'financeiro');
    end if;

  elsif tg_table_name = 'pagamentos' then
    if tg_op = 'INSERT' then
      perform public.registrar_evento('financeiro',
        format('Pagamento registrado: %s (%s)', public.formatar_moeda(new.valor), public.rotulo_opcao('forma_pagamento', new.forma)),
        null, new.cliente_id, new.caso_id, 'pagamento', new.id, jsonb_build_object('cobranca_id', new.cobranca_id), false, 'financeiro');
    elsif new.estornado_em is not null and old.estornado_em is null then
      perform public.registrar_evento('financeiro',
        format('Pagamento estornado: %s — %s', public.formatar_moeda(new.valor), coalesce(new.motivo_estorno, '')),
        null, new.cliente_id, new.caso_id, 'pagamento', new.id, jsonb_build_object('cobranca_id', new.cobranca_id), false, 'financeiro');
    end if;

  elsif tg_table_name = 'cobrancas' then
    if new.cancelada_em is not null and old.cancelada_em is null then
      perform public.registrar_evento('financeiro',
        format('Cobrança cancelada: %s — %s', new.descricao, coalesce(new.motivo_cancelamento, '')),
        null, new.cliente_id, new.caso_id, 'cobranca', new.id, '{}'::jsonb, false, 'financeiro');
    end if;

  elsif tg_table_name = 'reembolsos' then
    perform public.registrar_evento('financeiro',
      format('Reembolso ao cliente: %s — %s', public.formatar_moeda(new.valor), new.motivo),
      null, new.cliente_id, new.caso_id, 'reembolso', new.id, jsonb_build_object('cobranca_id', new.cobranca_id), false, 'financeiro');

  elsif tg_table_name = 'despesas' then
    perform public.registrar_evento('financeiro',
      format('%s registrada: %s — %s (pago por %s)',
        case new.categoria when 'custas' then 'Custas' else 'Despesa' end, new.descricao,
        public.formatar_moeda(new.valor), case new.pago_por when 'escritorio' then 'escritório' else 'cliente' end),
      null, new.cliente_id, new.caso_id, 'despesa', new.id, '{}'::jsonb, false, 'financeiro');
  end if;
  return null;
end
$$;

create trigger contratos_eventos after insert or update on public.contratos
  for each row execute function public.tg_financeiro_eventos();
create trigger pagamentos_eventos after insert or update on public.pagamentos
  for each row execute function public.tg_financeiro_eventos();
create trigger cobrancas_eventos after update on public.cobrancas
  for each row execute function public.tg_financeiro_eventos();
create trigger reembolsos_eventos after insert on public.reembolsos
  for each row execute function public.tg_financeiro_eventos();
create trigger despesas_eventos after insert on public.despesas
  for each row execute function public.tg_financeiro_eventos();

-- -----------------------------------------------------------------------------
-- Auditoria genérica
-- Argumento "sensivel": registra apenas os nomes dos campos alterados.
-- -----------------------------------------------------------------------------

create or replace function public.tg_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sensivel boolean := coalesce(tg_argv[0], '') = 'sensivel';
  v_antigo jsonb;
  v_novo jsonb;
  v_alteracoes jsonb := '{}';
  v_id text;
  k text;
  v_ignorar constant text[] := array['updated_at', 'versao', 'token_hash', 'telefone_norm', 'telefone_chave',
                                     'email_norm', 'cpf_norm', 'cpf_cnpj_norm', 'numero_norm', 'ultima_atividade_em',
                                     'ultimo_acesso_em'];
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_antigo := to_jsonb(old) - v_ignorar;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_novo := to_jsonb(new) - v_ignorar;
  end if;

  v_id := coalesce(
    v_novo ->> 'id', v_antigo ->> 'id',
    v_novo ->> 'chave', v_antigo ->> 'chave',
    case when tg_table_name = 'dados_clinicos' then coalesce(v_novo ->> 'cliente_id', v_antigo ->> 'cliente_id') end,
    case when tg_table_name = 'valores_personalizados' then coalesce(v_novo ->> 'registro_id', v_antigo ->> 'registro_id') end,
    case when tg_table_name = 'opcoes' then coalesce(v_novo ->> 'lista', v_antigo ->> 'lista') || ':' || coalesce(v_novo ->> 'valor', v_antigo ->> 'valor') end
  );

  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_novo) loop
      if (v_novo -> k) is distinct from (v_antigo -> k) then
        v_alteracoes := v_alteracoes || jsonb_build_object(k,
          case when v_sensivel then jsonb_build_object('alterado', true)
               else jsonb_build_object('de', v_antigo -> k, 'para', v_novo -> k) end);
      end if;
    end loop;
    if v_alteracoes = '{}'::jsonb then
      return null;
    end if;
  elsif tg_op = 'INSERT' then
    v_alteracoes := case when v_sensivel
      then jsonb_build_object('campos', (select jsonb_agg(x) from jsonb_object_keys(v_novo) x))
      else v_novo end;
  else
    v_alteracoes := case when v_sensivel then '{}'::jsonb else v_antigo end;
  end if;

  insert into public.auditoria (tabela, registro_id, acao, usuario_id, alteracoes, contexto)
  values (tg_table_name, v_id, tg_op, public.usuario_atual(), v_alteracoes,
          nullif(current_setting('app.contexto', true), ''));
  return null;
end
$$;

do $$
declare
  t text;
begin
  -- Tabelas com dados pessoais/clínicos: somente os nomes dos campos.
  foreach t in array array['leads', 'clientes', 'dados_clinicos', 'arquivos', 'midias', 'valores_personalizados'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.tg_auditoria(%L)',
                   t || '_auditoria', t, 'sensivel');
  end loop;
  -- Demais tabelas relevantes: valores anteriores e novos.
  foreach t in array array[
    'casos', 'processos', 'prazos', 'documentos', 'solicitacoes_documentos',
    'contratos', 'cobrancas', 'pagamentos', 'reembolsos', 'despesas',
    'usuarios', 'perfis', 'configuracoes', 'etapas', 'opcoes', 'etiquetas', 'campos_personalizados',
    'tipos_demanda', 'categorias_documento', 'modelos_checklist', 'modelos_checklist_grupos',
    'modelos_checklist_itens', 'modelos_tarefas', 'automacoes', 'feriados'
  ] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.tg_auditoria()',
                   t || '_auditoria', t);
  end loop;
end
$$;

-- Registro de exportações (sem dados pessoais).
create or replace function public.registrar_exportacao(p_quadro text, p_quantidade integer, p_formato text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.tem_permissao('dados.exportar') then
    raise exception 'Você não tem permissão para exportar dados.' using errcode = '42501';
  end if;
  insert into public.auditoria (tabela, registro_id, acao, usuario_id, alteracoes)
  values (left(p_quadro, 40), null, 'EXPORT', auth.uid(),
          jsonb_build_object('quantidade', p_quantidade, 'formato', left(p_formato, 10)));
end
$$;
