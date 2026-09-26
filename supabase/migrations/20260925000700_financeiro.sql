-- =============================================================================
-- CRM Amado & Amado Jr. — 07. Financeiro (honorários, parcelas, pagamentos,
-- reembolsos, custas e despesas)
--
-- Separação conceitual:
--   * cobrancas  — valores que o CLIENTE deve ao ESCRITÓRIO (honorários ou
--                  reembolso de despesas adiantadas pelo escritório).
--   * pagamentos — recebimentos do escritório vinculados a uma cobrança
--                  (admite pagamento parcial).
--   * reembolsos — devoluções do escritório ao cliente.
--   * despesas   — custas e despesas pagas EM NOME do cliente (pelo escritório
--                  ou pelo próprio cliente). Nunca entram como receita.
--
-- Escrita somente pela Edge Function crm-financeiro (funções de serviço).
-- Não há integração bancária, emissão fiscal ou cobrança automática ativas;
-- os campos id_externo ficam reservados para integrações futuras.
-- =============================================================================

create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  caso_id uuid references public.casos (id) on delete set null,
  descricao text not null default 'Honorários advocatícios',
  forma_contratacao text not null default 'parcelado',
  valor_total numeric(14, 2) not null check (valor_total >= 0),
  valor_entrada numeric(14, 2) not null default 0 check (valor_entrada >= 0),
  data_entrada date,
  numero_parcelas integer not null default 0 check (numero_parcelas between 0 and 120),
  primeiro_vencimento date,
  percentual_exito numeric(5, 2) check (percentual_exito is null or percentual_exito between 0 and 100),
  desconto numeric(14, 2) not null default 0 check (desconto >= 0),
  acrescimo numeric(14, 2) not null default 0 check (acrescimo >= 0),
  data_assinatura date,
  arquivo_id uuid references public.arquivos (id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo', 'encerrado', 'cancelado')),
  observacoes text,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  versao integer not null default 1
);

create index contratos_cliente_idx on public.contratos (cliente_id);
create index contratos_caso_idx on public.contratos (caso_id);
create index contratos_arquivo_idx on public.contratos (arquivo_id);
create index contratos_created_by_idx on public.contratos (created_by);
create trigger contratos_atualizado_em before update on public.contratos
  for each row execute function public.tg_atualizado_em();
create trigger contratos_versao before update on public.contratos
  for each row execute function public.tg_incrementar_versao();

create table public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references public.contratos (id) on delete restrict,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  caso_id uuid references public.casos (id) on delete set null,
  categoria text not null default 'honorarios' check (categoria in ('honorarios', 'reembolso_despesas')),
  descricao text not null check (length(trim(descricao)) between 1 and 200),
  parcela_numero integer,
  parcela_total integer,
  valor numeric(14, 2) not null check (valor >= 0),
  desconto numeric(14, 2) not null default 0 check (desconto >= 0),
  acrescimo numeric(14, 2) not null default 0 check (acrescimo >= 0),
  vencimento date not null,
  cancelada_em timestamptz,
  cancelada_por uuid references public.usuarios (id) on delete set null,
  motivo_cancelamento text,
  observacoes text,
  id_externo text,
  created_by uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (desconto <= valor + acrescimo)
);

create index cobrancas_contrato_idx on public.cobrancas (contrato_id);
create index cobrancas_cliente_idx on public.cobrancas (cliente_id);
create index cobrancas_caso_idx on public.cobrancas (caso_id);
create index cobrancas_cancelada_por_idx on public.cobrancas (cancelada_por);
create index cobrancas_created_by_idx on public.cobrancas (created_by);
create index cobrancas_vencimento_idx on public.cobrancas (vencimento) where cancelada_em is null;
create trigger cobrancas_atualizado_em before update on public.cobrancas
  for each row execute function public.tg_atualizado_em();

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  cobranca_id uuid not null references public.cobrancas (id) on delete restrict,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  caso_id uuid references public.casos (id) on delete set null,
  valor numeric(14, 2) not null check (valor > 0),
  data_pagamento date not null,
  forma text not null default 'pix',
  comprovante_arquivo_id uuid references public.arquivos (id) on delete set null,
  observacao text,
  registrado_por uuid not null references public.usuarios (id) on delete restrict,
  registrado_em timestamptz not null default now(),
  estornado_em timestamptz,
  estornado_por uuid references public.usuarios (id) on delete set null,
  motivo_estorno text
);

comment on column public.pagamentos.estornado_em is
  'Estorno = correção de lançamento indevido (o valor deixa de contar como recebido). Devoluções ao cliente ficam em "reembolsos".';

