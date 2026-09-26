-- =============================================================================
-- CRM Amado & Amado Jr. — 12. Automações configuráveis
-- Regras seguras e parametrizáveis pelo administrador. Geram tarefas e
-- notificações internas; nenhuma mensagem externa é enviada.
-- Deduplicação: notificacoes(usuario_id, chave_dedupe) é única.
-- =============================================================================

create or replace function public.admins_ativos()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(array_agg(u.id), '{}') from public.usuarios u where u.ativo and u.perfil_id = 'admin' $$;

-- Lead sem atividade há N dias
create or replace function public.auto_lead_parado(a public.automacoes)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dias integer := greatest(coalesce(nullif(a.parametros ->> 'dias', '')::integer, 3), 1);
  v record;
  v_dest uuid;
  v_n integer := 0;
begin
  for v in
    select l.id, l.nome, l.responsavel_id, l.ultima_atividade_em, e.nome as etapa
    from public.leads l
    join public.etapas e on e.id = l.etapa_id
    where l.arquivado_em is null and l.mesclado_em_id is null and e.categoria = 'aberta'
      and l.ultima_atividade_em < now() - make_interval(days => v_dias)
      and (jsonb_typeof(a.parametros -> 'etapas') is distinct from 'array'
           or jsonb_array_length(a.parametros -> 'etapas') = 0
           or (a.parametros -> 'etapas') ? l.etapa_id::text)
  loop
    foreach v_dest in array case when v.responsavel_id is not null then array[v.responsavel_id] else public.admins_ativos() end loop
      if public.notificar(v_dest, 'lead_parado',
           format('Lead sem movimentação há mais de %s dias: %s', v_dias, v.nome),
           format('Etapa "%s". Última atividade em %s.', v.etapa, public.formatar_data_hora(v.ultima_atividade_em)),
           public.link_registro('lead', v.id), 'lead', v.id,
           format('lead_parado:%s:%s', v.id, to_char(v.ultima_atividade_em, 'YYYYMMDDHH24MISS')), a.id) then
        v_n := v_n + 1;
      end if;
    end loop;
  end loop;
  return v_n;
end
$$;

-- Documento obrigatório pendente (solicitado há N dias ou com prazo interno vencido)
create or replace function public.auto_documento_pendente(a public.automacoes)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dias integer := greatest(coalesce(nullif(a.parametros ->> 'dias', '')::integer, 5), 1);
  v record;
  v_dest uuid;
  v_n integer := 0;
  v_semana text := to_char(date_trunc('week', now() at time zone 'America/Sao_Paulo'), 'IYYY-IW');
begin
  for v in
    select d.id, d.nome, d.status, d.prazo, d.solicitado_em,
           coalesce(k.responsavel_id, d.revisor_id, c.responsavel_id, l.responsavel_id) as resp,
           coalesce(k.titulo, c.nome, l.nome) as referencia
    from public.documentos d
    left join public.casos k on k.id = d.caso_id
    left join public.clientes c on c.id = d.cliente_id
    left join public.leads l on l.id = d.lead_id
    where d.obrigatorio
      and d.status in ('nao_solicitado', 'solicitado', 'rejeitado')
      and (k.id is null or (k.arquivado_em is null and k.status <> 'concluido'))
      and (c.id is null or c.arquivado_em is null)
      and (l.id is null or l.arquivado_em is null)
      and ((d.status = 'solicitado' and d.solicitado_em < now() - make_interval(days => v_dias))
           or (d.prazo is not null and d.prazo < public.hoje_sp()))
  loop
    foreach v_dest in array case when v.resp is not null then array[v.resp] else public.admins_ativos() end loop
      if public.notificar(v_dest, 'documento_pendente', 'Documento pendente: ' || v.nome,
           case when v.prazo is not null and v.prazo < public.hoje_sp()
                then format('%s · prazo interno vencido em %s.', v.referencia, to_char(v.prazo, 'DD/MM/YYYY'))
                else format('%s · solicitado há mais de %s dias.', v.referencia, v_dias) end,
           public.link_registro('documento', v.id), 'documento', v.id,
           format('doc_pendente:%s:%s', v.id, v_semana), a.id) then
        v_n := v_n + 1;
      end if;
    end loop;
  end loop;
  return v_n;
end
$$;

-- Parcela vencida (destaque + aviso a quem pode ver o financeiro)
create or replace function public.auto_parcela_vencida(a public.automacoes)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dias integer := greatest(coalesce(nullif(a.parametros ->> 'dias_apos_vencimento', '')::integer, 0), 0);
  v record;
  v_dest uuid;
  v_n integer := 0;
