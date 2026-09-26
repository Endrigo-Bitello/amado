"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Archive, ArrowRightLeft, CheckCircle2, ClipboardCheck, Gavel, PauseCircle, Scale, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso, comSalvamento } from "../../_lib/avisos";
import { colunaPrioridade, colunaResponsavel, opcoesEtapas, opcoesLista, opcoesTiposDemanda, opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { formatarDataHora, situacaoVencimento } from "../../_lib/datas";
import { buscarTodos, ErroCrm, executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { formatarProcesso, somenteDigitos } from "../../_lib/formatos";
import type { Consulta } from "../../_lib/presets";
import { Link, navegar, useRota } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import type { Caso, Cliente, Prazo, PrazoComRelacoes, Processo } from "../../_lib/tipos";
import { AvisoPreset, usePresetAtivo } from "../../_lib/usePreset";
import { OpcoesExibicao } from "../../_quadro/OpcoesExibicao";
import { Quadro } from "../../_quadro/Quadro";
import type { ColunaQuadro } from "../../_quadro/tipos";
import { Abas } from "../../_ui/Abas";
import { Botao } from "../../_ui/Botao";
import { Selecao } from "../../_ui/Campos";
import { confirmar, confirmarSimples } from "../../_ui/Dialogos";
import { ListaBusca } from "../../_ui/Seletores";
import { Modal } from "../../_ui/Sobreposicoes";
import { CabecalhoPagina, Carregando, Vazio } from "../../_ui/Visuais";
import { processoPrincipal, semNumeroProcesso, useColunasCasos, type CasoQuadro, type PendenciasCaso } from "./colunasCasos";
import { SITUACAO_PROCESSO, STATUS_PRAZO } from "./constantes";
import { FormCaso } from "./FormCaso";
import { CumprirPrazo, FormPrazo } from "./Prazos";
import { AvisoIntegracaoTribunais, FormProcesso } from "./Processos";

const FichaCaso = dynamic(() => import("./FichaCaso"), { loading: () => <Carregando /> });

const SELECT_CASOS = "*, cliente:clientes(id, nome, codigo), processos(id, numero, tribunal, principal, orgao, classe, situacao)";

export default function Casos() {
  const { segmentos, parametro, definirParametros } = useRota();
  const config = useConfig();
  const { pode } = useAuth();
  const [novoCaso, setNovoCaso] = useState(false);
  if (segmentos[1]) return <FichaCaso id={segmentos[1]} />;
  const aba = parametro("aba") === "processos" ? "processos" : parametro("aba") === "prazos" && pode("prazos.ver") ? "prazos" : "casos";
  const abas = [
    { id: "casos", rotulo: "Casos", icone: <Scale size={14} aria-hidden /> },
    { id: "processos", rotulo: "Processos judiciais", icone: <Gavel size={14} aria-hidden /> },
    ...(pode("prazos.ver") ? [{ id: "prazos", rotulo: "Prazos processuais", icone: <ClipboardCheck size={14} aria-hidden /> }] : []),
  ];
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <CabecalhoPagina
        icone={<Scale size={20} />}
        titulo={config.nome("casos")}
        subtitulo="Carteira de casos internos e processos judiciais, com fases, prazos, documentos e financeiro."
        acoes={
          pode("casos.editar") && (
            <Botao variante="primario" tamanho="sm" icone={<Scale size={14} />} onClick={() => setNovoCaso(true)}>
              Novo caso
            </Botao>
          )
        }
      />
      <Abas
        abas={abas}
        ativa={aba}
        aoTrocar={(a) => definirParametros({ aba: a === "casos" ? null : a, preset: null, meus: null, v: null }, { substituir: true })}
        rotulo="Visões de casos e processos"
      />
      {aba === "casos" && <QuadroCasos />}
      {aba === "processos" && <QuadroProcessos />}
      {aba === "prazos" && <QuadroPrazos />}
      <FormCaso aberto={novoCaso} aoFechar={() => setNovoCaso(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

type Situacao = "todos" | "ativo" | "suspenso" | "concluido" | "sem_numero";

function usePendenciasCasos() {
  const { pode } = useAuth();
  const prazos = useQuery({
    queryKey: ["prazos", "pendencias-casos"],
    enabled: pode("prazos.ver"),
    queryFn: () =>
      buscarTodos<Pick<Prazo, "caso_id" | "vencimento" | "conferido">>((de, ate) => supabase().from("prazos").select("caso_id, vencimento, conferido").eq("status", "pendente").order("vencimento").range(de, ate), 20000),
  });
  const docs = useQuery({
    queryKey: ["documentos", "pendencias-casos"],
    enabled: pode("documentos.ver"),
    queryFn: () =>
      buscarTodos<{ caso_id: string | null }>((de, ate) =>
        supabase().from("documentos").select("caso_id").not("caso_id", "is", null).eq("obrigatorio", true).in("status", ["nao_solicitado", "solicitado", "rejeitado"]).range(de, ate),
      20000),
  });
  return useMemo(() => {
    const mapa = new Map<string, PendenciasCaso>();
    const pegar = (id: string) => {
      let p = mapa.get(id);
      if (!p) {
        p = { proximoPrazo: null, prazosVencidos: 0, prazosAConferir: 0, docsFaltantes: 0 };
        mapa.set(id, p);
      }
      return p;
    };
    for (const pz of prazos.data?.linhas ?? []) {
      const p = pegar(pz.caso_id);
      if (!p.proximoPrazo || pz.vencimento < p.proximoPrazo) p.proximoPrazo = pz.vencimento;
      if (situacaoVencimento(pz.vencimento) === "vencido") p.prazosVencidos++;
      if (!pz.conferido) p.prazosAConferir++;
    }
    for (const d of docs.data?.linhas ?? []) if (d.caso_id) pegar(d.caso_id).docsFaltantes++;
    return mapa;
  }, [prazos.data, docs.data]);
}

function QuadroCasos() {
  const config = useConfig();
  const { pode } = useAuth();
  const { parametro, definirParametros } = useRota();
  const { atualizar } = useGravacao();
  const { preset, ctx, limpar } = usePresetAtivo(["casos"]);
  const [arquivados, setArquivados] = useState(false);
  const [lote, setLote] = useState<{ tipo: "fase" | "responsavel" | "status"; itens: CasoQuadro[] } | null>(null);
  const situacao = (parametro("situacao") as Situacao | null) ?? "todos";
  const filtros = { advogado: parametro("advogado"), tipo: parametro("tipo"), fase: parametro("fase"), tribunal: parametro("tribunal") };

  const consulta = useQuery({
    queryKey: ["casos", "quadro", { arquivados, preset: preset?.id, meus: ctx?.somenteMeus }],
    enabled: !preset || Boolean(ctx),
    queryFn: () =>
      buscarTodos<CasoQuadro>((de, ate) => {
        let q = supabase().from("casos").select(SELECT_CASOS);
        if (preset && ctx) q = preset.aplicar(q as unknown as Consulta, ctx) as unknown as typeof q;
        else if (!arquivados) q = q.is("arquivado_em", null);
        return q.order("created_at", { ascending: false }).range(de, ate) as unknown as PromiseLike<{ data: CasoQuadro[] | null; error: unknown }>;
      }, 10000),
  });
  const pendencias = usePendenciasCasos();

  const salvar = useCallback(async (c: CasoQuadro, alt: Record<string, unknown>) => {
    await atualizar("casos", c.id, alt, { chaves: ["casos", "painel"] });
  }, [atualizar]);
  const colunas = useColunasCasos(salvar, pendencias);

  const todos = useMemo(() => consulta.data?.linhas ?? [], [consulta.data]);
  const tribunais = useMemo(() => [...new Set(todos.map((c) => processoPrincipal(c)?.tribunal).filter(Boolean) as string[])].sort(), [todos]);
  const filtrados = useMemo(
    () =>
      todos.filter(
        (c) =>
          (!filtros.advogado || c.responsavel_id === filtros.advogado || c.equipe.includes(filtros.advogado)) &&
          (!filtros.tipo || c.tipo_demanda_id === filtros.tipo) &&
          (!filtros.fase || c.fase_id === filtros.fase) &&
          (!filtros.tribunal || c.processos.some((p) => p.tribunal === filtros.tribunal)),
      ),
    [todos, filtros.advogado, filtros.tipo, filtros.fase, filtros.tribunal],
  );
  const contagem = useMemo(
    () => ({
      todos: filtrados.length,
      ativo: filtrados.filter((c) => c.status === "ativo").length,
      suspenso: filtrados.filter((c) => c.status === "suspenso").length,
      concluido: filtrados.filter((c) => c.status === "concluido").length,
      sem_numero: filtrados.filter((c) => c.status !== "concluido" && semNumeroProcesso(c)).length,
    }),
    [filtrados],
  );
  const itens = useMemo(
    () => (situacao === "todos" ? filtrados : situacao === "sem_numero" ? filtrados.filter((c) => c.status !== "concluido" && semNumeroProcesso(c)) : filtrados.filter((c) => c.status === situacao)),
    [filtrados, situacao],
  );
  const algumFiltro = Object.values(filtros).some(Boolean) || situacao !== "todos";

  const tiles: { id: Situacao; rotulo: string; icone: ReactNode; tom?: "alerta" }[] = [
    { id: "todos", rotulo: "Total", icone: <Scale size={15} aria-hidden /> },
    { id: "ativo", rotulo: "Ativos", icone: <CheckCircle2 size={15} aria-hidden /> },
    { id: "suspenso", rotulo: "Suspensos", icone: <PauseCircle size={15} aria-hidden /> },
    { id: "concluido", rotulo: "Concluídos", icone: <Archive size={15} aria-hidden /> },
    { id: "sem_numero", rotulo: "Sem nº processual", icone: <AlertTriangle size={15} aria-hidden />, tom: "alerta" },
  ];

  const acoesLote = pode("casos.editar")
    ? [
        { id: "fase", rotulo: "Mudar fase", icone: <ArrowRightLeft size={13} />, executar: (cs: CasoQuadro[]) => setLote({ tipo: "fase" as const, itens: cs }) },
        { id: "status", rotulo: "Mudar situação", icone: <PauseCircle size={13} />, executar: (cs: CasoQuadro[]) => setLote({ tipo: "status" as const, itens: cs }) },
        { id: "responsavel", rotulo: "Atribuir advogado", icone: <UserRound size={13} />, executar: (cs: CasoQuadro[]) => setLote({ tipo: "responsavel" as const, itens: cs }) },
        {
          id: "arquivar",
          rotulo: "Arquivar",
          icone: <Archive size={13} />,
          executar: async (cs: CasoQuadro[]) => {
            if (!(await confirmarSimples({ titulo: `Arquivar ${cs.length} caso(s)?`, mensagem: "Eles saem dos quadros, mas continuam acessíveis pela busca, pela ficha do cliente e em “Arquivados”. Nada é apagado.", confirmar: "Arquivar" }))) return;
            await Promise.all(cs.map((c) => atualizar("casos", c.id, { arquivado_em: new Date().toISOString() }, { silencioso: true }).catch(() => undefined)));
            aviso.sucesso(`${cs.length} caso(s) arquivado(s).`);
          },
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Contadores de casos (clique para filtrar)" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => {
          const ativo = situacao === t.id;
          const n = contagem[t.id];
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={ativo}
              onClick={() => definirParametros({ situacao: t.id === "todos" || ativo ? null : t.id }, { substituir: true })}
              className={`flex flex-col items-start gap-1 rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                ativo ? "border-crm-tinta bg-crm-verde text-white shadow-crm-bruto" : "border-crm-linha bg-white hover:border-crm-linha-forte"
              }`}
            >
              <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${ativo ? "text-crm-ouro-claro" : t.tom === "alerta" && n > 0 ? "text-crm-alerta" : "text-crm-tinta-3"}`}>
                {t.icone} {t.rotulo}
              </span>
              <span className="text-2xl font-semibold">{consulta.isLoading ? "…" : n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-crm-linha bg-white p-3">
        <FiltroRapido rotulo="Advogado" valor={filtros.advogado} aoAlterar={(v) => definirParametros({ advogado: v }, { substituir: true })} opcoes={opcoesUsuarios(config).map((o) => ({ valor: o.valor, rotulo: o.rotulo }))} />
        <FiltroRapido rotulo="Tipo de demanda" valor={filtros.tipo} aoAlterar={(v) => definirParametros({ tipo: v }, { substituir: true })} opcoes={opcoesTiposDemanda(config).map((o) => ({ valor: o.valor, rotulo: o.rotulo }))} />
        <FiltroRapido rotulo="Fase" valor={filtros.fase} aoAlterar={(v) => definirParametros({ fase: v }, { substituir: true })} opcoes={opcoesEtapas(config, "caso").map((o) => ({ valor: o.valor, rotulo: o.rotulo }))} />
        <FiltroRapido rotulo="Tribunal" valor={filtros.tribunal} aoAlterar={(v) => definirParametros({ tribunal: v }, { substituir: true })} opcoes={tribunais.map((t) => ({ valor: t, rotulo: t }))} />
        {algumFiltro && (
          <Botao tamanho="sm" variante="fantasma" onClick={() => definirParametros({ advogado: null, tipo: null, fase: null, tribunal: null, situacao: null }, { substituir: true })}>
            Limpar filtros
          </Botao>
        )}
      </div>

      <Quadro<CasoQuadro>
        id="casos"
        rotuloItens={config.nome("casos")}
        itens={itens}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoRecarregar={() => consulta.refetch()}
        truncado={consulta.data?.truncado}
        colunas={colunas}
        colunaTitulo="titulo"
        colunaStatus="fase_id"
        chave={(c) => c.id}
        rotuloItem={(c) => c.titulo}
        aoAbrir={(c) => navegar(`/crm/casos/${c.id}`)}
        configPadrao={{ tipo: "tabela", agrupamento: "fase_id", ordenacao: null }}
        kanban={{ coluna: "fase_id", aoMover: (c, v) => (v ? salvar(c, { fase_id: v }).catch(() => undefined) : undefined), campos: ["cliente", "responsavel_id", "processo", "proximo_prazo", "docs_faltantes"] }}
        calendario={{ coluna: "proximo_prazo", evento: (c) => ({ id: c.id, titulo: `${c.titulo}${c.cliente ? ` — ${c.cliente.nome}` : ""}`, cor: config.etapa(c.fase_id)?.cor ?? "#3E5C8A", tipo: "Próximo prazo do caso", icone: <Gavel size={11} /> }) }}
        resumo={{ campos: ["fase_id", "status", "processo", "proximo_prazo"] }}
        aoNovo={pode("casos.editar") ? () => definirParametros({ novo: "1" }) : undefined}
        rotuloNovo="Novo caso"
        acoesLote={acoesLote}
        aviso={<AvisoPreset preset={preset} ctx={ctx} aoLimpar={limpar} />}
        destaqueLinha={(c) => ((pendencias.get(c.id)?.prazosVencidos ?? 0) > 0 ? "perigo" : c.status !== "concluido" && semNumeroProcesso(c) ? "alerta" : null)}
        extrasBarra={!preset && <OpcoesExibicao opcoes={[{ id: "arquivados", rotulo: "Casos arquivados", ativo: arquivados, aoAlterar: setArquivados }]} />}
        vazio={
          <Vazio
            icone={<Scale size={24} />}
            titulo={algumFiltro ? "Nenhum caso com estes filtros" : "Nenhum caso cadastrado"}
            descricao={algumFiltro ? "Ajuste ou limpe os filtros acima." : "Casos são criados na conversão de um lead, na ficha do cliente ou pelo botão “Novo caso”."}
          />
        }
      />
      <FormCaso aberto={parametro("novo") === "1"} aoFechar={() => definirParametros({ novo: null })} />
      <AcaoLoteCasos pedido={lote} aoFechar={() => setLote(null)} />
    </div>
  );
}

function FiltroRapido({ rotulo, valor, aoAlterar, opcoes }: { rotulo: string; valor: string | null; aoAlterar: (v: string | null) => void; opcoes: { valor: string; rotulo: string }[] }) {
  return (
    <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-semibold text-crm-tinta-2 sm:max-w-[240px]">
      {rotulo}
      <Selecao value={valor ?? ""} onChange={(e) => aoAlterar(e.target.value || null)} className={valor ? "border-crm-verde bg-crm-verde-claro font-semibold" : ""}>
        <option value="">Todos</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </Selecao>
    </label>
  );
}

function AcaoLoteCasos({ pedido, aoFechar }: { pedido: { tipo: "fase" | "responsavel" | "status"; itens: CasoQuadro[] } | null; aoFechar: () => void }) {
  const config = useConfig();
  const { atualizar } = useGravacao();
  if (!pedido) return null;
  const n = pedido.itens.length;
  const opcoes =
    pedido.tipo === "fase"
      ? opcoesEtapas(config, "caso").filter((o) => !o.desabilitada)
      : pedido.tipo === "status"
        ? [
            { valor: "ativo", rotulo: "Ativo", cor: "#3D7B3E" },
            { valor: "suspenso", rotulo: "Suspenso", cor: "#C9822B" },
            { valor: "concluido", rotulo: "Concluído", cor: "#52525B" },
          ]
        : [{ valor: "", rotulo: "Sem responsável" }, ...opcoesUsuarios(config, false)];
  const aplicar = async (v: string) => {
    const campo = pedido.tipo === "fase" ? "fase_id" : pedido.tipo === "status" ? "status" : "responsavel_id";
    const resultados = await Promise.all(pedido.itens.map((c) => atualizar("casos", c.id, { [campo]: v || null }, { silencioso: true }).then(() => true).catch(() => false)));
    const ok = resultados.filter(Boolean).length;
    if (ok === n) aviso.sucesso(`${n} caso(s) atualizado(s).`);
    else aviso.erro(`${ok} de ${n} caso(s) atualizados. Verifique suas permissões e tente novamente.`);
    aoFechar();
  };
  return (
    <Modal aberto aoFechar={aoFechar} largura="sm" titulo={pedido.tipo === "fase" ? `Mudar fase de ${n} caso(s)` : pedido.tipo === "status" ? `Mudar situação de ${n} caso(s)` : `Atribuir ${n} caso(s)`}>
      <div className="-mx-2 max-h-80 overflow-y-auto rounded-xl border border-crm-linha">
        <ListaBusca opcoes={opcoes} selecionados={[]} estilo={pedido.tipo === "responsavel" ? "pessoa" : "pilula"} aoAlternar={aplicar} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Processos judiciais
// ---------------------------------------------------------------------------

type ProcessoQuadro = Processo & {
  caso: (Pick<Caso, "id" | "titulo" | "codigo" | "responsavel_id" | "status"> & { cliente: Pick<Cliente, "id" | "nome"> | null }) | null;
};

function QuadroProcessos() {
  const config = useConfig();
  const { pode } = useAuth();
  const { atualizar } = useGravacao();
  const [novo, setNovo] = useState(false);
  const [encerrados, setEncerrados] = useState(false);
  const consulta = useQuery({
    queryKey: ["processos", "quadro", { encerrados }],
    queryFn: () =>
      buscarTodos<ProcessoQuadro>((de, ate) => {
        let q = supabase().from("processos").select("*, caso:casos(id, titulo, codigo, responsavel_id, status, cliente:clientes(id, nome))");
        if (!encerrados) q = q.not("situacao", "in", "(arquivado,transitado)");
        return q.order("created_at", { ascending: false }).range(de, ate) as unknown as PromiseLike<{ data: ProcessoQuadro[] | null; error: unknown }>;
      }, 10000),
  });
  const salvar = useCallback(async (p: ProcessoQuadro, alt: Record<string, unknown>) => {
    await atualizar("processos", p.id, alt, { chaves: ["processos", "casos"] });
  }, [atualizar]);
  const ed = pode("casos.editar") ? salvar : undefined;

  const colunas = useMemo<ColunaQuadro<ProcessoQuadro>[]>(
    () => [
      {
        id: "numero",
        titulo: "Nº do processo",
        tipo: "texto",
        valor: (p) => p.numero,
        texto: (p) => `${p.numero ?? "sem número"} ${p.caso?.titulo ?? ""} ${p.caso?.cliente?.nome ?? ""}`,
        exibir: (p) =>
          p.numero ? (
            <span className="truncate tabular-nums">{p.numero}</span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-crm-alerta">
              <AlertTriangle size={13} aria-hidden /> Sem número
            </span>
          ),
        editar: ed ? (p, v) => salvar(p, { numero: typeof v === "string" && somenteDigitos(v).length === 20 ? formatarProcesso(v) : v || null }) : undefined,
        largura: 240,
        obrigatoria: true,
      },
      {
        id: "caso",
        titulo: config.nome("caso"),
        tipo: "texto",
        valor: (p) => p.caso?.titulo ?? null,
        exibir: (p) =>
          p.caso ? (
            <Link href={`/crm/casos/${p.caso.id}`} onClick={(e) => e.stopPropagation()} className="truncate text-crm-info hover:underline">
              {p.caso.titulo} <span className="font-mono text-[10px] text-crm-tinta-3">{p.caso.codigo}</span>
            </Link>
          ) : (
            "—"
          ),
        largura: 240,
      },
      {
        id: "cliente",
        titulo: config.nome("cliente"),
        tipo: "texto",
        valor: (p) => p.caso?.cliente?.nome ?? null,
        exibir: (p) =>
          p.caso?.cliente ? (
            <Link href={`/crm/clientes/${p.caso.cliente.id}`} onClick={(e) => e.stopPropagation()} className="truncate text-crm-info hover:underline">
              {p.caso.cliente.nome}
            </Link>
          ) : (
            "—"
          ),
        agrupavel: true,
        largura: 200,
      },
      { id: "tribunal", titulo: "Tribunal", tipo: "texto", valor: (p) => p.tribunal, editar: ed ? (p, v) => salvar(p, { tribunal: typeof v === "string" ? v.toUpperCase() : v }) : undefined, agrupavel: true, largura: 110 },
      { id: "orgao", titulo: "Órgão / vara", tipo: "texto", valor: (p) => p.orgao, editar: ed ? (p, v) => salvar(p, { orgao: v }) : undefined, largura: 190 },
      { id: "classe", titulo: "Classe", tipo: "texto", valor: (p) => p.classe, editar: ed ? (p, v) => salvar(p, { classe: v }) : undefined, agrupavel: true, largura: 200 },
      {
        id: "situacao",
        titulo: "Situação",
        tipo: "status",
        valor: (p) => p.situacao,
        opcoes: Object.entries(SITUACAO_PROCESSO).map(([valor, s]) => ({ valor, rotulo: s.rotulo, cor: s.cor })),
        editar: ed ? (p, v) => salvar(p, { situacao: v ?? "em_andamento" }) : undefined,
        agrupavel: true,
        resumo: "distribuicao",
        largura: 170,
      },
      { id: "responsavel", titulo: "Advogado do caso", tipo: "pessoa", valor: (p) => p.caso?.responsavel_id ?? null, opcoes: opcoesUsuarios(config), agrupavel: true, largura: 150 },
      { id: "data_distribuicao", titulo: "Distribuição", tipo: "data", valor: (p) => p.data_distribuicao, editar: ed ? (p, v) => salvar(p, { data_distribuicao: v }) : undefined, largura: 120 },
      { id: "sistema", titulo: "Sistema", tipo: "texto", valor: (p) => p.sistema, editar: ed ? (p, v) => salvar(p, { sistema: v }) : undefined, agrupavel: true, largura: 110, oculta: true },
      { id: "comarca", titulo: "Comarca", tipo: "texto", valor: (p) => p.comarca, editar: ed ? (p, v) => salvar(p, { comarca: v }) : undefined, agrupavel: true, largura: 140, oculta: true },
      { id: "uf", titulo: "UF", tipo: "texto", valor: (p) => p.uf, agrupavel: true, largura: 60, oculta: true },
      { id: "instancia", titulo: "Instância", tipo: "texto", valor: (p) => p.instancia, editar: ed ? (p, v) => salvar(p, { instancia: v }) : undefined, agrupavel: true, largura: 110, oculta: true },
      {
        id: "link_consulta",
        titulo: "Consulta pública",
        tipo: "link",
        valor: (p) => p.link_consulta,
        editar: ed
          ? async (p, v) => {
              if (v && !/^https:\/\//i.test(String(v))) {
                aviso.erro("O link deve começar com https://");
                throw new ErroCrm("Link inválido");
              }
              await salvar(p, { link_consulta: v || null });
            }
          : undefined,
        largura: 120,
      },
      {
        id: "fonte",
        titulo: "Origem do cadastro",
        tipo: "selecao",
        valor: (p) => p.fonte,
        opcoes: [
          { valor: "manual", rotulo: "Manual", cor: "#E9E1D0" },
          { valor: "importacao", rotulo: "Importação", cor: "#C5D8EC" },
          { valor: "integracao", rotulo: "Integração", cor: "#BFDDC2" },
        ],
        agrupavel: true,
        largura: 130,
        oculta: true,
      },
      { id: "principal", titulo: "Principal", tipo: "checkbox", valor: (p) => p.principal, largura: 90, oculta: true, agrupavel: true },
      { id: "segredo_justica", titulo: "Segredo de justiça", tipo: "checkbox", valor: (p) => p.segredo_justica, editar: ed ? (p, v) => salvar(p, { segredo_justica: Boolean(v) }) : undefined, largura: 110, oculta: true },
    ],
    [config, ed, salvar],
  );

  return (
    <div className="flex flex-col gap-4">
      <AvisoIntegracaoTribunais />
      <Quadro<ProcessoQuadro>
        id="processos"
        rotuloItens="Processos"
        itens={consulta.data?.linhas ?? []}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoRecarregar={() => consulta.refetch()}
        truncado={consulta.data?.truncado}
        colunas={colunas}
        colunaTitulo="numero"
        colunaStatus="situacao"
        chave={(p) => p.id}
        rotuloItem={(p) => p.numero ?? "Processo sem número"}
        aoAbrir={(p) => navegar(`/crm/casos/${p.caso_id}?aba=processos`)}
        visualizacoes={["tabela", "kanban", "resumo"]}
        configPadrao={{ tipo: "tabela", agrupamento: null, ordenacao: null }}
        kanban={{ coluna: "situacao", aoMover: (p, v) => salvar(p, { situacao: v ?? "em_andamento" }).catch(() => undefined), campos: ["caso", "cliente", "tribunal", "responsavel"] }}
        resumo={{ campos: ["situacao", "tribunal"] }}
        aoNovo={pode("casos.editar") ? () => setNovo(true) : undefined}
        rotuloNovo="Cadastrar processo"
        destaqueLinha={(p) => (!p.numero && p.caso?.status !== "concluido" ? "alerta" : null)}
        extrasBarra={<OpcoesExibicao opcoes={[{ id: "encerrados", rotulo: "Transitados e arquivados", ativo: encerrados, aoAlterar: setEncerrados }]} />}
        vazio={<Vazio icone={<Gavel size={24} />} titulo="Nenhum processo cadastrado" descricao="Cadastre o processo na ficha do caso (aba Processos) ou pelo botão “Cadastrar processo”." />}
      />
      <FormProcesso aberto={novo} aoFechar={() => setNovo(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prazos processuais (todas as carteiras)
// ---------------------------------------------------------------------------

const SELECT_PRAZOS = "*, caso:casos(id, titulo, codigo, cliente_id, cliente:clientes(id, nome)), processo:processos(id, numero, tribunal)";

function QuadroPrazos() {
  const config = useConfig();
  const { pode } = useAuth();
  const { parametro, definirParametros } = useRota();
  const { atualizar, invalidar } = useGravacao();
  const { preset, ctx, limpar } = usePresetAtivo(["prazos"]);
  const [antigos, setAntigos] = useState(false);
  const [cumprir, setCumprir] = useState<PrazoComRelacoes | null>(null);
  const [lote, setLote] = useState<PrazoComRelacoes[] | null>(null);
  const novo = parametro("novo") === "1";

  const consulta = useQuery({
    queryKey: ["prazos", "quadro", { antigos, preset: preset?.id, meus: ctx?.somenteMeus }],
    enabled: !preset || Boolean(ctx),
    queryFn: () => {
      const limite = new Date(Date.now() - 60 * 86400_000).toISOString();
      return buscarTodos<PrazoComRelacoes>((de, ate) => {
        let q = supabase().from("prazos").select(SELECT_PRAZOS);
        if (preset && ctx) q = preset.aplicar(q as unknown as Consulta, ctx) as unknown as typeof q;
        else if (!antigos) q = q.or(`status.eq.pendente,updated_at.gte.${limite}`);
        return q.order("vencimento").range(de, ate) as unknown as PromiseLike<{ data: PrazoComRelacoes[] | null; error: unknown }>;
      }, 10000);
    },
  });

  const salvar = useCallback(async (p: PrazoComRelacoes, alt: Record<string, unknown>) => {
    await atualizar("prazos", p.id, alt, { chaves: ["prazos", "painel", "eventos"] });
  }, [atualizar]);
  const ed = pode("prazos.editar") ? salvar : undefined;

  const alterarStatus = useCallback(
    async (p: PrazoComRelacoes, status: string | null) => {
      if (!status || status === p.status || !pode("prazos.editar")) return;
      if (status === "cumprido") {
        setCumprir(p);
        return;
      }
      const r = await confirmar({
        titulo: status === "cancelado" ? "Cancelar prazo?" : "Reabrir prazo?",
        mensagem: `“${p.titulo}”. Informe o motivo; ele fica registrado no histórico do prazo.`,
        motivo: { rotulo: "Motivo", obrigatorio: true },
        confirmar: "Confirmar",
        perigo: status === "cancelado",
      });
      if (!r.confirmado) return;
      await salvar(p, { status, motivo_alteracao: r.motivo }).catch(() => undefined);
    },
    [pode, salvar],
  );

  const colunas = useMemo<ColunaQuadro<PrazoComRelacoes>[]>(
    () => [
      { id: "titulo", titulo: "Prazo", tipo: "texto", valor: (p) => p.titulo, texto: (p) => `${p.titulo} ${p.caso?.titulo ?? ""} ${p.caso?.cliente?.nome ?? ""} ${p.processo?.numero ?? ""}`, editar: ed ? (p, v) => salvar(p, { titulo: v }) : undefined, largura: 280, obrigatoria: true },
      {
        id: "vencimento",
        titulo: "Vencimento",
        tipo: "data_hora",
        valor: (p) => p.vencimento,
        alertaVencimento: (p) => p.status === "pendente",
        largura: 160,
        descricao: "Para corrigir o vencimento, abra o prazo (a correção exige motivo e nova conferência).",
      },
      {
        id: "status",
        titulo: "Situação",
        tipo: "status",
        valor: (p) => p.status,
        opcoes: Object.entries(STATUS_PRAZO).map(([valor, s]) => ({ valor, rotulo: s.rotulo, cor: s.cor })),
        editar: pode("prazos.editar") ? (p, v) => alterarStatus(p, v as string | null) : undefined,
        agrupavel: true,
        resumo: "distribuicao",
        largura: 130,
      },
      {
        id: "conferido",
        titulo: "Conferência",
        tipo: "selecao",
        valor: (p) => (p.conferido ? "sim" : "nao"),
        opcoes: [
          { valor: "sim", rotulo: "Conferido", cor: "#2E6B33", icone: <ShieldCheck size={12} aria-hidden /> },
          { valor: "nao", rotulo: "A conferir", cor: "#A15C07", icone: <ShieldAlert size={12} aria-hidden /> },
        ],
        exibir: (p) =>
          p.conferido ? (
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-crm-sucesso" title={`Conferido por ${config.usuario(p.conferido_por)?.nome ?? "—"}`}>
              <ShieldCheck size={13} aria-hidden /> Conferido
            </span>
          ) : p.status === "pendente" ? (
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-crm-alerta">
              <ShieldAlert size={13} aria-hidden /> A conferir
            </span>
          ) : (
            <span className="text-[13px] text-crm-tinta-3">Não conferido</span>
          ),
        agrupavel: true,
        largura: 130,
      },
      colunaResponsavel<PrazoComRelacoes>(config, ed),
      colunaPrioridade<PrazoComRelacoes>(config, ed),
      {
        id: "caso",
        titulo: config.nome("caso"),
        tipo: "texto",
        valor: (p) => p.caso?.titulo ?? null,
        exibir: (p) =>
          p.caso ? (
            <Link href={`/crm/casos/${p.caso.id}?aba=prazos&prazo=${p.id}`} onClick={(e) => e.stopPropagation()} className="truncate text-crm-info hover:underline">
              {p.caso.titulo}
            </Link>
          ) : (
            "—"
          ),
        agrupavel: true,
        largura: 220,
      },
      { id: "cliente", titulo: config.nome("cliente"), tipo: "texto", valor: (p) => p.caso?.cliente?.nome ?? null, agrupavel: true, largura: 180 },
      { id: "processo", titulo: "Processo", tipo: "texto", valor: (p) => p.processo?.numero ?? null, exibir: (p) => <span className="truncate tabular-nums">{p.processo?.numero ?? "—"}</span>, largura: 220 },
      { id: "tribunal", titulo: "Tribunal", tipo: "texto", valor: (p) => p.processo?.tribunal ?? null, agrupavel: true, largura: 100, oculta: true },
      { id: "origem", titulo: "Origem", tipo: "selecao", valor: (p) => p.origem, opcoes: opcoesLista(config, "origem_prazo"), editar: ed ? (p, v) => salvar(p, { origem: v ?? "intimacao_eletronica" }) : undefined, agrupavel: true, largura: 170 },
      { id: "referencia_origem", titulo: "Referência", tipo: "texto", valor: (p) => p.referencia_origem, editar: ed ? (p, v) => salvar(p, { referencia_origem: v }) : undefined, largura: 160, oculta: true },
      { id: "data_ciencia", titulo: "Ciência", tipo: "data", valor: (p) => p.data_ciencia, largura: 110, oculta: true },
      { id: "auxilio", titulo: "Auxílio de contagem", tipo: "checkbox", valor: (p) => Boolean(p.calculo), largura: 120, oculta: true, agrupavel: true, descricao: "Data sugerida pelo auxílio de contagem (sempre sujeita à conferência)." },
      { id: "cumprido_em", titulo: "Cumprido em", tipo: "data_hora", valor: (p) => p.cumprido_em, largura: 150, oculta: true },
    ],
    [config, ed, salvar, pode, alterarStatus],
  );

  const itens = consulta.data?.linhas ?? [];
  const acoesLote = [
    ...(pode("prazos.conferir")
      ? [{ id: "conferir", rotulo: "Conferir", icone: <ClipboardCheck size={13} />, executar: (ps: PrazoComRelacoes[]) => conferirLote(ps, invalidar) }]
      : []),
    ...(pode("prazos.editar") ? [{ id: "responsavel", rotulo: "Atribuir responsável", icone: <UserRound size={13} />, executar: (ps: PrazoComRelacoes[]) => setLote(ps) }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-xl border-2 border-[#F3D19A] bg-crm-alerta-claro px-3 py-2 text-sm text-crm-alerta">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>{config.texto("aviso_prazos", "O CRM não calcula prazos processuais de forma definitiva. Todo prazo deve ser conferido e confirmado por profissional habilitado.")}</span>
      </p>
      <Quadro<PrazoComRelacoes>
        id="prazos"
        rotuloItens="Prazos"
        itens={itens}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoRecarregar={() => consulta.refetch()}
        truncado={consulta.data?.truncado}
        colunas={colunas}
        colunaTitulo="titulo"
        colunaStatus="status"
        chave={(p) => p.id}
        rotuloItem={(p) => p.titulo}
        aoAbrir={(p) => navegar(`/crm/casos/${p.caso_id}?aba=prazos&prazo=${p.id}`)}
        configPadrao={{ tipo: "tabela", agrupamento: "status", ordenacao: { coluna: "vencimento", direcao: "asc" } }}
        kanban={{ coluna: "status", aoMover: (p, v) => alterarStatus(p, v), campos: ["vencimento", "conferido", "responsavel_id", "caso"] }}
        calendario={{
          coluna: "vencimento",
          evento: (p) => ({
            id: p.id,
            titulo: `${p.titulo}${p.caso ? ` — ${p.caso.titulo}` : ""}`,
            cor: p.status !== "pendente" ? STATUS_PRAZO[p.status]?.cor ?? "#52525B" : p.conferido ? "#8E2C3D" : "#A15C07",
            tipo: p.conferido ? "Prazo conferido" : "Prazo a conferir",
            icone: <Gavel size={11} />,
            concluido: p.status !== "pendente",
            alerta: p.status === "pendente" ? (situacaoVencimento(p.vencimento) === "vencido" ? "vencido" : situacaoVencimento(p.vencimento) === "hoje" ? "hoje" : null) : null,
          }),
        }}
        resumo={{ campos: ["status", "conferido", "vencimento"] }}
        aoNovo={pode("prazos.editar") ? () => definirParametros({ novo: "1" }) : undefined}
        rotuloNovo="Novo prazo"
        acoesLote={acoesLote}
        aviso={<AvisoPreset preset={preset} ctx={ctx} aoLimpar={limpar} />}
        destaqueLinha={(p) => (p.status === "pendente" ? (situacaoVencimento(p.vencimento) === "vencido" ? "perigo" : !p.conferido ? "alerta" : null) : null)}
        extrasBarra={!preset && <OpcoesExibicao opcoes={[{ id: "antigos", rotulo: "Cumpridos e cancelados há mais de 60 dias", ativo: antigos, aoAlterar: setAntigos }]} />}
        vazio={<Vazio icone={<Gavel size={24} />} titulo="Nenhum prazo por aqui" descricao="Prazos são cadastrados na ficha do caso ou pelo botão “Novo prazo”." />}
      />
      <FormPrazo aberto={novo} aoFechar={() => definirParametros({ novo: null })} />
      <CumprirPrazo prazo={cumprir} aoFechar={() => setCumprir(null)} />
      {lote && (
        <Modal aberto aoFechar={() => setLote(null)} largura="sm" titulo={`Atribuir ${lote.length} prazo(s)`}>
          <div className="-mx-2 max-h-80 overflow-y-auto rounded-xl border border-crm-linha">
            <ListaBusca
              opcoes={[{ valor: "", rotulo: "Sem responsável" }, ...opcoesUsuarios(config, false)]}
              selecionados={[]}
              estilo="pessoa"
              aoAlternar={async (v) => {
                await Promise.all(lote.map((p) => atualizar("prazos", p.id, { responsavel_id: v || null }, { silencioso: true }).catch(() => undefined)));
                aviso.sucesso(`${lote.length} prazo(s) atualizado(s).`);
                setLote(null);
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

async function conferirLote(ps: PrazoComRelacoes[], invalidar: (...c: string[]) => void) {
  const pendentes = ps.filter((p) => p.status === "pendente" && !p.conferido);
  if (pendentes.length === 0) {
    aviso.info("Os prazos selecionados já estão conferidos ou não estão pendentes.");
    return;
  }
  const r = await confirmar({
    titulo: `Confirmar conferência de ${pendentes.length} prazo(s)?`,
    mensagem: (
      <span>
        Você confirma que conferiu cada vencimento abaixo? Seu nome ficará registrado em cada prazo.
        <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs">
          {pendentes.map((p) => (
            <li key={p.id}>
              {p.titulo} — {formatarDataHora(p.vencimento)}
            </li>
          ))}
        </ul>
      </span>
    ),
    confirmar: "Confirmar conferência",
  });
  if (!r.confirmado) return;
  let ok = 0;
  for (const p of pendentes) {
    try {
      const linhas = await comSalvamento(() => executar(supabase().from("prazos").update({ conferido: true }).eq("id", p.id).eq("versao", p.versao).select("id")));
      if ((linhas as unknown[]).length) ok++;
    } catch (e) {
      aviso.erro(mensagemErro(e));
      break;
    }
  }
  invalidar("prazos", "painel", "eventos");
  if (ok === pendentes.length) aviso.sucesso(`${ok} prazo(s) conferido(s).`);
  else aviso.erro(`${ok} de ${pendentes.length} prazo(s) conferidos. Alguns foram alterados por outra pessoa — atualize e confira novamente.`);
}
