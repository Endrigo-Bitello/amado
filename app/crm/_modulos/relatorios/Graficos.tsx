"use client";

import { BarChart3, Download, Table2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso } from "../../_lib/avisos";
import { mensagemErro } from "../../_lib/dados";
import { exportarPlanilha } from "../../_lib/exportar";
import { formatarNumero } from "../../_lib/formatos";
import { Link } from "../../_lib/rotas";

// Paleta categórica derivada da marca (verde-folha e ouro), validada com o
// validador de paleta (modo claro, superfície #FFFFFF): separação para
// daltonismo ΔE 11,9, visão normal ΔE 20,3 e contraste ≥ 3:1. O CRM só tem
// tema claro. Séries de uma cor usam sempre a posição 1.
export const CORES_SERIE = ["#35713F", "#B8862F"] as const;
const COR_GRADE = "#E4DED3"; // crm-linha: linha fina, um passo acima da superfície
const COR_EIXO = "#CFC7B8"; // crm-linha-forte
const COR_TEXTO_EIXO = "#6B746D"; // crm-tinta-3

// ---------------------------------------------------------------------------
// Estrutura: cartão com alternância gráfico/tabela e exportação
// ---------------------------------------------------------------------------

export interface ColunaTabela<T> {
  titulo: string;
  valor: (item: T) => ReactNode;
  exportar?: (item: T) => string | number | null;
  numerico?: boolean;
}

interface PropsCartao<T> {
  titulo: string;
  descricao?: ReactNode;
  children?: ReactNode;
  /** Tabela equivalente (sempre disponível: acessibilidade e conferência). */
  tabela?: { colunas: ColunaTabela<T>[]; linhas: T[]; nomeArquivo: string };
  somenteTabela?: boolean;
  atualizando?: boolean;
  className?: string;
}

