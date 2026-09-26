-- =============================================================================
-- CRM Amado & Amado Jr. — 03. Leads, quiz, consentimentos, clientes e contatos
-- =============================================================================

create sequence public.leads_codigo_seq;
create sequence public.clientes_codigo_seq;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nome text not null check (length(trim(nome)) between 1 and 160),
  whatsapp text,
  telefone_norm text generated always as (public.normalizar_telefone(whatsapp)) stored,
  telefone_chave text generated always as (public.chave_telefone(whatsapp)) stored,
  email text,
  email_norm text generated always as (public.normalizar_email(email)) stored,
  cpf text,
  cpf_norm text generated always as (public.normalizar_documento(cpf)) stored,
  estado text,
  municipio text,
  profissao text,
  faixa_renda text,
  etapa_id uuid not null references public.etapas (id),
  etapa_alterada_em timestamptz not null default now(),
  responsavel_id uuid references public.usuarios (id) on delete set null,
  origem text not null default 'manual',
  tipo_demanda_id uuid references public.tipos_demanda (id) on delete set null,
  temperatura text check (temperatura in ('quente', 'morno', 'frio')),
  score integer,
  prioridade text not null default 'media',
  proxima_acao text,
  proxima_acao_em timestamptz,
  motivo_perda text,
  motivo_perda_detalhe text,
  cliente_id uuid,
  convertido_em timestamptz,
  convertido_por uuid references public.usuarios (id) on delete set null,
  -- Últimas respostas do quiz (todas as submissões ficam em quiz_submissoes/quiz_respostas)
  quiz_interesse text,
  quiz_cultiva text,
  quiz_consulta_medica text,
  quiz_motivacao text,
  quiz_agenda text,
  quiz_horario text,
  quiz_observacoes text,
  ultima_submissao_id uuid,
  total_submissoes integer not null default 0,
  primeiro_contato_em timestamptz,
  ultimo_contato_em timestamptz,
  ultima_atividade_em timestamptz not null default now(),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  observacoes text,
  etiquetas uuid[] not null default '{}',
  mesclado_em_id uuid references public.leads (id) on delete set null,
  arquivado_em timestamptz,
  arquivado_por uuid references public.usuarios (id) on delete set null,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  versao integer not null default 1
);

create index leads_etapa_idx on public.leads (etapa_id);
create index leads_responsavel_idx on public.leads (responsavel_id);
create index leads_cliente_idx on public.leads (cliente_id);
create index leads_tipo_demanda_idx on public.leads (tipo_demanda_id);
create index leads_convertido_por_idx on public.leads (convertido_por);
create index leads_arquivado_por_idx on public.leads (arquivado_por);
create index leads_created_by_idx on public.leads (created_by);
create index leads_mesclado_idx on public.leads (mesclado_em_id);
create index leads_telefone_chave_idx on public.leads (telefone_chave);
create index leads_email_norm_idx on public.leads (email_norm);
create index leads_cpf_norm_idx on public.leads (cpf_norm);
create index leads_created_at_idx on public.leads (created_at desc);
create index leads_nome_trgm_idx on public.leads using gin (public.f_unaccent(lower(nome)) extensions.gin_trgm_ops);

create trigger leads_atualizado_em before update on public.leads
  for each row execute function public.tg_atualizado_em();
create trigger leads_versao before update on public.leads
  for each row execute function public.tg_incrementar_versao();

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  tipo_pessoa text not null default 'PF' check (tipo_pessoa in ('PF', 'PJ')),
  nome text not null check (length(trim(nome)) between 1 and 160),
  nome_social text,
  cpf_cnpj text,
  cpf_cnpj_norm text generated always as (public.normalizar_documento(cpf_cnpj)) stored,
  rg text,
  data_nascimento date,
  nacionalidade text,
  estado_civil text,
  profissao text,
  email text,
  email_norm text generated always as (public.normalizar_email(email)) stored,
  whatsapp text,
  telefone_norm text generated always as (public.normalizar_telefone(whatsapp)) stored,
  telefone_chave text generated always as (public.chave_telefone(whatsapp)) stored,
  telefone_secundario text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  responsavel_id uuid references public.usuarios (id) on delete set null,
  origem text not null default 'manual',
  lead_origem_id uuid references public.leads (id) on delete set null,
  possui_representante boolean not null default false,
  representante_nome text,
  representante_cpf text,
  representante_parentesco text,
  representante_contato text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  observacoes text,
  etiquetas uuid[] not null default '{}',
  arquivado_em timestamptz,
  arquivado_por uuid references public.usuarios (id) on delete set null,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  versao integer not null default 1
);

create unique index clientes_cpf_cnpj_uidx on public.clientes (cpf_cnpj_norm)
  where cpf_cnpj_norm is not null and arquivado_em is null;
