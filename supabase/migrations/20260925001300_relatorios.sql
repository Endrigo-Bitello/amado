-- =============================================================================
-- CRM Amado & Amado Jr. — 13. Relatórios
-- Todas as funções são security invoker: os números refletem apenas os dados
-- que o usuário pode ver (RLS). O relatório financeiro exige financeiro.ver.
-- Filtros (jsonb): inicio, fim (datas), origem, responsavel_id, tipo_demanda_id
-- =============================================================================

create or replace function public.relatorio_periodo(p jsonb, out inicio timestamptz, out fim timestamptz, out inicio_d date, out fim_d date)
language plpgsql
stable
set search_path = ''
as $$
begin
  inicio_d := coalesce(nullif(p ->> 'inicio', '')::date, public.hoje_sp() - 29);
  fim_d := coalesce(nullif(p ->> 'fim', '')::date, public.hoje_sp());
  if fim_d < inicio_d then
    raise exception 'O fim do período deve ser posterior ao início.';
  end if;
  if fim_d - inicio_d > 3660 then
    raise exception 'Período máximo de 10 anos.';
  end if;
  inicio := inicio_d::timestamp at time zone 'America/Sao_Paulo';
  fim := (fim_d + 1)::timestamp at time zone 'America/Sao_Paulo';
end
$$;

create or replace function public.exigir_relatorios()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.tem_permissao('relatorios.ver') then
    raise exception 'Você não tem permissão para acessar relatórios.' using errcode = '42501';
  end if;
end
$$;

