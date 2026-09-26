"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Banknote, CalendarClock, FilePlus2, HandCoins, Lock, Paperclip, Plus, Receipt, Scale, Wallet } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../_lib/auth";
import { opcoesLista, opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { hojeSP, inicioMes, somarDias } from "../../_lib/datas";
import { buscarTodos, executar } from "../../_lib/dados";
import { formatarMoeda } from "../../_lib/formatos";
import type { Consulta } from "../../_lib/presets";
import { Link, navegar, useRota } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import type { Caso, Cliente, CobrancaComRelacoes, Contrato, Despesa, Pagamento } from "../../_lib/tipos";
import { AvisoPreset, usePresetAtivo } from "../../_lib/usePreset";
import { OpcoesExibicao } from "../../_quadro/OpcoesExibicao";
import { Quadro } from "../../_quadro/Quadro";
import type { ColunaQuadro } from "../../_quadro/tipos";
import { Abas } from "../../_ui/Abas";
import { Botao } from "../../_ui/Botao";
import { GrupoCampo } from "../../_ui/Campos";
import { Modal } from "../../_ui/Sobreposicoes";
import { CabecalhoPagina, Carregando, Vazio } from "../../_ui/Visuais";
import { abrirArquivo } from "../../_componentes/Arquivos";
import { SeletorRegistro, type RegistroSelecionado } from "../../_componentes/SeletorRegistro";
import { CATEGORIAS_COBRANCA, PilulaSituacao, SITUACOES } from "./comum";
import { FormContrato, FormDespesa, FormNovaCobranca, FormPagamento } from "./Formularios";

type Aba = "cobrancas" | "pagamentos" | "despesas" | "contratos";

export default function Financeiro() {
  const config = useConfig();
  const { pode } = useAuth();
  const { parametro, definirParametros } = useRota();
  const [novo, setNovo] = useState(false);
  const abaParam = parametro("aba") as Aba | null;
  const aba: Aba = abaParam && ["pagamentos", "despesas", "contratos"].includes(abaParam) ? abaParam : "cobrancas";

  if (!pode("financeiro.ver")) {
    return (
      <div className="p-6">
        <Vazio icone={<Lock size={24} />} titulo="Acesso restrito" descricao="Seu perfil não tem permissão para ver valores financeiros. Fale com o administrador do escritório." />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <CabecalhoPagina
        icone={<Wallet size={20} />}
        titulo={config.nome("financeiro")}
        subtitulo="Honorários, parcelas, recebimentos, custas e reembolsos de todos os clientes."
        acoes={
          (pode("financeiro.contratos") || pode("financeiro.lancar")) && (
            <Botao variante="primario" tamanho="sm" icone={<Plus size={14} />} onClick={() => setNovo(true)}>
              Novo lançamento
            </Botao>
          )
        }
      />
      <ResumoGeral />
      <Abas
        abas={[
          { id: "cobrancas", rotulo: "Cobranças e parcelas", icone: <CalendarClock size={14} aria-hidden /> },
          { id: "pagamentos", rotulo: "Recebimentos", icone: <HandCoins size={14} aria-hidden /> },
          { id: "despesas", rotulo: "Custas e despesas", icone: <Receipt size={14} aria-hidden /> },
          { id: "contratos", rotulo: "Contratos", icone: <FilePlus2 size={14} aria-hidden /> },
        ]}
        ativa={aba}
        aoTrocar={(a) => definirParametros({ aba: a === "cobrancas" ? null : a, preset: null, v: null, situacao: null }, { substituir: true })}
        rotulo="Visões do financeiro"
      />
      {aba === "cobrancas" && <QuadroCobrancas />}
      {aba === "pagamentos" && <QuadroPagamentos />}
      {aba === "despesas" && <QuadroDespesas />}
      {aba === "contratos" && <QuadroContratos />}
      <p className="text-xs text-crm-tinta-3">
        Integrações bancárias, emissão de boletos ou notas fiscais e cobrança automática não estão ativas: recebimentos e lançamentos são registrados manualmente pela equipe, com comprovante.
      </p>
      <NovoLancamento aberto={novo} aoFechar={() => setNovo(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resumo geral (honorários)
// ---------------------------------------------------------------------------

function ResumoGeral() {
  const consulta = useQuery({
    queryKey: ["financeiro", "resumo-geral"],
    queryFn: async () => {
      const s = supabase();
      const hoje = hojeSP();
      const [abertas, recebidos] = await Promise.all([
        buscarTodos<{ saldo: number | null; situacao: string | null; vencimento: string | null; categoria: string | null }>((de, ate) =>
          s.from("v_cobrancas").select("saldo, situacao, vencimento, categoria").in("situacao", ["a_receber", "parcial", "vencido"]).range(de, ate),
        50000),
        buscarTodos<{ valor: number }>((de, ate) => s.from("pagamentos").select("valor").is("estornado_em", null).gte("data_pagamento", inicioMes(hoje)).lte("data_pagamento", hoje).range(de, ate), 50000),
      ]);
      const hon = abertas.linhas.filter((c) => c.categoria === "honorarios");
      const soma = (l: { saldo: number | null }[]) => l.reduce((t, c) => t + Number(c.saldo ?? 0), 0);
      const limite7 = somarDias(hoje, 7);
      return {
        emAberto: soma(hon),
        vencido: soma(hon.filter((c) => c.situacao === "vencido")),
        qtdVencidas: hon.filter((c) => c.situacao === "vencido").length,
        proximos7: soma(hon.filter((c) => c.situacao !== "vencido" && (c.vencimento ?? "") <= limite7)),
        reembolsos: soma(abertas.linhas.filter((c) => c.categoria === "reembolso_despesas")),
        recebidoMes: recebidos.linhas.reduce((t, p) => t + Number(p.valor), 0),
      };
    },
  });
  const r = consulta.data;
  const tiles: { rotulo: string; valor: number | undefined; detalhe?: string; icone: ReactNode; tom?: "perigo" | "sucesso"; href: string }[] = [
    { rotulo: "Recebido no mês", valor: r?.recebidoMes, icone: <Banknote size={15} aria-hidden />, tom: "sucesso", href: "/crm/financeiro?aba=pagamentos" },
    { rotulo: "Honorários em aberto", valor: r?.emAberto, icone: <Wallet size={15} aria-hidden />, href: "/crm/financeiro" },
    { rotulo: "Vencem em 7 dias", valor: r?.proximos7, icone: <CalendarClock size={15} aria-hidden />, href: "/crm/financeiro?situacao=proximos" },
    { rotulo: "Vencido (inadimplência)", valor: r?.vencido, detalhe: r ? `${r.qtdVencidas} parcela(s)` : undefined, icone: <AlertTriangle size={15} aria-hidden />, tom: "perigo", href: "/crm/financeiro?preset=pagamentos_vencidos" },
    { rotulo: "Reembolsos de custas a receber", valor: r?.reembolsos, icone: <Receipt size={15} aria-hidden />, href: "/crm/financeiro?situacao=reembolsos" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5" aria-busy={consulta.isLoading}>
      {tiles.map((t) => (
        <Link key={t.rotulo} href={t.href} className="flex flex-col gap-1 rounded-2xl border-2 border-crm-linha bg-white px-4 py-3 transition-colors hover:border-crm-linha-forte">
          <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${t.tom === "perigo" && (t.valor ?? 0) > 0 ? "text-crm-perigo" : t.tom === "sucesso" ? "text-crm-sucesso" : "text-crm-tinta-3"}`}>
            {t.icone} {t.rotulo}
          </span>
          <span className="text-xl font-semibold text-crm-tinta">{t.valor === undefined ? "…" : formatarMoeda(t.valor)}</span>
          {t.detalhe && <span className="text-xs text-crm-tinta-2">{t.detalhe}</span>}
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cobranças (parcelas, avulsas e reembolsos de custas)
// ---------------------------------------------------------------------------

const SELECT_COBRANCAS = "*, cliente:clientes(id, nome, codigo), caso:casos(id, titulo, codigo)";

function QuadroCobrancas() {
  const config = useConfig();
  const { pode } = useAuth();
  const { parametro, definirParametros } = useRota();
  const { preset, ctx, limpar } = usePresetAtivo(["v_cobrancas"]);
  const [historico, setHistorico] = useState(false);
  const [pagar, setPagar] = useState<CobrancaComRelacoes | null>(null);
  const situacaoRapida = parametro("situacao");

  const consulta = useQuery({
    queryKey: ["financeiro", "cobrancas", { historico, preset: preset?.id }],
    enabled: !preset || Boolean(ctx),
    queryFn: () => {
      const limite = somarDias(hojeSP(), -90);
      return buscarTodos<CobrancaComRelacoes>((de, ate) => {
        let q = supabase().from("v_cobrancas").select(SELECT_COBRANCAS);
        if (preset && ctx) q = preset.aplicar(q as unknown as Consulta, ctx) as unknown as typeof q;
        else if (!historico) q = q.or(`situacao.in.(a_receber,parcial,vencido),vencimento.gte.${limite}`);
        return q.order("vencimento").range(de, ate) as unknown as PromiseLike<{ data: CobrancaComRelacoes[] | null; error: unknown }>;
      }, 20000);
    },
  });

  const itens = useMemo(() => {
    const todos = consulta.data?.linhas ?? [];
    if (situacaoRapida === "proximos") {
      const limite = somarDias(hojeSP(), 7);
      return todos.filter((c) => ["a_receber", "parcial"].includes(c.situacao ?? "") && (c.vencimento ?? "") <= limite);
    }
    if (situacaoRapida === "reembolsos") return todos.filter((c) => c.categoria === "reembolso_despesas" && ["a_receber", "parcial", "vencido"].includes(c.situacao ?? ""));
    return todos;
  }, [consulta.data, situacaoRapida]);

  const colunas = useMemo<ColunaQuadro<CobrancaComRelacoes>[]>(
    () => [
      {
        id: "descricao",
        titulo: "Cobrança",
        tipo: "texto",
        valor: (c) => c.descricao,
        texto: (c) => `${c.descricao} ${c.cliente?.nome ?? ""} ${c.caso?.titulo ?? ""}`,
        largura: 240,
        obrigatoria: true,
      },
      {
        id: "cliente",
        titulo: config.nome("cliente"),
        tipo: "texto",
        valor: (c) => c.cliente?.nome ?? null,
        exibir: (c) =>
          c.cliente ? (
            <Link href={`/crm/clientes/${c.cliente.id}?aba=financeiro`} onClick={(e) => e.stopPropagation()} className="truncate text-crm-info hover:underline">
              {c.cliente.nome}
            </Link>
          ) : (
            "—"
          ),
        agrupavel: true,
        largura: 200,
      },
      { id: "caso", titulo: config.nome("caso"), tipo: "texto", valor: (c) => c.caso?.titulo ?? null, agrupavel: true, largura: 200 },
      {
        id: "categoria",
        titulo: "Categoria",
        tipo: "selecao",
        valor: (c) => c.categoria,
        opcoes: [
          { valor: "honorarios", rotulo: CATEGORIAS_COBRANCA.honorarios, cor: "#263A2D" },
          { valor: "reembolso_despesas", rotulo: CATEGORIAS_COBRANCA.reembolso_despesas, cor: "#C5A880" },
        ],
        agrupavel: true,
        largura: 170,
      },
      {
        id: "parcela",
        titulo: "Parcela",
        tipo: "texto",
        valor: (c) => (c.parcela_numero ? `${c.parcela_numero}/${c.parcela_total ?? "?"}` : null),
        largura: 90,
        oculta: true,
      },
      {
        id: "vencimento",
        titulo: "Vencimento",
        tipo: "data",
        valor: (c) => c.vencimento,
        alertaVencimento: (c) => ["a_receber", "parcial", "vencido"].includes(c.situacao ?? ""),
        largura: 130,
      },
      { id: "valor_devido", titulo: "Valor devido", tipo: "moeda", valor: (c) => Number(c.valor_devido), alinhamento: "direita", resumo: "soma", largura: 130 },
      { id: "valor_pago", titulo: "Pago", tipo: "moeda", valor: (c) => Number(c.valor_pago), alinhamento: "direita", resumo: "soma", largura: 120 },
      { id: "saldo", titulo: "Saldo", tipo: "moeda", valor: (c) => Number(c.saldo), alinhamento: "direita", resumo: "soma", largura: 120 },
      {
        id: "situacao",
        titulo: "Situação",
        tipo: "status",
        valor: (c) => c.situacao,
        opcoes: Object.entries(SITUACOES).map(([valor, s]) => ({ valor, rotulo: s.rotulo, cor: s.cor, icone: s.icone })),
        exibir: (c) => <PilulaSituacao situacao={c.situacao} parcial={c.parcialmente_pago} />,
        agrupavel: true,
        resumo: "distribuicao",
        largura: 170,
      },
      {
        id: "dias_atraso",
        titulo: "Dias em atraso",
        tipo: "numero",
        valor: (c) => Number(c.dias_atraso ?? 0),
        exibir: (c) =>
          Number(c.dias_atraso ?? 0) > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-crm-perigo">
              <AlertTriangle size={12} aria-hidden /> {c.dias_atraso} dia(s)
            </span>
          ) : (
            <span className="text-crm-tinta-3">—</span>
          ),
        alinhamento: "direita",
        largura: 130,
      },
      { id: "desconto", titulo: "Desconto", tipo: "moeda", valor: (c) => Number(c.desconto), alinhamento: "direita", largura: 110, oculta: true },
      { id: "acrescimo", titulo: "Acréscimo", tipo: "moeda", valor: (c) => Number(c.acrescimo), alinhamento: "direita", largura: 110, oculta: true },
      { id: "ultimo_pagamento", titulo: "Último pagamento", tipo: "data", valor: (c) => c.ultimo_pagamento, largura: 140, oculta: true },
      {
        id: "acoes",
        titulo: "Receber",
        tipo: "texto",
        valor: () => null,
        exibir: (c) =>
          pode("financeiro.lancar") && Number(c.saldo) > 0 && c.situacao !== "cancelado" ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPagar(c);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-crm-linha-forte bg-white px-2.5 py-0.5 text-[12px] font-semibold hover:bg-crm-verde-claro"
            >
              <HandCoins size={12} aria-hidden /> Registrar
            </button>
          ) : (
            <span className="text-crm-tinta-3">—</span>
          ),
        largura: 120,
        filtravel: false,
        ordenavel: false,
      },
    ],
    [config, pode],
  );

  return (
    <div className="flex flex-col gap-4">
      {situacaoRapida && (
        <div role="status" className="flex items-center gap-2 rounded-xl border-2 border-crm-tinta bg-crm-ouro-claro px-3 py-2 text-sm shadow-crm-bruto">
          <span className="flex-1">
            <strong>Filtro:</strong> {situacaoRapida === "proximos" ? "parcelas em aberto que vencem nos próximos 7 dias" : "reembolsos de custas/despesas a receber"}
          </span>
          <button type="button" className="text-xs font-bold hover:underline" onClick={() => definirParametros({ situacao: null }, { substituir: true })}>
            Remover filtro
          </button>
        </div>
      )}
      <Quadro<CobrancaComRelacoes>
        id="financeiro"
        rotuloItens="Cobranças"
        itens={itens}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoRecarregar={() => consulta.refetch()}
        truncado={consulta.data?.truncado}
        colunas={colunas}
        colunaTitulo="descricao"
        colunaStatus="situacao"
        chave={(c) => c.id!}
        rotuloItem={(c) => c.descricao ?? "Cobrança"}
        aoAbrir={(c) => navegar(`/crm/clientes/${c.cliente_id}?aba=financeiro`)}
        visualizacoes={["tabela", "calendario", "resumo"]}
        configPadrao={{ tipo: "tabela", agrupamento: "situacao", ordenacao: { coluna: "vencimento", direcao: "asc" } }}
        calendario={{ coluna: "vencimento", evento: (c) => ({ id: c.id!, titulo: `${c.cliente?.nome ?? ""} — ${c.descricao} (${formatarMoeda(c.saldo)})`, cor: SITUACOES[c.situacao ?? "a_receber"]?.cor ?? "#3E5C8A", tipo: "Vencimento", diaInteiro: true, concluido: c.situacao === "pago" }) }}
        resumo={{ campos: ["situacao", "saldo", "vencimento"] }}
        aviso={<AvisoPreset preset={preset} ctx={ctx} aoLimpar={limpar} />}
        destaqueLinha={(c) => (c.situacao === "vencido" ? "perigo" : null)}
        extrasBarra={!preset && <OpcoesExibicao opcoes={[{ id: "historico", rotulo: "Histórico completo (pagas e canceladas antigas)", ativo: historico, aoAlterar: setHistorico }]} />}
        vazio={<Vazio icone={<Wallet size={24} />} titulo="Nenhuma cobrança" descricao="As parcelas são geradas ao registrar o contrato de honorários na ficha do cliente ou do caso." />}
      />
      <FormPagamento cobranca={pagar} aoFechar={() => setPagar(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recebimentos
// ---------------------------------------------------------------------------

type PagamentoLista = Pagamento & {
  cliente: Pick<Cliente, "id" | "nome"> | null;
  cobranca: { id: string; descricao: string; categoria: string } | null;
  comprovante: { id: string; bucket: string; caminho: string; nome: string } | null;
};

function QuadroPagamentos() {
  const config = useConfig();
  const [estornados, setEstornados] = useState(false);
  const consulta = useQuery({
    queryKey: ["financeiro", "pagamentos", { estornados }],
    queryFn: () =>
      buscarTodos<PagamentoLista>((de, ate) => {
        let q = supabase().from("pagamentos").select("*, cliente:clientes(id, nome), cobranca:cobrancas(id, descricao, categoria), comprovante:arquivos(id, bucket, caminho, nome)");
        if (!estornados) q = q.is("estornado_em", null);
        return q.order("data_pagamento", { ascending: false }).range(de, ate) as unknown as PromiseLike<{ data: PagamentoLista[] | null; error: unknown }>;
      }, 20000),
  });
  const colunas = useMemo<ColunaQuadro<PagamentoLista>[]>(
    () => [
      { id: "cobranca", titulo: "Referente a", tipo: "texto", valor: (p) => p.cobranca?.descricao ?? null, texto: (p) => `${p.cobranca?.descricao ?? ""} ${p.cliente?.nome ?? ""}`, largura: 240, obrigatoria: true },
      { id: "cliente", titulo: config.nome("cliente"), tipo: "texto", valor: (p) => p.cliente?.nome ?? null, agrupavel: true, largura: 200 },
      { id: "data_pagamento", titulo: "Data do pagamento", tipo: "data", valor: (p) => p.data_pagamento, largura: 140 },
      { id: "valor", titulo: "Valor", tipo: "moeda", valor: (p) => Number(p.valor), alinhamento: "direita", resumo: "soma", largura: 130 },
      { id: "forma", titulo: "Forma", tipo: "selecao", valor: (p) => p.forma, opcoes: opcoesLista(config, "forma_pagamento"), agrupavel: true, largura: 140 },
      {
        id: "categoria",
        titulo: "Categoria",
        tipo: "selecao",
        valor: (p) => p.cobranca?.categoria ?? null,
        opcoes: [
          { valor: "honorarios", rotulo: CATEGORIAS_COBRANCA.honorarios, cor: "#263A2D" },
          { valor: "reembolso_despesas", rotulo: CATEGORIAS_COBRANCA.reembolso_despesas, cor: "#C5A880" },
        ],
        agrupavel: true,
        largura: 170,
      },
      { id: "registrado_por", titulo: "Registrado por", tipo: "pessoa", valor: (p) => p.registrado_por, opcoes: opcoesUsuarios(config), agrupavel: true, largura: 150 },
      { id: "registrado_em", titulo: "Registrado em", tipo: "data_hora", valor: (p) => p.registrado_em, largura: 150, oculta: true },
      {
        id: "comprovante",
        titulo: "Comprovante",
        tipo: "texto",
        valor: (p) => (p.comprovante ? "sim" : null),
        exibir: (p) =>
          p.comprovante ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); abrirArquivo(p.comprovante!); }} className="inline-flex items-center gap-1 text-[13px] font-semibold text-crm-info hover:underline">
              <Paperclip size={12} aria-hidden /> Abrir
            </button>
          ) : (
            <span className="text-[13px] text-crm-tinta-3">Sem comprovante</span>
          ),
        largura: 140,
      },
      {
        id: "estornado",
        titulo: "Estorno",
        tipo: "texto",
        valor: (p) => (p.estornado_em ? "Estornado" : null),
        exibir: (p) => (p.estornado_em ? <span className="text-[13px] font-semibold text-crm-perigo">Estornado — {p.motivo_estorno}</span> : <span className="text-crm-tinta-3">—</span>),
        largura: 200,
        oculta: !estornados,
      },
    ],
    [config, estornados],
  );
  return (
    <Quadro<PagamentoLista>
      id="pagamentos"
      rotuloItens="Recebimentos"
      itens={consulta.data?.linhas ?? []}
      carregando={consulta.isLoading}
      erro={consulta.error}
      aoRecarregar={() => consulta.refetch()}
      truncado={consulta.data?.truncado}
      colunas={colunas}
      colunaTitulo="cobranca"
      chave={(p) => p.id}
      rotuloItem={(p) => p.cobranca?.descricao ?? "Pagamento"}
      aoAbrir={(p) => navegar(`/crm/clientes/${p.cliente_id}?aba=financeiro`)}
      visualizacoes={["tabela", "calendario", "resumo"]}
      configPadrao={{ tipo: "tabela", agrupamento: null, ordenacao: { coluna: "data_pagamento", direcao: "desc" } }}
      calendario={{ coluna: "data_pagamento", evento: (p) => ({ id: p.id, titulo: `${p.cliente?.nome ?? ""} — ${formatarMoeda(p.valor)}`, cor: "#2E6B33", tipo: "Recebimento", diaInteiro: true }) }}
      resumo={{ campos: ["valor", "forma"] }}
      destaqueLinha={(p) => (p.estornado_em ? "alerta" : null)}
      extrasBarra={<OpcoesExibicao opcoes={[{ id: "estornados", rotulo: "Pagamentos estornados", ativo: estornados, aoAlterar: setEstornados }]} />}
      vazio={<Vazio icone={<HandCoins size={24} />} titulo="Nenhum recebimento registrado" descricao="Registre pagamentos a partir das cobranças (botão “Registrar”)." />}
    />
  );
}

// ---------------------------------------------------------------------------
// Custas e despesas
// ---------------------------------------------------------------------------

type DespesaLista = Despesa & {
  cliente: Pick<Cliente, "id" | "nome"> | null;
  caso: Pick<Caso, "id" | "titulo"> | null;
  comprovante: { id: string; bucket: string; caminho: string; nome: string } | null;
};

function QuadroDespesas() {
  const config = useConfig();
  const [canceladas, setCanceladas] = useState(false);
  const consulta = useQuery({
    queryKey: ["financeiro", "despesas", { canceladas }],
    queryFn: () =>
      buscarTodos<DespesaLista>((de, ate) => {
        let q = supabase().from("despesas").select("*, cliente:clientes(id, nome), caso:casos(id, titulo), comprovante:arquivos(id, bucket, caminho, nome)");
        if (!canceladas) q = q.is("cancelada_em", null);
        return q.order("data", { ascending: false }).range(de, ate) as unknown as PromiseLike<{ data: DespesaLista[] | null; error: unknown }>;
      }, 20000),
  });
  const colunas = useMemo<ColunaQuadro<DespesaLista>[]>(
    () => [
      { id: "descricao", titulo: "Descrição", tipo: "texto", valor: (d) => d.descricao, texto: (d) => `${d.descricao} ${d.cliente?.nome ?? ""}`, largura: 240, obrigatoria: true },
      { id: "cliente", titulo: config.nome("cliente"), tipo: "texto", valor: (d) => d.cliente?.nome ?? null, agrupavel: true, largura: 200 },
      { id: "caso", titulo: config.nome("caso"), tipo: "texto", valor: (d) => d.caso?.titulo ?? null, agrupavel: true, largura: 200 },
      {
        id: "categoria",
        titulo: "Tipo",
        tipo: "selecao",
        valor: (d) => d.categoria,
        opcoes: [
          { valor: "custas", rotulo: "Custas processuais", cor: "#2B5A8A" },
          { valor: "despesa", rotulo: "Despesa", cor: "#6B746D" },
        ],
        agrupavel: true,
        largura: 160,
      },
      { id: "data", titulo: "Data", tipo: "data", valor: (d) => d.data, largura: 120 },
      { id: "valor", titulo: "Valor", tipo: "moeda", valor: (d) => Number(d.valor), alinhamento: "direita", resumo: "soma", largura: 130 },
      {
        id: "pago_por",
        titulo: "Pago por",
        tipo: "selecao",
        valor: (d) => d.pago_por,
        opcoes: [
          { valor: "escritorio", rotulo: "Escritório (adiantado)", cor: "#C9822B" },
          { valor: "cliente", rotulo: "Cliente", cor: "#3D7B3E" },
        ],
        agrupavel: true,
        largura: 180,
      },
      { id: "reembolso", titulo: "Reembolso cobrado", tipo: "checkbox", valor: (d) => Boolean(d.cobranca_reembolso_id), agrupavel: true, largura: 140 },
      { id: "registrado_por", titulo: "Registrado por", tipo: "pessoa", valor: (d) => d.registrado_por, opcoes: opcoesUsuarios(config), largura: 150, oculta: true },
      {
        id: "comprovante",
        titulo: "Comprovante",
        tipo: "texto",
        valor: (d) => (d.comprovante ? "sim" : null),
        exibir: (d) =>
          d.comprovante ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); abrirArquivo(d.comprovante!); }} className="inline-flex items-center gap-1 text-[13px] font-semibold text-crm-info hover:underline">
              <Paperclip size={12} aria-hidden /> Abrir
            </button>
          ) : (
            <span className="text-[13px] text-crm-tinta-3">Sem comprovante</span>
          ),
        largura: 140,
      },
      { id: "cancelada", titulo: "Cancelada", tipo: "checkbox", valor: (d) => Boolean(d.cancelada_em), largura: 110, oculta: !canceladas },
    ],
    [config, canceladas],
  );
  return (
    <Quadro<DespesaLista>
      id="despesas"
      rotuloItens="Custas e despesas"
      itens={consulta.data?.linhas ?? []}
      carregando={consulta.isLoading}
      erro={consulta.error}
      aoRecarregar={() => consulta.refetch()}
      truncado={consulta.data?.truncado}
      colunas={colunas}
      colunaTitulo="descricao"
      chave={(d) => d.id}
      rotuloItem={(d) => d.descricao}
      aoAbrir={(d) => navegar(`/crm/clientes/${d.cliente_id}?aba=financeiro`)}
      visualizacoes={["tabela", "resumo"]}
      configPadrao={{ tipo: "tabela", agrupamento: "pago_por", ordenacao: { coluna: "data", direcao: "desc" } }}
      resumo={{ campos: ["valor", "pago_por"] }}
      destaqueLinha={(d) => (d.cancelada_em ? "alerta" : null)}
      extrasBarra={<OpcoesExibicao opcoes={[{ id: "canceladas", rotulo: "Lançamentos cancelados", ativo: canceladas, aoAlterar: setCanceladas }]} />}
      vazio={<Vazio icone={<Receipt size={24} />} titulo="Nenhuma custa ou despesa" descricao="Registre custas e despesas na ficha do cliente ou pelo botão “Novo lançamento”." />}
    />
  );
}

// ---------------------------------------------------------------------------
// Contratos
// ---------------------------------------------------------------------------

type ContratoLista = Contrato & { cliente: Pick<Cliente, "id" | "nome"> | null; caso: Pick<Caso, "id" | "titulo"> | null };

function QuadroContratos() {
  const config = useConfig();
  const consulta = useQuery({
    queryKey: ["financeiro", "contratos"],
    queryFn: () =>
      buscarTodos<ContratoLista>(
        (de, ate) => supabase().from("contratos").select("*, cliente:clientes(id, nome), caso:casos(id, titulo)").order("created_at", { ascending: false }).range(de, ate) as unknown as PromiseLike<{ data: ContratoLista[] | null; error: unknown }>,
        20000,
      ),
  });
  const colunas = useMemo<ColunaQuadro<ContratoLista>[]>(
    () => [
      { id: "descricao", titulo: "Contrato", tipo: "texto", valor: (c) => c.descricao, texto: (c) => `${c.descricao} ${c.cliente?.nome ?? ""}`, largura: 220, obrigatoria: true },
      { id: "cliente", titulo: config.nome("cliente"), tipo: "texto", valor: (c) => c.cliente?.nome ?? null, agrupavel: true, largura: 200 },
      { id: "caso", titulo: config.nome("caso"), tipo: "texto", valor: (c) => c.caso?.titulo ?? null, agrupavel: true, largura: 200 },
      { id: "forma_contratacao", titulo: "Forma", tipo: "selecao", valor: (c) => c.forma_contratacao, opcoes: opcoesLista(config, "forma_contratacao"), agrupavel: true, largura: 160 },
      { id: "valor_total", titulo: "Valor total", tipo: "moeda", valor: (c) => Number(c.valor_total), alinhamento: "direita", resumo: "soma", largura: 130 },
      { id: "valor_entrada", titulo: "Entrada", tipo: "moeda", valor: (c) => Number(c.valor_entrada), alinhamento: "direita", largura: 120 },
      { id: "numero_parcelas", titulo: "Parcelas", tipo: "numero", valor: (c) => c.numero_parcelas, alinhamento: "direita", largura: 100 },
      { id: "desconto", titulo: "Desconto", tipo: "moeda", valor: (c) => Number(c.desconto), alinhamento: "direita", largura: 110, oculta: true },
      { id: "percentual_exito", titulo: "Êxito (%)", tipo: "numero", valor: (c) => (c.percentual_exito === null ? null : Number(c.percentual_exito)), alinhamento: "direita", largura: 100 },
      { id: "data_assinatura", titulo: "Assinatura", tipo: "data", valor: (c) => c.data_assinatura, largura: 120 },
      {
        id: "status",
        titulo: "Situação",
        tipo: "status",
        valor: (c) => c.status,
        opcoes: [
          { valor: "ativo", rotulo: "Ativo", cor: "#3D7B3E" },
          { valor: "encerrado", rotulo: "Encerrado", cor: "#52525B" },
          { valor: "cancelado", rotulo: "Cancelado", cor: "#A1A1AA" },
        ],
        agrupavel: true,
        largura: 120,
      },
      { id: "created_at", titulo: "Registrado em", tipo: "data_hora", valor: (c) => c.created_at, largura: 150, oculta: true },
    ],
    [config],
  );
  return (
    <Quadro<ContratoLista>
      id="contratos"
      rotuloItens="Contratos"
      itens={consulta.data?.linhas ?? []}
      carregando={consulta.isLoading}
      erro={consulta.error}
      aoRecarregar={() => consulta.refetch()}
      colunas={colunas}
      colunaTitulo="descricao"
      colunaStatus="status"
      chave={(c) => c.id}
      rotuloItem={(c) => c.descricao}
      aoAbrir={(c) => navegar(`/crm/clientes/${c.cliente_id}?aba=financeiro`)}
      visualizacoes={["tabela", "resumo"]}
      configPadrao={{ tipo: "tabela", agrupamento: null, ordenacao: null }}
      resumo={{ campos: ["status", "valor_total"] }}
      vazio={<Vazio icone={<FilePlus2 size={24} />} titulo="Nenhum contrato registrado" descricao="Registre o contrato de honorários na ficha do cliente ou pelo botão “Novo lançamento”." />}
    />
  );
}

// ---------------------------------------------------------------------------
// Novo lançamento (escolhe o cliente e abre o formulário adequado)
// ---------------------------------------------------------------------------

function NovoLancamento({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { pode } = useAuth();
  const [cliente, setCliente] = useState<RegistroSelecionado | null>(null);
  const [form, setForm] = useState<"contrato" | "cobranca" | "despesa" | null>(null);
  const casos = useQuery({
    queryKey: ["casos", "cliente", cliente?.id, "opcoes"],
    enabled: Boolean(cliente),
    queryFn: async () => (await executar(supabase().from("casos").select("id, titulo, codigo").eq("cliente_id", cliente!.id).order("created_at", { ascending: false }))) as Pick<Caso, "id" | "titulo" | "codigo">[],
  });
  const fechar = useCallback(() => {
    setCliente(null);
    setForm(null);
    aoFechar();
  }, [aoFechar]);
  const opcoesCasos = (casos.data ?? []).map((c) => ({ id: c.id, titulo: `${c.codigo} · ${c.titulo}` }));
  const alvo = cliente ? { id: cliente.id, nome: cliente.titulo } : null;
  return (
    <>
      <Modal aberto={aberto && !form} aoFechar={fechar} titulo="Novo lançamento financeiro" descricao="Escolha o cliente e o tipo de lançamento.">
        <div className="flex flex-col gap-4">
          <GrupoCampo rotulo="Cliente" obrigatorio>
            {(p) => <SeletorRegistro {...p} tipos={["cliente"]} valor={cliente} aoAlterar={setCliente} placeholder="Buscar cliente por nome, CPF ou código…" />}
          </GrupoCampo>
          {cliente && casos.isLoading && <Carregando />}
          {cliente && !casos.isLoading && (
            <div className="grid gap-2 sm:grid-cols-3">
              {pode("financeiro.contratos") && (
                <OpcaoLancamento icone={<FilePlus2 size={18} />} titulo="Contrato de honorários" descricao="Valor, entrada e parcelas" aoEscolher={() => setForm("contrato")} />
              )}
              {pode("financeiro.contratos") && (
                <OpcaoLancamento icone={<Scale size={18} />} titulo="Cobrança avulsa" descricao="Honorário extra ou ajuste" aoEscolher={() => setForm("cobranca")} />
              )}
              {pode("financeiro.lancar") && (
                <OpcaoLancamento icone={<Receipt size={18} />} titulo="Custas / despesa" descricao="Adiantada ou paga pelo cliente" aoEscolher={() => setForm("despesa")} />
              )}
            </div>
          )}
        </div>
      </Modal>
      {alvo && (
        <>
          <FormContrato aberto={form === "contrato"} aoFechar={fechar} cliente={alvo} casos={opcoesCasos} />
          <FormNovaCobranca aberto={form === "cobranca"} aoFechar={fechar} cliente={alvo} casos={opcoesCasos} />
          <FormDespesa aberto={form === "despesa"} aoFechar={fechar} cliente={alvo} casos={opcoesCasos} />
        </>
      )}
    </>
  );
}

function OpcaoLancamento({ icone, titulo, descricao, aoEscolher }: { icone: ReactNode; titulo: string; descricao: string; aoEscolher: () => void }) {
  return (
    <button type="button" onClick={aoEscolher} className="flex flex-col items-start gap-1 rounded-xl border-2 border-crm-linha bg-white p-3 text-left transition-colors hover:border-crm-verde hover:bg-crm-verde-claro">
      <span className="text-crm-verde">{icone}</span>
      <span className="text-sm font-bold">{titulo}</span>
      <span className="text-xs text-crm-tinta-2">{descricao}</span>
    </button>
  );
}
