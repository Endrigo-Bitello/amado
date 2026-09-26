-- =============================================================================
-- CRM Amado & Amado Jr. — 04. Casos, processos judiciais, partes e andamentos
-- "Caso" é a carteira interna do escritório (pode ou não ter processo).
-- "Processo" é o processo judicial vinculado ao caso (um caso pode ter vários).
-- O atendimento comercial (pré-contratação) permanece em "leads".
-- =============================================================================

create sequence public.casos_codigo_seq;

create table public.casos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  lead_id uuid references public.leads (id) on delete set null,
  titulo text not null check (length(trim(titulo)) between 1 and 200),
  natureza text not null default 'interno' check (natureza in ('interno', 'judicial')),
  tipo_demanda_id uuid references public.tipos_demanda (id) on delete set null,
  objeto text,
  fase_id uuid references public.etapas (id),
  fase_alterada_em timestamptz not null default now(),
  status text not null default 'ativo' check (status in ('ativo', 'suspenso', 'concluido')),
  responsavel_id uuid references public.usuarios (id) on delete set null,
  equipe uuid[] not null default '{}',
  prioridade text not null default 'media',
  data_abertura date not null default public.hoje_sp(),
  data_protocolo date,
  data_encerramento date,
  resultado text,
  valor_causa numeric(14, 2),
  segredo_justica boolean not null default true,
  links jsonb not null default '[]',
  observacoes text,
  etiquetas uuid[] not null default '{}',
  arquivado_em timestamptz,
  arquivado_por uuid references public.usuarios (id) on delete set null,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  versao integer not null default 1
);

comment on column public.casos.links is 'Links externos: [{"titulo": "...", "url": "https://..."}]';

create index casos_cliente_idx on public.casos (cliente_id);
create index casos_lead_idx on public.casos (lead_id);
create index casos_tipo_demanda_idx on public.casos (tipo_demanda_id);
create index casos_fase_idx on public.casos (fase_id);
create index casos_responsavel_idx on public.casos (responsavel_id);
create index casos_arquivado_por_idx on public.casos (arquivado_por);
create index casos_created_by_idx on public.casos (created_by);
create index casos_equipe_idx on public.casos using gin (equipe);
create index casos_titulo_trgm_idx on public.casos using gin (public.f_unaccent(lower(titulo)) extensions.gin_trgm_ops);

create trigger casos_atualizado_em before update on public.casos
  for each row execute function public.tg_atualizado_em();
create trigger casos_versao before update on public.casos
  for each row execute function public.tg_incrementar_versao();

alter table public.interacoes
  add constraint interacoes_caso_fk foreign key (caso_id) references public.casos (id) on delete cascade;

create table public.processos (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  numero text,
  numero_norm text generated always as (public.somente_digitos(numero)) stored,
  principal boolean not null default false,
  classe text,
  tribunal text,
  orgao text,
  comarca text,
  uf text,
  instancia text,
  sistema text,
  data_distribuicao date,
  link_consulta text,
  situacao text not null default 'em_andamento'
    check (situacao in ('em_andamento', 'suspenso', 'sentenciado', 'transitado', 'arquivado')),
  segredo_justica boolean not null default true,
  fonte text not null default 'manual' check (fonte in ('manual', 'importacao', 'integracao')),
  id_externo text,
  ultima_sincronizacao_em timestamptz,
  observacoes text,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.processos.fonte is
  'Origem do cadastro. "integracao" fica reservado para uma futura consulta automática (não ativa).';

create unique index processos_numero_uidx on public.processos (numero_norm) where numero_norm is not null;
create index processos_caso_idx on public.processos (caso_id);
create index processos_created_by_idx on public.processos (created_by);

create trigger processos_atualizado_em before update on public.processos
  for each row execute function public.tg_atualizado_em();

create table public.partes (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  processo_id uuid references public.processos (id) on delete set null,
  nome text not null check (length(trim(nome)) between 1 and 200),
  tipo text not null default 'autor',
  documento text,
  cliente_id uuid references public.clientes (id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now()
);

create index partes_caso_idx on public.partes (caso_id);
create index partes_processo_idx on public.partes (processo_id);
create index partes_cliente_idx on public.partes (cliente_id);

create table public.andamentos (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  processo_id uuid references public.processos (id) on delete set null,
  data timestamptz not null default now(),
  tipo text not null default 'outro',
  descricao text not null check (length(trim(descricao)) between 1 and 8000),
  importante boolean not null default false,
  fonte text not null default 'manual' check (fonte in ('manual', 'integracao')),
  id_externo text,
  registrado_por uuid references public.usuarios (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index andamentos_caso_idx on public.andamentos (caso_id, data desc);
create index andamentos_processo_idx on public.andamentos (processo_id);
create index andamentos_registrado_por_idx on public.andamentos (registrado_por);
create unique index andamentos_externo_uidx on public.andamentos (processo_id, id_externo) where id_externo is not null;