begin
  for v in
    select vc.id, vc.descricao, vc.saldo, vc.vencimento, c.nome as cliente_nome
    from public.v_cobrancas vc
    join public.clientes c on c.id = vc.cliente_id
    where vc.situacao = 'vencido' and vc.vencimento <= public.hoje_sp() - v_dias
  loop
    for v_dest in
      select u.id from public.usuarios u
      where u.ativo and public.tem_permissao_usuario(u.id, 'financeiro.ver')
    loop
      if public.notificar(v_dest, 'parcela_vencida',
           format('Parcela vencida: %s — %s em aberto', v.cliente_nome, public.formatar_moeda(v.saldo)),
           format('%s · vencimento em %s.', v.descricao, to_char(v.vencimento, 'DD/MM/YYYY')),
           public.link_registro('cobranca', v.id), 'cobranca', v.id,
           format('parcela_vencida:%s:%s', v.id, v.vencimento), a.id) then
        v_n := v_n + 1;
      end if;
    end loop;
  end loop;
  return v_n;
end
$$;

-- Tarefas próximas do prazo ou atrasadas
create or replace function public.auto_tarefa_prazo(a public.automacoes)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_horas integer := greatest(coalesce(nullif(a.parametros ->> 'horas_antes', '')::integer, 24), 1);
  v_vencidas boolean := coalesce((a.parametros ->> 'avisar_vencidas')::boolean, true);
  v record;
  v_n integer := 0;
begin
  for v in
    select t.id, t.titulo, t.prazo, t.responsavel_id
    from public.tarefas t
    where t.status not in ('concluida', 'cancelada') and t.arquivado_em is null
      and t.prazo is not null and t.responsavel_id is not null
      and t.prazo <= now() + make_interval(hours => v_horas)
  loop
    if v.prazo < now() then
      if v_vencidas and public.notificar(v.responsavel_id, 'tarefa_vencida', 'Tarefa atrasada: ' || v.titulo,
           'Prazo: ' || public.formatar_data_hora(v.prazo), public.link_registro('tarefa', v.id), 'tarefa', v.id,
           format('tarefa_vencida:%s:%s', v.id, extract(epoch from v.prazo)::bigint), a.id) then
        v_n := v_n + 1;
      end if;
    elsif public.notificar(v.responsavel_id, 'tarefa_proxima', 'Tarefa vence em breve: ' || v.titulo,
           'Prazo: ' || public.formatar_data_hora(v.prazo), public.link_registro('tarefa', v.id), 'tarefa', v.id,
           format('tarefa_proxima:%s:%s', v.id, extract(epoch from v.prazo)::bigint), a.id) then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end
$$;

-- Prazos processuais: alertas configurados no prazo, vencidos e não conferidos
create or replace function public.auto_prazo_processual(a public.automacoes)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vencidos boolean := coalesce((a.parametros ->> 'avisar_vencidos')::boolean, true);
  v_conferir boolean := coalesce((a.parametros ->> 'avisar_nao_conferidos')::boolean, true);
  v record;
  v_dest uuid;
  v_dests uuid[];
  v_alerta integer;
  v_n integer := 0;
  v_hoje date := public.hoje_sp();
begin
  for v in
    select p.id, p.titulo, p.vencimento, p.responsavel_id, p.alertas_dias, p.conferido, p.created_at,
           k.titulo as caso_titulo, k.responsavel_id as caso_resp,
           (p.vencimento at time zone 'America/Sao_Paulo')::date as dia
    from public.prazos p
    join public.casos k on k.id = p.caso_id
    where p.status = 'pendente' and k.arquivado_em is null
  loop
    v_dests := array_remove(array[v.responsavel_id,
                 case when v.caso_resp is distinct from v.responsavel_id then v.caso_resp end], null);
    if cardinality(v_dests) = 0 then
      v_dests := public.admins_ativos();
    end if;

    if v.vencimento < now() then
      if v_vencidos then
        foreach v_dest in array v_dests loop
          if public.notificar(v_dest, 'prazo_vencido', 'Prazo vencido sem cumprimento registrado: ' || v.titulo,
               format('Caso: %s · venceu em %s.', v.caso_titulo, public.formatar_data_hora(v.vencimento)),
               public.link_registro('prazo', v.id), 'prazo', v.id,
               format('prazo_vencido:%s:%s', v.id, extract(epoch from v.vencimento)::bigint), a.id) then
            v_n := v_n + 1;
          end if;
        end loop;
      end if;
    else
      select min(d) into v_alerta from unnest(v.alertas_dias) d where d >= 0 and v_hoje >= v.dia - d;
      if v_alerta is not null then
        foreach v_dest in array v_dests loop
          if public.notificar(v_dest, 'prazo_alerta',
               case when v.dia = v_hoje then 'Prazo vence HOJE: ' || v.titulo
                    else format('Prazo vence em %s dia(s): %s', v.dia - v_hoje, v.titulo) end,
               format('Caso: %s · vencimento %s.', v.caso_titulo, public.formatar_data_hora(v.vencimento)),
               public.link_registro('prazo', v.id), 'prazo', v.id,
               format('prazo_alerta:%s:%s:%s', v.id, v_alerta, extract(epoch from v.vencimento)::bigint), a.id) then
            v_n := v_n + 1;
          end if;
        end loop;
      end if;
    end if;

    if v_conferir and not v.conferido and v.created_at < now() - interval '1 hour' then
      for v_dest in
        select u.id from public.usuarios u
        where u.ativo and public.tem_permissao_usuario(u.id, 'prazos.conferir')
          and (u.id = any (v_dests) or not exists (
                select 1 from unnest(v_dests) x where public.tem_permissao_usuario(x, 'prazos.conferir')))
      loop
        if public.notificar(v_dest, 'prazo_conferir', 'Prazo aguardando conferência: ' || v.titulo,
             format('Caso: %s · vencimento informado %s. Confira antes de confiar no alerta.', v.caso_titulo, public.formatar_data_hora(v.vencimento)),
             public.link_registro('prazo', v.id), 'prazo', v.id,
             format('prazo_conferir:%s:%s', v.id, extract(epoch from v.vencimento)::bigint), a.id) then
          v_n := v_n + 1;
        end if;
      end loop;
    end if;
  end loop;
  return v_n;
