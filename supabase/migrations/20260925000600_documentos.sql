-- =============================================================================
-- CRM Amado & Amado Jr. — 06. Documentos, modelos de checklist, arquivos,
-- vídeos e solicitações seguras de documentos ao cliente
-- =============================================================================

create table public.categorias_documento (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 120),
  descricao text,
  clinico boolean not null default false,
  financeiro boolean not null default false,
  cor text not null default '#3D7B3E',
  ordem integer not null default 100,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.categorias_documento.clinico is
  'Documentos desta categoria são dados de saúde: acesso apenas para quem possui permissão clínica.';
comment on column public.categorias_documento.financeiro is
  'Documentos desta categoria revelam valores (contratos, comprovantes): acesso apenas com financeiro.ver.';

create trigger categorias_documento_atualizado_em before update on public.categorias_documento
  for each row execute function public.tg_atualizado_em();

create table public.modelos_checklist (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 160),
  descricao text,
  tipo_demanda_id uuid references public.tipos_demanda (id) on delete set null,
  aviso text,
  ativo boolean not null default true,
  versao integer not null default 1,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index modelos_checklist_tipo_demanda_idx on public.modelos_checklist (tipo_demanda_id);
create index modelos_checklist_created_by_idx on public.modelos_checklist (created_by);
create trigger modelos_checklist_atualizado_em before update on public.modelos_checklist
  for each row execute function public.tg_atualizado_em();

alter table public.tipos_demanda
  add constraint tipos_demanda_modelo_checklist_fk foreign key (modelo_checklist_id)
  references public.modelos_checklist (id) on delete set null;
create index tipos_demanda_modelo_checklist_idx on public.tipos_demanda (modelo_checklist_id);

create table public.modelos_checklist_grupos (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references public.modelos_checklist (id) on delete cascade,
  nome text not null check (length(trim(nome)) between 1 and 160),
  descricao text,
  ordem integer not null default 100,
  created_at timestamptz not null default now()
);

create index modelos_checklist_grupos_modelo_idx on public.modelos_checklist_grupos (modelo_id, ordem);

create table public.modelos_checklist_itens (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references public.modelos_checklist (id) on delete cascade,
  grupo_id uuid references public.modelos_checklist_grupos (id) on delete set null,
  categoria_id uuid references public.categorias_documento (id) on delete set null,
  nome text not null check (length(trim(nome)) between 1 and 200),
  descricao_cliente text,
  instrucao_equipe text,
  obrigatoriedade text not null default 'obrigatorio'
    check (obrigatoriedade in ('obrigatorio', 'opcional', 'condicional')),
  condicao jsonb,
  condicao_descricao text,
  prazo_dias integer check (prazo_dias is null or prazo_dias between 0 and 365),
  revisor_tipo text not null default 'responsavel_caso'
    check (revisor_tipo in ('responsavel_caso', 'usuario', 'perfil')),
  revisor_usuario_id uuid references public.usuarios (id) on delete set null,
  revisor_perfil_id text references public.perfis (id) on delete set null on update cascade,
  etapa text,
  validade_dias integer check (validade_dias is null or validade_dias between 1 and 3650),
  cliente_pode_enviar boolean not null default true,
  ordem integer not null default 100,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.modelos_checklist_itens.condicao is
  'Regra segura avaliada ao aplicar o modelo: {"campo": "cliente.possui_representante", "operador": "igual", "valor": true}.';

create index modelos_checklist_itens_modelo_idx on public.modelos_checklist_itens (modelo_id, ordem);
create index modelos_checklist_itens_grupo_idx on public.modelos_checklist_itens (grupo_id);
create index modelos_checklist_itens_categoria_idx on public.modelos_checklist_itens (categoria_id);
create index modelos_checklist_itens_revisor_idx on public.modelos_checklist_itens (revisor_usuario_id);
create index modelos_checklist_itens_revisor_perfil_idx on public.modelos_checklist_itens (revisor_perfil_id);
create trigger modelos_checklist_itens_atualizado_em before update on public.modelos_checklist_itens
  for each row execute function public.tg_atualizado_em();

-- -----------------------------------------------------------------------------
-- Documentos de um cliente/caso (instâncias do checklist ou avulsos)
-- -----------------------------------------------------------------------------

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete cascade,
  caso_id uuid references public.casos (id) on delete cascade,
  modelo_id uuid references public.modelos_checklist (id) on delete set null,
  modelo_item_id uuid references public.modelos_checklist_itens (id) on delete set null,
  grupo text,
  categoria_id uuid references public.categorias_documento (id) on delete set null,
  nome text not null check (length(trim(nome)) between 1 and 200),
  descricao_cliente text,
  instrucao_equipe text,
  obrigatorio boolean not null default true,
  condicao_descricao text,
  status text not null default 'nao_solicitado' check (status in (
    'nao_solicitado', 'solicitado', 'recebido', 'em_revisao', 'aprovado', 'rejeitado', 'dispensado'
  )),
  prazo date,
  revisor_id uuid references public.usuarios (id) on delete set null,
  etapa text,
  validade_dias integer,
  valido_ate date,
  cliente_pode_enviar boolean not null default true,
  clinico boolean not null default false,
  financeiro boolean not null default false,
  solicitado_por uuid references public.usuarios (id) on delete set null,
  solicitado_em timestamptz,
  recebido_por uuid references public.usuarios (id) on delete set null,
  recebido_em timestamptz,
  enviado_pelo_cliente boolean not null default false,
  revisado_por uuid references public.usuarios (id) on delete set null,
  revisado_em timestamptz,
  aprovado_por uuid references public.usuarios (id) on delete set null,
  aprovado_em timestamptz,
  rejeitado_motivo text,
  dispensado_motivo text,
  observacoes text,
  ordem integer not null default 100,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lead_id is not null or cliente_id is not null)
);

