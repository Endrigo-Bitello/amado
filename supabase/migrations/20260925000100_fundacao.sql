-- =============================================================================
-- CRM Amado & Amado Jr. — 01. Fundação
-- Extensões, utilitários, perfis de acesso, usuários e catálogo de permissões.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- -----------------------------------------------------------------------------
-- Utilitários de texto e normalização
-- -----------------------------------------------------------------------------

create or replace function public.f_unaccent(texto text)
returns text
language sql
immutable parallel safe strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, texto) $$;

create or replace function public.somente_digitos(texto text)
returns text
language sql
immutable parallel safe
set search_path = ''
as $$ select nullif(regexp_replace(coalesce(texto, ''), '\D', '', 'g'), '') $$;

-- Telefone brasileiro normalizado: 55 + DDD + número (somente dígitos).
create or replace function public.normalizar_telefone(texto text)
returns text
language plpgsql
immutable parallel safe
set search_path = ''
as $$
declare
  d text := regexp_replace(coalesce(texto, ''), '\D', '', 'g');
begin
  if d = '' then
    return null;
  end if;
  d := regexp_replace(d, '^0+', '');
  if length(d) in (10, 11) then
    d := '55' || d;
  end if;
  return nullif(d, '');
end
$$;

-- Chave usada na detecção de duplicidade: DDD + 8 últimos dígitos
-- (torna equivalentes números com e sem o nono dígito).
create or replace function public.chave_telefone(texto text)
returns text
language plpgsql
immutable parallel safe
set search_path = ''
as $$
declare
  d text := public.normalizar_telefone(texto);
begin
  if d is null then
    return null;
  end if;
  if left(d, 2) = '55' and length(d) in (12, 13) then
    return substr(d, 3, 2) || right(d, 8);
  end if;
  if length(d) < 8 then
    return d;
  end if;
  return right(d, 10);
end
$$;

-- CPF/CNPJ normalizado: letras maiúsculas e dígitos (aceita o CNPJ alfanumérico).
create or replace function public.normalizar_documento(texto text)
returns text
language sql
immutable parallel safe
set search_path = ''
as $$ select nullif(upper(regexp_replace(coalesce(texto, ''), '[^0-9A-Za-z]', '', 'g')), '') $$;

create or replace function public.normalizar_email(texto text)
returns text
language sql
immutable parallel safe
set search_path = ''
as $$ select nullif(lower(trim(coalesce(texto, ''))), '') $$;

-- Data corrente no fuso do escritório.
create or replace function public.hoje_sp()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- -----------------------------------------------------------------------------
-- Triggers genéricos
-- -----------------------------------------------------------------------------

create or replace function public.tg_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create or replace function public.tg_incrementar_versao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.versao := coalesce(old.versao, 0) + 1;
  return new;
end
$$;

-- -----------------------------------------------------------------------------
-- Perfis, permissões e usuários
-- -----------------------------------------------------------------------------

create table public.permissoes_catalogo (
  id text primary key,
  modulo text not null,
  descricao text not null,
  ordem integer not null default 0
);

comment on table public.permissoes_catalogo is
  'Catálogo fixo de permissões disponíveis. Perfis e usuários recebem subconjuntos deste catálogo.';

create table public.perfis (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  nome text not null check (length(trim(nome)) between 2 and 60),
  descricao text,
  permissoes text[] not null default '{}',
  sistema boolean not null default false,
  ordem integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger perfis_atualizado_em before update on public.perfis
  for each row execute function public.tg_atualizado_em();

create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 120),
  email text not null,
  perfil_id text not null references public.perfis (id) on update cascade,
  cargo text,
  oab text,
  telefone text,
  cor text not null default '#3D7B3E',
  permissoes_extra text[] not null default '{}',
  permissoes_negadas text[] not null default '{}',
  ativo boolean not null default true,
  ultimo_acesso_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index usuarios_perfil_idx on public.usuarios (perfil_id);

create trigger usuarios_atualizado_em before update on public.usuarios
  for each row execute function public.tg_atualizado_em();

-- Usuário que executa a operação. Para chamadas autenticadas vem do JWT; para
-- operações executadas pelas Edge Functions (service role) vem da variável de
-- transação app.usuario_id, definida pelas funções de serviço.
create or replace function public.usuario_atual()
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()),
    nullif(current_setting('app.usuario_id', true), '')::uuid
  )
$$;

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

create or replace function public.tem_permissao(p_permissao text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.tem_permissao_usuario(public.usuario_atual(), p_permissao) $$;

create or replace function public.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.ativo from public.usuarios u where u.id = public.usuario_atual()), false)
$$;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select u.ativo and u.perfil_id = 'admin'
    from public.usuarios u
    where u.id = public.usuario_atual()
  ), false)
$$;

-- Permissões efetivas de um usuário (perfil + concessões − negações).
create or replace function public.permissoes_efetivas(p_usuario uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(c.id order by c.ordem), '{}')
  from public.permissoes_catalogo c
  where public.tem_permissao_usuario(p_usuario, c.id)
$$;

-- Dados da sessão do usuário logado (perfil e permissões efetivas).
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
    'permissoes', to_jsonb(public.permissoes_efetivas(u.id))
  )
  from public.usuarios u
  join public.perfis pf on pf.id = u.perfil_id
  where u.id = auth.uid()
$$;

create or replace function public.registrar_acesso()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.usuarios set ultimo_acesso_em = now()
  where id = auth.uid() and ativo
$$;

