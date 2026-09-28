-- =============================================================================
-- CRM Amado & Amado Jr. — 18. Modo simplificado por usuário
-- Interface enxuta (menu reduzido e painel Hoje só com os indicadores
-- principais) e bloqueio de exclusões, para quem acompanha o escritório e
-- corrige registros, mas não deve apagar nada por engano. Criar e editar
-- continuam valendo conforme o perfil da pessoa.
-- =============================================================================

alter table public.usuarios add column modo_simplificado boolean not null default false;

comment on column public.usuarios.modo_simplificado is
  'Interface simplificada (menu e painel reduzidos) e sem exclusões, independentemente do perfil.';

create or replace function public.modo_simplificado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.modo_simplificado from public.usuarios u where u.id = public.usuario_atual()), false)
$$;

grant execute on function public.modo_simplificado() to authenticated, service_role;

-- Permissões de exclusão ("*.excluir") nunca valem no modo simplificado, nem
-- para administradores. Assim a interface esconde essas ações e as políticas
-- e funções que já exigem essas permissões passam a recusá-las.
create or replace function public.tem_permissao_usuario(p_usuario uuid, p_permissao text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select u.ativo
       and not (p_permissao = any (u.permissoes_negadas))
       and not (u.modo_simplificado and p_permissao like '%.excluir')
       and (
         u.perfil_id = 'admin'
         or p_permissao = any (pf.permissoes)
         or p_permissao = any (u.permissoes_extra)
       )
    from public.usuarios u
    join public.perfis pf on pf.id = u.perfil_id
    where u.id = p_usuario
  ), false)
$$;

-- Exclusões que não dependem de "*.excluir" (tarefas, compromissos, processos,
-- partes, andamentos, contatos, mídias, prazos por administradores...) são
-- barradas por políticas restritivas, combinadas às já existentes.
do $$
declare
  t text;
begin
  foreach t in array array[
    'leads', 'clientes', 'interacoes', 'casos', 'processos', 'partes', 'andamentos',
    'tarefas', 'compromissos', 'prazos', 'documentos', 'arquivos', 'midias'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (not (select public.modo_simplificado()))',
      t || '_excluir_modo_simplificado', t
    );
  end loop;
end
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
    'modo_simplificado', u.modo_simplificado,
    'permissoes', to_jsonb(public.permissoes_efetivas(u.id))
  )
  from public.usuarios u
  join public.perfis pf on pf.id = u.perfil_id
  where u.id = auth.uid()
$$;

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
  v_simplificado boolean := coalesce((p ->> 'modo_simplificado')::boolean, false);
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

  insert into public.usuarios (id, nome, email, perfil_id, cargo, oab, telefone, cor, permissoes_extra, permissoes_negadas, modo_simplificado, ativo)
  values (v_id, trim(p ->> 'nome'), lower(trim(p ->> 'email')), v_perfil,
          nullif(trim(coalesce(p ->> 'cargo', '')), ''), nullif(trim(coalesce(p ->> 'oab', '')), ''),
          nullif(trim(coalesce(p ->> 'telefone', '')), ''),
          case when (p ->> 'cor') ~ '^#[0-9A-Fa-f]{6}$' then p ->> 'cor' else '#3D7B3E' end,
          v_extra, v_negadas, v_simplificado, v_ativo)
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
    modo_simplificado = excluded.modo_simplificado,
    ativo = excluded.ativo;
end
$$;

-- Conta do dono do escritório, que usa o modo simplificado. Se a conta ainda
-- não existir quando esta migração rodar, marque "Modo simplificado" ao
-- criá-la em Administração → Usuários.
update public.usuarios set modo_simplificado = true
where lower(email) = 'eduardoamado@amadoeamadojr.com.br';
