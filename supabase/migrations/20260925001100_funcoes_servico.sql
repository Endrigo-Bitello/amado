-- =============================================================================
-- CRM Amado & Amado Jr. — 11. Funções de serviço (somente Edge Functions)
-- Executáveis apenas pela service role (ver migration de permissões).
-- Cada função recebe o usuário autenticado (p_ator), já validado pela Edge
-- Function, e revalida as permissões no banco.
-- =============================================================================

create or replace function public.servico_contexto(p_ator uuid, p_contexto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.usuario_id', coalesce(p_ator::text, ''), true);
  perform set_config('app.contexto', coalesce(p_contexto, ''), true);
end
$$;

create or replace function public.exigir_permissao(p_ator uuid, p_permissao text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.tem_permissao_usuario(p_ator, p_permissao) then
    raise exception 'Você não tem permissão para esta operação.' using errcode = '42501';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Limites de uso (proteção contra abuso das entradas públicas)
-- -----------------------------------------------------------------------------

create or replace function public.verificar_limite(p_chave text, p_maximo integer, p_janela_segundos integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz := to_timestamp(floor(extract(epoch from now()) / p_janela_segundos) * p_janela_segundos);
  v_contagem integer;
begin
  insert into public.limites_uso (chave, janela_inicio, contagem)
  values (left(p_chave, 200), v_inicio, 1)
  on conflict (chave, janela_inicio) do update set contagem = public.limites_uso.contagem + 1
  returning contagem into v_contagem;
  if random() < 0.02 then
    delete from public.limites_uso where janela_inicio < now() - interval '2 days';
  end if;
  return v_contagem <= p_maximo;
end
$$;

-- -----------------------------------------------------------------------------
-- Quiz do site → submissão + lead (idempotente)
-- -----------------------------------------------------------------------------

create or replace function public.quiz_registrar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chave uuid := (p ->> 'chave_idempotencia')::uuid;
  v_sub uuid;
  v_lead uuid;
  v_existente public.leads%rowtype;
  v_cliente record;
  v_tel text := public.chave_telefone(p -> 'contato' ->> 'whatsapp');
  v_email text := public.normalizar_email(p -> 'contato' ->> 'email');
  v_meta jsonb := coalesce(p -> 'meta', '{}');
  v_l jsonb := coalesce(p -> 'lead', '{}');
  v_novo boolean := false;
  v_obs text;
begin
  perform public.servico_contexto(null, 'edge:quiz-lead');

  if v_chave is null then
    raise exception 'Chave de idempotência ausente.';
  end if;

  select s.id, s.lead_id into v_sub, v_lead from public.quiz_submissoes s where s.chave_idempotencia = v_chave;
  if found then
    return jsonb_build_object('ok', true, 'duplicada', true, 'lead_id', v_lead,
                              'protocolo', (select l.codigo from public.leads l where l.id = v_lead));
  end if;

  if nullif(p ->> 'bloqueio', '') is not null then
    insert into public.quiz_submissoes (chave_idempotencia, status, motivo_bloqueio, nome, whatsapp, email, respostas,
                                        versao_quiz, pagina, user_agent, ip_hash, iniciado_em, duracao_segundos)
    values (v_chave, 'bloqueada', left(p ->> 'bloqueio', 120),
            left(p -> 'contato' ->> 'nome', 160), left(p -> 'contato' ->> 'whatsapp', 40), left(p -> 'contato' ->> 'email', 160),
            coalesce(p -> 'respostas_brutas', '{}'), p ->> 'versao_quiz', left(v_meta ->> 'pagina', 300),
            left(v_meta ->> 'user_agent', 300), v_meta ->> 'ip_hash',
            nullif(v_meta ->> 'iniciado_em', '')::timestamptz, nullif(v_meta ->> 'duracao_segundos', '')::integer)
    on conflict (chave_idempotencia) do nothing;
    return jsonb_build_object('ok', true, 'bloqueada', true);
  end if;

  -- Serializa envios simultâneos da mesma pessoa (evita leads duplicados).
  perform pg_advisory_xact_lock(hashtext('quiz:' || coalesce(v_tel, v_email, v_chave::text)));

  select s.id, s.lead_id into v_sub, v_lead from public.quiz_submissoes s where s.chave_idempotencia = v_chave;
  if found then
    return jsonb_build_object('ok', true, 'duplicada', true, 'lead_id', v_lead,
                              'protocolo', (select l.codigo from public.leads l where l.id = v_lead));
  end if;

  insert into public.quiz_submissoes (
    chave_idempotencia, status, nome, whatsapp, email, respostas, score_informado, score_calculado, temperatura,
    observacoes, versao_quiz, pagina, referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    gclid, fbclid, user_agent, ip_hash, iniciado_em, duracao_segundos
  ) values (
    v_chave, 'processada',
    left(p -> 'contato' ->> 'nome', 160), left(p -> 'contato' ->> 'whatsapp', 40), left(p -> 'contato' ->> 'email', 160),
    coalesce(p -> 'respostas_brutas', '{}'),
    nullif(p ->> 'score_informado', '')::integer, nullif(p ->> 'score_calculado', '')::integer,
    p ->> 'temperatura', left(p ->> 'observacoes', 1000), p ->> 'versao_quiz',
    left(v_meta ->> 'pagina', 300), left(v_meta ->> 'referrer', 300),
    left(v_meta ->> 'utm_source', 150), left(v_meta ->> 'utm_medium', 150), left(v_meta ->> 'utm_campaign', 150),
    left(v_meta ->> 'utm_term', 150), left(v_meta ->> 'utm_content', 150),
    left(v_meta ->> 'gclid', 200), left(v_meta ->> 'fbclid', 200),
    left(v_meta ->> 'user_agent', 300), v_meta ->> 'ip_hash',
    nullif(v_meta ->> 'iniciado_em', '')::timestamptz, nullif(v_meta ->> 'duracao_segundos', '')::integer
  )
  returning id into v_sub;

  -- Lead aberto da mesma pessoa? Atualiza as respostas em vez de duplicar.
  select l.* into v_existente
  from public.leads l
  join public.etapas e on e.id = l.etapa_id
  where l.arquivado_em is null and l.mesclado_em_id is null and l.cliente_id is null and e.categoria = 'aberta'
    and ((v_tel is not null and l.telefone_chave = v_tel) or (v_email is not null and l.email_norm = v_email))
  order by l.created_at desc
  limit 1;

  if v_existente.id is not null then
    v_lead := v_existente.id;
    update public.leads l set
      whatsapp = coalesce(l.whatsapp, nullif(p -> 'contato' ->> 'whatsapp', '')),
      email = coalesce(l.email, nullif(p -> 'contato' ->> 'email', '')),
      estado = coalesce(nullif(v_l ->> 'estado', ''), l.estado),
      municipio = coalesce(nullif(v_l ->> 'municipio', ''), l.municipio),
      profissao = coalesce(nullif(v_l ->> 'profissao', ''), l.profissao),
      faixa_renda = coalesce(nullif(v_l ->> 'faixa_renda', ''), l.faixa_renda),
      quiz_interesse = coalesce(nullif(v_l ->> 'quiz_interesse', ''), l.quiz_interesse),
      quiz_cultiva = coalesce(nullif(v_l ->> 'quiz_cultiva', ''), l.quiz_cultiva),
      quiz_consulta_medica = coalesce(nullif(v_l ->> 'quiz_consulta_medica', ''), l.quiz_consulta_medica),
      quiz_motivacao = coalesce(nullif(v_l ->> 'quiz_motivacao', ''), l.quiz_motivacao),
      quiz_agenda = coalesce(nullif(v_l ->> 'quiz_agenda', ''), l.quiz_agenda),
      quiz_horario = case when nullif(v_l ->> 'quiz_agenda', '') is not null then nullif(v_l ->> 'quiz_horario', '') else l.quiz_horario end,
      quiz_observacoes = coalesce(nullif(p ->> 'observacoes', ''), l.quiz_observacoes),
      temperatura = coalesce(nullif(p ->> 'temperatura', ''), l.temperatura),
      score = coalesce(nullif(p ->> 'score_calculado', '')::integer, l.score),
      ultima_submissao_id = v_sub,
      total_submissoes = l.total_submissoes + 1,
      ultima_atividade_em = now()
    where l.id = v_lead;

    perform public.registrar_evento('quiz', 'Novo envio do quiz pelo site (respostas atualizadas)',
      v_lead, null, null, 'quiz_submissao', v_sub, '{}'::jsonb, true);
    perform public.notificar(v_existente.responsavel_id, 'quiz', 'Lead respondeu o quiz novamente: ' || v_existente.nome,
      'As respostas mais recentes foram registradas no lead.', public.link_registro('lead', v_lead), 'lead', v_lead,
      'quiz_reenvio:' || v_sub::text, null);
  else
    select c.id, c.codigo into v_cliente
    from public.clientes c
    where c.arquivado_em is null
      and ((v_tel is not null and c.telefone_chave = v_tel) or (v_email is not null and c.email_norm = v_email))
    limit 1;

    v_obs := nullif(p ->> 'observacoes', '');
    if v_cliente.id is not null then
      v_obs := concat_ws(' ', v_obs, 'Pessoa já cadastrada como cliente ' || v_cliente.codigo || '.');
    end if;

    insert into public.leads (
      nome, whatsapp, email, estado, municipio, profissao, faixa_renda, origem, temperatura, score,
      quiz_interesse, quiz_cultiva, quiz_consulta_medica, quiz_motivacao, quiz_agenda, quiz_horario, quiz_observacoes,
      ultima_submissao_id, total_submissoes, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      prioridade
    ) values (
      coalesce(nullif(trim(p -> 'contato' ->> 'nome'), ''), 'Sem nome'),
      nullif(p -> 'contato' ->> 'whatsapp', ''),
      nullif(p -> 'contato' ->> 'email', ''),
      nullif(v_l ->> 'estado', ''), nullif(v_l ->> 'municipio', ''), nullif(v_l ->> 'profissao', ''),
      nullif(v_l ->> 'faixa_renda', ''), 'quiz_site', nullif(p ->> 'temperatura', ''),
      nullif(p ->> 'score_calculado', '')::integer,
      nullif(v_l ->> 'quiz_interesse', ''), nullif(v_l ->> 'quiz_cultiva', ''), nullif(v_l ->> 'quiz_consulta_medica', ''),
      nullif(v_l ->> 'quiz_motivacao', ''), nullif(v_l ->> 'quiz_agenda', ''), nullif(v_l ->> 'quiz_horario', ''), v_obs,
      v_sub, 1,
      left(v_meta ->> 'utm_source', 150), left(v_meta ->> 'utm_medium', 150), left(v_meta ->> 'utm_campaign', 150),
      left(v_meta ->> 'utm_term', 150), left(v_meta ->> 'utm_content', 150),
      case p ->> 'temperatura' when 'quente' then 'alta' when 'frio' then 'baixa' else 'media' end
    )
    returning id into v_lead;
    v_novo := true;
  end if;

  update public.quiz_submissoes set lead_id = v_lead where id = v_sub;

  insert into public.quiz_respostas (submissao_id, lead_id, ordem, pergunta_id, pergunta, campo, resposta, valor, pontuacao)
  select v_sub, v_lead, coalesce((r ->> 'ordem')::integer, 0), left(r ->> 'pergunta_id', 60), left(r ->> 'pergunta', 400),
         left(r ->> 'campo', 60), left(r ->> 'resposta', 400), left(r ->> 'valor', 400), nullif(r ->> 'pontuacao', '')::integer
  from jsonb_array_elements(coalesce(p -> 'respostas', '[]'::jsonb)) r;

  if jsonb_typeof(p -> 'consentimento') = 'object' then
    insert into public.consentimentos (lead_id, submissao_id, tipo, texto, versao, concedido, origem, pagina, ip_hash, user_agent)
    values (v_lead, v_sub, 'lgpd_quiz', left(p -> 'consentimento' ->> 'texto', 2000), left(p -> 'consentimento' ->> 'versao', 40),
            coalesce((p -> 'consentimento' ->> 'concedido')::boolean, false), 'quiz_site',
            left(v_meta ->> 'pagina', 300), v_meta ->> 'ip_hash', left(v_meta ->> 'user_agent', 300));
  end if;

  return jsonb_build_object('ok', true, 'novo', v_novo, 'lead_id', v_lead,
                            'protocolo', (select l.codigo from public.leads l where l.id = v_lead));
end
$$;

-- -----------------------------------------------------------------------------
-- Portal do cliente (envio de documentos por link individual)
-- -----------------------------------------------------------------------------

create or replace function public.portal_solicitacao_valida(p_token_hash text)
returns public.solicitacoes_documentos
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.solicitacoes_documentos%rowtype;
begin
  select s.* into v from public.solicitacoes_documentos s where s.token_hash = p_token_hash;
  if not found then
    raise exception 'portal:invalido';
  end if;
  if v.revogada_em is not null then
    raise exception 'portal:revogado';
  end if;
  if v.expira_em < now() then
    raise exception 'portal:expirado';
  end if;
  return v;
end
$$;

create or replace function public.portal_abrir(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.solicitacoes_documentos%rowtype;
  v_nome text;
begin
  v := public.portal_solicitacao_valida(p_token_hash);
  update public.solicitacoes_documentos s
     set ultimo_acesso_em = now(), total_acessos = s.total_acessos + 1
   where s.id = v.id;

  v_nome := split_part(coalesce(
    (select c.nome from public.clientes c where c.id = v.cliente_id),
    (select l.nome from public.leads l where l.id = v.lead_id), ''), ' ', 1);

  return jsonb_build_object(
    'primeiro_nome', v_nome,
    'mensagem', v.mensagem,
    'expira_em', v.expira_em,
    'documentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'nome', d.nome,
        'descricao', d.descricao_cliente,
        'obrigatorio', d.obrigatorio,
        'situacao', case
          when d.status = 'aprovado' then 'aprovado'
          when d.status in ('recebido', 'em_revisao') then 'recebido'
          when d.status = 'rejeitado' then 'reenviar'
          when d.status = 'dispensado' then 'dispensado'
          else 'pendente' end,
        'enviados', (select count(*) from public.arquivos a
                     where a.documento_id = d.id and a.solicitacao_id = v.id and a.removido_em is null),
        'pode_enviar', d.cliente_pode_enviar and d.status not in ('aprovado', 'dispensado')
      ) order by d.ordem, d.nome)
      from public.documentos d
      where d.id = any (v.documentos_ids)
    ), '[]'::jsonb)
  );