export function CartaoGrafico<T>({ titulo, descricao, children, tabela, somenteTabela, atualizando, className = "" }: PropsCartao<T>) {
  const { pode } = useAuth();
  const [verTabela, setVerTabela] = useState(false);
  const idTitulo = useId();
  const mostrarTabela = somenteTabela || verTabela;
  const exportar = async () => {
    if (!tabela) return;
    try {
      await exportarPlanilha(
        tabela.nomeArquivo,
        tabela.colunas.map((c) => ({ titulo: c.titulo, texto: (i: T) => (c.exportar ? c.exportar(i) : textoDe(c.valor(i))) })),
        tabela.linhas,
        "xlsx",
        "relatorios",
      );
      aviso.sucesso("Planilha exportada.");
    } catch (e) {
      aviso.erro(mensagemErro(e));
    }
  };
  return (
    <figure aria-labelledby={idTitulo} className={`flex min-w-0 flex-col gap-3 rounded-2xl border border-crm-linha bg-white p-4 shadow-crm-cartao ${className}`}>
      <figcaption className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={idTitulo} className="text-sm font-bold text-crm-tinta">
            {titulo}
          </h3>
          {descricao && <p className="mt-0.5 text-xs text-crm-tinta-3">{descricao}</p>}
        </div>
        {tabela && (
          <div className="flex items-center gap-1">
            {!somenteTabela && (
              <button
                type="button"
                aria-pressed={verTabela}
                onClick={() => setVerTabela((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-crm-tinta-2 hover:bg-crm-suave"
              >
                {verTabela ? <BarChart3 size={13} aria-hidden /> : <Table2 size={13} aria-hidden />}
                {verTabela ? "Ver gráfico" : "Ver tabela"}
              </button>
            )}
            {pode("dados.exportar") && tabela.linhas.length > 0 && (
              <button type="button" onClick={exportar} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-crm-tinta-2 hover:bg-crm-suave" aria-label={`Exportar planilha — ${titulo}`}>
                <Download size={13} aria-hidden /> Exportar
              </button>
            )}
          </div>
        )}
      </figcaption>
      {/* Ao recarregar, mantém o quadro anterior com opacidade reduzida (sem saltos). */}
      <div className={`min-w-0 transition-opacity ${atualizando ? "opacity-50" : ""}`} aria-busy={atualizando || undefined}>
        {mostrarTabela && tabela ? <TabelaDados colunas={tabela.colunas} linhas={tabela.linhas} /> : children}
      </div>
    </figure>
  );
}

function textoDe(v: ReactNode): string | number {
  if (typeof v === "string" || typeof v === "number") return v;
  return "";
}

export function TabelaDados<T>({ colunas, linhas }: { colunas: ColunaTabela<T>[]; linhas: T[] }) {
  if (linhas.length === 0) return <p className="py-6 text-center text-sm text-crm-tinta-3">Sem dados no período.</p>;
  return (
    <div className="max-h-[420px] overflow-auto rounded-xl border border-crm-linha">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-crm-suave text-xs font-bold text-crm-tinta-2">
          <tr>
            {colunas.map((c) => (
              <th key={c.titulo} scope="col" className={`px-3 py-2 ${c.numerico ? "text-right" : ""}`}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-t border-crm-linha">
              {colunas.map((c) => (
                <td key={c.titulo} className={`px-3 py-2 ${c.numerico ? "text-right tabular-nums" : ""}`}>
                  {c.valor(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicador (stat tile)
// ---------------------------------------------------------------------------

type Tom = "neutro" | "perigo" | "alerta" | "sucesso";
const TONS: Record<Tom, string> = {
  neutro: "text-crm-tinta-3",
  perigo: "text-crm-perigo",
  alerta: "text-crm-alerta",
  sucesso: "text-crm-sucesso",
};

export function Indicador({ rotulo, valor, detalhe, tom = "neutro", icone, href }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; tom?: Tom; icone?: ReactNode; href?: string }) {
  const conteudo = (
    <>
      <span className={`flex items-center gap-1.5 text-xs font-bold ${TONS[tom]}`}>
        {icone}
        {rotulo}
      </span>
      <span className="text-2xl font-semibold leading-tight text-crm-tinta">{valor}</span>
      {detalhe && <span className="text-xs text-crm-tinta-2">{detalhe}</span>}
    </>
  );
  const classe = "flex min-w-0 flex-col gap-1 rounded-2xl border border-crm-linha bg-white px-4 py-3 shadow-crm-cartao";
  return href ? (
    <Link href={href} className={`${classe} transition-colors hover:border-crm-linha-forte`}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

// ---------------------------------------------------------------------------
// Barras horizontais (uma série): comparar grandezas entre categorias
// ---------------------------------------------------------------------------

export interface ItemBarra {
  chave: string;
  rotulo: string;
  valor: number;
  detalhe?: string;
  href?: string;
}

export function BarrasHorizontais({ itens, formatar = formatarNumero, unidade, maxItens = 10, ordenar = true, vazio = "Sem dados no período." }: { itens: ItemBarra[]; formatar?: (n: number) => string; unidade: string; maxItens?: number; ordenar?: boolean; vazio?: string }) {
  const lista = useMemo(() => {
    const ordenados = ordenar ? [...itens].sort((a, b) => b.valor - a.valor) : itens;
    if (ordenados.length <= maxItens) return ordenados;
    const resto = ordenados.slice(maxItens - 1);
    return [...ordenados.slice(0, maxItens - 1), { chave: "__outros", rotulo: `Outros (${resto.length})`, valor: resto.reduce((t, i) => t + i.valor, 0) }];
  }, [itens, maxItens, ordenar]);
  const max = Math.max(0, ...lista.map((i) => i.valor));
  if (lista.length === 0 || max === 0) return <p className="py-6 text-center text-sm text-crm-tinta-3">{vazio}</p>;
  return (
    <ul className="flex flex-col gap-1.5" aria-label={`${unidade} por categoria`}>
      {lista.map((i) => {
        const pct = max > 0 ? (i.valor / max) * 100 : 0;
        const rotuloAcessivel = `${i.rotulo}: ${formatar(i.valor)} ${unidade}${i.detalhe ? ` — ${i.detalhe}` : ""}`;
        const linha = (
          <>
            <span className="truncate text-[13px] text-crm-tinta-2" title={i.rotulo}>
              {i.rotulo}
            </span>
            <span className="relative flex h-5 items-center">
              <span
                className="block h-4 rounded-r-[4px] transition-[filter] group-hover:brightness-110 group-focus-visible:brightness-110"
                style={{ width: `${Math.max(pct, i.valor > 0 ? 0.8 : 0)}%`, backgroundColor: CORES_SERIE[0] }}
              />
              <span className="ml-1.5 shrink-0 text-[12px] font-semibold text-crm-tinta">{formatar(i.valor)}</span>
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/3 z-10 mb-1 hidden min-w-40 rounded-lg border border-crm-linha bg-white px-2.5 py-1.5 text-xs shadow-crm-flutuante group-hover:block group-focus-visible:block"
            >
              <strong className="block text-sm text-crm-tinta">
                {formatar(i.valor)} {unidade}
              </strong>
              <span className="text-crm-tinta-2">{i.rotulo}</span>
              {i.detalhe && <span className="block text-crm-tinta-3">{i.detalhe}</span>}
            </span>
          </>
        );
        const classe = "group relative grid grid-cols-[minmax(90px,34%)_1fr] items-center gap-2 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-crm-folha";
        return (
          <li key={i.chave}>
            {i.href ? (
              <Link href={i.href} className={`${classe} hover:bg-crm-fundo`} aria-label={rotuloAcessivel}>
                {linha}
              </Link>
            ) : (
              <div tabIndex={0} className={classe} aria-label={rotuloAcessivel}>
                {linha}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Colunas no tempo (1 ou 2 séries; agrupadas ou empilhadas) com eixo e dica
// ---------------------------------------------------------------------------

export interface SerieColuna {
  id: string;
  rotulo: string;
}

export interface PontoColuna {
  chave: string;
  rotulo: string;
  rotuloLongo?: string;
  valores: Record<string, number>;
}

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(el.getBoundingClientRect().width);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, largura };
}

function passoLimpo(max: number) {
  if (max <= 0) return 1;
  const bruto = max / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / potencia;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * potencia;
}

/** Retângulo com cantos superiores arredondados (4px) e base reta. */
function caminhoColuna(x: number, y: number, w: number, h: number, raio: number) {
  const r = Math.min(raio, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

export function Colunas({
  series,
  pontos,
  modo = "agrupado",
  formatar = formatarNumero,
  formatarEixo,
  alturaPlot = 200,
}: {
  series: SerieColuna[];
  pontos: PontoColuna[];
  modo?: "agrupado" | "empilhado";
  formatar?: (n: number) => string;
  formatarEixo?: (n: number) => string;
  alturaPlot?: number;
}) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);
  const idGrafico = useId();
  const margem = { topo: 16, dir: 8, base: 26, esq: 52 };
  const alturaTotal = alturaPlot + margem.topo + margem.base;
  const plotL = Math.max(0, largura - margem.esq - margem.dir);
  const n = pontos.length;
  const totalPonto = (p: PontoColuna) => series.reduce((t, s) => t + (p.valores[s.id] ?? 0), 0);
  const maxBruto = Math.max(0, ...pontos.map((p) => (modo === "empilhado" ? totalPonto(p) : Math.max(0, ...series.map((s) => p.valores[s.id] ?? 0)))));
  const passo = passoLimpo(maxBruto);
  const maxEixo = Math.max(passo, Math.ceil(maxBruto / passo) * passo);
  const ticks = Array.from({ length: Math.round(maxEixo / passo) + 1 }, (_, i) => i * passo);
  const y = (v: number) => margem.topo + alturaPlot - (v / maxEixo) * alturaPlot;
  const banda = n > 0 ? plotL / n : 0;
  const larguraBarra = modo === "empilhado" ? Math.min(24, banda * 0.6) : Math.min(24, (banda * 0.7 - 2 * (series.length - 1)) / series.length);
  const cada = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotL / 64))));
  const indiceMax = pontos.reduce((m, p, i) => (totalPonto(p) > totalPonto(pontos[m] ?? p) ? i : m), 0);
  const fmtEixo = formatarEixo ?? formatar;

  if (n === 0 || maxBruto === 0) return <p className="py-6 text-center text-sm text-crm-tinta-3">Sem dados no período.</p>;

  return (
    <div className="flex flex-col gap-2">
      {series.length > 1 && (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-crm-tinta-2" aria-label="Legenda">
          {series.map((s, i) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-3.5 rounded-[2px]" style={{ backgroundColor: CORES_SERIE[i] }} aria-hidden />
              {s.rotulo}
            </li>
          ))}
        </ul>
      )}
      <div ref={ref} className="relative w-full" style={{ height: alturaTotal }} onMouseLeave={() => setAtivo(null)}>
        {largura > 0 && (
          <svg width={largura} height={alturaTotal} role="group" aria-label="Gráfico de colunas; use Tab para percorrer os períodos" className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={margem.esq} x2={largura - margem.dir} y1={y(t)} y2={y(t)} stroke={t === 0 ? COR_EIXO : COR_GRADE} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={margem.esq - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={COR_TEXTO_EIXO} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmtEixo(t)}
                </text>
              </g>
            ))}
            {pontos.map((p, i) => {
              const x0 = margem.esq + i * banda;
              const centro = x0 + banda / 2;
              const marcas: ReactNode[] = [];
              if (modo === "empilhado") {
                let acumulado = 0;
                const visiveis = series.map((s, si) => ({ s, si, v: p.valores[s.id] ?? 0 })).filter((x) => x.v > 0);
                visiveis.forEach(({ s, si, v }, k) => {
                  const topo = y(acumulado + v);
                  const base = y(acumulado);
                  const gap = k > 0 ? 2 : 0; // separação de 2px na cor da superfície entre segmentos
                  const h = Math.max(0, base - topo - gap);
                  const ultimo = k === visiveis.length - 1;
                  marcas.push(
                    ultimo ? (
                      <path key={s.id} d={caminhoColuna(centro - larguraBarra / 2, topo, larguraBarra, h, 4)} fill={CORES_SERIE[si]} />
                    ) : (
                      <rect key={s.id} x={centro - larguraBarra / 2} y={topo} width={larguraBarra} height={h} fill={CORES_SERIE[si]} />
                    ),
                  );
                  acumulado += v;
                });
              } else {
                const grupo = series.length * larguraBarra + (series.length - 1) * 2;
                series.forEach((s, si) => {
                  const v = p.valores[s.id] ?? 0;
                  if (v <= 0) return;
                  const bx = centro - grupo / 2 + si * (larguraBarra + 2);
                  marcas.push(<path key={s.id} d={caminhoColuna(bx, y(v), larguraBarra, y(0) - y(v), 4)} fill={CORES_SERIE[si]} />);
                });
              }
              const total = totalPonto(p);
              return (
                <g key={p.chave}>
                  {ativo === i && <rect x={x0 + 1} y={margem.topo} width={Math.max(0, banda - 2)} height={alturaPlot} fill="#F3F0EA" rx={4} />}
                  {marcas}
                  {i === indiceMax && total > 0 && (
                    <text x={centro} y={y(modo === "empilhado" ? total : Math.max(...series.map((s) => p.valores[s.id] ?? 0))) - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="#1D2A21">
                      {formatar(modo === "empilhado" ? total : Math.max(...series.map((s) => p.valores[s.id] ?? 0)))}
                    </text>
                  )}
                  {i % cada === 0 && (
                    <text x={centro} y={margem.topo + alturaPlot + 17} textAnchor="middle" fontSize={11} fill={COR_TEXTO_EIXO}>
                      {p.rotulo}
                    </text>
                  )}
                  <rect
                    x={x0}
                    y={margem.topo}
                    width={banda}
                    height={alturaPlot}
                    fill="transparent"
                    tabIndex={0}
                    role="img"
                    aria-label={`${p.rotuloLongo ?? p.rotulo}: ${series.map((s) => `${s.rotulo} ${formatar(p.valores[s.id] ?? 0)}`).join(", ")}`}
                    aria-describedby={ativo === i ? `${idGrafico}-dica` : undefined}
                    onMouseEnter={() => setAtivo(i)}
                    onFocus={() => setAtivo(i)}
                    onBlur={() => setAtivo(null)}
                    style={{ outline: "none", cursor: "default" }}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {ativo !== null && pontos[ativo] && largura > 0 && (
          <div
            id={`${idGrafico}-dica`}
            role="tooltip"
            className="pointer-events-none absolute z-10 min-w-40 rounded-lg border border-crm-linha bg-white px-3 py-2 text-xs shadow-crm-flutuante"
            style={{
              left: Math.min(Math.max(0, margem.esq + ativo * banda + banda / 2 - 80), Math.max(0, largura - 170)),
              top: 0,
            }}
          >
            <p className="mb-1 font-semibold text-crm-tinta-2">{pontos[ativo].rotuloLongo ?? pontos[ativo].rotulo}</p>
            <ul className="flex flex-col gap-0.5">
              {series.map((s, si) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: CORES_SERIE[si] }} aria-hidden />
                  <strong className="text-sm text-crm-tinta">{formatar(pontos[ativo].valores[s.id] ?? 0)}</strong>
                  <span className="text-crm-tinta-3">{s.rotulo}</span>
                </li>
              ))}
              {modo === "empilhado" && series.length > 1 && (
                <li className="mt-0.5 border-t border-crm-linha pt-0.5 text-crm-tinta-2">
                  Total <strong className="text-crm-tinta">{formatar(totalPonto(pontos[ativo]))}</strong>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Distribuição em faixas ordenadas (ex.: tempo até o primeiro contato)
// ---------------------------------------------------------------------------

export function FaixasOrdenadas({ itens, unidade }: { itens: { rotulo: string; valor: number }[]; unidade: string }) {
  const total = itens.reduce((t, i) => t + i.valor, 0);
  if (total === 0) return <p className="py-6 text-center text-sm text-crm-tinta-3">Sem dados no período.</p>;
  return (
    <BarrasHorizontais
      itens={itens.map((i, k) => ({ chave: String(k), rotulo: i.rotulo, valor: i.valor, detalhe: `${Math.round((i.valor / total) * 100)}% do total` }))}
      unidade={unidade}
      maxItens={itens.length}
      ordenar={false}
    />
  );
}
