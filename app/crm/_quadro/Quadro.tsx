"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  Columns3,
  Download,
  Kanban as IconeKanban,
  LayoutGrid,
  Layers,
  Plus,
  Search,
  Table2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../_lib/auth";
import { aviso } from "../_lib/avisos";
import { hojeSP } from "../_lib/datas";
import { mensagemErro } from "../_lib/dados";
import { exportarPlanilha } from "../_lib/exportar";
import { agruparItens, filtrarItens, ordenarItens, textoColuna, type Grupo } from "../_lib/filtros";
import { useRota } from "../_lib/rotas";
import type { Visualizacao } from "../_lib/tipos";
import { Botao } from "../_ui/Botao";
import { Selecao } from "../_ui/Campos";
import { Menu, Popover } from "../_ui/Sobreposicoes";
import { ErroCarga, EsqueletoLinhas, Vazio } from "../_ui/Visuais";
import { Calendario, type EventoCalendario, type ModoCalendario } from "../_componentes/Calendario";
import { BotaoFiltros, ChipsFiltros } from "./Filtros";
import { Kanban } from "./Kanban";
import { Resumo } from "./Resumo";
import { Tabela } from "./Tabela";
import type { AcaoLote, ColunaQuadro, ConfigVisualizacao, TipoVisualizacao } from "./tipos";
import { SeletorVisualizacoes, useVisualizacoes } from "./Visualizacoes";

export interface PropsQuadro<T> {
  id: string;
  rotuloItens: string;
  itens: T[];
  carregando: boolean;
  erro?: unknown;
  aoRecarregar?: () => void;
  colunas: ColunaQuadro<T>[];
  colunaTitulo: string;
  chave: (item: T) => string;
  rotuloItem: (item: T) => string;
  aoAbrir: (item: T) => void;
  configPadrao: Partial<ConfigVisualizacao>;
  visualizacoes?: TipoVisualizacao[];
  kanban?: { coluna: string; aoMover: (item: T, valor: string | null) => Promise<void> | void; campos: string[] };
  calendario?: { coluna: string; evento: (item: T) => Omit<EventoCalendario, "aoAbrir" | "inicio"> };
  resumo?: { campos: string[] };
  colunaStatus?: string;
  aoCriarRapido?: (titulo: string, grupo?: { coluna: string; valor: unknown }) => Promise<void>;
  aoNovo?: () => void;
  rotuloNovo?: string;
  acoesLote?: AcaoLote<T>[];
  extrasBarra?: ReactNode;
  aviso?: ReactNode;
  truncado?: boolean;
  destaqueLinha?: (item: T) => "perigo" | "alerta" | null;
  cartaoMovel?: (item: T) => ReactNode;
  vazio?: ReactNode;
}

const CONFIG_BASE: ConfigVisualizacao = {
  tipo: "tabela",
  busca: "",
  filtros: [],
  ordenacao: null,
  agrupamento: null,
  colunasOcultas: [],
  ordemColunas: [],
  larguras: {},
  resumirPor: null,
};