create index pagamentos_cobranca_idx on public.pagamentos (cobranca_id);
create index pagamentos_cliente_idx on public.pagamentos (cliente_id);
create index pagamentos_caso_idx on public.pagamentos (caso_id);
create index pagamentos_comprovante_idx on public.pagamentos (comprovante_arquivo_id);
create index pagamentos_registrado_por_idx on public.pagamentos (registrado_por);
create index pagamentos_estornado_por_idx on public.pagamentos (estornado_por);
create index pagamentos_data_idx on public.pagamentos (data_pagamento);

create table public.reembolsos (
  id uuid primary key default gen_random_uuid(),
  cobranca_id uuid not null references public.cobrancas (id) on delete restrict,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  caso_id uuid references public.casos (id) on delete set null,
  valor numeric(14, 2) not null check (valor > 0),
  data date not null,
  forma text not null default 'pix',
  motivo text not null,
  comprovante_arquivo_id uuid references public.arquivos (id) on delete set null,
  registrado_por uuid not null references public.usuarios (id) on delete restrict,
  registrado_em timestamptz not null default now()
);

create index reembolsos_cobranca_idx on public.reembolsos (cobranca_id);
create index reembolsos_cliente_idx on public.reembolsos (cliente_id);
create index reembolsos_caso_idx on public.reembolsos (caso_id);
create index reembolsos_comprovante_idx on public.reembolsos (comprovante_arquivo_id);
create index reembolsos_registrado_por_idx on public.reembolsos (registrado_por);

create table public.despesas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  caso_id uuid references public.casos (id) on delete set null,
  categoria text not null check (categoria in ('custas', 'despesa')),
  descricao text not null check (length(trim(descricao)) between 1 and 200),
  valor numeric(14, 2) not null check (valor > 0),
  data date not null,
  pago_por text not null check (pago_por in ('escritorio', 'cliente')),
  reembolsavel boolean not null default true,
  cobranca_reembolso_id uuid references public.cobrancas (id) on delete set null,
  comprovante_arquivo_id uuid references public.arquivos (id) on delete set null,
  observacao text,
  registrado_por uuid not null references public.usuarios (id) on delete restrict,
  registrado_em timestamptz not null default now(),
  cancelada_em timestamptz,
  cancelada_por uuid references public.usuarios (id) on delete set null,
  motivo_cancelamento text
);

create index despesas_cliente_idx on public.despesas (cliente_id);
create index despesas_caso_idx on public.despesas (caso_id);
create index despesas_cobranca_idx on public.despesas (cobranca_reembolso_id);
create index despesas_comprovante_idx on public.despesas (comprovante_arquivo_id);
create index despesas_registrado_por_idx on public.despesas (registrado_por);
create index despesas_cancelada_por_idx on public.despesas (cancelada_por);

-- -----------------------------------------------------------------------------
-- Situação calculada das cobranças (a partir de lançamentos e vencimento)
-- security_invoker: as permissões (RLS) das tabelas de origem são aplicadas.
-- -----------------------------------------------------------------------------

create view public.v_cobrancas
with (security_invoker = true)
as
select
  c.*,
  (c.valor - c.desconto + c.acrescimo)::numeric(14, 2) as valor_devido,
  coalesce(p.total, 0)::numeric(14, 2) as valor_pago,
  coalesce(r.total, 0)::numeric(14, 2) as valor_reembolsado,
  greatest((c.valor - c.desconto + c.acrescimo) - coalesce(p.total, 0), 0)::numeric(14, 2) as saldo,
  p.ultimo_pagamento,
  case
    when c.cancelada_em is not null then 'cancelado'
    when coalesce(r.total, 0) > 0 and coalesce(r.total, 0) >= coalesce(p.total, 0) then 'reembolsado'
    when coalesce(p.total, 0) >= (c.valor - c.desconto + c.acrescimo) then 'pago'
    when c.vencimento < public.hoje_sp() then 'vencido'
    when coalesce(p.total, 0) > 0 then 'parcial'
    else 'a_receber'
  end as situacao,
  (coalesce(p.total, 0) > 0 and coalesce(p.total, 0) < (c.valor - c.desconto + c.acrescimo)) as parcialmente_pago,
  case
    when c.cancelada_em is null
     and coalesce(p.total, 0) < (c.valor - c.desconto + c.acrescimo)
     and c.vencimento < public.hoje_sp()
    then public.hoje_sp() - c.vencimento
    else 0
  end as dias_atraso
from public.cobrancas c
left join lateral (
  select sum(pg.valor) as total, max(pg.data_pagamento) as ultimo_pagamento
  from public.pagamentos pg
  where pg.cobranca_id = c.id and pg.estornado_em is null
) p on true
left join lateral (
  select sum(rb.valor) as total
  from public.reembolsos rb
  where rb.cobranca_id = c.id
) r on true;

comment on view public.v_cobrancas is
  'Situações: a_receber, parcial (parcialmente pago), pago, vencido, cancelado, reembolsado.';