end
$$;

-- Laudos, prescrições e outros documentos com validade próxima ou vencida
create or replace function public.auto_documento_validade(a public.automacoes)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dias integer := greatest(coalesce(nullif(a.parametros ->> 'dias_antes', '')::integer, 15), 0);
  v record;
  v_dest uuid;
  v_n integer := 0;
begin
  for v in
    select d.id, d.nome, d.valido_ate,
           coalesce(k.responsavel_id, d.revisor_id, c.responsavel_id) as resp,
           coalesce(k.titulo, c.nome) as referencia
    from public.documentos d
    left join public.casos k on k.id = d.caso_id
    left join public.clientes c on c.id = d.cliente_id
    where d.status = 'aprovado' and d.valido_ate is not null
      and d.valido_ate <= public.hoje_sp() + v_dias
      and (k.id is null or (k.arquivado_em is null and k.status <> 'concluido'))
  loop
    foreach v_dest in array case when v.resp is not null then array[v.resp] else public.admins_ativos() end loop
      if public.notificar(v_dest, 'documento_validade',
           case when v.valido_ate < public.hoje_sp() then 'Documento com validade vencida: ' else 'Documento perto do vencimento: ' end || v.nome,
           format('%s · válido até %s. Avalie a necessidade de atualização.', v.referencia, to_char(v.valido_ate, 'DD/MM/YYYY')),
           public.link_registro('documento', v.id), 'documento', v.id,
           format('doc_validade:%s:%s', v.id, v.valido_ate), a.id) then
        v_n := v_n + 1;
      end if;
    end loop;
  end loop;
  return v_n;
end
$$;

-- Executor (pg_cron a cada 15 minutos e botão "Executar agora" do administrador)
create or replace function public.executar_automacoes()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.automacoes%rowtype;
  v_n integer;
  v_total jsonb := '{}'::jsonb;
begin
  perform public.servico_contexto(null, 'automacoes');
  for a in select * from public.automacoes where ativo and tipo <> 'lead_novo_primeiro_contato' order by created_at loop
    begin
      v_n := case a.tipo
        when 'lead_parado' then public.auto_lead_parado(a)
        when 'documento_pendente' then public.auto_documento_pendente(a)
        when 'parcela_vencida' then public.auto_parcela_vencida(a)
        when 'tarefa_prazo' then public.auto_tarefa_prazo(a)
        when 'prazo_processual' then public.auto_prazo_processual(a)
        when 'documento_validade' then public.auto_documento_validade(a)
        else 0
      end;
      update public.automacoes set ultima_execucao_em = now() where id = a.id;
      if v_n > 0 then
        insert into public.automacoes_execucoes (automacao_id, itens_afetados) values (a.id, v_n);
      end if;
      v_total := v_total || jsonb_build_object(a.id::text, v_n);
    exception when others then
      insert into public.automacoes_execucoes (automacao_id, erro) values (a.id, left(sqlstate || ': ' || sqlerrm, 500));
    end;
  end loop;

  delete from public.automacoes_execucoes where iniciado_em < now() - interval '90 days';
  delete from public.notificacoes where lida_em is not null and created_at < now() - interval '180 days';
  return v_total;
end
$$;

create or replace function public.executar_automacoes_agora()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.tem_permissao('admin.automacoes') then
    raise exception 'Você não tem permissão para executar automações.' using errcode = '42501';
  end if;
  return public.executar_automacoes();
end
$$;