create index documentos_lead_idx on public.documentos (lead_id);
create index documentos_cliente_idx on public.documentos (cliente_id);
create index documentos_caso_idx on public.documentos (caso_id);
create index documentos_modelo_idx on public.documentos (modelo_id);
create index documentos_modelo_item_idx on public.documentos (modelo_item_id);
create index documentos_categoria_idx on public.documentos (categoria_id);
create index documentos_revisor_idx on public.documentos (revisor_id);
create index documentos_solicitado_por_idx on public.documentos (solicitado_por);
create index documentos_recebido_por_idx on public.documentos (recebido_por);
create index documentos_revisado_por_idx on public.documentos (revisado_por);
create index documentos_aprovado_por_idx on public.documentos (aprovado_por);
create index documentos_created_by_idx on public.documentos (created_by);
create index documentos_status_idx on public.documentos (status);

create trigger documentos_atualizado_em before update on public.documentos
  for each row execute function public.tg_atualizado_em();

create table public.documentos_historico (
  id bigint generated always as identity primary key,
  documento_id uuid not null references public.documentos (id) on delete cascade,
  de text,
  para text not null,
  via text not null default 'crm' check (via in ('crm', 'portal', 'automacao', 'sistema')),
  comentario text,
  usuario_id uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now()
);

create index documentos_historico_documento_idx on public.documentos_historico (documento_id, created_at desc);
create index documentos_historico_usuario_idx on public.documentos_historico (usuario_id);

-- -----------------------------------------------------------------------------
-- Solicitações de documentos ao cliente (link individual, expirável)
-- Somente o hash do token é armazenado.
-- -----------------------------------------------------------------------------

create table public.solicitacoes_documentos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete cascade,
  caso_id uuid references public.casos (id) on delete cascade,
  token_hash text not null unique,
  documentos_ids uuid[] not null,
  mensagem text,
  expira_em timestamptz not null,
  revogada_em timestamptz,
  revogada_por uuid references public.usuarios (id) on delete set null,
  ultimo_acesso_em timestamptz,
  total_acessos integer not null default 0,
  total_envios integer not null default 0,
  criado_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  check (lead_id is not null or cliente_id is not null),
  check (cardinality(documentos_ids) between 1 and 60)
);

