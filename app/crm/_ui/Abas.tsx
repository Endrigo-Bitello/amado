"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface Aba {
  id: string;
  rotulo: string;
  contador?: number | null;
  icone?: ReactNode;
  alerta?: boolean;
}

interface PropsAbas {
  abas: Aba[];
  ativa: string;
  aoTrocar: (id: string) => void;
  rotulo: string;
  className?: string;
}

/** Abas acessíveis (setas do teclado alternam entre as abas). */
export function Abas({ abas, ativa, aoTrocar, rotulo, className = "" }: PropsAbas) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const aoTeclar = (e: KeyboardEvent, i: number) => {
    let alvo = -1;
    if (e.key === "ArrowRight") alvo = (i + 1) % abas.length;
    if (e.key === "ArrowLeft") alvo = (i - 1 + abas.length) % abas.length;
    if (e.key === "Home") alvo = 0;
    if (e.key === "End") alvo = abas.length - 1;
    if (alvo >= 0) {
      e.preventDefault();
      refs.current[alvo]?.focus();
      aoTrocar(abas[alvo].id);
    }
  };
  return (
    <div role="tablist" aria-label={rotulo} className={`flex gap-1 overflow-x-auto border-b border-crm-linha ${className}`}>
      {abas.map((a, i) => {
        const selecionada = a.id === ativa;
        return (
          <button
            key={a.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${base}-${a.id}`}
            type="button"
            role="tab"
            aria-selected={selecionada}
            tabIndex={selecionada ? 0 : -1}
            onClick={() => aoTrocar(a.id)}
            onKeyDown={(e) => aoTeclar(e, i)}
            className={`relative -mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
              selecionada ? "border-crm-verde text-crm-tinta" : "border-transparent text-crm-tinta-3 hover:text-crm-tinta"
            }`}
          >
            {a.icone}
            {a.rotulo}
            {a.contador !== undefined && a.contador !== null && (
              <span
                className={`rounded-full px-1.5 py-px text-[11px] tabular-nums ${
                  a.alerta ? "bg-crm-perigo text-white" : selecionada ? "bg-crm-verde text-white" : "bg-crm-suave-2 text-crm-tinta-2"
                }`}
              >
                {a.contador}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
