-- =============================================================================
-- CRM Amado & Amado Jr. — 10. Funções de negócio usadas pela interface
-- (conversão de lead, criação de caso, checklists, modelos de tarefas,
-- mesclagem de duplicados, detecção de duplicidade e busca global)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Condições seguras dos modelos de checklist
-- Somente campos da lista abaixo podem ser usados em regras.
-- -----------------------------------------------------------------------------

create or replace function public.avaliar_condicao_documento(p_cond jsonb, p_cliente uuid, p_caso uuid, p_lead uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_campo text := p_cond ->> 'campo';
  v_op text := coalesce(p_cond ->> 'operador', 'igual');
  v_valor jsonb := p_cond -> 'valor';
  v_atual jsonb;
  v_lead uuid := p_lead;
  v_permitidos constant text[] := array[
    'cliente.possui_representante', 'cliente.tipo_pessoa', 'cliente.uf', 'cliente.estado_civil',
    'caso.natureza', 'caso.tipo_demanda_id', 'caso.segredo_justica',
    'lead.quiz_cultiva', 'lead.quiz_consulta_medica', 'lead.quiz_motivacao', 'lead.faixa_renda', 'lead.estado'
  ];
begin
  if p_cond is null or jsonb_typeof(p_cond) <> 'object' or v_campo is null then
    return null;
  end if;
  if not (v_campo = any (v_permitidos) or v_campo ~ '^campo:[0-9a-f-]{36}$') then
    return null;
  end if;

  if v_lead is null and p_cliente is not null then
    select c.lead_origem_id into v_lead from public.clientes c where c.id = p_cliente;
  end if;
  if v_lead is null and p_caso is not null then
    select k.lead_id into v_lead from public.casos k where k.id = p_caso;
  end if;

  if v_campo like 'cliente.%' then
    if p_cliente is null then return null; end if;
    select to_jsonb(c) -> substr(v_campo, 9) into v_atual from public.clientes c where c.id = p_cliente;
  elsif v_campo like 'caso.%' then
    if p_caso is null then return null; end if;
    select to_jsonb(k) -> substr(v_campo, 6) into v_atual from public.casos k where k.id = p_caso;
  elsif v_campo like 'lead.%' then
    if v_lead is null then return null; end if;
    select to_jsonb(l) -> substr(v_campo, 6) into v_atual from public.leads l where l.id = v_lead;
  else
    select v.valor into v_atual from public.valores_personalizados v
    where v.campo_id = substr(v_campo, 7)::uuid
      and v.registro_id in (p_cliente, p_caso, v_lead)
    limit 1;
  end if;

  return case v_op
    when 'igual' then
      v_atual = v_valor
      or (jsonb_typeof(v_atual) = 'string' and jsonb_typeof(v_valor) = 'string'
          and lower(v_atual #>> '{}') = lower(v_valor #>> '{}'))
    when 'diferente' then
      not (coalesce(v_atual = v_valor, false)
           or (jsonb_typeof(v_atual) = 'string' and jsonb_typeof(v_valor) = 'string'
               and lower(v_atual #>> '{}') = lower(v_valor #>> '{}')))
    when 'contem' then
      case when jsonb_typeof(v_atual) = 'array' then v_atual @> jsonb_build_array(v_valor)
           else position(lower(coalesce(v_valor #>> '{}', '')) in lower(coalesce(v_atual #>> '{}', ''))) > 0 end
    when 'preenchido' then
      v_atual is not null and v_atual <> 'null'::jsonb and coalesce(v_atual #>> '{}', '') not in ('', 'false', '[]')
    when 'vazio' then
      v_atual is null or v_atual = 'null'::jsonb or coalesce(v_atual #>> '{}', '') in ('', 'false', '[]')
    else null
  end;
end
$$;

-- -----------------------------------------------------------------------------
-- Aplicar modelo de checklist a um caso, cliente ou lead
-- Itens já aplicados (mesmo item do modelo) não são duplicados.
-- -----------------------------------------------------------------------------

create or replace function public.aplicar_checklist(p_modelo uuid, p_caso uuid default null, p_cliente uuid default null, p_lead uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_cliente uuid := p_cliente;
  v_lead uuid := p_lead;
  v_resp uuid;
  v_cond boolean;
  v_obrig boolean;
  v_status text;
  v_motivo text;
  v_obs text;
  v_revisor uuid;
  v_n integer := 0;
  v_nome_modelo text;
begin
  if not public.tem_permissao('documentos.editar') then
    raise exception 'Você não tem permissão para aplicar checklists.' using errcode = '42501';
  end if;
  select m.nome into v_nome_modelo from public.modelos_checklist m where m.id = p_modelo and m.ativo;
  if v_nome_modelo is null then
    raise exception 'Modelo de checklist não encontrado ou inativo.';
  end if;

  if p_caso is not null then
    select k.cliente_id, k.responsavel_id into v_cliente, v_resp from public.casos k where k.id = p_caso;
    if v_cliente is null then
      raise exception 'Caso não encontrado.';
    end if;
    v_lead := null;
  elsif v_cliente is not null then
    select c.responsavel_id into v_resp from public.clientes c where c.id = v_cliente;
    v_lead := null;
  elsif v_lead is not null then
    select l.responsavel_id into v_resp from public.leads l where l.id = v_lead;
  else
    raise exception 'Informe o caso, o cliente ou o lead para aplicar o checklist.';
  end if;

  for v_item in
    select i.*, g.nome as grupo_nome, coalesce(g.ordem, 0) as grupo_ordem
    from public.modelos_checklist_itens i
    left join public.modelos_checklist_grupos g on g.id = i.grupo_id
    where i.modelo_id = p_modelo and i.ativo
    order by coalesce(g.ordem, 0), i.ordem, i.nome
  loop
    if exists (
      select 1 from public.documentos d
      where d.modelo_item_id = v_item.id
        and (
          (p_caso is not null and d.caso_id = p_caso)
          or (p_caso is null and v_cliente is not null and d.cliente_id = v_cliente and d.caso_id is null)
          or (p_caso is null and v_cliente is null and d.lead_id = v_lead)
        )
    ) then
      continue;
    end if;

    v_obrig := v_item.obrigatoriedade <> 'opcional';
    v_status := 'nao_solicitado';
    v_motivo := null;
    v_obs := null;
    if v_item.obrigatoriedade = 'condicional' then
      v_cond := public.avaliar_condicao_documento(v_item.condicao, v_cliente, p_caso, v_lead);
      if v_cond is false then
        v_obrig := false;
        v_status := 'dispensado';
        v_motivo := 'Condição não atendida ao aplicar o modelo: ' || coalesce(v_item.condicao_descricao, 'regra do modelo') || '. Revise se necessário.';
      elsif v_cond is null then
        v_obs := 'Condição a conferir pela equipe: ' || coalesce(v_item.condicao_descricao, 'regra do modelo') || '.';
      end if;
    end if;

    v_revisor := case v_item.revisor_tipo
      when 'usuario' then v_item.revisor_usuario_id
      when 'perfil' then (select u.id from public.usuarios u where u.ativo and u.perfil_id = v_item.revisor_perfil_id order by u.nome limit 1)
      else v_resp
    end;

    insert into public.documentos (
      lead_id, cliente_id, caso_id, modelo_id, modelo_item_id, grupo, categoria_id, nome,
      descricao_cliente, instrucao_equipe, obrigatorio, condicao_descricao, status, prazo,
      revisor_id, etapa, validade_dias, cliente_pode_enviar, dispensado_motivo, observacoes, ordem
    ) values (
      v_lead, v_cliente, p_caso, p_modelo, v_item.id, v_item.grupo_nome, v_item.categoria_id, v_item.nome,
      v_item.descricao_cliente, v_item.instrucao_equipe, v_obrig, v_item.condicao_descricao, v_status,
      case when v_item.prazo_dias is not null then public.hoje_sp() + v_item.prazo_dias end,
      v_revisor, v_item.etapa, v_item.validade_dias, v_item.cliente_pode_enviar, v_motivo, v_obs,
      v_item.grupo_ordem * 1000 + v_item.ordem
    );
    v_n := v_n + 1;
  end loop;

  if v_n > 0 then
    perform public.registrar_evento('documento',
      format('Checklist aplicado: %s (%s itens)', v_nome_modelo, v_n),
      v_lead, v_cliente, p_caso, 'modelo_checklist', p_modelo);
  end if;
  return v_n;
end
$$;

-- -----------------------------------------------------------------------------
-- Aplicar modelo de tarefas (etapas de preparação da ação) a um caso
-- -----------------------------------------------------------------------------

create or replace function public.aplicar_modelo_tarefas(p_modelo uuid, p_caso uuid, p_data_base date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modelo public.modelos_tarefas%rowtype;
  v_caso public.casos%rowtype;
  v_item jsonb;
  v_map jsonb := '{}';
  v_id uuid;
  v_resp uuid;
  v_checklist jsonb;
  v_base date := coalesce(p_data_base, public.hoje_sp());
  v_n integer := 0;
begin
  if not public.tem_permissao('tarefas.editar') then
    raise exception 'Você não tem permissão para aplicar modelos de tarefas.' using errcode = '42501';
  end if;
  select m.* into v_modelo from public.modelos_tarefas m where m.id = p_modelo and m.ativo;
  if not found then
    raise exception 'Modelo de tarefas não encontrado ou inativo.';
  end if;
  select k.* into v_caso from public.casos k where k.id = p_caso;
  if not found then
    raise exception 'Caso não encontrado.';
  end if;

  for v_item in select * from jsonb_array_elements(v_modelo.itens) loop
    if coalesce(trim(v_item ->> 'titulo'), '') = '' then
      continue;
    end if;
    v_resp := case v_item -> 'responsavel' ->> 'tipo'
      when 'usuario' then (select u.id from public.usuarios u where u.id = nullif(v_item -> 'responsavel' ->> 'valor', '')::uuid and u.ativo)
      when 'perfil' then (select u.id from public.usuarios u where u.ativo and u.perfil_id = v_item -> 'responsavel' ->> 'valor' order by u.nome limit 1)
      else v_caso.responsavel_id
    end;
    select coalesce(jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'texto', x, 'feito', false)), '[]')
      into v_checklist
      from jsonb_array_elements_text(case when jsonb_typeof(v_item -> 'checklist') = 'array' then v_item -> 'checklist' else '[]'::jsonb end) x;

    insert into public.tarefas (titulo, descricao, prioridade, responsavel_id, prazo, prazo_dia_inteiro,
                                caso_id, cliente_id, checklist, origem, modelo_id)
    values (
      left(v_item ->> 'titulo', 200),
      v_item ->> 'descricao',
      coalesce(nullif(v_item ->> 'prioridade', ''), 'media'),
      v_resp,
      case when nullif(v_item ->> 'prazo_dias', '') is not null
        then ((v_base + (v_item ->> 'prazo_dias')::integer)::timestamp + time '23:59') at time zone 'America/Sao_Paulo'
      end,
      true,
      p_caso,
      v_caso.cliente_id,
      v_checklist,
      'modelo',
      p_modelo
    )
    returning id into v_id;
    v_map := v_map || jsonb_build_object(coalesce(v_item ->> 'id', v_n::text), v_id);
    v_n := v_n + 1;
  end loop;

  for v_item in select * from jsonb_array_elements(v_modelo.itens) loop
    if nullif(v_item ->> 'depende_de', '') is not null and v_map ? (v_item ->> 'depende_de') and v_map ? (v_item ->> 'id') then
      update public.tarefas t set depende_de = (v_map ->> (v_item ->> 'depende_de'))::uuid
      where t.id = (v_map ->> (v_item ->> 'id'))::uuid;
    end if;
  end loop;

  if v_n > 0 then
    perform public.registrar_evento('tarefa', format('Modelo de tarefas aplicado: %s (%s tarefas)', v_modelo.nome, v_n),
      null, v_caso.cliente_id, p_caso, 'modelo_tarefas', p_modelo);
  end if;
  return v_n;
end
$$;

-- -----------------------------------------------------------------------------
-- Criar caso (com processo, checklist e modelo de tarefas opcionais)
-- -----------------------------------------------------------------------------

create or replace function public.criar_caso(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caso uuid;
  v_tipo public.tipos_demanda%rowtype;
  v_cliente uuid := nullif(p ->> 'cliente_id', '')::uuid;
  v_modelo uuid;
  v_modelo_tarefas uuid;
  v_equipe uuid[];
begin
  if not public.tem_permissao('casos.editar') then
    raise exception 'Você não tem permissão para criar casos.' using errcode = '42501';
  end if;
  if v_cliente is null or not exists (select 1 from public.clientes c where c.id = v_cliente) then
    raise exception 'Selecione o cliente do caso.';
  end if;
  if nullif(p ->> 'tipo_demanda_id', '') is not null then
    select t.* into v_tipo from public.tipos_demanda t where t.id = (p ->> 'tipo_demanda_id')::uuid;
  end if;
  select coalesce(array_agg(x::uuid), '{}') into v_equipe
    from jsonb_array_elements_text(case when jsonb_typeof(p -> 'equipe') = 'array' then p -> 'equipe' else '[]'::jsonb end) x;

  insert into public.casos (cliente_id, lead_id, titulo, natureza, tipo_demanda_id, objeto, fase_id, status,
                            responsavel_id, equipe, prioridade, data_abertura, observacoes, segredo_justica)
  values (
    v_cliente,
    nullif(p ->> 'lead_id', '')::uuid,
    coalesce(nullif(trim(p ->> 'titulo'), ''), v_tipo.nome, 'Novo caso'),
    coalesce(nullif(p ->> 'natureza', ''), 'interno'),
    v_tipo.id,
    nullif(p ->> 'objeto', ''),
    nullif(p ->> 'fase_id', '')::uuid,
    'ativo',
    coalesce(nullif(p ->> 'responsavel_id', '')::uuid, public.usuario_atual()),
    v_equipe,
    coalesce(nullif(p ->> 'prioridade', ''), 'media'),
    coalesce(nullif(p ->> 'data_abertura', '')::date, public.hoje_sp()),
    nullif(p ->> 'observacoes', ''),
    coalesce((p ->> 'segredo_justica')::boolean, true)
  )
  returning id into v_caso;

  if nullif(trim(coalesce(p ->> 'numero_processo', '')), '') is not null or nullif(trim(coalesce(p ->> 'tribunal', '')), '') is not null then
    begin
      insert into public.processos (caso_id, numero, tribunal, orgao, classe, principal)
      values (v_caso, nullif(trim(p ->> 'numero_processo'), ''), nullif(trim(p ->> 'tribunal'), ''),
              nullif(trim(p ->> 'orgao'), ''), nullif(trim(p ->> 'classe'), ''), true);
    exception when unique_violation then
      raise exception 'O número de processo % já está cadastrado em outro caso.', p ->> 'numero_processo';
    end;
  end if;

  v_modelo := coalesce(nullif(p ->> 'modelo_checklist_id', '')::uuid,
                       case when coalesce((p ->> 'aplicar_checklist')::boolean, false) then v_tipo.modelo_checklist_id end);
  if v_modelo is not null and public.tem_permissao('documentos.editar') then
    perform public.aplicar_checklist(v_modelo, v_caso, null, null);
  end if;

  v_modelo_tarefas := coalesce(nullif(p ->> 'modelo_tarefas_id', '')::uuid,
                               case when coalesce((p ->> 'aplicar_tarefas')::boolean, false) then v_tipo.modelo_tarefas_id end);
  if v_modelo_tarefas is not null and public.tem_permissao('tarefas.editar') then
    perform public.aplicar_modelo_tarefas(v_modelo_tarefas, v_caso, public.hoje_sp());
  end if;

  return v_caso;
end
$$;

-- -----------------------------------------------------------------------------
-- Conversão de lead em cliente (sem perda de informações)
-- -----------------------------------------------------------------------------

create or replace function public.converter_lead(p_lead uuid, p_dados jsonb default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_cliente uuid := nullif(p_dados ->> 'cliente_existente_id', '')::uuid;
  v_caso uuid;
  v_ganha uuid;
  v_cpf text := public.normalizar_documento(p_dados ->> 'cpf_cnpj');
  v_existente text;
begin
  if not (public.tem_permissao('leads.editar') and public.tem_permissao('clientes.editar')) then
    raise exception 'Você não tem permissão para converter leads em clientes.' using errcode = '42501';
  end if;

  select l.* into v_lead from public.leads l where l.id = p_lead for update;
  if not found then
    raise exception 'Lead não encontrado.';
  end if;
  if v_lead.cliente_id is not null then
    raise exception 'Este lead já foi convertido em cliente.';
  end if;
  if v_lead.mesclado_em_id is not null then
    raise exception 'Este lead foi mesclado em outro registro.';
  end if;

  if v_cliente is not null then
    if not exists (select 1 from public.clientes c where c.id = v_cliente and c.arquivado_em is null) then
      raise exception 'Cliente selecionado não encontrado.';
    end if;
  else
    v_cpf := coalesce(v_cpf, v_lead.cpf_norm);
    if v_cpf is not null then
      select c.codigo || ' — ' || c.nome into v_existente
      from public.clientes c where c.cpf_cnpj_norm = v_cpf and c.arquivado_em is null;
      if v_existente is not null then
        raise exception 'Já existe um cliente com este CPF/CNPJ (%). Vincule o lead ao cliente existente.', v_existente;
      end if;
    end if;

    insert into public.clientes (
      tipo_pessoa, nome, cpf_cnpj, rg, data_nascimento, email, whatsapp, profissao, estado_civil, nacionalidade,
      cep, logradouro, numero, complemento, bairro, cidade, uf, responsavel_id, origem, lead_origem_id,
      possui_representante, representante_nome, representante_cpf, representante_parentesco, representante_contato,
      observacoes, etiquetas
    ) values (
      coalesce(nullif(p_dados ->> 'tipo_pessoa', ''), 'PF'),
      coalesce(nullif(trim(p_dados ->> 'nome'), ''), v_lead.nome),
      coalesce(nullif(trim(p_dados ->> 'cpf_cnpj'), ''), v_lead.cpf),
      nullif(trim(p_dados ->> 'rg'), ''),
      nullif(p_dados ->> 'data_nascimento', '')::date,
      coalesce(nullif(trim(p_dados ->> 'email'), ''), v_lead.email),
      coalesce(nullif(trim(p_dados ->> 'whatsapp'), ''), v_lead.whatsapp),
      coalesce(nullif(trim(p_dados ->> 'profissao'), ''), v_lead.profissao),
      nullif(trim(p_dados ->> 'estado_civil'), ''),
      nullif(trim(p_dados ->> 'nacionalidade'), ''),
      nullif(trim(p_dados ->> 'cep'), ''),
      nullif(trim(p_dados ->> 'logradouro'), ''),
      nullif(trim(p_dados ->> 'numero'), ''),
      nullif(trim(p_dados ->> 'complemento'), ''),
      nullif(trim(p_dados ->> 'bairro'), ''),
      coalesce(nullif(trim(p_dados ->> 'cidade'), ''), v_lead.municipio),
      coalesce(nullif(trim(p_dados ->> 'uf'), ''), v_lead.estado),
      coalesce(nullif(p_dados ->> 'responsavel_id', '')::uuid, v_lead.responsavel_id, public.usuario_atual()),
      'lead',
      v_lead.id,
      coalesce((p_dados ->> 'possui_representante')::boolean, false),
      nullif(trim(p_dados ->> 'representante_nome'), ''),
      nullif(trim(p_dados ->> 'representante_cpf'), ''),
      nullif(trim(p_dados ->> 'representante_parentesco'), ''),
      nullif(trim(p_dados ->> 'representante_contato'), ''),
      nullif(trim(p_dados ->> 'observacoes'), ''),
      v_lead.etiquetas
    )
    returning id into v_cliente;
  end if;

  v_ganha := public.etapa_por_categoria('lead', 'ganha');
  update public.leads l
     set cliente_id = v_cliente,
         convertido_em = now(),
         convertido_por = public.usuario_atual(),
         etapa_id = coalesce(v_ganha, l.etapa_id)
   where l.id = p_lead;

  -- O histórico do atendimento passa a aparecer também na ficha do cliente.
  update public.interacoes set cliente_id = v_cliente where lead_id = p_lead and cliente_id is null;
  update public.tarefas set cliente_id = v_cliente where lead_id = p_lead and cliente_id is null;
  update public.compromissos set cliente_id = v_cliente where lead_id = p_lead and cliente_id is null;
  update public.documentos set cliente_id = v_cliente where lead_id = p_lead and cliente_id is null;
  update public.arquivos set cliente_id = v_cliente where lead_id = p_lead and cliente_id is null;
  update public.solicitacoes_documentos set cliente_id = v_cliente where lead_id = p_lead and cliente_id is null;
  update public.consentimentos set cliente_id = v_cliente where lead_id = p_lead and cliente_id is null;
  update public.eventos set cliente_id = v_cliente where lead_id = p_lead and cliente_id is null;

  if jsonb_typeof(p_dados -> 'caso') = 'object' then
    v_caso := public.criar_caso((p_dados -> 'caso') || jsonb_build_object('cliente_id', v_cliente, 'lead_id', p_lead));
  end if;

  return jsonb_build_object('cliente_id', v_cliente, 'caso_id', v_caso);
end
$$;

-- -----------------------------------------------------------------------------
-- Detecção de duplicidade (telefone, e-mail, CPF/CNPJ)
-- security invoker: só retorna registros que o usuário pode ver.
-- -----------------------------------------------------------------------------

create or replace function public.buscar_duplicados(p_telefone text, p_email text, p_cpf text, p_ignorar uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with chaves as (
    select public.chave_telefone(p_telefone) as tel,
           public.normalizar_email(p_email) as email,
           public.normalizar_documento(p_cpf) as cpf
  )
  select jsonb_build_object(
    'leads', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object(
          'id', l.id, 'codigo', l.codigo, 'nome', l.nome, 'etapa_id', l.etapa_id,
          'cliente_id', l.cliente_id, 'arquivado', l.arquivado_em is not null, 'created_at', l.created_at,
          'motivos', to_jsonb(array_remove(array[
            case when k.tel is not null and l.telefone_chave = k.tel then 'telefone' end,
            case when k.email is not null and l.email_norm = k.email then 'e-mail' end,
            case when k.cpf is not null and l.cpf_norm = k.cpf then 'CPF' end
          ], null))) as x
        from public.leads l, chaves k
        where l.id is distinct from p_ignorar
          and l.mesclado_em_id is null
          and ((k.tel is not null and l.telefone_chave = k.tel)
               or (k.email is not null and l.email_norm = k.email)
               or (k.cpf is not null and l.cpf_norm = k.cpf))
        order by l.created_at desc
        limit 20
      ) s), '[]'::jsonb),
    'clientes', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object(
          'id', c.id, 'codigo', c.codigo, 'nome', c.nome, 'arquivado', c.arquivado_em is not null,
          'motivos', to_jsonb(array_remove(array[
            case when k.tel is not null and c.telefone_chave = k.tel then 'telefone' end,
            case when k.email is not null and c.email_norm = k.email then 'e-mail' end,
            case when k.cpf is not null and c.cpf_cnpj_norm = k.cpf then 'CPF/CNPJ' end
          ], null))) as x
        from public.clientes c, chaves k
        where c.id is distinct from p_ignorar
          and ((k.tel is not null and c.telefone_chave = k.tel)
               or (k.email is not null and c.email_norm = k.email)
               or (k.cpf is not null and c.cpf_cnpj_norm = k.cpf))
        order by c.created_at desc
        limit 20
      ) s), '[]'::jsonb)
  )
  from chaves k
$$;

-- -----------------------------------------------------------------------------
-- Mesclar leads duplicados: move todo o histórico para o lead de destino,
-- preenche apenas campos vazios do destino e arquiva o lead de origem.
-- -----------------------------------------------------------------------------

create or replace function public.mesclar_leads(p_origem uuid, p_destino uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o public.leads%rowtype;
  v_d public.leads%rowtype;
begin
  if not public.tem_permissao('leads.editar') then
    raise exception 'Você não tem permissão para mesclar leads.' using errcode = '42501';
  end if;
  if p_origem = p_destino then
    raise exception 'Selecione dois leads diferentes.';
  end if;
  select l.* into v_o from public.leads l where l.id = p_origem for update;
  select l.* into v_d from public.leads l where l.id = p_destino for update;
  if v_o.id is null or v_d.id is null then
    raise exception 'Lead não encontrado.';
  end if;
  if v_o.mesclado_em_id is not null or v_d.mesclado_em_id is not null then
    raise exception 'Um dos leads já foi mesclado anteriormente.';
  end if;
  if v_o.cliente_id is not null then
    raise exception 'O lead de origem já foi convertido em cliente. Mescle no sentido inverso.';
  end if;

  update public.leads l set
    whatsapp = coalesce(l.whatsapp, v_o.whatsapp),
    email = coalesce(l.email, v_o.email),
    cpf = coalesce(l.cpf, v_o.cpf),
    estado = coalesce(l.estado, v_o.estado),
    municipio = coalesce(l.municipio, v_o.municipio),
    profissao = coalesce(l.profissao, v_o.profissao),
    faixa_renda = coalesce(l.faixa_renda, v_o.faixa_renda),
    tipo_demanda_id = coalesce(l.tipo_demanda_id, v_o.tipo_demanda_id),
    responsavel_id = coalesce(l.responsavel_id, v_o.responsavel_id),
    temperatura = coalesce(l.temperatura, v_o.temperatura),
    score = coalesce(l.score, v_o.score),
    quiz_interesse = coalesce(l.quiz_interesse, v_o.quiz_interesse),
    quiz_cultiva = coalesce(l.quiz_cultiva, v_o.quiz_cultiva),
    quiz_consulta_medica = coalesce(l.quiz_consulta_medica, v_o.quiz_consulta_medica),
    quiz_motivacao = coalesce(l.quiz_motivacao, v_o.quiz_motivacao),
    quiz_agenda = coalesce(l.quiz_agenda, v_o.quiz_agenda),
    quiz_horario = coalesce(l.quiz_horario, v_o.quiz_horario),
    quiz_observacoes = coalesce(l.quiz_observacoes, v_o.quiz_observacoes),
    ultima_submissao_id = coalesce(l.ultima_submissao_id, v_o.ultima_submissao_id),
    total_submissoes = l.total_submissoes + v_o.total_submissoes,
    primeiro_contato_em = least(l.primeiro_contato_em, v_o.primeiro_contato_em),
    ultimo_contato_em = greatest(l.ultimo_contato_em, v_o.ultimo_contato_em),
    utm_source = coalesce(l.utm_source, v_o.utm_source),
    utm_medium = coalesce(l.utm_medium, v_o.utm_medium),
    utm_campaign = coalesce(l.utm_campaign, v_o.utm_campaign),
    utm_term = coalesce(l.utm_term, v_o.utm_term),
    utm_content = coalesce(l.utm_content, v_o.utm_content),
    observacoes = case
      when v_o.observacoes is null then l.observacoes
      when l.observacoes is null then v_o.observacoes
      else l.observacoes || E'\n\n[Mesclado de ' || v_o.codigo || '] ' || v_o.observacoes
    end,
    etiquetas = array(select distinct e from unnest(l.etiquetas || v_o.etiquetas) e)
  where l.id = p_destino;

  perform set_config('app.mesclagem', 'on', true);
  update public.quiz_submissoes set lead_id = p_destino where lead_id = p_origem;
  update public.quiz_respostas set lead_id = p_destino where lead_id = p_origem;
  update public.consentimentos set lead_id = p_destino where lead_id = p_origem;
  update public.interacoes set lead_id = p_destino where lead_id = p_origem;
  update public.tarefas set lead_id = p_destino where lead_id = p_origem;
  update public.compromissos set lead_id = p_destino where lead_id = p_origem;
  update public.documentos set lead_id = p_destino where lead_id = p_origem;
  update public.arquivos set lead_id = p_destino where lead_id = p_origem;
  update public.solicitacoes_documentos set lead_id = p_destino where lead_id = p_origem;
  update public.casos set lead_id = p_destino where lead_id = p_origem;
  update public.clientes set lead_origem_id = p_destino where lead_origem_id = p_origem;
  update public.comentarios set registro_id = p_destino where entidade = 'lead' and registro_id = p_origem;
  update public.eventos set lead_id = p_destino where lead_id = p_origem;
  insert into public.valores_personalizados (campo_id, registro_id, entidade, valor)
    select v.campo_id, p_destino, v.entidade, v.valor from public.valores_personalizados v where v.registro_id = p_origem
    on conflict (campo_id, registro_id) do nothing;
  perform set_config('app.mesclagem', '', true);

  update public.leads l set mesclado_em_id = p_destino, arquivado_em = now() where l.id = p_origem;

  perform public.registrar_evento('mesclagem', format('Lead %s (%s) mesclado neste registro', v_o.codigo, v_o.nome),
    p_destino, v_d.cliente_id, null, 'lead', p_destino, jsonb_build_object('origem', p_origem));
end
$$;

-- -----------------------------------------------------------------------------
-- Busca global (security invoker: respeita as permissões do usuário)
-- -----------------------------------------------------------------------------

create or replace function public.busca_global(p_termo text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_t text := left(trim(coalesce(p_termo, '')), 80);
  v_like text;
  v_dig text;
  v_res jsonb := '[]'::jsonb;
begin
  if length(v_t) < 2 then
    return v_res;
  end if;
  v_like := '%' || public.f_unaccent(lower(v_t)) || '%';
  v_dig := public.somente_digitos(v_t);

  v_res := v_res || coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object('tipo', 'lead', 'id', l.id, 'titulo', l.nome,
        'subtitulo', concat_ws(' · ', l.codigo, nullif(concat_ws('/', l.municipio, l.estado), '')),
        'arquivado', l.arquivado_em is not null) as x
      from public.leads l
      where l.mesclado_em_id is null
        and (public.f_unaccent(lower(l.nome)) like v_like
             or l.codigo ilike '%' || v_t || '%'
             or l.email_norm like '%' || lower(v_t) || '%'
             or (length(coalesce(v_dig, '')) >= 4 and l.telefone_norm like '%' || v_dig || '%'))
      order by l.arquivado_em nulls first, l.created_at desc
      limit 6) s), '[]'::jsonb);

  v_res := v_res || coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object('tipo', 'cliente', 'id', c.id, 'titulo', c.nome,
        'subtitulo', concat_ws(' · ', c.codigo, nullif(concat_ws('/', c.cidade, c.uf), '')),
        'arquivado', c.arquivado_em is not null) as x
      from public.clientes c
      where public.f_unaccent(lower(c.nome)) like v_like
         or c.codigo ilike '%' || v_t || '%'
         or c.email_norm like '%' || lower(v_t) || '%'
         or (length(coalesce(v_dig, '')) >= 4 and (c.telefone_norm like '%' || v_dig || '%' or c.cpf_cnpj_norm like '%' || v_dig || '%'))
      order by c.arquivado_em nulls first, c.nome
      limit 6) s), '[]'::jsonb);

  v_res := v_res || coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object('tipo', 'caso', 'id', k.id, 'titulo', k.titulo,
        'subtitulo', concat_ws(' · ', k.codigo, c.nome, p.numero),
        'arquivado', k.arquivado_em is not null) as x
      from public.casos k
      join public.clientes c on c.id = k.cliente_id
      left join public.processos p on p.caso_id = k.id and p.principal
      where public.f_unaccent(lower(k.titulo)) like v_like
         or k.codigo ilike '%' || v_t || '%'
         or public.f_unaccent(lower(c.nome)) like v_like
         or (length(coalesce(v_dig, '')) >= 5 and exists (
              select 1 from public.processos p2 where p2.caso_id = k.id and p2.numero_norm like '%' || v_dig || '%'))
      order by k.arquivado_em nulls first, k.created_at desc
      limit 6) s), '[]'::jsonb);

  v_res := v_res || coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object('tipo', 'tarefa', 'id', t.id, 'titulo', t.titulo,
        'subtitulo', concat_ws(' · ', 'Tarefa', case t.status when 'concluida' then 'Concluída' when 'cancelada' then 'Cancelada' else 'Aberta' end),
        'arquivado', t.arquivado_em is not null) as x
      from public.tarefas t
      where public.f_unaccent(lower(t.titulo)) like v_like
      order by (t.status in ('concluida', 'cancelada')), t.prazo nulls last
      limit 5) s), '[]'::jsonb);

  return v_res;
end
$$;
