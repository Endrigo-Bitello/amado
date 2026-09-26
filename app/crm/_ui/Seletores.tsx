"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { corTexto } from "../_lib/cores";
import { normalizarBusca } from "../_lib/formatos";
import { Avatar, Pilula } from "./Visuais";
import { Popover } from "./Sobreposicoes";
import { classeCampo } from "./Campos";

export interface OpcaoLista {
  valor: string;
  rotulo: string;
  cor?: string | null;
  descricao?: string;
  icone?: ReactNode;
  desabilitada?: boolean;
}

// ---------------------------------------------------------------------------
// Lista com busca (usada por todos os seletores)
// ---------------------------------------------------------------------------

interface PropsListaBusca {
  opcoes: OpcaoLista[];
  selecionados: string[];
  aoAlternar: (valor: string) => void;
  multipla?: boolean;
  estilo?: "texto" | "pilula" | "pessoa";
  placeholderBusca?: string;
  vazioTexto?: string;
  rodape?: ReactNode;
}

export function ListaBusca({ opcoes, selecionados, aoAlternar, multipla, estilo = "texto", placeholderBusca = "Buscar…", vazioTexto = "Nada encontrado", rodape }: PropsListaBusca) {
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);
  const lista = useRef<HTMLUListElement>(null);
  const filtradas = useMemo(() => {
    const termo = normalizarBusca(busca);
    return termo ? opcoes.filter((o) => normalizarBusca(o.rotulo).includes(termo)) : opcoes;
  }, [busca, opcoes]);

  const aoTeclar = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const op = filtradas[ativo];
      if (op && !op.desabilitada) aoAlternar(op.valor);
    }
  };

  return (
    <div className="flex min-h-0 flex-col" onKeyDown={aoTeclar}>
      {opcoes.length > 6 && (
        <div className="flex items-center gap-2 border-b border-crm-linha px-3 py-2">
          <Search size={14} className="shrink-0 text-crm-tinta-3" aria-hidden />
          <input
            data-autofoco
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAtivo(0);
            }}
            placeholder={placeholderBusca}
            aria-label={placeholderBusca}
            className="w-full bg-transparent text-sm outline-none placeholder:text-crm-tinta-3"
          />
        </div>
      )}
      <ul ref={lista} role="listbox" aria-multiselectable={multipla || undefined} className="min-h-0 flex-1 overflow-y-auto py-1">
        {filtradas.length === 0 && <li className="px-3.5 py-3 text-sm text-crm-tinta-3">{vazioTexto}</li>}
        {filtradas.map((o, i) => {
          const marcado = selecionados.includes(o.valor);
          return (
            <li key={o.valor} role="option" aria-selected={marcado} aria-disabled={o.desabilitada || undefined}>
              <button
                type="button"
                disabled={o.desabilitada}
                data-autofoco={opcoes.length <= 6 && i === 0 ? true : undefined}
                onMouseEnter={() => setAtivo(i)}
                onClick={() => aoAlternar(o.valor)}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors disabled:opacity-40 ${
                  i === ativo ? "bg-crm-suave" : ""
                } focus:bg-crm-suave focus:outline-none`}
              >
                {estilo === "pessoa" && <Avatar nome={o.valor ? o.rotulo : null} cor={o.cor} tamanho={24} />}
                {estilo === "pilula" ? (
                  <span
                    className="flex h-7 flex-1 items-center rounded-md px-2.5 text-[13px] font-semibold"
                    style={{ backgroundColor: o.cor ?? "#E9E1D0", color: corTexto(o.cor ?? "#E9E1D0") }}
                  >
                    {o.icone}
                    {o.rotulo}
                  </span>
                ) : (
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-crm-tinta">{o.rotulo}</span>
                    {o.descricao && <span className="truncate text-xs text-crm-tinta-3">{o.descricao}</span>}
                  </span>
                )}
                <Check size={15} className={`shrink-0 text-crm-folha ${marcado ? "opacity-100" : "opacity-0"}`} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {rodape && <div className="border-t border-crm-linha p-2">{rodape}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seletor com gatilho em forma de campo (formulários)
// ---------------------------------------------------------------------------

interface PropsSeletorCampo {
  id?: string;
  valor: string | null;
  opcoes: OpcaoLista[];
  aoAlterar: (v: string | null) => void;
  placeholder?: string;
  estilo?: "texto" | "pilula" | "pessoa";
  permitirVazio?: boolean;
  rotuloVazio?: string;
  desabilitado?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  rotulo?: string;
}

export function SeletorCampo({
  id,
  valor,
  opcoes,
  aoAlterar,
  placeholder = "Selecione…",
  estilo = "texto",
  permitirVazio = true,
  rotuloVazio = "Nenhum",
  desabilitado,
  rotulo,
  ...aria
}: PropsSeletorCampo) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const atual = opcoes.find((o) => o.valor === valor);
  const lista = permitirVazio ? [{ valor: "", rotulo: rotuloVazio, cor: null }, ...opcoes] : opcoes;
  return (
    <>
      <button
        id={id}
        ref={ref}
        type="button"
        disabled={desabilitado}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label={rotulo}
        onClick={() => setAberto((a) => !a)}
        className={`${classeCampo} flex h-9 items-center justify-between gap-2 text-left`}
        {...aria}
      >
        <span className="flex min-w-0 items-center gap-2">
          {atual ? (
            estilo === "pilula" ? (
              <Pilula cor={atual.cor}>{atual.rotulo}</Pilula>
            ) : (
              <>
                {estilo === "pessoa" && <Avatar nome={atual.rotulo} cor={atual.cor} tamanho={22} />}
                <span className="truncate">{atual.rotulo}</span>
              </>
            )
          ) : (
            <span className="truncate text-crm-tinta-3">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={15} className="shrink-0 text-crm-tinta-3" aria-hidden />
      </button>
      <Popover aberto={aberto} aoFechar={() => setAberto(false)} ancora={ref} largura="ancora" rotulo={rotulo ?? placeholder}>
        <ListaBusca
          opcoes={lista}
          selecionados={valor ? [valor] : [""]}
          estilo={estilo}
          aoAlternar={(v) => {
            aoAlterar(v || null);
            setAberto(false);
          }}
        />
      </Popover>
    </>
  );
}

interface PropsMultiplo {
  valores: string[];
  opcoes: OpcaoLista[];
  aoAlterar: (v: string[]) => void;
  placeholder?: string;
  rotulo?: string;
  id?: string;
  estilo?: "texto" | "pilula" | "pessoa";
}

export function SeletorMultiplo({ valores, opcoes, aoAlterar, placeholder = "Selecione…", rotulo, id, estilo = "pilula" }: PropsMultiplo) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const selecionadas = opcoes.filter((o) => valores.includes(o.valor));
  return (
    <>
      <button
        id={id}
        ref={ref}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label={rotulo}
        onClick={() => setAberto((a) => !a)}
        className={`${classeCampo} flex min-h-9 flex-wrap items-center gap-1.5 py-1 text-left`}
      >
        {selecionadas.length === 0 && <span className="text-crm-tinta-3">{placeholder}</span>}
        {selecionadas.map((o) =>
          estilo === "pessoa" ? (
            <span key={o.valor} className="inline-flex items-center gap-1 rounded-full bg-crm-suave py-0.5 pl-0.5 pr-2 text-xs font-semibold">
              <Avatar nome={o.rotulo} cor={o.cor} tamanho={20} />
              {o.rotulo}
            </span>
          ) : (
            <Pilula key={o.valor} cor={o.cor} preenchida={false}>
              {o.rotulo}
            </Pilula>
          ),
        )}
      </button>
      <Popover aberto={aberto} aoFechar={() => setAberto(false)} ancora={ref} largura="ancora-min" rotulo={rotulo ?? placeholder}>
        <ListaBusca
          multipla
          opcoes={opcoes}
          selecionados={valores}
          estilo={estilo === "pessoa" ? "pessoa" : "texto"}
          aoAlternar={(v) => aoAlterar(valores.includes(v) ? valores.filter((x) => x !== v) : [...valores, v])}
          rodape={
            valores.length > 0 ? (
              <button type="button" className="flex items-center gap-1 text-xs font-semibold text-crm-tinta-2 hover:text-crm-tinta" onClick={() => aoAlterar([])}>
                <X size={12} /> Limpar seleção
              </button>
            ) : undefined
          }
        />
      </Popover>
    </>
  );
}
