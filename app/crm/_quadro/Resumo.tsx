"use client";

import { useState } from "react";
import { agruparItens } from "../_lib/filtros";
import { Selecao } from "../_ui/Campos";
import { BarraDistribuicao, Vazio } from "../_ui/Visuais";
import { ExibicaoCelula } from "./Celulas";
import type { ColunaQuadro } from "./tipos";

interface PropsResumo<T> {
  itens: T[];
  colunas: ColunaQuadro<T>[];
  colunaStatus?: ColunaQuadro<T>;
  resumirPor: string | null;
  aoMudarResumirPor: (id: string) => void;
  chave: (item: T) => string;
  rotuloItem: (item: T) => string;
  aoAbrir: (item: T) => void;
  camposItem: ColunaQuadro<T>[];
}

/** Visão resumida: um cartão por grupo (por cliente, responsável, fase…). */
export function Resumo<T>({ itens, colunas, colunaStatus, resumirPor, aoMudarResumirPor, chave, rotuloItem, aoAbrir, camposItem }: PropsResumo<T>) {
  const agrupaveis = colunas.filter((c) => c.agrupavel);
  const coluna = agrupaveis.find((c) => c.id === resumirPor) ?? agrupaveis[0];
  const grupos = agruparItens(itens, coluna).filter((g) => g.itens.length > 0);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  return (
    <div className="flex flex-col gap-3">
      <label className="flex w-full max-w-xs items-center gap-2 text-sm font-semibold text-crm-tinta-2">
        Resumir por
        <Selecao value={coluna?.id ?? ""} onChange={(e) => aoMudarResumirPor(e.target.value)} className="flex-1">
          {agrupaveis.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </Selecao>
      </label>
      {grupos.length === 0 ? (
        <Vazio titulo="Nada para resumir com os filtros atuais" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {grupos.map((g) => {
            const aberto = expandidos.has(g.chave);
            const visiveis = aberto ? g.itens : g.itens.slice(0, 6);
            const partes = colunaStatus?.opcoes?.map((o) => ({
              rotulo: o.rotulo,
              cor: o.cor ?? "#A1A1AA",
              valor: g.itens.filter((i) => colunaStatus.valor(i) === o.valor).length,
            }));
            return (
              <section key={g.chave} className="flex flex-col rounded-2xl border border-crm-linha bg-white shadow-crm-cartao" style={{ borderTop: `4px solid ${g.cor ?? "#263A2D"}` }}>
                <header className="flex items-start justify-between gap-2 px-4 pb-2 pt-3">
                  <h3 className="min-w-0 truncate text-sm font-bold text-crm-tinta">{g.rotulo}</h3>
                  <span className="shrink-0 rounded-full bg-crm-suave px-2 py-0.5 text-xs font-bold tabular-nums text-crm-tinta-2">{g.itens.length}</span>
                </header>
                {partes && (
                  <div className="px-4 pb-2">
                    <BarraDistribuicao partes={partes} />
                    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-crm-tinta-2">
                      {partes
                        .filter((p) => p.valor > 0)
                        .map((p) => (
                          <li key={p.rotulo} className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.cor }} aria-hidden />
                            {p.rotulo}: <strong className="tabular-nums">{p.valor}</strong>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                <ul className="flex flex-col divide-y divide-crm-linha border-t border-crm-linha">
                  {visiveis.map((item) => (
                    <li key={chave(item)}>
                      <button type="button" onClick={() => aoAbrir(item)} className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-crm-suave">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{rotuloItem(item)}</span>
                        {camposItem.map((c) => (
                          <span key={c.id} className="max-w-32 shrink-0 truncate text-xs">
                            <ExibicaoCelula coluna={c} item={item} />
                          </span>
                        ))}
                      </button>
                    </li>
                  ))}
                </ul>
                {g.itens.length > 6 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandidos((s) => {
                        const n = new Set(s);
                        if (n.has(g.chave)) n.delete(g.chave);
                        else n.add(g.chave);
                        return n;
                      })
                    }
                    className="border-t border-crm-linha px-4 py-2 text-left text-xs font-semibold text-crm-folha hover:underline"
                  >
                    {aberto ? "Mostrar menos" : `Ver todos (${g.itens.length})`}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
