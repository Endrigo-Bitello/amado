-- =============================================================================
-- CRM Amado & Amado Jr. — 08. Comentários, linha do tempo, notificações,
-- auditoria, importações, limites de uso e execuções de automações
-- =============================================================================

create table public.comentarios (
  id uuid primary key default gen_random_uuid(),
  entidade text not null check (entidade in ('lead', 'cliente', 'caso', 'tarefa', 'documento', 'prazo', 'processo', 'compromisso')),
  registro_id uuid not null,
  texto text not null check (length(trim(texto)) between 1 and 8000),
  mencoes uuid[] not null default '{}',
  autor_id uuid references public.usuarios (id) on delete set null default auth.uid(),
  editado_em timestamptz,
  removido_em timestamptz,
  created_at timestamptz not null default now()
);

create index comentarios_registro_idx on public.comentarios (entidade, registro_id, created_at);
create index comentarios_autor_idx on public.comentarios (autor_id);

-- Linha do tempo unificada (lead, cliente e caso)
create table public.eventos (
  id bigint generated always as identity primary key,
  tipo text not null,
  titulo text not null,
  detalhes jsonb not null default '{}',
  lead_id uuid references public.leads (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete cascade,
  caso_id uuid references public.casos (id) on delete cascade,
  entidade text,
  registro_id uuid,
  restrito text check (restrito in ('financeiro', 'saude')),
  automatico boolean not null default false,
  autor_id uuid references public.usuarios (id) on delete set null,
  ocorrido_em timestamptz not null default now()
);

comment on column public.eventos.restrito is
  'Eventos financeiros ou clínicos só aparecem para quem possui a permissão correspondente.';

create index eventos_lead_idx on public.eventos (lead_id, ocorrido_em desc);
create index eventos_cliente_idx on public.eventos (cliente_id, ocorrido_em desc);
create index eventos_caso_idx on public.eventos (caso_id, ocorrido_em desc);
create index eventos_autor_idx on public.eventos (autor_id);

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  mensagem text,
  link text,
  entidade text,
  registro_id uuid,
  automacao_id uuid references public.automacoes (id) on delete set null,
  chave_dedupe text,
  lida_em timestamptz,
  created_at timestamptz not null default now(),
  unique (usuario_id, chave_dedupe)
);

create index notificacoes_usuario_idx on public.notificacoes (usuario_id, created_at desc);
create index notificacoes_automacao_idx on public.notificacoes (automacao_id);

create table public.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id text,
  acao text not null check (acao in ('INSERT', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'ACAO')),
  usuario_id uuid references public.usuarios (id) on delete set null,
  alteracoes jsonb not null default '{}',
  contexto text,
  created_at timestamptz not null default now()
);

create index auditoria_tabela_idx on public.auditoria (tabela, created_at desc);
create index auditoria_registro_idx on public.auditoria (registro_id);
create index auditoria_usuario_idx on public.auditoria (usuario_id, created_at desc);
create index auditoria_created_idx on public.auditoria (created_at desc);

create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'clientes' check (tipo in ('clientes')),
  arquivo_nome text,
  total_linhas integer not null default 0,
  criados integer not null default 0,
  atualizados integer not null default 0,
  ignorados integer not null default 0,
  erros integer not null default 0,
  mapeamento jsonb not null default '{}',
  relatorio jsonb not null default '[]',
  status text not null default 'concluida' check (status in ('concluida', 'falhou')),
  usuario_id uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on column public.importacoes.relatorio is
  'Resultado por linha (número da linha, ação e mensagens). Não armazena os dados pessoais importados.';

create index importacoes_usuario_idx on public.importacoes (usuario_id);

-- Limites de uso para as entradas públicas (quiz e portal do cliente).
create table public.limites_uso (
  chave text not null,
  janela_inicio timestamptz not null,
  contagem integer not null default 0,
  primary key (chave, janela_inicio)
);

create index limites_uso_janela_idx on public.limites_uso (janela_inicio);

create table public.automacoes_execucoes (
  id bigint generated always as identity primary key,
  automacao_id uuid references public.automacoes (id) on delete cascade,
  iniciado_em timestamptz not null default now(),
  itens_afetados integer not null default 0,
  erro text
);

create index automacoes_execucoes_automacao_idx on public.automacoes_execucoes (automacao_id, iniciado_em desc);
