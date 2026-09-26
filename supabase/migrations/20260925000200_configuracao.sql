-- =============================================================================
-- CRM Amado & Amado Jr. — 02. Configuração sem código
-- Tipos de demanda, etapas de funis/fases, listas de opções, etiquetas,
-- campos personalizados, configurações gerais, visualizações e feriados.
-- =============================================================================

create table public.tipos_demanda (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 120),
  descricao text,
  cor text not null default '#3D7B3E',
  ordem integer not null default 100,
  ativo boolean not null default true,
  modelo_checklist_id uuid,   -- FK criada na migration de documentos
  modelo_tarefas_id uuid,     -- FK criada na migration de tarefas
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index tipos_demanda_nome_uidx on public.tipos_demanda (lower(nome));
create trigger tipos_demanda_atualizado_em before update on public.tipos_demanda
  for each row execute function public.tg_atualizado_em();

-- Etapas do funil de leads e fases dos casos.
create table public.etapas (
  id uuid primary key default gen_random_uuid(),
  funil text not null check (funil in ('lead', 'caso')),
  nome text not null check (length(trim(nome)) between 1 and 80),
  descricao text,
  cor text not null default '#8A8F87',
  ordem integer not null default 100,
  categoria text not null default 'aberta' check (categoria in ('aberta', 'ganha', 'perdida')),
  ativo boolean not null default true,
  chave text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.etapas.categoria is
  'Para o funil de leads: aberta, ganha (contratado) ou perdida (não convertido). Fases de casos usam "aberta".';

create index etapas_funil_idx on public.etapas (funil, ordem);
create trigger etapas_atualizado_em before update on public.etapas
  for each row execute function public.tg_atualizado_em();

create or replace function public.etapa_inicial(p_funil text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.etapas e
  where e.funil = p_funil and e.ativo and e.categoria = 'aberta'
  order by e.ordem, e.created_at
  limit 1
$$;

create or replace function public.etapa_por_categoria(p_funil text, p_categoria text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.etapas e
  where e.funil = p_funil and e.ativo and e.categoria = p_categoria
  order by e.ordem, e.created_at
  limit 1
$$;

-- Listas de opções configuráveis (prioridades, origens, motivos de perda etc.).
-- O "valor" é estável e gravado nos registros; o rótulo pode ser renomeado.
create table public.opcoes (
  lista text not null check (lista ~ '^[a-z0-9_]{2,40}$'),
  valor text not null check (valor ~ '^[a-z0-9_]{1,60}$'),
  rotulo text not null check (length(trim(rotulo)) between 1 and 80),
  cor text,
  ordem integer not null default 100,
  ativo boolean not null default true,
  sistema boolean not null default false,
  meta jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (lista, valor)
);

create trigger opcoes_atualizado_em before update on public.opcoes
  for each row execute function public.tg_atualizado_em();

create table public.etiquetas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 40),
  cor text not null default '#C5A880',
  escopos text[] not null default '{lead,cliente,caso,tarefa}',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger etiquetas_atualizado_em before update on public.etiquetas
  for each row execute function public.tg_atualizado_em();

-- -----------------------------------------------------------------------------
-- Campos personalizados
-- -----------------------------------------------------------------------------

create table public.campos_personalizados (
  id uuid primary key default gen_random_uuid(),
  entidade text not null check (entidade in ('lead', 'cliente', 'caso')),
  rotulo text not null check (length(trim(rotulo)) between 1 and 80),
  tipo text not null check (tipo in ('texto', 'texto_longo', 'numero', 'moeda', 'data', 'selecao', 'multipla', 'checkbox', 'link')),
  opcoes jsonb not null default '[]',
  obrigatorio boolean not null default false,
  visibilidade text not null default 'todos' check (visibilidade in ('todos', 'saude', 'financeiro', 'admin')),
  secao text not null default 'Informações adicionais',
  ajuda text,
  ordem integer not null default 100,
  mostrar_no_quadro boolean not null default true,
  ativo boolean not null default true,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.campos_personalizados.opcoes is
  'Para seleção/múltipla seleção: [{"id": "abc", "rotulo": "...", "cor": "#...", "arquivado": false}]. Os valores gravam o id da opção.';

create index campos_personalizados_entidade_idx on public.campos_personalizados (entidade, ordem);
create trigger campos_personalizados_atualizado_em before update on public.campos_personalizados
  for each row execute function public.tg_atualizado_em();

create table public.valores_personalizados (
  campo_id uuid not null references public.campos_personalizados (id) on delete restrict,
  registro_id uuid not null,
  entidade text not null check (entidade in ('lead', 'cliente', 'caso')),
  valor jsonb,
  updated_by uuid references public.usuarios (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (campo_id, registro_id)
);

create index valores_personalizados_registro_idx on public.valores_personalizados (registro_id);

-- Mantém os dados já gravados: impede trocar o tipo de um campo que já possui
-- valores e impede excluir campos com valores (devem ser arquivados).
create or replace function public.tg_campos_personalizados_protecao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.tipo is distinct from old.tipo then
    if exists (select 1 from public.valores_personalizados v where v.campo_id = old.id and v.valor is not null) then
      raise exception 'Este campo já possui valores preenchidos. Para mudar o tipo, arquive-o e crie um novo campo.';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.entidade is distinct from old.entidade then
    raise exception 'Não é possível mover um campo para outro tipo de registro.';
  end if;
  return new;
end
$$;

create trigger campos_personalizados_protecao before update on public.campos_personalizados
  for each row execute function public.tg_campos_personalizados_protecao();

create or replace function public.tg_valores_personalizados_antes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entidade text;
begin
  select c.entidade into v_entidade from public.campos_personalizados c where c.id = new.campo_id;
  if v_entidade is null or v_entidade <> new.entidade then
    raise exception 'Campo personalizado incompatível com o registro.';
  end if;
  new.updated_at := now();
  new.updated_by := public.usuario_atual();
  return new;
end
$$;

create trigger valores_personalizados_antes before insert or update on public.valores_personalizados
  for each row execute function public.tg_valores_personalizados_antes();

-- -----------------------------------------------------------------------------
-- Configurações gerais (painel, nomenclaturas, textos, aparência, portal...)
-- -----------------------------------------------------------------------------

create table public.configuracoes (
  chave text primary key check (chave ~ '^[a-z0-9_.]{2,60}$'),
  valor jsonb not null,
  descricao text,
  updated_by uuid references public.usuarios (id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.tg_configuracoes_antes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := public.usuario_atual();
  return new;
end
$$;

create trigger configuracoes_antes before insert or update on public.configuracoes
  for each row execute function public.tg_configuracoes_antes();

-- -----------------------------------------------------------------------------
-- Visualizações salvas dos quadros (filtros, colunas, agrupamentos)
-- -----------------------------------------------------------------------------

create table public.visualizacoes (
  id uuid primary key default gen_random_uuid(),
  quadro text not null check (quadro in ('leads', 'clientes', 'casos', 'tarefas', 'prazos', 'documentos', 'financeiro', 'agenda')),
  nome text not null check (length(trim(nome)) between 1 and 80),
  tipo text not null default 'tabela' check (tipo in ('tabela', 'kanban', 'calendario', 'resumo')),
  config jsonb not null default '{}',
  compartilhada boolean not null default false,
  padrao boolean not null default false,
  dono_id uuid references public.usuarios (id) on delete cascade default auth.uid(),
  ordem integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visualizacoes_quadro_idx on public.visualizacoes (quadro);
create index visualizacoes_dono_idx on public.visualizacoes (dono_id);
create trigger visualizacoes_atualizado_em before update on public.visualizacoes
  for each row execute function public.tg_atualizado_em();

create table public.visualizacoes_favoritas (
  usuario_id uuid not null references public.usuarios (id) on delete cascade default auth.uid(),
  visualizacao_id uuid not null references public.visualizacoes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (usuario_id, visualizacao_id)
);

create index visualizacoes_favoritas_visualizacao_idx on public.visualizacoes_favoritas (visualizacao_id);

-- -----------------------------------------------------------------------------
-- Feriados e suspensões (apenas para o auxílio de contagem de prazos)
-- -----------------------------------------------------------------------------

create table public.feriados (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  descricao text not null check (length(trim(descricao)) between 2 and 120),
  abrangencia text not null default 'nacional' check (abrangencia in ('nacional', 'estadual', 'municipal', 'forense')),
  uf text,
  municipio text,
  tribunal text,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now()
);

create index feriados_data_idx on public.feriados (data);