-- Leads, conversão e tempo até o primeiro contato
create or replace function public.relatorio_leads(p jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  per record;
  v_origem text := nullif(p ->> 'origem', '');
  v_resp uuid := nullif(p ->> 'responsavel_id', '')::uuid;
  v_tipo uuid := nullif(p ->> 'tipo_demanda_id', '')::uuid;
  v jsonb;
begin
  perform public.exigir_relatorios();
  select * into per from public.relatorio_periodo(p);

  with base as (
    select l.*, e.categoria, e.nome as etapa_nome, e.ordem as etapa_ordem, e.cor as etapa_cor,
           case when l.primeiro_contato_em is not null
                then extract(epoch from (l.primeiro_contato_em - l.created_at)) / 3600.0 end as horas_contato
    from public.leads l
    join public.etapas e on e.id = l.etapa_id
    where l.mesclado_em_id is null
      and l.created_at >= per.inicio and l.created_at < per.fim
      and (v_origem is null or l.origem = v_origem)
      and (v_resp is null or l.responsavel_id = v_resp)
      and (v_tipo is null or l.tipo_demanda_id = v_tipo)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'convertidos', (select count(*) from base where cliente_id is not null or categoria = 'ganha'),
    'perdidos', (select count(*) from base where categoria = 'perdida'),
    'em_aberto', (select count(*) from base where categoria = 'aberta'),
    'por_etapa', coalesce((select jsonb_agg(jsonb_build_object('rotulo', etapa_nome, 'cor', etapa_cor, 'total', n) order by ordem)
                  from (select etapa_nome, etapa_cor, min(etapa_ordem) as ordem, count(*) as n from base group by etapa_nome, etapa_cor) s), '[]'),
    'por_origem', coalesce((select jsonb_agg(jsonb_build_object('chave', origem, 'rotulo', public.rotulo_opcao('origem', origem),
                     'total', n, 'convertidos', conv) order by n desc)
                  from (select origem, count(*) as n, count(*) filter (where cliente_id is not null or categoria = 'ganha') as conv
                        from base group by origem) s), '[]'),
    'por_responsavel', coalesce((select jsonb_agg(jsonb_build_object('id', responsavel_id, 'rotulo', public.nome_usuario(responsavel_id),
                     'total', n, 'convertidos', conv) order by n desc)
                  from (select responsavel_id, count(*) as n, count(*) filter (where cliente_id is not null or categoria = 'ganha') as conv
                        from base group by responsavel_id) s), '[]'),
    'por_temperatura', coalesce((select jsonb_agg(jsonb_build_object('chave', coalesce(temperatura, 'sem'), 'total', n))
                  from (select temperatura, count(*) as n from base group by temperatura) s), '[]'),
    'motivos_perda', coalesce((select jsonb_agg(jsonb_build_object('chave', motivo_perda, 'rotulo', public.rotulo_opcao('motivo_perda', motivo_perda), 'total', n) order by n desc)
                  from (select motivo_perda, count(*) as n from base where categoria = 'perdida' group by motivo_perda) s), '[]'),
    'por_semana', coalesce((select jsonb_agg(jsonb_build_object('semana', semana, 'total', n, 'convertidos', conv) order by semana)
                  from (select to_char(date_trunc('week', created_at at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as semana,
                               count(*) as n, count(*) filter (where cliente_id is not null or categoria = 'ganha') as conv
                        from base group by 1) s), '[]'),
    'primeiro_contato', jsonb_build_object(
      'com_contato', (select count(*) from base where horas_contato is not null),
      'sem_contato', (select count(*) from base where horas_contato is null),
      'media_horas', (select round(avg(horas_contato)::numeric, 1) from base where horas_contato is not null),
      'mediana_horas', (select round((percentile_cont(0.5) within group (order by horas_contato))::numeric, 1) from base where horas_contato is not null),
      'ate_1h', (select count(*) from base where horas_contato <= 1),
      'ate_24h', (select count(*) from base where horas_contato > 1 and horas_contato <= 24),
      'mais_24h', (select count(*) from base where horas_contato > 24)
    )
  ) into v;
  return v;
end
$$;

-- Clientes e carteira de casos/processos
create or replace function public.relatorio_casos(p jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  per record;
  v_origem text := nullif(p ->> 'origem', '');
  v_resp uuid := nullif(p ->> 'responsavel_id', '')::uuid;
  v_tipo uuid := nullif(p ->> 'tipo_demanda_id', '')::uuid;
  v jsonb;
begin
  perform public.exigir_relatorios();
  select * into per from public.relatorio_periodo(p);

  with casos_base as (
    select k.*, e.nome as fase_nome, e.ordem as fase_ordem, e.cor as fase_cor,
           exists (select 1 from public.processos pr where pr.caso_id = k.id and pr.numero_norm is not null) as tem_numero
    from public.casos k
    left join public.etapas e on e.id = k.fase_id
    join public.clientes c on c.id = k.cliente_id
    where k.arquivado_em is null
      and (v_resp is null or k.responsavel_id = v_resp)
      and (v_tipo is null or k.tipo_demanda_id = v_tipo)
      and (v_origem is null or c.origem = v_origem)
  ),
  clientes_base as (
    select c.* from public.clientes c
    where c.arquivado_em is null
      and (v_resp is null or c.responsavel_id = v_resp)
      and (v_origem is null or c.origem = v_origem)
  )
  select jsonb_build_object(
    'clientes_total', (select count(*) from clientes_base),
    'clientes_novos', (select count(*) from clientes_base where created_at >= per.inicio and created_at < per.fim),
    'clientes_por_origem', coalesce((select jsonb_agg(jsonb_build_object('chave', origem, 'rotulo', public.rotulo_opcao('origem', origem), 'total', n) order by n desc)
                     from (select origem, count(*) as n from clientes_base where created_at >= per.inicio and created_at < per.fim group by origem) s), '[]'),
    'casos_total', (select count(*) from casos_base),
    'ativos', (select count(*) from casos_base where status = 'ativo'),
    'suspensos', (select count(*) from casos_base where status = 'suspenso'),
    'concluidos', (select count(*) from casos_base where status = 'concluido'),
    'judiciais', (select count(*) from casos_base where natureza = 'judicial'),
    'internos', (select count(*) from casos_base where natureza = 'interno'),
    'sem_numero', (select count(*) from casos_base where status <> 'concluido' and not tem_numero),
    'abertos_periodo', (select count(*) from casos_base where data_abertura between per.inicio_d and per.fim_d),
    'concluidos_periodo', (select count(*) from casos_base where data_encerramento between per.inicio_d and per.fim_d),
    'por_fase', coalesce((select jsonb_agg(jsonb_build_object('rotulo', coalesce(fase_nome, 'Sem fase'), 'cor', fase_cor, 'total', n) order by ordem nulls last)
                     from (select fase_nome, fase_cor, min(fase_ordem) as ordem, count(*) as n from casos_base where status <> 'concluido' group by fase_nome, fase_cor) s), '[]'),
    'por_tipo', coalesce((select jsonb_agg(jsonb_build_object('rotulo', coalesce(t.nome, 'Sem tipo'), 'cor', t.cor, 'total', n) order by n desc)
                     from (select tipo_demanda_id, count(*) as n from casos_base group by tipo_demanda_id) s
                     left join public.tipos_demanda t on t.id = s.tipo_demanda_id), '[]'),
    'por_responsavel', coalesce((select jsonb_agg(jsonb_build_object('id', responsavel_id, 'rotulo', public.nome_usuario(responsavel_id), 'total', n, 'ativos', ativos) order by n desc)
                     from (select responsavel_id, count(*) as n, count(*) filter (where status = 'ativo') as ativos from casos_base group by responsavel_id) s), '[]'),
    'por_tribunal', coalesce((select jsonb_agg(jsonb_build_object('rotulo', coalesce(tribunal, 'Não informado'), 'total', n) order by n desc)
                     from (select pr.tribunal, count(*) as n from public.processos pr join casos_base k on k.id = pr.caso_id group by pr.tribunal) s), '[]')
  ) into v;
  return v;
end
$$;

-- Produtividade da equipe no período
create or replace function public.relatorio_produtividade(p jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  per record;
  v_resp uuid := nullif(p ->> 'responsavel_id', '')::uuid;
  v jsonb;
begin
  perform public.exigir_relatorios();
  select * into per from public.relatorio_periodo(p);

  select coalesce(jsonb_agg(x order by (x ->> 'tarefas_concluidas')::integer desc), '[]') into v
  from (
    select jsonb_build_object(
      'id', u.id,
      'nome', u.nome,
      'cor', u.cor,
      'tarefas_concluidas', (select count(*) from public.tarefas t where t.concluida_por = u.id and t.concluida_em >= per.inicio and t.concluida_em < per.fim),
      'tarefas_no_prazo', (select count(*) from public.tarefas t where t.concluida_por = u.id and t.concluida_em >= per.inicio and t.concluida_em < per.fim and (t.prazo is null or t.concluida_em <= t.prazo)),
      'tarefas_atrasadas', (select count(*) from public.tarefas t where t.responsavel_id = u.id and t.status not in ('concluida', 'cancelada') and t.arquivado_em is null and t.prazo < now()),
      'contatos', (select count(*) from public.interacoes i where i.usuario_id = u.id and i.ocorrida_em >= per.inicio and i.ocorrida_em < per.fim),
      'leads_convertidos', (select count(*) from public.leads l where l.convertido_por = u.id and l.convertido_em >= per.inicio and l.convertido_em < per.fim),
      'prazos_cumpridos', (select count(*) from public.prazos pz where pz.cumprido_por = u.id and pz.cumprido_em >= per.inicio and pz.cumprido_em < per.fim),
      'documentos_revisados', (select count(*) from public.documentos_historico h where h.usuario_id = u.id and h.para in ('aprovado', 'rejeitado') and h.created_at >= per.inicio and h.created_at < per.fim),
      'andamentos', (select count(*) from public.andamentos a where a.registrado_por = u.id and a.created_at >= per.inicio and a.created_at < per.fim)
    ) as x
    from public.usuarios u
    where u.ativo and (v_resp is null or u.id = v_resp)
  ) s;
  return jsonb_build_object('usuarios', v);
end
$$;

-- Prazos processuais
create or replace function public.relatorio_prazos(p jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  per record;
  v_resp uuid := nullif(p ->> 'responsavel_id', '')::uuid;
  v_tipo uuid := nullif(p ->> 'tipo_demanda_id', '')::uuid;
  v jsonb;
begin
  perform public.exigir_relatorios();
  select * into per from public.relatorio_periodo(p);

  with base as (
    select pz.*, k.tipo_demanda_id
    from public.prazos pz join public.casos k on k.id = pz.caso_id
    where pz.vencimento >= per.inicio and pz.vencimento < per.fim
      and (v_resp is null or pz.responsavel_id = v_resp)
      and (v_tipo is null or k.tipo_demanda_id = v_tipo)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'cumpridos', (select count(*) from base where status = 'cumprido'),
    'cumpridos_no_prazo', (select count(*) from base where status = 'cumprido' and cumprido_em <= vencimento),
    'cumpridos_apos', (select count(*) from base where status = 'cumprido' and cumprido_em > vencimento),
    'pendentes', (select count(*) from base where status = 'pendente' and vencimento >= now()),
    'vencidos_pendentes', (select count(*) from base where status = 'pendente' and vencimento < now()),
    'cancelados', (select count(*) from base where status = 'cancelado'),
    'nao_conferidos', (select count(*) from base where status = 'pendente' and not conferido),
    'por_responsavel', coalesce((select jsonb_agg(jsonb_build_object('id', responsavel_id, 'rotulo', public.nome_usuario(responsavel_id),
                        'total', n, 'cumpridos', c, 'vencidos', venc) order by n desc)
                     from (select responsavel_id, count(*) as n, count(*) filter (where status = 'cumprido') as c,
                                  count(*) filter (where status = 'pendente' and vencimento < now()) as venc
                           from base group by responsavel_id) s), '[]')
  ) into v;
  return v;
end
$$;

-- Pendências documentais (casos ativos)
create or replace function public.relatorio_documentos(p jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  per record;
  v_resp uuid := nullif(p ->> 'responsavel_id', '')::uuid;
  v_tipo uuid := nullif(p ->> 'tipo_demanda_id', '')::uuid;
  v jsonb;
begin
  perform public.exigir_relatorios();
  select * into per from public.relatorio_periodo(p);

  with base as (
    select d.*, k.titulo as caso_titulo, k.codigo as caso_codigo, cat.nome as categoria_nome
    from public.documentos d
    left join public.casos k on k.id = d.caso_id
    left join public.categorias_documento cat on cat.id = d.categoria_id
    where (k.id is null or (k.arquivado_em is null and k.status <> 'concluido'))
      and (v_resp is null or k.responsavel_id = v_resp)
      and (v_tipo is null or k.tipo_demanda_id = v_tipo)
  ),
  tempos as (
    select h.documento_id, h.para, h.created_at
    from public.documentos_historico h
    join base b on b.id = h.documento_id
    where h.created_at >= per.inicio and h.created_at < per.fim
  )
  select jsonb_build_object(
    'exigidos', (select count(*) from base where obrigatorio and status <> 'dispensado'),
    'recebidos', (select count(*) from base where status in ('recebido', 'em_revisao', 'aprovado')),
    'aprovados', (select count(*) from base where status = 'aprovado'),
    'faltantes', (select count(*) from base where obrigatorio and status in ('nao_solicitado', 'solicitado', 'rejeitado')),
    'em_revisao', (select count(*) from base where status in ('recebido', 'em_revisao')),
    'rejeitados', (select count(*) from base where status = 'rejeitado'),
    'vencendo', (select count(*) from base where status = 'aprovado' and valido_ate is not null and valido_ate <= public.hoje_sp() + 30),
    'por_status', coalesce((select jsonb_agg(jsonb_build_object('chave', status, 'rotulo', public.rotulo_status_documento(status), 'total', n))
                   from (select status, count(*) as n from base group by status) s), '[]'),
    'faltantes_por_categoria', coalesce((select jsonb_agg(jsonb_build_object('rotulo', coalesce(categoria_nome, 'Sem categoria'), 'total', n) order by n desc)
                   from (select categoria_nome, count(*) as n from base where obrigatorio and status in ('nao_solicitado', 'solicitado', 'rejeitado') group by categoria_nome) s), '[]'),
    'casos_com_pendencias', coalesce((select jsonb_agg(jsonb_build_object('id', caso_id, 'codigo', caso_codigo, 'titulo', caso_titulo, 'faltantes', n) order by n desc)
                   from (select caso_id, caso_codigo, caso_titulo, count(*) as n from base
                         where caso_id is not null and obrigatorio and status in ('nao_solicitado', 'solicitado', 'rejeitado')
                         group by caso_id, caso_codigo, caso_titulo order by count(*) desc limit 20) s), '[]'),
    'aprovados_periodo', (select count(*) from tempos where para = 'aprovado'),
    'recebidos_periodo', (select count(*) from tempos where para = 'recebido')
  ) into v;
  return v;
end
$$;

-- Financeiro: contratado, recebido, em aberto e vencido (requer financeiro.ver)
create or replace function public.relatorio_financeiro(p jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  per record;
  v_origem text := nullif(p ->> 'origem', '');
  v_resp uuid := nullif(p ->> 'responsavel_id', '')::uuid;
  v_tipo uuid := nullif(p ->> 'tipo_demanda_id', '')::uuid;
  v jsonb;
begin
  perform public.exigir_relatorios();
  if not public.tem_permissao('financeiro.ver') then
    raise exception 'Você não tem permissão para ver valores financeiros.' using errcode = '42501';
  end if;
  select * into per from public.relatorio_periodo(p);

  with clientes_f as (
    select c.id, c.nome, c.responsavel_id, c.origem from public.clientes c
    where (v_origem is null or c.origem = v_origem)
  ),
  cob as (
    select vc.*, cf.nome as cliente_nome
    from public.v_cobrancas vc
    join clientes_f cf on cf.id = vc.cliente_id
    left join public.casos k on k.id = vc.caso_id
    where (v_resp is null or coalesce(k.responsavel_id, cf.responsavel_id) = v_resp)
      and (v_tipo is null or k.tipo_demanda_id = v_tipo)
  ),
  pag as (
    select pg.*, cb.categoria
    from public.pagamentos pg
    join cob cb on cb.id = pg.cobranca_id
    where pg.estornado_em is null and pg.data_pagamento between per.inicio_d and per.fim_d
  ),
  contr as (
    select ct.* from public.contratos ct
    join clientes_f cf on cf.id = ct.cliente_id
    left join public.casos k on k.id = ct.caso_id
    where ct.status <> 'cancelado'
      and coalesce(ct.data_assinatura, (ct.created_at at time zone 'America/Sao_Paulo')::date) between per.inicio_d and per.fim_d
      and (v_resp is null or coalesce(k.responsavel_id, cf.responsavel_id) = v_resp)
      and (v_tipo is null or k.tipo_demanda_id = v_tipo)
  ),
  desp as (
    select d.* from public.despesas d
    join clientes_f cf on cf.id = d.cliente_id
    left join public.casos k on k.id = d.caso_id
    where d.cancelada_em is null and d.data between per.inicio_d and per.fim_d
      and (v_resp is null or coalesce(k.responsavel_id, cf.responsavel_id) = v_resp)
      and (v_tipo is null or k.tipo_demanda_id = v_tipo)
  )
  select jsonb_build_object(
    'contratado_periodo', (select coalesce(sum(valor_total - desconto + acrescimo), 0) from contr),
    'contratos_periodo', (select count(*) from contr),
    'honorarios_recebidos_periodo', (select coalesce(sum(valor), 0) from pag where categoria = 'honorarios'),
    'reembolsos_despesas_recebidos_periodo', (select coalesce(sum(valor), 0) from pag where categoria = 'reembolso_despesas'),
    'em_aberto', (select coalesce(sum(saldo), 0) from cob where situacao in ('a_receber', 'parcial', 'vencido') and categoria = 'honorarios'),
    'vencido', (select coalesce(sum(saldo), 0) from cob where situacao = 'vencido' and categoria = 'honorarios'),
    'vencido_reembolsos', (select coalesce(sum(saldo), 0) from cob where situacao = 'vencido' and categoria = 'reembolso_despesas'),
    'a_vencer_30d', (select coalesce(sum(saldo), 0) from cob where situacao in ('a_receber', 'parcial') and vencimento <= public.hoje_sp() + 30),
    'clientes_inadimplentes', (select count(distinct cliente_id) from cob where situacao = 'vencido'),
    'devolvido_clientes_periodo', (select coalesce(sum(r.valor), 0) from public.reembolsos r join cob on cob.id = r.cobranca_id where r.data between per.inicio_d and per.fim_d),
    'custas_periodo', (select coalesce(sum(valor), 0) from desp where categoria = 'custas'),
    'despesas_periodo', (select coalesce(sum(valor), 0) from desp where categoria = 'despesa'),
    'adiantado_escritorio_periodo', (select coalesce(sum(valor), 0) from desp where pago_por = 'escritorio'),
    'recebido_por_mes', coalesce((select jsonb_agg(jsonb_build_object('mes', mes, 'honorarios', h, 'reembolsos', r) order by mes)
                   from (select to_char(data_pagamento, 'YYYY-MM') as mes,
                                sum(valor) filter (where categoria = 'honorarios') as h,
                                sum(valor) filter (where categoria = 'reembolso_despesas') as r
                         from pag group by 1) s), '[]'),
    'maiores_saldos', coalesce((select jsonb_agg(jsonb_build_object('cliente_id', cliente_id, 'nome', cliente_nome, 'saldo', saldo, 'vencido', vencido) order by saldo desc)
                   from (select cliente_id, cliente_nome, sum(saldo) as saldo, sum(saldo) filter (where situacao = 'vencido') as vencido
                         from cob where situacao in ('a_receber', 'parcial', 'vencido')
                         group by cliente_id, cliente_nome order by sum(saldo) desc limit 10) s), '[]')
  ) into v;
  return v;
end
$$;
