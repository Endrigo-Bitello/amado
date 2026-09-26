"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Loader2, Pencil, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatarMoeda } from "../_lib/formatos";
import type { Grupo } from "../_lib/filtros";
import { BarraDistribuicao } from "../_ui/Visuais";
import { CelulaEditavel, ExibicaoCelula } from "./Celulas";
import type { ColunaQuadro, Ordenacao } from "./tipos";

const LIMITE_INICIAL = 100;

interface PropsTabela<T> {
  grupos: Grupo<T>[];
  agrupado: boolean;
  colunas: ColunaQuadro<T>[];
  colunaTitulo: ColunaQuadro<T>;
  colunaStatus?: ColunaQuadro<T>;
  chave: (item: T) => string;
  aoAbrir: (item: T) => void;
  selecionados: Set<string>;
  aoSelecionar: (ids: string[], marcar: boolean) => void;
  ordenacao: Ordenacao | null;
  aoOrdenar: (coluna: string) => void;
  recolhidos: Set<string>;
  aoRecolher: (grupo: string) => void;
  larguras: Record<string, number>;
  aoCriarRapido?: (titulo: string, grupo: Grupo<T>) => Promise<void>;
  destaqueLinha?: (item: T) => "perigo" | "alerta" | null;
  rotuloItem: (item: T) => string;
  cartaoMovel?: (item: T) => ReactNode;
}