-- Atualização dos próprios dados básicos (nome, telefone e cor do avatar).
create or replace function public.atualizar_meu_perfil(p_nome text, p_telefone text, p_cor text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.usuario_ativo() then
    raise exception 'Usuário inativo ou sem cadastro no CRM.' using errcode = '42501';
  end if;
  if p_cor is not null and p_cor !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Cor inválida.';
  end if;
  update public.usuarios
     set nome = coalesce(nullif(trim(p_nome), ''), nome),
         telefone = nullif(trim(coalesce(p_telefone, '')), ''),
         cor = coalesce(p_cor, cor)
   where id = auth.uid();
end
$$;

-- -----------------------------------------------------------------------------
-- Catálogo de permissões (fixo — o que cada perfil recebe é configurável)
-- -----------------------------------------------------------------------------

insert into public.permissoes_catalogo (id, modulo, descricao, ordem) values
  ('leads.ver',                 'Leads',        'Ver leads e respostas do quiz', 10),
  ('leads.editar',              'Leads',        'Criar e editar leads, registrar contatos e converter em cliente', 11),
  ('leads.excluir',             'Leads',        'Excluir leads definitivamente', 12),
  ('clientes.ver',              'Clientes',     'Ver fichas de clientes', 20),
  ('clientes.editar',           'Clientes',     'Criar e editar clientes', 21),
  ('clientes.excluir',          'Clientes',     'Excluir clientes definitivamente', 22),
  ('casos.ver',                 'Casos',        'Ver casos, processos e andamentos', 30),
  ('casos.editar',              'Casos',        'Criar e editar casos, processos, partes e andamentos', 31),
  ('casos.excluir',             'Casos',        'Excluir casos definitivamente', 32),
  ('tarefas.ver_todas',         'Tarefas',      'Ver tarefas de toda a equipe (sem esta permissão, apenas as próprias)', 40),
  ('tarefas.editar',            'Tarefas',      'Criar, atribuir e editar tarefas de qualquer pessoa', 41),
  ('agenda.ver_todas',          'Agenda',       'Ver compromissos de toda a equipe', 50),
  ('agenda.editar',             'Agenda',       'Criar e editar compromissos de qualquer pessoa', 51),
  ('prazos.ver',                'Prazos',       'Ver prazos processuais', 60),
  ('prazos.editar',             'Prazos',       'Cadastrar e corrigir prazos processuais', 61),
  ('prazos.conferir',           'Prazos',       'Conferir e confirmar prazos (profissional habilitado)', 62),
  ('documentos.ver',            'Documentos',   'Ver checklists e documentos não clínicos', 70),
  ('documentos.editar',         'Documentos',   'Aplicar checklists, anexar arquivos e alterar situação de documentos', 71),
  ('documentos.revisar',        'Documentos',   'Aprovar ou rejeitar documentos', 72),
  ('documentos.solicitar_cliente', 'Documentos','Gerar links seguros para o cliente enviar documentos', 73),
  ('documentos.excluir',        'Documentos',   'Excluir arquivos definitivamente', 74),
  ('saude.ver_atribuidos',      'Dados de saúde', 'Ver dados e documentos clínicos dos clientes e casos sob sua responsabilidade', 80),
  ('saude.ver_todos',           'Dados de saúde', 'Ver dados e documentos clínicos de todos os clientes', 81),
  ('financeiro.ver',            'Financeiro',   'Ver valores, contratos, parcelas e pagamentos', 90),
  ('financeiro.lancar',         'Financeiro',   'Registrar pagamentos, custas e despesas', 91),
  ('financeiro.desconto',       'Financeiro',   'Conceder descontos', 92),
  ('financeiro.contratos',      'Financeiro',   'Criar e alterar contratos, parcelas, cancelamentos e reembolsos', 93),
  ('relatorios.ver',            'Relatórios',   'Acessar relatórios gerenciais', 100),
  ('dados.importar',            'Dados',        'Importar planilhas de clientes', 110),
  ('dados.exportar',            'Dados',        'Exportar quadros em CSV/XLSX', 111),
  ('admin.usuarios',            'Administração','Gerenciar usuários, perfis e permissões', 120),
  ('admin.configuracoes',       'Administração','Configurar funis, campos, quadros, modelos, textos e painel', 121),
  ('admin.automacoes',          'Administração','Configurar automações', 122),
  ('admin.auditoria',           'Administração','Consultar a auditoria do sistema', 123);

-- Perfis iniciais. O administrador possui todas as permissões automaticamente.
insert into public.perfis (id, nome, descricao, permissoes, sistema, ordem) values
  ('admin', 'Administrador', 'Acesso total, incluindo usuários, permissões e configurações.', '{}', true, 1),
  ('advogado', 'Advogado', 'Atendimento jurídico, casos, prazos, documentos e revisão.', array[
    'leads.ver', 'leads.editar',
    'clientes.ver', 'clientes.editar',
    'casos.ver', 'casos.editar',
    'tarefas.ver_todas', 'tarefas.editar',
    'agenda.ver_todas', 'agenda.editar',
    'prazos.ver', 'prazos.editar', 'prazos.conferir',
    'documentos.ver', 'documentos.editar', 'documentos.revisar', 'documentos.solicitar_cliente',
    'saude.ver_atribuidos',
    'financeiro.ver',
    'relatorios.ver', 'dados.exportar'
  ], true, 2),
  ('atendimento', 'Atendimento', 'Recepção de leads, contatos, agenda e coleta de documentos.', array[
    'leads.ver', 'leads.editar',
    'clientes.ver', 'clientes.editar',
    'casos.ver',
    'tarefas.ver_todas', 'tarefas.editar',
    'agenda.ver_todas', 'agenda.editar',
    'prazos.ver',
    'documentos.ver', 'documentos.editar', 'documentos.solicitar_cliente',
    'saude.ver_atribuidos'
  ], true, 3);