function lerSessao<T>(chave: string): T | null {
  try {
    const v = window.sessionStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function gravarSessao(chave: string, valor: unknown) {
  try {
    window.sessionStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem armazenamento: apenas em memória */
  }
}

const ICONES_VISUALIZACAO: Record<TipoVisualizacao, { rotulo: string; icone: ReactNode }> = {
  tabela: { rotulo: "Tabela", icone: <Table2 size={15} /> },
  kanban: { rotulo: "Kanban", icone: <IconeKanban size={15} /> },
  calendario: { rotulo: "Calendário", icone: <CalendarDays size={15} /> },
  resumo: { rotulo: "Resumo", icone: <LayoutGrid size={15} /> },
};

export function Quadro<T>(props: PropsQuadro<T>) {
  const { perfil, pode } = useAuth();
  const { parametro, definirParametros } = useRota();
  const padrao = useMemo<ConfigVisualizacao>(
    () => ({
      ...CONFIG_BASE,
      colunasOcultas: props.colunas.filter((c) => c.oculta).map((c) => c.id),
      ...props.configPadrao,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.id],
  );
  const chaveSessao = `crm.quadro.${props.id}`;
  const vis = useVisualizacoes(props.id);
  const idAtiva = parametro("v");
  const [config, setConfigInterno] = useState<ConfigVisualizacao>(() => ({ ...padrao, ...(lerSessao<ConfigVisualizacao>(chaveSessao) ?? {}) }));
  const [base, setBase] = useState<ConfigVisualizacao>(padrao);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [modoCal, setModoCal] = useState<ModoCalendario>("mes");
  const [dataCal, setDataCal] = useState(hojeSP());
  const aplicouPadrao = useRef(false);

  const setConfig = useCallback(
    (alteracao: Partial<ConfigVisualizacao>) => {
      setConfigInterno((c) => {
        const novo = { ...c, ...alteracao };
        gravarSessao(chaveSessao, novo);
        return novo;
      });
    },
    [chaveSessao],
  );

  // Aplica a visualização indicada na URL ou a padrão compartilhada da equipe.
  useEffect(() => {
    if (!vis.data) return;
    const alvo = idAtiva ? vis.data.lista.find((v) => v.id === idAtiva) : null;
    if (alvo) {
      const c = { ...padrao, ...(alvo.config as unknown as ConfigVisualizacao), tipo: alvo.tipo as TipoVisualizacao };
      setConfigInterno(c);
      setBase(c);
      aplicouPadrao.current = true;
      return;
    }
    if (!aplicouPadrao.current && !lerSessao(chaveSessao)) {
      const padraoEquipe = vis.data.lista.find((v) => v.padrao);
      if (padraoEquipe) {
        const c = { ...padrao, ...(padraoEquipe.config as unknown as ConfigVisualizacao), tipo: padraoEquipe.tipo as TipoVisualizacao };
        setConfigInterno(c);
        setBase(c);
      }
    }
    aplicouPadrao.current = true;
  }, [vis.data, idAtiva, padrao, chaveSessao]);

  const aplicarVisualizacao = (v: Visualizacao | null) => {
    if (!v) {
      setConfigInterno(padrao);
      setBase(padrao);
      gravarSessao(chaveSessao, padrao);
      definirParametros({ v: null });
      return;
    }
    const c = { ...padrao, ...(v.config as unknown as ConfigVisualizacao), tipo: v.tipo as TipoVisualizacao };
    setConfigInterno(c);
    setBase(c);
    gravarSessao(chaveSessao, c);
    definirParametros({ v: v.id });
  };

  // Colunas visíveis na ordem configurada
  const colunaTitulo = props.colunas.find((c) => c.id === props.colunaTitulo)!;
  const demais = props.colunas.filter((c) => c.id !== props.colunaTitulo);
  const ordenadas = useMemo(() => {
    const ordem = config.ordemColunas;
    if (!ordem.length) return demais;
    return [...demais].sort((a, b) => {
      const ia = ordem.indexOf(a.id);
      const ib = ordem.indexOf(b.id);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [demais, config.ordemColunas]);
  const visiveis = ordenadas.filter((c) => !config.colunasOcultas.includes(c.id) || c.obrigatoria);

  const filtrados = useMemo(
    () => ordenarItens(filtrarItens(props.itens, props.colunas, config.filtros, config.busca, { usuarioId: perfil?.id ?? null }), props.colunas, config.ordenacao),
    [props.itens, props.colunas, config.filtros, config.busca, config.ordenacao, perfil?.id],
  );
  const colunaGrupo = config.agrupamento ? props.colunas.find((c) => c.id === config.agrupamento) : undefined;
  const grupos = useMemo(() => agruparItens(filtrados, colunaGrupo), [filtrados, colunaGrupo]);
  const colunaStatus = props.colunas.find((c) => c.id === (props.colunaStatus ?? props.kanban?.coluna));
  const selecionadosItens = filtrados.filter((i) => selecionados.has(props.chave(i)));

  useEffect(() => {
    // Remove da seleção itens que deixaram de existir (tempo real/filtros).
    setSelecionados((s) => {
      const existentes = new Set(props.itens.map(props.chave));
      const novo = new Set([...s].filter((id) => existentes.has(id)));
      return novo.size === s.size ? s : novo;
    });
  }, [props.itens, props.chave]);

  const modificada = JSON.stringify({ ...config, busca: "" }) !== JSON.stringify({ ...base, busca: "" });
  const tipos = props.visualizacoes ?? ["tabela", ...(props.kanban ? ["kanban" as const] : []), ...(props.calendario ? ["calendario" as const] : []), "resumo"];

  const aoOrdenar = (coluna: string) => {
    const atual = config.ordenacao;
    if (atual?.coluna !== coluna) setConfig({ ordenacao: { coluna, direcao: "asc" } });
    else if (atual.direcao === "asc") setConfig({ ordenacao: { coluna, direcao: "desc" } });
    else setConfig({ ordenacao: null });
  };

  const exportar = async (formato: "csv" | "xlsx", itens: T[]) => {
    try {
      const cols = [colunaTitulo, ...visiveis];
      await exportarPlanilha(props.id, cols.map((c) => ({ titulo: c.titulo, texto: (i: T) => textoColuna(c, i) })), itens, formato, props.id);
      aviso.sucesso(`${itens.length} ${itens.length === 1 ? "linha exportada" : "linhas exportadas"}.`);
    } catch (e) {
      aviso.erro(mensagemErro(e));
    }
  };

  const criarRapido = props.aoCriarRapido
    ? async (titulo: string, grupo?: Grupo<T>) => {
        await props.aoCriarRapido!(titulo, grupo && colunaGrupo && grupo.chave !== "__todos__" ? { coluna: colunaGrupo.id, valor: grupo.valor } : undefined);
      }
    : undefined;

  const criarRapidoKanban = props.aoCriarRapido && props.kanban
    ? async (titulo: string, grupo: Grupo<T>) => {
        await props.aoCriarRapido!(titulo, { coluna: props.kanban!.coluna, valor: grupo.valor });
      }
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Tipo de visualização" className="inline-flex rounded-full border border-crm-linha-forte bg-white p-0.5">
          {tipos.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={config.tipo === t}
              onClick={() => setConfig({ tipo: t })}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${config.tipo === t ? "bg-crm-verde text-white" : "text-crm-tinta-2 hover:text-crm-tinta"}`}
            >
              {ICONES_VISUALIZACAO[t].icone}
              <span className="hidden sm:inline">{ICONES_VISUALIZACAO[t].rotulo}</span>
              <span className="sr-only sm:hidden">{ICONES_VISUALIZACAO[t].rotulo}</span>
            </button>
          ))}
        </div>

        <label className="flex h-8 min-w-40 flex-1 items-center gap-2 rounded-full border border-crm-linha-forte bg-white px-3 focus-within:border-crm-folha focus-within:ring-2 focus-within:ring-crm-folha/20 sm:max-w-64">
          <Search size={14} className="shrink-0 text-crm-tinta-3" aria-hidden />
          <input
            value={config.busca}
            onChange={(e) => setConfig({ busca: e.target.value })}
            placeholder={`Buscar em ${props.rotuloItens.toLowerCase()}`}
            aria-label={`Buscar em ${props.rotuloItens}`}
            className="w-full bg-transparent text-sm outline-none placeholder:text-crm-tinta-3"
          />
          {config.busca && (
            <button type="button" onClick={() => setConfig({ busca: "" })} aria-label="Limpar busca" className="text-crm-tinta-3 hover:text-crm-tinta">
              <X size={14} />
            </button>
          )}
        </label>

        <BotaoFiltros colunas={props.colunas} filtros={config.filtros} aoAlterar={(filtros) => setConfig({ filtros })} />

        {config.tipo === "tabela" && (
          <MenuAgrupar colunas={props.colunas} valor={config.agrupamento} aoAlterar={(agrupamento) => setConfig({ agrupamento })} />
        )}
        {(config.tipo === "tabela" || config.tipo === "kanban") && (
          <MenuOrdenar colunas={[colunaTitulo, ...demais]} valor={config.ordenacao} aoAlterar={(ordenacao) => setConfig({ ordenacao })} />
        )}
        {config.tipo === "tabela" && (
          <SeletorColunas
            colunas={ordenadas}
            ocultas={config.colunasOcultas}
            larguras={config.larguras}
            aoAlterar={(parcial) => setConfig(parcial)}
          />
        )}

        <SeletorVisualizacoes quadro={props.id} ativa={idAtiva} modificada={modificada} configAtual={config} aoAplicar={aplicarVisualizacao} />

        {pode("dados.exportar") && (
          <Menu
            rotulo="Exportar"
            itens={[
              { rotulo: `Exportar CSV (${filtrados.length})`, icone: <Download size={14} />, aoSelecionar: () => exportar("csv", filtrados) },
              { rotulo: `Exportar Excel/XLSX (${filtrados.length})`, icone: <Download size={14} />, aoSelecionar: () => exportar("xlsx", filtrados) },
            ]}
            gatilho={(p) => (
              <Botao {...p} tamanho="sm" variante="secundario" icone={<Download size={14} />} aria-label="Exportar">
                <span className="hidden xl:inline">Exportar</span>
              </Botao>
            )}
          />
        )}

        {props.extrasBarra}

        {props.aoNovo && (
          <Botao variante="primario" tamanho="sm" icone={<Plus size={15} />} onClick={props.aoNovo} className="ml-auto">
            {props.rotuloNovo ?? "Novo"}
          </Botao>
        )}
      </div>

      {props.aviso}
      <ChipsFiltros colunas={props.colunas} filtros={config.filtros} aoAlterar={(filtros) => setConfig({ filtros })} />

      <p className="sr-only" aria-live="polite">
        {filtrados.length} {props.rotuloItens.toLowerCase()} exibidos.
      </p>

      {props.truncado && (
        <p className="rounded-xl border border-[#F3D19A] bg-crm-alerta-claro px-3 py-2 text-xs font-semibold text-crm-alerta">
          Exibindo os registros mais recentes. Use filtros ou a opção de incluir antigos para refinar.
        </p>
      )}

      {/* Conteúdo */}
      {props.erro ? (
        <div className="rounded-2xl border border-crm-linha bg-white">
          <ErroCarga mensagem={mensagemErro(props.erro)} aoTentarNovamente={props.aoRecarregar} />
        </div>
      ) : props.carregando ? (
        <div className="rounded-2xl border border-crm-linha bg-white">
          <EsqueletoLinhas />
        </div>
      ) : props.itens.length === 0 ? (
        <div className="rounded-2xl border border-crm-linha bg-white">{props.vazio ?? <Vazio titulo={`Nenhum registro em ${props.rotuloItens.toLowerCase()}`} />}</div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border border-crm-linha bg-white">
          <Vazio
            titulo="Nenhum item com os filtros atuais"
            descricao="Ajuste a busca ou os filtros para ver mais itens."
            acao={
              <Botao tamanho="sm" onClick={() => setConfig({ filtros: [], busca: "" })}>
                Limpar filtros e busca
              </Botao>
            }
          />
        </div>
      ) : config.tipo === "kanban" && props.kanban && colunaStatus ? (
        <Kanban
          itens={filtrados}
          colunaStatus={colunaStatus}
          camposCartao={props.kanban.campos.map((id) => props.colunas.find((c) => c.id === id)).filter(Boolean) as ColunaQuadro<T>[]}
          chave={props.chave}
          rotuloItem={props.rotuloItem}
          aoAbrir={props.aoAbrir}
          aoMover={props.kanban.aoMover}
          aoCriarRapido={criarRapidoKanban}
          destaqueLinha={props.destaqueLinha}
        />
      ) : config.tipo === "calendario" && props.calendario ? (
        <Calendario
          modo={modoCal}
          data={dataCal}
          aoMudarModo={setModoCal}
          aoMudarData={setDataCal}
          eventos={filtrados
            .map((item) => {
              const valor = props.colunas.find((c) => c.id === props.calendario!.coluna)?.valor(item);
              if (!valor) return null;
              return { ...props.calendario!.evento(item), inicio: String(valor), aoAbrir: () => props.aoAbrir(item) };
            })
            .filter(Boolean) as EventoCalendario[]}
        />
      ) : config.tipo === "resumo" ? (
        <Resumo
          itens={filtrados}
          colunas={props.colunas}
          colunaStatus={colunaStatus}
          resumirPor={config.resumirPor ?? null}
          aoMudarResumirPor={(resumirPor) => setConfig({ resumirPor })}
          chave={props.chave}
          rotuloItem={props.rotuloItem}
          aoAbrir={props.aoAbrir}
          camposItem={(props.resumo?.campos ?? []).map((id) => props.colunas.find((c) => c.id === id)).filter(Boolean) as ColunaQuadro<T>[]}
        />
      ) : (
        <Tabela
          grupos={grupos}
          agrupado={Boolean(colunaGrupo)}
          colunas={visiveis}
          colunaTitulo={colunaTitulo}
          colunaStatus={colunaStatus}
          chave={props.chave}
          aoAbrir={props.aoAbrir}
          selecionados={selecionados}
          aoSelecionar={(ids, marcar) =>
            setSelecionados((s) => {
              const n = new Set(s);
              ids.forEach((id) => (marcar ? n.add(id) : n.delete(id)));
              return n;
            })
          }
          ordenacao={config.ordenacao}
          aoOrdenar={aoOrdenar}
          recolhidos={recolhidos}
          aoRecolher={(g) =>
            setRecolhidos((s) => {
              const n = new Set(s);
              if (n.has(g)) n.delete(g);
              else n.add(g);
              return n;
            })
          }
          larguras={config.larguras}
          aoCriarRapido={criarRapido}
          destaqueLinha={props.destaqueLinha}
          rotuloItem={props.rotuloItem}
          cartaoMovel={props.cartaoMovel}
        />
      )}

      {/* Ações em lote */}
      {selecionadosItens.length > 0 && (
        <div role="region" aria-label="Ações em lote" className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-2xl border-2 border-crm-tinta bg-crm-verde px-4 py-3 text-white shadow-crm-flutuante lg:bottom-6">
          <span className="mr-1 text-sm font-bold">
            {selecionadosItens.length} {selecionadosItens.length === 1 ? "selecionado" : "selecionados"}
          </span>
          {(props.acoesLote ?? [])
            .filter((a) => a.visivel !== false)
            .map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={async () => {
                  try {
                    await a.executar(selecionadosItens);
                    setSelecionados(new Set());
                  } catch (e) {
                    aviso.erro(mensagemErro(e));
                  }
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                  a.perigo ? "border-[#F5C2BD]/60 text-[#FDDCD8] hover:bg-crm-perigo" : "border-white/25 hover:bg-white/10"
                }`}
              >
                {a.icone}
                {a.rotulo}
              </button>
            ))}
          {pode("dados.exportar") && (
            <button type="button" onClick={() => exportar("xlsx", selecionadosItens)} className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3 py-1.5 text-xs font-bold hover:bg-white/10">
              <Download size={13} /> Exportar
            </button>
          )}
          <button type="button" onClick={() => setSelecionados(new Set())} className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-crm-ouro-claro hover:bg-white/10">
            <X size={13} /> Limpar seleção
          </button>
        </div>
      )}
    </div>
  );
}