export function Tabela<T>(props: PropsTabela<T>) {
  const { grupos, agrupado, colunas, colunaTitulo, chave, selecionados, aoSelecionar, larguras } = props;
  const todas = grupos.flatMap((g) => g.itens);
  const todosSelecionados = todas.length > 0 && todas.every((i) => selecionados.has(chave(i)));
  const algunsSelecionados = !todosSelecionados && todas.some((i) => selecionados.has(chave(i)));
  const largura = (c: ColunaQuadro<T>) => larguras[c.id] ?? c.largura ?? 160;
  const larguraTitulo = larguras[colunaTitulo.id] ?? colunaTitulo.largura ?? 300;

  return (
    <>
      {/* Tabela (telas médias e grandes) */}
      <div className="hidden overflow-auto rounded-2xl border border-crm-linha bg-white shadow-crm-cartao md:block" style={{ maxHeight: "calc(100dvh - 250px)" }}>
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm" role="grid" aria-rowcount={todas.length}>
          <thead className="sticky top-0 z-20">
            <tr>
              <th scope="col" className="sticky left-0 z-30 w-10 border-b border-crm-linha bg-crm-suave px-3 py-2 text-left">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os itens visíveis"
                  checked={todosSelecionados}
                  ref={(el) => {
                    if (el) el.indeterminate = algunsSelecionados;
                  }}
                  onChange={(e) => aoSelecionar(todas.map(chave), e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-[#263A2D]"
                />
              </th>
              <CabecalhoColuna coluna={colunaTitulo} largura={larguraTitulo} fixa ordenacao={props.ordenacao} aoOrdenar={props.aoOrdenar} />
              {colunas.map((c) => (
                <CabecalhoColuna key={c.id} coluna={c} largura={largura(c)} ordenacao={props.ordenacao} aoOrdenar={props.aoOrdenar} />
              ))}
            </tr>
          </thead>
          {grupos.map((g) => (
            <GrupoTabela key={g.chave} {...props} grupo={g} agrupado={agrupado} larguraTitulo={larguraTitulo} largura={largura} />
          ))}
        </table>
      </div>

      {/* Cartões (celular) */}
      <div className="flex flex-col gap-4 md:hidden">
        {grupos.map((g) => (
          <section key={g.chave} aria-label={agrupado ? g.rotulo : undefined}>
            {agrupado && (
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: g.cor ?? undefined }}>
                <span className="h-3 w-3 rounded" style={{ backgroundColor: g.cor ?? "#A1A1AA" }} aria-hidden />
                {g.rotulo} <span className="font-semibold text-crm-tinta-3">({g.itens.length})</span>
              </h3>
            )}
            <ul className="flex flex-col gap-2">
              {g.itens.slice(0, 200).map((item) => (
                <li key={chave(item)}>
                  <button
                    type="button"
                    onClick={() => props.aoAbrir(item)}
                    className="w-full rounded-xl border border-crm-linha bg-white p-3 text-left shadow-crm-cartao active:bg-crm-suave"
                    style={{ borderLeft: `4px solid ${g.cor ?? "#CFC7B8"}` }}
                  >
                    {props.cartaoMovel ? (
                      props.cartaoMovel(item)
                    ) : (
                      <>
                        <span className="block font-semibold text-crm-tinta">{props.rotuloItem(item)}</span>
                        <span className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-crm-tinta-2">
                          {colunas.slice(0, 4).map((c) => (
                            <span key={c.id} className="flex min-w-0 flex-col">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-crm-tinta-3">{c.titulo}</span>
                              <span className="min-w-0 truncate">
                                <ExibicaoCelula coluna={c} item={item} />
                              </span>
                            </span>
                          ))}
                        </span>
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function CabecalhoColuna<T>({
  coluna,
  largura,
  fixa,
  ordenacao,
  aoOrdenar,
}: {
  coluna: ColunaQuadro<T>;
  largura: number;
  fixa?: boolean;
  ordenacao: Ordenacao | null;
  aoOrdenar: (c: string) => void;
}) {
  const ativa = ordenacao?.coluna === coluna.id;
  const ordenavel = coluna.ordenavel !== false;
  return (
    <th
      scope="col"
      aria-sort={ativa ? (ordenacao!.direcao === "asc" ? "ascending" : "descending") : undefined}
      style={{ width: largura, minWidth: largura, maxWidth: largura, left: fixa ? 40 : undefined }}
      className={`border-b border-l border-crm-linha bg-crm-suave px-0 py-0 text-left text-xs font-bold text-crm-tinta-2 ${fixa ? "sticky z-30 shadow-[1px_0_0_0_#E4DED3]" : ""}`}
    >
      {ordenavel ? (
        <button
          type="button"
          onClick={() => aoOrdenar(coluna.id)}
          title={coluna.descricao ?? `Ordenar por ${coluna.titulo}`}
          className={`flex h-10 w-full items-center gap-1 px-2.5 text-left hover:text-crm-tinta ${coluna.alinhamento === "direita" ? "justify-end" : ""}`}
        >
          <span className="truncate">{coluna.titulo}</span>
          {ativa && (ordenacao!.direcao === "asc" ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
        </button>
      ) : (
        <span className="flex h-10 items-center px-2.5">{coluna.titulo}</span>
      )}
    </th>
  );
}

function GrupoTabela<T>(
  props: PropsTabela<T> & { grupo: Grupo<T>; larguraTitulo: number; largura: (c: ColunaQuadro<T>) => number },
) {
  const { grupo, agrupado, colunas, colunaTitulo, chave, selecionados, aoSelecionar, recolhidos, aoRecolher, larguraTitulo, largura } = props;
  const [limite, setLimite] = useState(LIMITE_INICIAL);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [criando, setCriando] = useState(false);
  const recolhido = recolhidos.has(grupo.chave);
  const corGrupo = grupo.cor ?? "#A1A1AA";
  const totalColunas = colunas.length + 2;
  const colunasSoma = colunas.filter((c) => c.resumo === "soma");

  const criar = async () => {
    const t = novoTitulo.trim();
    if (!t || !props.aoCriarRapido) return;
    setCriando(true);
    try {
      await props.aoCriarRapido(t, grupo);
      setNovoTitulo("");
    } finally {
      setCriando(false);
    }
  };

  const distribuicao = props.colunaStatus && props.colunaStatus.opcoes
    ? props.colunaStatus.opcoes.map((o) => ({
        rotulo: o.rotulo,
        cor: o.cor ?? "#A1A1AA",
        valor: grupo.itens.filter((i) => props.colunaStatus!.valor(i) === o.valor).length,
      }))
    : null;

  return (
    <tbody>
      {agrupado && (
        <tr>
          <th colSpan={totalColunas} scope="colgroup" className="sticky left-0 border-b border-crm-linha bg-white p-0 text-left">
            <div className="flex items-center gap-2 px-3 py-2.5" style={{ color: corGrupo }}>
              <button
                type="button"
                onClick={() => aoRecolher(grupo.chave)}
                aria-expanded={!recolhido}
                className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-bold hover:bg-crm-suave"
              >
                {recolhido ? <ChevronRight size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
                <span style={{ color: corGrupo === "#A1A1AA" ? "#4F5A52" : undefined }} className="brightness-75">
                  {grupo.rotulo}
                </span>
              </button>
              <span className="text-xs font-semibold text-crm-tinta-3">
                {grupo.itens.length} {grupo.itens.length === 1 ? "item" : "itens"}
              </span>
            </div>
          </th>
        </tr>
      )}
      {!recolhido &&
        grupo.itens.slice(0, limite).map((item) => {
          const id = chave(item);
          const marcado = selecionados.has(id);
          const destaque = props.destaqueLinha?.(item);
          return (
            <tr key={id} className={`group ${marcado ? "bg-crm-verde-claro" : "bg-white hover:bg-crm-fundo"}`} aria-selected={marcado}>
              <td
                className="sticky left-0 z-10 border-b border-crm-linha px-3"
                style={{ height: "var(--crm-linha-altura)", boxShadow: `inset 4px 0 0 0 ${agrupado ? corGrupo : destaque === "perigo" ? "#B42318" : destaque === "alerta" ? "#A15C07" : "transparent"}`, backgroundColor: marcado ? "#EEF4EF" : "white" }}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={(e) => aoSelecionar([id], e.target.checked)}
                  aria-label={`Selecionar ${props.rotuloItem(item)}`}
                  className="h-4 w-4 cursor-pointer accent-[#263A2D]"
                />
              </td>
              <td
                className="sticky z-10 border-b border-l border-crm-linha p-0 shadow-[1px_0_0_0_#E4DED3]"
                style={{ left: 40, width: larguraTitulo, minWidth: larguraTitulo, maxWidth: larguraTitulo, backgroundColor: marcado ? "#EEF4EF" : "white" }}
              >
                <CelulaTitulo coluna={colunaTitulo} item={item} rotulo={props.rotuloItem(item)} aoAbrir={() => props.aoAbrir(item)} />
              </td>
              {colunas.map((c) => (
                <td key={c.id} className="border-b border-l border-crm-linha p-0" style={{ width: largura(c), minWidth: largura(c), maxWidth: largura(c), height: "var(--crm-linha-altura)" }}>
                  <CelulaEditavel coluna={c} item={item} rotuloItem={props.rotuloItem(item)} />
                </td>
              ))}
            </tr>
          );
        })}
      {!recolhido && grupo.itens.length > limite && (
        <tr>
          <td colSpan={totalColunas} className="border-b border-crm-linha bg-white px-4 py-2">
            <button type="button" className="text-xs font-semibold text-crm-folha hover:underline" onClick={() => setLimite((l) => l + 200)}>
              Mostrar mais {Math.min(200, grupo.itens.length - limite)} de {grupo.itens.length - limite} restantes
            </button>
          </td>
        </tr>
      )}
      {!recolhido && props.aoCriarRapido && (
        <tr>
          <td className="sticky left-0 z-10 border-b border-crm-linha bg-white" style={{ boxShadow: `inset 4px 0 0 0 ${agrupado ? corGrupo : "transparent"}` }} />
          <td className="sticky z-10 border-b border-l border-crm-linha bg-white p-0" style={{ left: 40 }} colSpan={1}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                criar();
              }}
              className="flex items-center gap-1.5 px-2"
            >
              <Plus size={14} className="shrink-0 text-crm-tinta-3" aria-hidden />
              <input
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                disabled={criando}
                placeholder={agrupado ? `Adicionar em “${grupo.rotulo}”` : "Adicionar item"}
                aria-label={agrupado ? `Adicionar item em ${grupo.rotulo}` : "Adicionar item"}
                className="h-9 w-full bg-transparent text-[13px] outline-none placeholder:text-crm-tinta-3"
              />
            </form>
          </td>
          <td colSpan={colunas.length} className="border-b border-crm-linha bg-white" />
        </tr>
      )}
      {agrupado && !recolhido && (distribuicao || colunasSoma.length > 0) && grupo.itens.length > 0 && (
        <tr>
          <td className="sticky left-0 z-10 bg-crm-fundo" />
          <td className="sticky z-10 bg-crm-fundo" style={{ left: 40 }} />
          {colunas.map((c) => (
            <td key={c.id} className="bg-crm-fundo px-2 py-2">
              {c.id === props.colunaStatus?.id && distribuicao ? (
                <BarraDistribuicao partes={distribuicao} />
              ) : c.resumo === "soma" ? (
                <span className="block text-right text-xs font-bold tabular-nums text-crm-tinta-2">
                  {formatarMoeda(grupo.itens.reduce((s, i) => s + (Number(c.valor(i)) || 0), 0))}
                </span>
              ) : null}
            </td>
          ))}
        </tr>
      )}
    </tbody>
  );
}

/** Nome do item: clicar abre a ficha; o lápis permite renomear na própria linha. */
function CelulaTitulo<T>({ coluna, item, rotulo, aoAbrir }: { coluna: ColunaQuadro<T>; item: T; rotulo: string; aoAbrir: () => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(rotulo);
  const [salvando, setSalvando] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const editavel = Boolean(coluna.editar) && (coluna.podeEditar?.(item) ?? true);
  useEffect(() => {
    if (editando) {
      setTexto(String(coluna.valor(item) ?? ""));
      window.setTimeout(() => ref.current?.select(), 0);
    }
  }, [editando, coluna, item]);
  const concluir = async () => {
    const t = texto.trim();
    setEditando(false);
    if (!t || t === String(coluna.valor(item) ?? "") || !coluna.editar) return;
    setSalvando(true);
    try {
      await coluna.editar(item, t);
    } catch {
      /* aviso exibido pela camada de dados */
    } finally {
      setSalvando(false);
    }
  };
  if (editando) {
    return (
      <input
        ref={ref}
        value={texto}
        aria-label={`Renomear ${rotulo}`}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={concluir}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            concluir();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditando(false);
          }
        }}
        className="h-full w-full border-2 border-crm-folha bg-white px-2.5 text-[13px] font-semibold outline-none"
      />
    );
  }
  return (
    <div className="flex h-full items-center gap-1 pr-1">
      <button
        type="button"
        onClick={aoAbrir}
        className="flex h-full min-w-0 flex-1 items-center gap-2 px-2.5 text-left text-[13px] font-semibold text-crm-tinta hover:text-crm-musgo hover:underline"
        title={`Abrir ${rotulo}`}
        aria-label={`Abrir ${rotulo}`}
      >
        {coluna.exibir ? coluna.exibir(item) : <span className="truncate">{rotulo}</span>}
      </button>
      {salvando && <Loader2 size={13} className="shrink-0 animate-spin text-crm-folha" aria-label="Salvando" />}
      {editavel && !salvando && (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="shrink-0 rounded-md p-1 text-crm-tinta-3 opacity-0 transition-opacity hover:bg-crm-suave hover:text-crm-tinta focus:opacity-100 group-hover:opacity-100"
          aria-label={`Renomear ${rotulo}`}
          title="Renomear"
        >
          <Pencil size={13} />
        </button>
      )}
    </div>
  );
}
