-- =============================================================================
-- CRM Amado & Amado Jr. — 05. Tarefas, modelos de tarefas, agenda e prazos
-- =============================================================================

create table public.modelos_tarefas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 120),
  descricao text,
  tipo_demanda_id uuid references public.tipos_demanda (id) on delete set null,
  itens jsonb not null default '[]',
  ativo boolean not null default true,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.modelos_tarefas.itens is
  'Etapas do modelo: [{"id","titulo","descricao","prazo_dias","prioridade","responsavel":{"tipo":"responsavel_caso|usuario|perfil","valor":...},"depende_de":"id","checklist":["..."]}]';

create index modelos_tarefas_tipo_demanda_idx on public.modelos_tarefas (tipo_demanda_id);
create index modelos_tarefas_created_by_idx on public.modelos_tarefas (created_by);
create trigger modelos_tarefas_atualizado_em before update on public.modelos_tarefas
  for each row execute function public.tg_atualizado_em();

alter table public.tipos_demanda
  add constraint tipos_demanda_modelo_tarefas_fk foreign key (modelo_tarefas_id)
  references public.modelos_tarefas (id) on delete set null;
create index tipos_demanda_modelo_tarefas_idx on public.tipos_demanda (modelo_tarefas_id);

create table public.automacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in (
    'lead_novo_primeiro_contato', 'lead_parado', 'documento_pendente', 'parcela_vencida',
    'tarefa_prazo', 'prazo_processual', 'documento_validade'
  )),
  nome text not null,
  descricao text,
  ativo boolean not null default false,
  parametros jsonb not null default '{}',
  ultima_execucao_em timestamptz,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automacoes_created_by_idx on public.automacoes (created_by);
create trigger automacoes_atualizado_em before update on public.automacoes
  for each row execute function public.tg_atualizado_em();

create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) between 1 and 200),
  descricao text,
  status text not null default 'a_fazer' check (status in ('a_fazer', 'em_andamento', 'aguardando', 'concluida', 'cancelada')),
  prioridade text not null default 'media',
  responsavel_id uuid references public.usuarios (id) on delete set null,
  prazo timestamptz,
  prazo_dia_inteiro boolean not null default true,
  lead_id uuid references public.leads (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete cascade,
  caso_id uuid references public.casos (id) on delete cascade,
  checklist jsonb not null default '[]',
  depende_de uuid references public.tarefas (id) on delete set null,
  origem text not null default 'manual' check (origem in ('manual', 'automacao', 'modelo')),
  automacao_id uuid references public.automacoes (id) on delete set null,
  modelo_id uuid references public.modelos_tarefas (id) on delete set null,
  concluida_em timestamptz,
  concluida_por uuid references public.usuarios (id) on delete set null,
  etiquetas uuid[] not null default '{}',
  arquivado_em timestamptz,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  versao integer not null default 1
);

comment on column public.tarefas.checklist is 'Subitens: [{"id": "...", "texto": "...", "feito": false}]';

create index tarefas_responsavel_idx on public.tarefas (responsavel_id);
create index tarefas_lead_idx on public.tarefas (lead_id);
create index tarefas_cliente_idx on public.tarefas (cliente_id);
create index tarefas_caso_idx on public.tarefas (caso_id);
create index tarefas_depende_idx on public.tarefas (depende_de);
create index tarefas_automacao_idx on public.tarefas (automacao_id);
create index tarefas_modelo_idx on public.tarefas (modelo_id);
create index tarefas_concluida_por_idx on public.tarefas (concluida_por);
create index tarefas_created_by_idx on public.tarefas (created_by);
create index tarefas_prazo_idx on public.tarefas (prazo) where status not in ('concluida', 'cancelada');

create trigger tarefas_atualizado_em before update on public.tarefas
  for each row execute function public.tg_atualizado_em();
create trigger tarefas_versao before update on public.tarefas
  for each row execute function public.tg_incrementar_versao();

-- -----------------------------------------------------------------------------
-- Agenda
-- -----------------------------------------------------------------------------