create index clientes_responsavel_idx on public.clientes (responsavel_id);
create index clientes_lead_origem_idx on public.clientes (lead_origem_id);
create index clientes_arquivado_por_idx on public.clientes (arquivado_por);
create index clientes_created_by_idx on public.clientes (created_by);
create index clientes_telefone_chave_idx on public.clientes (telefone_chave);
create index clientes_email_norm_idx on public.clientes (email_norm);
create index clientes_nome_trgm_idx on public.clientes using gin (public.f_unaccent(lower(nome)) extensions.gin_trgm_ops);

create trigger clientes_atualizado_em before update on public.clientes
  for each row execute function public.tg_atualizado_em();
create trigger clientes_versao before update on public.clientes
  for each row execute function public.tg_incrementar_versao();

alter table public.leads
  add constraint leads_cliente_fk foreign key (cliente_id) references public.clientes (id) on delete set null;

-- Dados clínicos ficam separados para permitir acesso restrito por necessidade.
create table public.dados_clinicos (
  cliente_id uuid primary key references public.clientes (id) on delete cascade,
  diagnostico text,
  cid text,
  medico_nome text,
  medico_registro text,
  medico_especialidade text,
  tratamento_atual text,
  tratamentos_anteriores text,
  produto_prescrito text,
  posologia text,
  observacoes text,
  updated_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dados_clinicos_updated_by_idx on public.dados_clinicos (updated_by);

-- -----------------------------------------------------------------------------
-- Quiz do site
-- -----------------------------------------------------------------------------

create table public.quiz_submissoes (
  id uuid primary key default gen_random_uuid(),
  chave_idempotencia uuid not null unique,
  lead_id uuid references public.leads (id) on delete set null,
  status text not null default 'processada' check (status in ('processada', 'bloqueada')),
  motivo_bloqueio text,
  nome text,
  whatsapp text,
  email text,
  respostas jsonb not null default '{}',
  score_informado integer,
  score_calculado integer,
  temperatura text,
  observacoes text,
  versao_quiz text,
  pagina text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  fbclid text,
  user_agent text,
  ip_hash text,
  iniciado_em timestamptz,
  duracao_segundos integer,
  recebido_em timestamptz not null default now()
);

create index quiz_submissoes_lead_idx on public.quiz_submissoes (lead_id);
create index quiz_submissoes_recebido_idx on public.quiz_submissoes (recebido_em desc);

create table public.quiz_respostas (
  id bigint generated always as identity primary key,
  submissao_id uuid not null references public.quiz_submissoes (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  ordem integer not null,
  pergunta_id text not null,
  pergunta text not null,
  campo text,
  resposta text,
  valor text,
  pontuacao integer
);

create index quiz_respostas_submissao_idx on public.quiz_respostas (submissao_id, ordem);
create index quiz_respostas_lead_idx on public.quiz_respostas (lead_id);

alter table public.leads
  add constraint leads_ultima_submissao_fk foreign key (ultima_submissao_id)
  references public.quiz_submissoes (id) on delete set null;
create index leads_ultima_submissao_idx on public.leads (ultima_submissao_id);

-- Registro da manifestação do visitante sobre o tratamento de dados (LGPD).
create table public.consentimentos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  submissao_id uuid references public.quiz_submissoes (id) on delete set null,
  tipo text not null default 'lgpd_quiz',
  texto text not null,
  versao text,
  concedido boolean not null,
  origem text not null default 'quiz_site',
  pagina text,
  ip_hash text,
  user_agent text,
  registrado_em timestamptz not null default now()
);

create index consentimentos_lead_idx on public.consentimentos (lead_id);
create index consentimentos_cliente_idx on public.consentimentos (cliente_id);
create index consentimentos_submissao_idx on public.consentimentos (submissao_id);

-- -----------------------------------------------------------------------------
-- Histórico de contatos (ligações, WhatsApp, e-mails, reuniões, notas)
-- -----------------------------------------------------------------------------

create table public.interacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'nota',
  direcao text check (direcao in ('saida', 'entrada')),
  resumo text not null check (length(trim(resumo)) between 1 and 4000),
  resultado text,
  ocorrida_em timestamptz not null default now(),
  lead_id uuid references public.leads (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete cascade,
  caso_id uuid,
  usuario_id uuid references public.usuarios (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (lead_id is not null or cliente_id is not null or caso_id is not null)
);

create index interacoes_lead_idx on public.interacoes (lead_id, ocorrida_em desc);
create index interacoes_cliente_idx on public.interacoes (cliente_id, ocorrida_em desc);
create index interacoes_caso_idx on public.interacoes (caso_id, ocorrida_em desc);
create index interacoes_usuario_idx on public.interacoes (usuario_id);