end
$$;

create or replace function public.portal_preparar_envio(p_token_hash text, p_documento uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.solicitacoes_documentos%rowtype;
  v_doc public.documentos%rowtype;
  v_qtd integer;
begin
  v := public.portal_solicitacao_valida(p_token_hash);
  if not (p_documento = any (v.documentos_ids)) then
    raise exception 'portal:documento';
  end if;
  select d.* into v_doc from public.documentos d where d.id = p_documento;
  if not found or not v_doc.cliente_pode_enviar or v_doc.status in ('aprovado', 'dispensado') then
    raise exception 'portal:documento';
  end if;
  select count(*) into v_qtd from public.arquivos a where a.documento_id = p_documento and a.solicitacao_id = v.id;
  if v_qtd >= 10 then
    raise exception 'portal:limite';
  end if;
  return jsonb_build_object('solicitacao_id', v.id, 'documento_id', v_doc.id);
end
$$;

create or replace function public.portal_registrar_envio(
  p_token_hash text, p_documento uuid, p_caminho text, p_nome text, p_mime text, p_tamanho bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.solicitacoes_documentos%rowtype;
  v_doc public.documentos%rowtype;
  v_arquivo uuid;
  v_resp uuid;
begin
  v := public.portal_solicitacao_valida(p_token_hash);
  if not (p_documento = any (v.documentos_ids)) then
    raise exception 'portal:documento';
  end if;
  if p_caminho not like 'portal/' || v.id::text || '/' || p_documento::text || '/%' then
    raise exception 'portal:caminho';
  end if;
  select d.* into v_doc from public.documentos d where d.id = p_documento;
  if not found or not v_doc.cliente_pode_enviar or v_doc.status in ('aprovado', 'dispensado') then
    raise exception 'portal:documento';
  end if;

  perform public.servico_contexto(null, 'edge:portal-cliente');
  perform set_config('app.via', 'portal', true);

  insert into public.arquivos (bucket, caminho, nome, mime, tamanho, tipo, documento_id, enviado_pelo_cliente, solicitacao_id)
  values ('crm-documentos', p_caminho, left(p_nome, 255), left(p_mime, 120), p_tamanho, 'documento', p_documento, true, v.id)
  on conflict (bucket, caminho) do nothing
  returning id into v_arquivo;

  if v_arquivo is null then
    return jsonb_build_object('ok', true, 'duplicado', true);
  end if;

  update public.solicitacoes_documentos s set total_envios = s.total_envios + 1 where s.id = v.id;

  select coalesce(
    (select k.responsavel_id from public.casos k where k.id = v_doc.caso_id),
    v_doc.revisor_id,
    (select c.responsavel_id from public.clientes c where c.id = v_doc.cliente_id),
    (select l.responsavel_id from public.leads l where l.id = v_doc.lead_id)
  ) into v_resp;

  perform public.notificar(v_resp, 'documento', 'Documento recebido pelo link do cliente: ' || v_doc.nome,
    'Revise o arquivo enviado.', public.link_registro('documento', v_doc.id), 'documento', v_doc.id,
    'portal_envio:' || v_arquivo::text, null);
  return jsonb_build_object('ok', true, 'arquivo_id', v_arquivo);
end
$$;

-- Criação e revogação de links de solicitação (Edge Function crm-documentos)
create or replace function public.doc_criar_solicitacao(p_ator uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_cliente uuid := nullif(p ->> 'cliente_id', '')::uuid;
  v_caso uuid := nullif(p ->> 'caso_id', '')::uuid;
  v_lead uuid := nullif(p ->> 'lead_id', '')::uuid;
  v_dias integer := least(greatest(coalesce((p ->> 'validade_dias')::integer, 7), 1), 30);
  v_id uuid;
  v_expira timestamptz;
  v_invalidos integer;
begin
  perform public.servico_contexto(p_ator, 'edge:crm-documentos');
  perform public.exigir_permissao(p_ator, 'documentos.solicitar_cliente');

  select coalesce(array_agg(distinct x::uuid), '{}') into v_ids
  from jsonb_array_elements_text(case when jsonb_typeof(p -> 'documentos_ids') = 'array' then p -> 'documentos_ids' else '[]'::jsonb end) x;
  if cardinality(v_ids) = 0 then
    raise exception 'Selecione ao menos um documento para solicitar.';
  end if;

  if v_caso is not null then
    select k.cliente_id into v_cliente from public.casos k where k.id = v_caso;
  end if;
  if v_cliente is null and v_lead is null then
    raise exception 'Informe o cliente, o caso ou o lead.';
  end if;

  select count(*) into v_invalidos
  from unnest(v_ids) i
  left join public.documentos d on d.id = i
  where d.id is null
     or not d.cliente_pode_enviar
     or d.status in ('aprovado', 'dispensado')
     or (v_cliente is not null and d.cliente_id is distinct from v_cliente)
     or (v_cliente is null and d.lead_id is distinct from v_lead)
     or (v_caso is not null and d.caso_id is distinct from v_caso)
     or (d.clinico and not public.pode_ver_saude(d.cliente_id, d.lead_id))
     or (d.financeiro and not public.tem_permissao('financeiro.ver'));
  if v_invalidos > 0 then
    raise exception 'Há documentos que não podem ser solicitados por este link (aprovados, dispensados, de outro cliente ou sem permissão).';
  end if;

  v_expira := now() + make_interval(days => v_dias);
  insert into public.solicitacoes_documentos (lead_id, cliente_id, caso_id, token_hash, documentos_ids, mensagem, expira_em, criado_por)
  values (case when v_cliente is null then v_lead end, v_cliente, v_caso, p ->> 'token_hash', v_ids,
          nullif(left(trim(coalesce(p ->> 'mensagem', '')), 1000), ''), v_expira, p_ator)
  returning id into v_id;

  update public.documentos d set status = 'solicitado'
  where d.id = any (v_ids) and d.status in ('nao_solicitado', 'rejeitado');

  perform public.registrar_evento('solicitacao',
    format('Link de envio de documentos gerado (%s documento%s, válido até %s)',
      cardinality(v_ids), case when cardinality(v_ids) > 1 then 's' else '' end, public.formatar_data_hora(v_expira)),
    v_lead, v_cliente, v_caso, 'solicitacao', v_id);

  return jsonb_build_object('id', v_id, 'expira_em', v_expira);
end
$$;

create or replace function public.doc_revogar_solicitacao(p_ator uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.solicitacoes_documentos%rowtype;
begin
  perform public.servico_contexto(p_ator, 'edge:crm-documentos');
  perform public.exigir_permissao(p_ator, 'documentos.solicitar_cliente');
  update public.solicitacoes_documentos s set revogada_em = now(), revogada_por = p_ator
  where s.id = p_id and s.revogada_em is null
  returning s.* into v;
  if v.id is null then
    raise exception 'Link não encontrado ou já revogado.';
  end if;
  perform public.registrar_evento('solicitacao', 'Link de envio de documentos revogado',
    v.lead_id, v.cliente_id, v.caso_id, 'solicitacao', v.id);
end
$$;

-- -----------------------------------------------------------------------------
-- Administração de usuários e perfis (Edge Function crm-admin)
-- -----------------------------------------------------------------------------

create or replace function public.admin_salvar_usuario(p_ator uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_perfil text := p ->> 'perfil_id';
  v_ativo boolean := coalesce((p ->> 'ativo')::boolean, true);
  v_existente public.usuarios%rowtype;
  v_extra text[];
  v_negadas text[];
begin
  perform public.servico_contexto(p_ator, 'edge:crm-admin');
  perform public.exigir_permissao(p_ator, 'admin.usuarios');

  if v_id is null then
    raise exception 'Usuário inválido.';
  end if;
  if not exists (select 1 from public.perfis pf where pf.id = v_perfil) then
    raise exception 'Perfil inválido.';
  end if;
  if coalesce(length(trim(p ->> 'nome')), 0) < 2 then
    raise exception 'Informe o nome do usuário.';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_extra
  from jsonb_array_elements_text(case when jsonb_typeof(p -> 'permissoes_extra') = 'array' then p -> 'permissoes_extra' else '[]'::jsonb end) x
  where x in (select c.id from public.permissoes_catalogo c);
  select coalesce(array_agg(distinct x), '{}') into v_negadas
  from jsonb_array_elements_text(case when jsonb_typeof(p -> 'permissoes_negadas') = 'array' then p -> 'permissoes_negadas' else '[]'::jsonb end) x
  where x in (select c.id from public.permissoes_catalogo c);

  select u.* into v_existente from public.usuarios u where u.id = v_id;
  if v_id = p_ator and not v_ativo then
    raise exception 'Você não pode desativar a sua própria conta.';
  end if;
  if v_existente.id is not null and v_existente.perfil_id = 'admin' and v_existente.ativo
     and (v_perfil <> 'admin' or not v_ativo)
     and not exists (select 1 from public.usuarios u where u.perfil_id = 'admin' and u.ativo and u.id <> v_id) then
    raise exception 'É necessário manter ao menos um administrador ativo.';
  end if;

  insert into public.usuarios (id, nome, email, perfil_id, cargo, oab, telefone, cor, permissoes_extra, permissoes_negadas, ativo)
  values (v_id, trim(p ->> 'nome'), lower(trim(p ->> 'email')), v_perfil,
          nullif(trim(coalesce(p ->> 'cargo', '')), ''), nullif(trim(coalesce(p ->> 'oab', '')), ''),
          nullif(trim(coalesce(p ->> 'telefone', '')), ''),
          case when (p ->> 'cor') ~ '^#[0-9A-Fa-f]{6}$' then p ->> 'cor' else '#3D7B3E' end,
          v_extra, v_negadas, v_ativo)
  on conflict (id) do update set
    nome = excluded.nome,
    email = excluded.email,
    perfil_id = excluded.perfil_id,
    cargo = excluded.cargo,
    oab = excluded.oab,
    telefone = excluded.telefone,
    cor = excluded.cor,
    permissoes_extra = excluded.permissoes_extra,
    permissoes_negadas = excluded.permissoes_negadas,
    ativo = excluded.ativo;
end
$$;

-- Cria o primeiro administrador (somente enquanto não houver nenhum).
create or replace function public.admin_bootstrap(p_usuario uuid, p_nome text, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.usuarios u where u.perfil_id = 'admin' and u.ativo) then
    raise exception 'Já existe um administrador ativo. Use a área de Administração para criar novos usuários.';
  end if;
  perform public.servico_contexto(p_usuario, 'script:criar-admin');
  insert into public.usuarios (id, nome, email, perfil_id, ativo)
  values (p_usuario, trim(p_nome), lower(trim(p_email)), 'admin', true)
  on conflict (id) do update set perfil_id = 'admin', ativo = true, nome = excluded.nome, email = excluded.email;
end
$$;

create or replace function public.admin_salvar_perfil(p_ator uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := lower(trim(coalesce(p ->> 'id', '')));
  v_perms text[];
begin
  perform public.servico_contexto(p_ator, 'edge:crm-admin');
  perform public.exigir_permissao(p_ator, 'admin.usuarios');
  if v_id !~ '^[a-z0-9_]{2,40}$' then
    raise exception 'Identificador de perfil inválido (use letras minúsculas, números e _).';
  end if;
  if coalesce(length(trim(p ->> 'nome')), 0) < 2 then
    raise exception 'Informe o nome do perfil.';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_perms
  from jsonb_array_elements_text(case when jsonb_typeof(p -> 'permissoes') = 'array' then p -> 'permissoes' else '[]'::jsonb end) x
  where x in (select c.id from public.permissoes_catalogo c);

  if v_id = 'admin' then
    update public.perfis set nome = trim(p ->> 'nome'), descricao = nullif(trim(coalesce(p ->> 'descricao', '')), '')
    where id = 'admin';
    return;
  end if;

  insert into public.perfis (id, nome, descricao, permissoes, sistema, ordem)
  values (v_id, trim(p ->> 'nome'), nullif(trim(coalesce(p ->> 'descricao', '')), ''), v_perms, false,
          coalesce((p ->> 'ordem')::integer, 100))
  on conflict (id) do update set
    nome = excluded.nome,
    descricao = excluded.descricao,
    permissoes = excluded.permissoes;
end
$$;

create or replace function public.admin_excluir_perfil(p_ator uuid, p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.servico_contexto(p_ator, 'edge:crm-admin');
  perform public.exigir_permissao(p_ator, 'admin.usuarios');
  if exists (select 1 from public.perfis pf where pf.id = p_id and pf.sistema) then
    raise exception 'Perfis iniciais do sistema não podem ser excluídos.';
  end if;
  if exists (select 1 from public.usuarios u where u.perfil_id = p_id) then
    raise exception 'Há usuários com este perfil. Altere o perfil deles antes de excluir.';
  end if;
  delete from public.perfis where id = p_id;
end
$$;

-- -----------------------------------------------------------------------------
-- Financeiro (Edge Function crm-financeiro)
-- -----------------------------------------------------------------------------

create or replace function public.fin_validar_comprovante(p_arquivo uuid, p_cliente uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_arquivo is not null and not exists (
    select 1 from public.arquivos a
    where a.id = p_arquivo and a.bucket = 'crm-financeiro' and a.cliente_id = p_cliente and a.removido_em is null
  ) then
    raise exception 'Comprovante inválido para este cliente.';
  end if;
end
$$;

create or replace function public.fin_registrar_arquivo(p_ator uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente uuid := (p ->> 'cliente_id')::uuid;
  v_id uuid;
begin
  perform public.servico_contexto(p_ator, 'edge:crm-financeiro');
  if not (public.tem_permissao_usuario(p_ator, 'financeiro.lancar') or public.tem_permissao_usuario(p_ator, 'financeiro.contratos')) then
    raise exception 'Você não tem permissão para esta operação.' using errcode = '42501';
  end if;
  if (p ->> 'caminho') not like 'financeiro/' || v_cliente::text || '/%' then
    raise exception 'Caminho de arquivo inválido.';
  end if;
  insert into public.arquivos (bucket, caminho, nome, mime, tamanho, tipo, cliente_id, caso_id, financeiro, enviado_por)
  values ('crm-financeiro', p ->> 'caminho', left(p ->> 'nome', 255), left(p ->> 'mime', 120),
          nullif(p ->> 'tamanho', '')::bigint,
          case when p ->> 'tipo' = 'contrato' then 'contrato' else 'comprovante_financeiro' end,
          v_cliente, nullif(p ->> 'caso_id', '')::uuid, true, p_ator)
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.fin_criar_contrato(p_ator uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrato uuid;
  v_cliente uuid := nullif(p ->> 'cliente_id', '')::uuid;
  v_caso uuid := nullif(p ->> 'caso_id', '')::uuid;
  v_total numeric(14, 2) := round(coalesce(nullif(p ->> 'valor_total', '')::numeric, 0), 2);
  v_desconto numeric(14, 2) := round(coalesce(nullif(p ->> 'desconto', '')::numeric, 0), 2);
  v_acrescimo numeric(14, 2) := round(coalesce(nullif(p ->> 'acrescimo', '')::numeric, 0), 2);
  v_entrada numeric(14, 2) := round(coalesce(nullif(p -> 'entrada' ->> 'valor', '')::numeric, 0), 2);
  v_data_entrada date := nullif(p -> 'entrada' ->> 'data', '')::date;
  v_n integer := coalesce(nullif(p -> 'parcelas' ->> 'quantidade', '')::integer, 0);
  v_primeiro date := nullif(p -> 'parcelas' ->> 'primeiro_vencimento', '')::date;
  v_forma text := coalesce(nullif(p ->> 'forma_contratacao', ''), 'parcelado');
  v_descricao text := coalesce(nullif(trim(p ->> 'descricao'), ''), 'Honorários advocatícios');
  v_liquido numeric(14, 2);
  v_restante numeric(14, 2);
  v_base numeric(14, 2);
  v_i integer;
begin
  perform public.servico_contexto(p_ator, 'edge:crm-financeiro');
  perform public.exigir_permissao(p_ator, 'financeiro.contratos');
  if v_desconto > 0 then
    perform public.exigir_permissao(p_ator, 'financeiro.desconto');
  end if;
  if v_cliente is null or not exists (select 1 from public.clientes c where c.id = v_cliente) then
    raise exception 'Cliente não encontrado.';
  end if;
  if v_caso is not null and not exists (select 1 from public.casos k where k.id = v_caso and k.cliente_id = v_cliente) then
    raise exception 'O caso selecionado não pertence a este cliente.';
  end if;
  if v_total < 0 or v_desconto < 0 or v_acrescimo < 0 or v_entrada < 0 then
    raise exception 'Os valores não podem ser negativos.';
  end if;
  v_liquido := v_total - v_desconto + v_acrescimo;
  if v_liquido < 0 then
    raise exception 'O desconto não pode ser maior que o valor contratado.';
  end if;
  if v_entrada > v_liquido then
    raise exception 'A entrada não pode ser maior que o valor total.';
  end if;
  if v_entrada > 0 and v_data_entrada is null then
    raise exception 'Informe o vencimento da entrada.';
  end if;
  if v_n < 0 or v_n > 120 then
    raise exception 'Quantidade de parcelas inválida (0 a 120).';
  end if;
  v_restante := v_liquido - v_entrada;
  if v_restante > 0 and v_n = 0 then
    v_n := 1;
  end if;
  if v_restante > 0 and v_primeiro is null then
    raise exception 'Informe o vencimento da primeira parcela.';
  end if;

  insert into public.contratos (cliente_id, caso_id, descricao, forma_contratacao, valor_total, valor_entrada, data_entrada,
                                numero_parcelas, primeiro_vencimento, percentual_exito, desconto, acrescimo, data_assinatura,
                                arquivo_id, observacoes, created_by)
  values (v_cliente, v_caso, v_descricao, v_forma, v_total, v_entrada, v_data_entrada,
          case when v_restante > 0 then v_n else 0 end, v_primeiro, nullif(p ->> 'percentual_exito', '')::numeric,
          v_desconto, v_acrescimo, nullif(p ->> 'data_assinatura', '')::date,
          nullif(p ->> 'arquivo_id', '')::uuid, nullif(trim(coalesce(p ->> 'observacoes', '')), ''), p_ator)
  returning id into v_contrato;

  if v_entrada > 0 then
    insert into public.cobrancas (contrato_id, cliente_id, caso_id, categoria, descricao, parcela_numero, parcela_total,
                                  valor, vencimento, created_by)
    values (v_contrato, v_cliente, v_caso, 'honorarios', v_descricao || ' — entrada', 0,
            case when v_restante > 0 then v_n else 0 end, v_entrada, v_data_entrada, p_ator);
  end if;

  if v_restante > 0 then
    v_base := trunc(v_restante / v_n, 2);
    for v_i in 1..v_n loop
      insert into public.cobrancas (contrato_id, cliente_id, caso_id, categoria, descricao, parcela_numero, parcela_total,
                                    valor, vencimento, created_by)
      values (v_contrato, v_cliente, v_caso, 'honorarios',
              case when v_n = 1 then v_descricao else v_descricao || format(' — parcela %s/%s', v_i, v_n) end,
              v_i, v_n,
              case when v_i = v_n then v_restante - v_base * (v_n - 1) else v_base end,
              (v_primeiro + make_interval(months => v_i - 1))::date, p_ator);
    end loop;
  end if;

  return jsonb_build_object('contrato_id', v_contrato);
end
$$;

create or replace function public.fin_atualizar_contrato(p_ator uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.contratos%rowtype;
  v_status text;
begin
  perform public.servico_contexto(p_ator, 'edge:crm-financeiro');
  perform public.exigir_permissao(p_ator, 'financeiro.contratos');
  select c.* into v_c from public.contratos c where c.id = (p ->> 'id')::uuid for update;
  if not found then
    raise exception 'Contrato não encontrado.';
  end if;
  v_status := coalesce(nullif(p ->> 'status', ''), v_c.status);
  if v_status not in ('ativo', 'encerrado', 'cancelado') then
    raise exception 'Situação de contrato inválida.';
  end if;
  if p ? 'caso_id' and nullif(p ->> 'caso_id', '') is not null
     and not exists (select 1 from public.casos k where k.id = (p ->> 'caso_id')::uuid and k.cliente_id = v_c.cliente_id) then
    raise exception 'O caso selecionado não pertence a este cliente.';
  end if;

  update public.contratos c set
    descricao = coalesce(nullif(trim(p ->> 'descricao'), ''), c.descricao),
    forma_contratacao = coalesce(nullif(p ->> 'forma_contratacao', ''), c.forma_contratacao),
    observacoes = case when p ? 'observacoes' then nullif(trim(coalesce(p ->> 'observacoes', '')), '') else c.observacoes end,
    data_assinatura = case when p ? 'data_assinatura' then nullif(p ->> 'data_assinatura', '')::date else c.data_assinatura end,
    percentual_exito = case when p ? 'percentual_exito' then nullif(p ->> 'percentual_exito', '')::numeric else c.percentual_exito end,
    arquivo_id = case when p ? 'arquivo_id' then nullif(p ->> 'arquivo_id', '')::uuid else c.arquivo_id end,
    caso_id = case when p ? 'caso_id' then nullif(p ->> 'caso_id', '')::uuid else c.caso_id end,
    status = v_status
  where c.id = v_c.id;

  if v_status = 'cancelado' and coalesce((p ->> 'cancelar_abertas')::boolean, false) then
    update public.cobrancas cb set cancelada_em = now(), cancelada_por = p_ator,
      motivo_cancelamento = coalesce(nullif(trim(p ->> 'motivo'), ''), 'Contrato cancelado')
    where cb.contrato_id = v_c.id and cb.cancelada_em is null
      and not exists (select 1 from public.pagamentos pg where pg.cobranca_id = cb.id and pg.estornado_em is null);
  end if;
end
$$;

create or replace function public.fin_adicionar_cobranca(p_ator uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_cliente uuid := (p ->> 'cliente_id')::uuid;
  v_contrato uuid := nullif(p ->> 'contrato_id', '')::uuid;
  v_desconto numeric(14, 2) := round(coalesce(nullif(p ->> 'desconto', '')::numeric, 0), 2);
begin
  perform public.servico_contexto(p_ator, 'edge:crm-financeiro');
  perform public.exigir_permissao(p_ator, 'financeiro.contratos');
  if v_desconto > 0 then
    perform public.exigir_permissao(p_ator, 'financeiro.desconto');
  end if;
  if v_cliente is null or not exists (select 1 from public.clientes c where c.id = v_cliente) then
    raise exception 'Cliente não encontrado.';
  end if;
  if v_contrato is not null and not exists (select 1 from public.contratos c where c.id = v_contrato and c.cliente_id = v_cliente) then
    raise exception 'Contrato inválido para este cliente.';
  end if;
  if nullif(p ->> 'caso_id', '') is not null
     and not exists (select 1 from public.casos k where k.id = (p ->> 'caso_id')::uuid and k.cliente_id = v_cliente) then
    raise exception 'O caso selecionado não pertence a este cliente.';
  end if;
  if coalesce(nullif(p ->> 'valor', '')::numeric, -1) < 0 then
    raise exception 'Informe um valor válido.';
  end if;
  if nullif(p ->> 'vencimento', '') is null then
    raise exception 'Informe o vencimento.';
  end if;

  insert into public.cobrancas (contrato_id, cliente_id, caso_id, categoria, descricao, valor, desconto, acrescimo,
                                vencimento, observacoes, created_by)
  values (v_contrato, v_cliente, nullif(p ->> 'caso_id', '')::uuid,
          coalesce(nullif(p ->> 'categoria', ''), 'honorarios'),
          coalesce(nullif(trim(p ->> 'descricao'), ''), 'Honorários'),
          round((p ->> 'valor')::numeric, 2), v_desconto,
          round(coalesce(nullif(p ->> 'acrescimo', '')::numeric, 0), 2),
          (p ->> 'vencimento')::date, nullif(trim(coalesce(p ->> 'observacoes', '')), ''), p_ator)
  returning id into v_id;
  return v_id;
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
  if v_c.cancelada_em is not null then
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
  if v_valor - v_desconto + v_acrescimo < v_pago then
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
  if coalesce(trim(p ->> 'motivo'), '') = '' then
    raise exception 'Informe o motivo do cancelamento.';
  end if;
  if exists (select 1 from public.pagamentos pg where pg.cobranca_id = v_c.id and pg.estornado_em is null) then
    raise exception 'Esta cobrança possui pagamentos. Estorne o lançamento ou registre um reembolso antes de cancelar.';
  end if;
  update public.cobrancas c set cancelada_em = now(), cancelada_por = p_ator, motivo_cancelamento = trim(p ->> 'motivo')
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
  if v_c.cancelada_em is not null then
    raise exception 'Não é possível registrar pagamento em cobrança cancelada.';
  end if;
  if v_valor is null or v_valor <= 0 then
    raise exception 'Informe um valor maior que zero.';
  end if;
  if v_data is null then
    raise exception 'Informe a data do pagamento.';
  end if;
  if v_data > public.hoje_sp() then
    raise exception 'A data do pagamento não pode ser futura.';
  end if;
  if v_valor > v_c.saldo then
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
  if coalesce(trim(p ->> 'motivo'), '') = '' then
    raise exception 'Informe o motivo do estorno.';
  end if;
  if (select coalesce(sum(r.valor), 0) from public.reembolsos r where r.cobranca_id = v_p.cobranca_id) >
     (select coalesce(sum(pg.valor), 0) from public.pagamentos pg
      where pg.cobranca_id = v_p.cobranca_id and pg.estornado_em is null and pg.id <> v_p.id) then
    raise exception 'Há reembolsos vinculados a este pagamento. O estorno deixaria o reembolso sem pagamento correspondente.';
  end if;
  update public.pagamentos pg set estornado_em = now(), estornado_por = p_ator, motivo_estorno = trim(p ->> 'motivo')
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
  if v_valor > v_c.valor_pago - v_c.valor_reembolsado then
    raise exception 'O reembolso (%) não pode superar o valor pago e ainda não reembolsado (%).',
      public.formatar_moeda(v_valor), public.formatar_moeda(v_c.valor_pago - v_c.valor_reembolsado);
  end if;
  if coalesce(trim(p ->> 'motivo'), '') = '' then
    raise exception 'Informe o motivo do reembolso.';
  end if;
  perform public.fin_validar_comprovante(v_arquivo, v_c.cliente_id);
  insert into public.reembolsos (cobranca_id, cliente_id, caso_id, valor, data, forma, motivo, comprovante_arquivo_id, registrado_por)
  values (v_c.id, v_c.cliente_id, v_c.caso_id, v_valor, coalesce(nullif(p ->> 'data', '')::date, public.hoje_sp()),
          coalesce(nullif(p ->> 'forma', ''), 'pix'), trim(p ->> 'motivo'), v_arquivo, p_ator)
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.fin_registrar_despesa(p_ator uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_cobranca uuid;
  v_cliente uuid := (p ->> 'cliente_id')::uuid;
  v_caso uuid := nullif(p ->> 'caso_id', '')::uuid;
  v_valor numeric(14, 2) := round(nullif(p ->> 'valor', '')::numeric, 2);
  v_pago_por text := coalesce(nullif(p ->> 'pago_por', ''), 'escritorio');
  v_reembolsavel boolean := coalesce((p ->> 'reembolsavel')::boolean, true);
  v_arquivo uuid := nullif(p ->> 'comprovante_arquivo_id', '')::uuid;
  v_categoria text := coalesce(nullif(p ->> 'categoria', ''), 'despesa');
begin
  perform public.servico_contexto(p_ator, 'edge:crm-financeiro');
  perform public.exigir_permissao(p_ator, 'financeiro.lancar');
  if v_cliente is null or not exists (select 1 from public.clientes c where c.id = v_cliente) then
    raise exception 'Cliente não encontrado.';
  end if;
  if v_caso is not null and not exists (select 1 from public.casos k where k.id = v_caso and k.cliente_id = v_cliente) then
    raise exception 'O caso selecionado não pertence a este cliente.';
  end if;
  if v_valor is null or v_valor <= 0 then
    raise exception 'Informe um valor maior que zero.';
  end if;
  if coalesce(trim(p ->> 'descricao'), '') = '' then
    raise exception 'Informe a descrição.';
  end if;
  perform public.fin_validar_comprovante(v_arquivo, v_cliente);

  if v_pago_por = 'escritorio' and v_reembolsavel and coalesce((p ->> 'gerar_cobranca')::boolean, false) then
    insert into public.cobrancas (cliente_id, caso_id, categoria, descricao, valor, vencimento, created_by)
    values (v_cliente, v_caso, 'reembolso_despesas',
            'Reembolso de ' || case v_categoria when 'custas' then 'custas' else 'despesa' end || ': ' || trim(p ->> 'descricao'),
            v_valor, coalesce(nullif(p ->> 'vencimento_reembolso', '')::date, public.hoje_sp() + 7), p_ator)
    returning id into v_cobranca;
  end if;

  insert into public.despesas (cliente_id, caso_id, categoria, descricao, valor, data, pago_por, reembolsavel,
                               cobranca_reembolso_id, comprovante_arquivo_id, observacao, registrado_por)
  values (v_cliente, v_caso, v_categoria, trim(p ->> 'descricao'), v_valor,
          coalesce(nullif(p ->> 'data', '')::date, public.hoje_sp()), v_pago_por,
          v_pago_por = 'escritorio' and v_reembolsavel, v_cobranca, v_arquivo,
          nullif(trim(coalesce(p ->> 'observacao', '')), ''), p_ator)
  returning id into v_id;
  return jsonb_build_object('despesa_id', v_id, 'cobranca_id', v_cobranca);
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
  if coalesce(trim(p ->> 'motivo'), '') = '' then
    raise exception 'Informe o motivo do cancelamento.';
  end if;
  if v_d.cobranca_reembolso_id is not null then
    if exists (select 1 from public.pagamentos pg where pg.cobranca_id = v_d.cobranca_reembolso_id and pg.estornado_em is null) then
      raise exception 'O reembolso desta despesa já recebeu pagamentos. Estorne-os antes de cancelar.';
    end if;
    update public.cobrancas c set cancelada_em = now(), cancelada_por = p_ator,
      motivo_cancelamento = 'Despesa cancelada: ' || trim(p ->> 'motivo')
    where c.id = v_d.cobranca_reembolso_id and c.cancelada_em is null;
  end if;
  update public.despesas d set cancelada_em = now(), cancelada_por = p_ator, motivo_cancelamento = trim(p ->> 'motivo')
  where d.id = v_d.id;
end
$$;

-- -----------------------------------------------------------------------------
-- Importação de clientes (Edge Function crm-importacao)
-- -----------------------------------------------------------------------------

create or replace function public.importar_buscar_duplicados(p_cpfs text[], p_emails text[], p_telefones text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with chaves as (
    select coalesce(array_agg(distinct public.chave_telefone(t)) filter (where public.chave_telefone(t) is not null), '{}') as tels
    from unnest(coalesce(p_telefones, '{}')) t
  )
  select jsonb_build_object(
    'clientes', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'codigo', c.codigo, 'nome', c.nome,
               'cpf', c.cpf_cnpj_norm, 'email', c.email_norm, 'telefone', c.telefone_chave,
               'arquivado', c.arquivado_em is not null))
      from public.clientes c, chaves k
      where c.cpf_cnpj_norm = any (coalesce(p_cpfs, '{}'))
         or c.email_norm = any (coalesce(p_emails, '{}'))
         or c.telefone_chave = any (k.tels)
    ), '[]'::jsonb),
    'leads', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'codigo', l.codigo, 'nome', l.nome,
               'cpf', l.cpf_norm, 'email', l.email_norm, 'telefone', l.telefone_chave))
      from public.leads l, chaves k
      where l.cliente_id is null and l.mesclado_em_id is null and l.arquivado_em is null
        and (l.cpf_norm = any (coalesce(p_cpfs, '{}'))
             or l.email_norm = any (coalesce(p_emails, '{}'))
             or l.telefone_chave = any (k.tels))
    ), '[]'::jsonb)
  )
  from chaves k
$$;

create or replace function public.importar_clientes(p_ator uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha jsonb;
  v_d jsonb;
  v_acao text;
  v_campos text[];
  v_id uuid;
  v_caso uuid;
  v_resp uuid;
  v_tipo uuid;
  v_antes jsonb;
  v_depois jsonb;
  v_alterados text[];
  v_relatorio jsonb := '[]'::jsonb;
  v_criados integer := 0;
  v_atualizados integer := 0;
  v_ignorados integer := 0;
  v_erros integer := 0;
  v_import uuid;
  v_msg text;
  v_permitidos constant text[] := array['nome', 'tipo_pessoa', 'cpf_cnpj', 'rg', 'data_nascimento', 'email', 'whatsapp',
    'telefone_secundario', 'profissao', 'estado_civil', 'nacionalidade', 'cep', 'logradouro', 'numero', 'complemento',
    'bairro', 'cidade', 'uf', 'observacoes'];
begin
  perform public.servico_contexto(p_ator, 'edge:crm-importacao');
  perform public.exigir_permissao(p_ator, 'dados.importar');
  perform public.exigir_permissao(p_ator, 'clientes.editar');

  if jsonb_typeof(p -> 'linhas') <> 'array' or jsonb_array_length(p -> 'linhas') = 0 then
    raise exception 'Nenhuma linha para importar.';
  end if;
  if jsonb_array_length(p -> 'linhas') > 5000 then
    raise exception 'Limite de 5.000 linhas por importação.';
  end if;

  for v_linha in select * from jsonb_array_elements(p -> 'linhas') loop
    v_acao := coalesce(v_linha ->> 'acao', 'ignorar');
    v_d := coalesce(v_linha -> 'dados', '{}'::jsonb);
    v_id := nullif(v_linha ->> 'cliente_id', '')::uuid;
    v_caso := null;
    begin
      v_resp := null;
      if nullif(v_d ->> 'responsavel_email', '') is not null then
        select u.id into v_resp from public.usuarios u where u.email = lower(trim(v_d ->> 'responsavel_email')) and u.ativo;
      end if;

      if v_acao = 'ignorar' then
        v_ignorados := v_ignorados + 1;
        v_relatorio := v_relatorio || jsonb_build_object('linha', v_linha -> 'linha', 'resultado', 'ignorado');

      elsif v_acao = 'criar' then
        if coalesce(trim(v_d ->> 'nome'), '') = '' then
          raise exception 'import:nome';
        end if;
        insert into public.clientes (tipo_pessoa, nome, cpf_cnpj, rg, data_nascimento, email, whatsapp, telefone_secundario,
          profissao, estado_civil, nacionalidade, cep, logradouro, numero, complemento, bairro, cidade, uf, observacoes,
          responsavel_id, origem)
        values (
          coalesce(nullif(v_d ->> 'tipo_pessoa', ''), 'PF'), trim(v_d ->> 'nome'), nullif(trim(coalesce(v_d ->> 'cpf_cnpj', '')), ''),
          nullif(trim(coalesce(v_d ->> 'rg', '')), ''), nullif(v_d ->> 'data_nascimento', '')::date,
          nullif(trim(coalesce(v_d ->> 'email', '')), ''), nullif(trim(coalesce(v_d ->> 'whatsapp', '')), ''),
          nullif(trim(coalesce(v_d ->> 'telefone_secundario', '')), ''), nullif(trim(coalesce(v_d ->> 'profissao', '')), ''),
          nullif(trim(coalesce(v_d ->> 'estado_civil', '')), ''), nullif(trim(coalesce(v_d ->> 'nacionalidade', '')), ''),
          nullif(trim(coalesce(v_d ->> 'cep', '')), ''), nullif(trim(coalesce(v_d ->> 'logradouro', '')), ''),
          nullif(trim(coalesce(v_d ->> 'numero', '')), ''), nullif(trim(coalesce(v_d ->> 'complemento', '')), ''),
          nullif(trim(coalesce(v_d ->> 'bairro', '')), ''), nullif(trim(coalesce(v_d ->> 'cidade', '')), ''),
          nullif(upper(trim(coalesce(v_d ->> 'uf', ''))), ''), nullif(trim(coalesce(v_d ->> 'observacoes', '')), ''),
          coalesce(v_resp, p_ator), 'importacao')
        returning id into v_id;

        if nullif(trim(coalesce(v_d ->> 'caso_titulo', '')), '') is not null
           or nullif(trim(coalesce(v_d ->> 'numero_processo', '')), '') is not null
           or nullif(trim(coalesce(v_d ->> 'tipo_demanda', '')), '') is not null then
          v_tipo := null;
          if nullif(trim(coalesce(v_d ->> 'tipo_demanda', '')), '') is not null then
            select t.id into v_tipo from public.tipos_demanda t where lower(t.nome) = lower(trim(v_d ->> 'tipo_demanda')) limit 1;
          end if;
          insert into public.casos (cliente_id, titulo, natureza, tipo_demanda_id, responsavel_id)
          values (v_id,
                  coalesce(nullif(trim(coalesce(v_d ->> 'caso_titulo', '')), ''), nullif(trim(coalesce(v_d ->> 'tipo_demanda', '')), ''), 'Caso importado'),
                  case when nullif(trim(coalesce(v_d ->> 'numero_processo', '')), '') is not null then 'judicial' else 'interno' end,
                  v_tipo, coalesce(v_resp, p_ator))
          returning id into v_caso;
          if nullif(trim(coalesce(v_d ->> 'numero_processo', '')), '') is not null then
            insert into public.processos (caso_id, numero, tribunal, principal, fonte)
            values (v_caso, trim(v_d ->> 'numero_processo'), nullif(trim(coalesce(v_d ->> 'tribunal', '')), ''), true, 'importacao');
          end if;
        end if;

        v_criados := v_criados + 1;
        v_relatorio := v_relatorio || jsonb_build_object('linha', v_linha -> 'linha', 'resultado', 'criado',
          'cliente_id', v_id, 'caso_id', v_caso);

      elsif v_acao in ('completar', 'atualizar') then
        if v_id is null then
          raise exception 'import:alvo';
        end if;
        select to_jsonb(c) into v_antes from public.clientes c where c.id = v_id for update;
        if v_antes is null then
          raise exception 'import:alvo';
        end if;
        select coalesce(array_agg(x), '{}') into v_campos
        from jsonb_array_elements_text(case when jsonb_typeof(v_linha -> 'campos') = 'array' then v_linha -> 'campos' else '[]'::jsonb end) x
        where x = any (v_permitidos);

        update public.clientes c set
          nome = case when v_acao = 'atualizar' and 'nome' = any (v_campos) and nullif(trim(coalesce(v_d ->> 'nome', '')), '') is not null then trim(v_d ->> 'nome') else c.nome end,
          tipo_pessoa = case when v_acao = 'atualizar' and 'tipo_pessoa' = any (v_campos) and nullif(v_d ->> 'tipo_pessoa', '') is not null then v_d ->> 'tipo_pessoa' else c.tipo_pessoa end,
          cpf_cnpj = case when v_acao = 'completar' then coalesce(c.cpf_cnpj, nullif(trim(coalesce(v_d ->> 'cpf_cnpj', '')), ''))
                          when 'cpf_cnpj' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'cpf_cnpj', '')), ''), c.cpf_cnpj) else c.cpf_cnpj end,
          rg = case when v_acao = 'completar' then coalesce(c.rg, nullif(trim(coalesce(v_d ->> 'rg', '')), ''))
                    when 'rg' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'rg', '')), ''), c.rg) else c.rg end,
          data_nascimento = case when v_acao = 'completar' then coalesce(c.data_nascimento, nullif(v_d ->> 'data_nascimento', '')::date)
                    when 'data_nascimento' = any (v_campos) then coalesce(nullif(v_d ->> 'data_nascimento', '')::date, c.data_nascimento) else c.data_nascimento end,
          email = case when v_acao = 'completar' then coalesce(c.email, nullif(trim(coalesce(v_d ->> 'email', '')), ''))
                    when 'email' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'email', '')), ''), c.email) else c.email end,
          whatsapp = case when v_acao = 'completar' then coalesce(c.whatsapp, nullif(trim(coalesce(v_d ->> 'whatsapp', '')), ''))
                    when 'whatsapp' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'whatsapp', '')), ''), c.whatsapp) else c.whatsapp end,
          telefone_secundario = case when v_acao = 'completar' then coalesce(c.telefone_secundario, nullif(trim(coalesce(v_d ->> 'telefone_secundario', '')), ''))
                    when 'telefone_secundario' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'telefone_secundario', '')), ''), c.telefone_secundario) else c.telefone_secundario end,
          profissao = case when v_acao = 'completar' then coalesce(c.profissao, nullif(trim(coalesce(v_d ->> 'profissao', '')), ''))
                    when 'profissao' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'profissao', '')), ''), c.profissao) else c.profissao end,
          estado_civil = case when v_acao = 'completar' then coalesce(c.estado_civil, nullif(trim(coalesce(v_d ->> 'estado_civil', '')), ''))
                    when 'estado_civil' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'estado_civil', '')), ''), c.estado_civil) else c.estado_civil end,
          nacionalidade = case when v_acao = 'completar' then coalesce(c.nacionalidade, nullif(trim(coalesce(v_d ->> 'nacionalidade', '')), ''))
                    when 'nacionalidade' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'nacionalidade', '')), ''), c.nacionalidade) else c.nacionalidade end,
          cep = case when v_acao = 'completar' then coalesce(c.cep, nullif(trim(coalesce(v_d ->> 'cep', '')), ''))
                    when 'cep' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'cep', '')), ''), c.cep) else c.cep end,
          logradouro = case when v_acao = 'completar' then coalesce(c.logradouro, nullif(trim(coalesce(v_d ->> 'logradouro', '')), ''))
                    when 'logradouro' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'logradouro', '')), ''), c.logradouro) else c.logradouro end,
          numero = case when v_acao = 'completar' then coalesce(c.numero, nullif(trim(coalesce(v_d ->> 'numero', '')), ''))
                    when 'numero' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'numero', '')), ''), c.numero) else c.numero end,
          complemento = case when v_acao = 'completar' then coalesce(c.complemento, nullif(trim(coalesce(v_d ->> 'complemento', '')), ''))
                    when 'complemento' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'complemento', '')), ''), c.complemento) else c.complemento end,
          bairro = case when v_acao = 'completar' then coalesce(c.bairro, nullif(trim(coalesce(v_d ->> 'bairro', '')), ''))
                    when 'bairro' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'bairro', '')), ''), c.bairro) else c.bairro end,
          cidade = case when v_acao = 'completar' then coalesce(c.cidade, nullif(trim(coalesce(v_d ->> 'cidade', '')), ''))
                    when 'cidade' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'cidade', '')), ''), c.cidade) else c.cidade end,
          uf = case when v_acao = 'completar' then coalesce(c.uf, nullif(upper(trim(coalesce(v_d ->> 'uf', ''))), ''))
                    when 'uf' = any (v_campos) then coalesce(nullif(upper(trim(coalesce(v_d ->> 'uf', ''))), ''), c.uf) else c.uf end,
          observacoes = case when v_acao = 'completar' then coalesce(c.observacoes, nullif(trim(coalesce(v_d ->> 'observacoes', '')), ''))
                    when 'observacoes' = any (v_campos) then coalesce(nullif(trim(coalesce(v_d ->> 'observacoes', '')), ''), c.observacoes) else c.observacoes end
        where c.id = v_id;

        select to_jsonb(c) into v_depois from public.clientes c where c.id = v_id;
        select coalesce(array_agg(k), '{}') into v_alterados
        from unnest(v_permitidos) k
        where (v_antes -> k) is distinct from (v_depois -> k);

        v_atualizados := v_atualizados + 1;
        v_relatorio := v_relatorio || jsonb_build_object('linha', v_linha -> 'linha',
          'resultado', case when cardinality(v_alterados) = 0 then 'sem_alteracao' when v_acao = 'completar' then 'completado' else 'atualizado' end,
          'cliente_id', v_id, 'campos', to_jsonb(v_alterados));
      else
        raise exception 'import:acao';
      end if;

    exception when others then
      v_msg := case
        when sqlerrm = 'import:nome' then 'Nome obrigatório.'
        when sqlerrm = 'import:alvo' then 'Cliente existente não encontrado para atualização.'
        when sqlerrm = 'import:acao' then 'Ação inválida.'
        when sqlstate = '23505' and sqlerrm like '%cpf%' then 'CPF/CNPJ já cadastrado em outro cliente.'
        when sqlstate = '23505' and sqlerrm like '%processos_numero%' then 'Número de processo já cadastrado em outro caso.'
        when sqlstate = '23505' then 'Registro duplicado.'
        when sqlstate = '22007' or sqlstate = '22008' then 'Data inválida.'
        when sqlstate = '23514' then 'Valor fora do formato aceito.'
        else 'Não foi possível importar esta linha (código ' || sqlstate || ').'
      end;
      v_erros := v_erros + 1;
      v_relatorio := v_relatorio || jsonb_build_object('linha', v_linha -> 'linha', 'resultado', 'erro', 'mensagem', v_msg);
    end;
  end loop;

  insert into public.importacoes (tipo, arquivo_nome, total_linhas, criados, atualizados, ignorados, erros, mapeamento,
                                  relatorio, status, usuario_id)
  values ('clientes', left(p ->> 'arquivo_nome', 200), jsonb_array_length(p -> 'linhas'), v_criados, v_atualizados,
          v_ignorados, v_erros, coalesce(p -> 'mapeamento', '{}'::jsonb), v_relatorio, 'concluida', p_ator)
  returning id into v_import;

  return jsonb_build_object('importacao_id', v_import, 'criados', v_criados, 'atualizados', v_atualizados,
                            'ignorados', v_ignorados, 'erros', v_erros, 'relatorio', v_relatorio);
end
$$;