create table public.compromissos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'reuniao',
  titulo text not null check (length(trim(titulo)) between 1 and 200),
  descricao text,
  inicio timestamptz not null,
  fim timestamptz,
  dia_inteiro boolean not null default false,
  local text,
  link_reuniao text,
  lead_id uuid references public.leads (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete cascade,
  caso_id uuid references public.casos (id) on delete cascade,
  processo_id uuid references public.processos (id) on delete set null,
  responsavel_id uuid references public.usuarios (id) on delete set null,
  participantes uuid[] not null default '{}',
  status text not null default 'agendado'
    check (status in ('agendado', 'realizado', 'cancelado', 'remarcado', 'nao_compareceu')),
  lembrete_minutos integer default 60,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);

create index compromissos_inicio_idx on public.compromissos (inicio);
create index compromissos_lead_idx on public.compromissos (lead_id);
create index compromissos_cliente_idx on public.compromissos (cliente_id);
create index compromissos_caso_idx on public.compromissos (caso_id);
create index compromissos_processo_idx on public.compromissos (processo_id);
create index compromissos_responsavel_idx on public.compromissos (responsavel_id);
create index compromissos_created_by_idx on public.compromissos (created_by);
create index compromissos_participantes_idx on public.compromissos using gin (participantes);

create trigger compromissos_atualizado_em before update on public.compromissos
  for each row execute function public.tg_atualizado_em();

-- -----------------------------------------------------------------------------
-- Prazos processuais
-- Os prazos são informados pela equipe. O auxílio de contagem (quando usado)
-- fica registrado em "calculo" e exige conferência por profissional habilitado.
-- -----------------------------------------------------------------------------

create table public.prazos (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  processo_id uuid references public.processos (id) on delete set null,
  titulo text not null check (length(trim(titulo)) between 1 and 200),
  descricao text,
  origem text not null default 'intimacao_eletronica',
  referencia_origem text,
  data_ciencia date,
  vencimento timestamptz not null,
  responsavel_id uuid references public.usuarios (id) on delete set null,
  prioridade text not null default 'alta',
  alertas_dias integer[] not null default '{5,2,1,0}',
  status text not null default 'pendente' check (status in ('pendente', 'cumprido', 'cancelado')),
  conferido boolean not null default false,
  conferido_por uuid references public.usuarios (id) on delete set null,
  conferido_em timestamptz,
  calculo jsonb,
  cumprido_em timestamptz,
  cumprido_por uuid references public.usuarios (id) on delete set null,
  comprovante_arquivo_id uuid,
  cumprimento_obs text,
  motivo_alteracao text,
  observacoes text,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  versao integer not null default 1
);

comment on column public.prazos.calculo is
  'Parâmetros do auxílio de contagem utilizado (início, dias, tipo de contagem, feriados considerados). Apenas sugestão; exige conferência.';
comment on column public.prazos.motivo_alteracao is
  'Preenchido pela interface ao corrigir o vencimento; é gravado no histórico e limpo em seguida.';

create index prazos_caso_idx on public.prazos (caso_id);
create index prazos_processo_idx on public.prazos (processo_id);
create index prazos_responsavel_idx on public.prazos (responsavel_id);
create index prazos_conferido_por_idx on public.prazos (conferido_por);
create index prazos_cumprido_por_idx on public.prazos (cumprido_por);
create index prazos_created_by_idx on public.prazos (created_by);
create index prazos_vencimento_idx on public.prazos (vencimento) where status = 'pendente';

create trigger prazos_atualizado_em before update on public.prazos
  for each row execute function public.tg_atualizado_em();
create trigger prazos_versao before update on public.prazos
  for each row execute function public.tg_incrementar_versao();

create table public.prazos_historico (
  id bigint generated always as identity primary key,
  prazo_id uuid not null references public.prazos (id) on delete cascade,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  motivo text,
  usuario_id uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now()
);

create index prazos_historico_prazo_idx on public.prazos_historico (prazo_id, created_at desc);
create index prazos_historico_usuario_idx on public.prazos_historico (usuario_id);