function MenuAgrupar<T>({ colunas, valor, aoAlterar }: { colunas: ColunaQuadro<T>[]; valor: string | null; aoAlterar: (v: string | null) => void }) {
  const agrupaveis = colunas.filter((c) => c.agrupavel);
  const atual = agrupaveis.find((c) => c.id === valor);
  return (
    <Menu
      rotulo="Agrupar por"
      alinhamento="inicio"
      itens={[
        { rotulo: "Sem agrupamento", aoSelecionar: () => aoAlterar(null) },
        ...agrupaveis.map((c) => ({ rotulo: c.titulo, aoSelecionar: () => aoAlterar(c.id) })),
      ]}
      gatilho={(p) => (
        <Botao {...p} tamanho="sm" variante={atual ? "sutil" : "secundario"} icone={<Layers size={14} />}>
          <span className="hidden md:inline">{atual ? `Grupo: ${atual.titulo}` : "Agrupar"}</span>
          <span className="sr-only md:hidden">Agrupar</span>
        </Botao>
      )}
    />
  );
}

function MenuOrdenar<T>({ colunas, valor, aoAlterar }: { colunas: ColunaQuadro<T>[]; valor: ConfigVisualizacao["ordenacao"]; aoAlterar: (v: ConfigVisualizacao["ordenacao"]) => void }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const ordenaveis = colunas.filter((c) => c.ordenavel !== false);
  const atual = ordenaveis.find((c) => c.id === valor?.coluna);
  return (
    <>
      <Botao ref={ref} tamanho="sm" variante={atual ? "sutil" : "secundario"} icone={<ArrowUpDown size={14} />} onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <span className="hidden md:inline">{atual ? `Ordem: ${atual.titulo}` : "Ordenar"}</span>
        <span className="sr-only md:hidden">Ordenar</span>
      </Botao>
      <Popover aberto={aberto} aoFechar={() => setAberto(false)} ancora={ref} largura={280} rotulo="Ordenar">
        <div className="flex flex-col gap-3 p-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
            Ordenar por
            <Selecao value={valor?.coluna ?? ""} onChange={(e) => aoAlterar(e.target.value ? { coluna: e.target.value, direcao: valor?.direcao ?? "asc" } : null)}>
              <option value="">Ordem padrão</option>
              {ordenaveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </Selecao>
          </label>
          {valor && (
            <div role="group" aria-label="Direção" className="flex gap-1.5">
              <Botao tamanho="sm" variante={valor.direcao === "asc" ? "sutil" : "fantasma"} icone={<ArrowUp size={14} />} onClick={() => aoAlterar({ ...valor, direcao: "asc" })} aria-pressed={valor.direcao === "asc"}>
                Crescente
              </Botao>
              <Botao tamanho="sm" variante={valor.direcao === "desc" ? "sutil" : "fantasma"} icone={<ArrowDown size={14} />} onClick={() => aoAlterar({ ...valor, direcao: "desc" })} aria-pressed={valor.direcao === "desc"}>
                Decrescente
              </Botao>
            </div>
          )}
        </div>
      </Popover>
    </>
  );
}

const LARGURAS_PRESET = [
  { rotulo: "Estreita", valor: 120 },
  { rotulo: "Normal", valor: 170 },
  { rotulo: "Larga", valor: 240 },
  { rotulo: "Muito larga", valor: 320 },
];

function SeletorColunas<T>({
  colunas,
  ocultas,
  larguras,
  aoAlterar,
}: {
  colunas: ColunaQuadro<T>[];
  ocultas: string[];
  larguras: Record<string, number>;
  aoAlterar: (p: Partial<ConfigVisualizacao>) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const mover = (i: number, direcao: -1 | 1) => {
    const ordem = colunas.map((c) => c.id);
    const j = i + direcao;
    if (j < 0 || j >= ordem.length) return;
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    aoAlterar({ ordemColunas: ordem });
  };
  return (
    <>
      <Botao ref={ref} tamanho="sm" variante="secundario" icone={<Columns3 size={14} />} onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <span className="hidden lg:inline">Colunas</span>
        <span className="sr-only lg:hidden">Colunas</span>
      </Botao>
      <Popover aberto={aberto} aoFechar={() => setAberto(false)} ancora={ref} largura={360} rotulo="Colunas visíveis">
        <div className="flex max-h-[65vh] flex-col">
          <div className="flex items-center justify-between border-b border-crm-linha px-4 py-3">
            <h3 className="text-sm font-bold">Colunas</h3>
            <button type="button" className="text-xs font-semibold text-crm-tinta-2 hover:text-crm-tinta" onClick={() => aoAlterar({ colunasOcultas: [], ordemColunas: [], larguras: {} })}>
              Restaurar padrão
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto py-1">
            {colunas.map((c, i) => {
              const visivel = !ocultas.includes(c.id) || c.obrigatoria;
              return (
                <li key={c.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-crm-suave">
                  <input
                    type="checkbox"
                    id={`col-${c.id}`}
                    checked={Boolean(visivel)}
                    disabled={c.obrigatoria}
                    onChange={(e) => aoAlterar({ colunasOcultas: e.target.checked ? ocultas.filter((x) => x !== c.id) : [...ocultas, c.id] })}
                    className="h-4 w-4 accent-[#263A2D]"
                  />
                  <label htmlFor={`col-${c.id}`} className="min-w-0 flex-1 truncate text-sm">
                    {c.titulo}
                  </label>
                  <select
                    aria-label={`Largura de ${c.titulo}`}
                    value={larguras[c.id] ?? c.largura ?? 170}
                    onChange={(e) => aoAlterar({ larguras: { ...larguras, [c.id]: Number(e.target.value) } })}
                    className="rounded border border-crm-linha bg-white px-1 py-0.5 text-xs"
                  >
                    {LARGURAS_PRESET.map((l) => (
                      <option key={l.valor} value={l.valor}>
                        {l.rotulo}
                      </option>
                    ))}
                    {!LARGURAS_PRESET.some((l) => l.valor === (larguras[c.id] ?? c.largura ?? 170)) && <option value={larguras[c.id] ?? c.largura}>Personalizada</option>}
                  </select>
                  <span className="flex">
                    <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="rounded p-0.5 text-crm-tinta-3 hover:text-crm-tinta disabled:opacity-30" aria-label={`Mover ${c.titulo} para cima`}>
                      <ArrowUp size={13} />
                    </button>
                    <button type="button" onClick={() => mover(i, 1)} disabled={i === colunas.length - 1} className="rounded p-0.5 text-crm-tinta-3 hover:text-crm-tinta disabled:opacity-30" aria-label={`Mover ${c.titulo} para baixo`}>
                      <ArrowDown size={13} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-crm-linha px-4 py-2 text-[11px] text-crm-tinta-3">
            <ChevronDown size={11} className="inline" aria-hidden /> Salve em “Visualizações” para guardar esta configuração.
          </p>
        </div>
      </Popover>
    </>
  );
}