create index solicitacoes_documentos_lead_idx on public.solicitacoes_documentos (lead_id);
create index solicitacoes_documentos_cliente_idx on public.solicitacoes_documentos (cliente_id);
create index solicitacoes_documentos_caso_idx on public.solicitacoes_documentos (caso_id);
create index solicitacoes_documentos_criado_por_idx on public.solicitacoes_documentos (criado_por);
create index solicitacoes_documentos_revogada_por_idx on public.solicitacoes_documentos (revogada_por);

-- -----------------------------------------------------------------------------
-- Arquivos (metadados dos objetos no Storage privado). Cada novo envio para
-- um mesmo documento gera uma nova versão; versões anteriores são mantidas.
-- -----------------------------------------------------------------------------

create table public.arquivos (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('crm-documentos', 'crm-financeiro')),
  caminho text not null,
  nome text not null check (length(nome) between 1 and 255),
  mime text,
  tamanho bigint check (tamanho is null or tamanho >= 0),
  tipo text not null default 'documento' check (tipo in (
    'documento', 'video', 'anexo', 'comprovante_prazo', 'comprovante_financeiro', 'contrato'
  )),
  versao integer not null default 1,
  lead_id uuid references public.leads (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete cascade,
  caso_id uuid references public.casos (id) on delete cascade,
  tarefa_id uuid references public.tarefas (id) on delete cascade,
  documento_id uuid references public.documentos (id) on delete set null,
  categoria_id uuid references public.categorias_documento (id) on delete set null,
  clinico boolean not null default false,
  financeiro boolean not null default false,
  restrito boolean not null default false,
  descricao text,
  enviado_por uuid references public.usuarios (id) on delete set null,
  enviado_pelo_cliente boolean not null default false,
  solicitacao_id uuid references public.solicitacoes_documentos (id) on delete set null,
  removido_em timestamptz,
  removido_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, caminho)
);

create index arquivos_lead_idx on public.arquivos (lead_id);
create index arquivos_cliente_idx on public.arquivos (cliente_id);
create index arquivos_caso_idx on public.arquivos (caso_id);
create index arquivos_tarefa_idx on public.arquivos (tarefa_id);
create index arquivos_documento_idx on public.arquivos (documento_id, versao desc);
create index arquivos_categoria_idx on public.arquivos (categoria_id);
create index arquivos_enviado_por_idx on public.arquivos (enviado_por);
create index arquivos_solicitacao_idx on public.arquivos (solicitacao_id);
create index arquivos_removido_por_idx on public.arquivos (removido_por);

alter table public.prazos
  add constraint prazos_comprovante_fk foreign key (comprovante_arquivo_id)
  references public.arquivos (id) on delete set null;
create index prazos_comprovante_idx on public.prazos (comprovante_arquivo_id);

-- -----------------------------------------------------------------------------
-- Vídeos e mídias (links externos ou arquivos) do cliente/caso
-- -----------------------------------------------------------------------------

create table public.midias (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes (id) on delete cascade,
  caso_id uuid references public.casos (id) on delete cascade,
  tipo text not null check (tipo in ('link', 'arquivo')),
  url text,
  arquivo_id uuid references public.arquivos (id) on delete set null,
  titulo text not null check (length(trim(titulo)) between 1 and 200),
  descricao text,
  visibilidade text not null default 'equipe' check (visibilidade in ('equipe', 'saude', 'responsaveis')),
  created_by uuid references public.usuarios (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cliente_id is not null or caso_id is not null),
  check ((tipo = 'link' and url ~* '^https?://') or (tipo = 'arquivo' and arquivo_id is not null))
);

comment on column public.midias.visibilidade is
  'equipe: quem vê o cliente/caso; saude: somente quem pode ver dados clínicos; responsaveis: responsável/equipe do caso e administradores.';

create index midias_cliente_idx on public.midias (cliente_id);
create index midias_caso_idx on public.midias (caso_id);
create index midias_arquivo_idx on public.midias (arquivo_id);
create index midias_created_by_idx on public.midias (created_by);
create trigger midias_atualizado_em before update on public.midias
  for each row execute function public.tg_atualizado_em();
