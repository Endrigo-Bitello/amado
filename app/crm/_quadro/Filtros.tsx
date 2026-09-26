"use client";

import { Filter, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { formatarData } from "../_lib/datas";
import { ROTULOS_OPERADORES, operadorPrecisaValor, operadoresPara } from "../_lib/filtros";
import { idCurto } from "../_lib/formatos";
import { Botao } from "../_ui/Botao";
import { Entrada, Selecao } from "../_ui/Campos";
import { SeletorMultiplo } from "../_ui/Seletores";
import { Popover } from "../_ui/Sobreposicoes";
import type { ColunaQuadro, Filtro, Operador } from "./tipos";

interface PropsFiltros<T> {
  colunas: ColunaQuadro<T>[];
  filtros: Filtro[];
  aoAlterar: (f: Filtro[]) => void;
}

export function BotaoFiltros<T>({ colunas, filtros, aoAlterar }: PropsFiltros<T>) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const filtraveis = colunas.filter((c) => c.filtravel !== false);
  const ativos = filtros.length;

  const adicionar = () => {
    const c = filtraveis[0];
    if (!c) return;
    aoAlterar([...filtros, { id: idCurto(), coluna: c.id, operador: operadoresPara(c.tipo)[0] }]);
  };

  return (
    <>
      <Botao
        ref={ref}
        variante={ativos ? "sutil" : "secundario"}
        tamanho="sm"
        icone={<Filter size={14} />}
        onClick={() => {
          setAberto((a) => !a);
          if (!aberto && filtros.length === 0) adicionar();
        }}
        aria-expanded={aberto}
        aria-haspopup="dialog"
      >
        Filtros{ativos ? ` (${ativos})` : ""}
      </Botao>
      <Popover aberto={aberto} aoFechar={() => setAberto(false)} ancora={ref} largura={Math.min(640, typeof window !== "undefined" ? window.innerWidth - 24 : 640)} rotulo="Filtros do quadro">
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Filtrar itens</h3>
            {filtros.length > 0 && (
              <button type="button" className="text-xs font-semibold text-crm-tinta-2 hover:text-crm-perigo" onClick={() => aoAlterar([])}>
                Limpar todos
              </button>
            )}
          </div>
          {filtros.length === 0 && <p className="text-sm text-crm-tinta-3">Nenhum filtro. Todos os itens estão visíveis.</p>}
          <ul className="flex flex-col gap-2">
            {filtros.map((f, i) => {
              const coluna = filtraveis.find((c) => c.id === f.coluna) ?? filtraveis[0];
              const operadores = coluna ? operadoresPara(coluna.tipo) : [];
              const atualizar = (parcial: Partial<Filtro>) => aoAlterar(filtros.map((x) => (x.id === f.id ? { ...x, ...parcial } : x)));
              return (
                <li key={f.id} className="flex flex-col gap-2 rounded-xl border border-crm-linha bg-crm-fundo p-2 sm:flex-row sm:items-center">
                  <span className="w-8 shrink-0 text-xs font-semibold text-crm-tinta-3">{i === 0 ? "Onde" : "e"}</span>
                  <Selecao
                    aria-label="Coluna"
                    value={coluna?.id}
                    onChange={(e) => {
                      const nova = filtraveis.find((c) => c.id === e.target.value)!;
                      atualizar({ coluna: nova.id, operador: operadoresPara(nova.tipo)[0], valor: undefined });
                    }}
                    className="sm:w-44"
                  >
                    {filtraveis.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.titulo}
                      </option>
                    ))}
                  </Selecao>
                  <Selecao aria-label="Condição" value={f.operador} onChange={(e) => atualizar({ operador: e.target.value as Operador, valor: undefined })} className="sm:w-40">
                    {operadores.map((o) => (
                      <option key={o} value={o}>
                        {ROTULOS_OPERADORES[o]}
                      </option>
                    ))}
                  </Selecao>
                  <div className="min-w-0 flex-1">{coluna && operadorPrecisaValor(f.operador) && <ValorFiltro coluna={coluna} filtro={f} aoAlterar={(valor) => atualizar({ valor })} />}</div>
                  <button type="button" onClick={() => aoAlterar(filtros.filter((x) => x.id !== f.id))} className="self-end rounded-lg p-2 text-crm-tinta-3 hover:bg-crm-perigo-claro hover:text-crm-perigo sm:self-auto" aria-label="Remover filtro">
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
          <Botao variante="fantasma" tamanho="sm" icone={<Plus size={14} />} onClick={adicionar} className="self-start">
            Adicionar filtro
          </Botao>
        </div>
      </Popover>
    </>
  );
}

function ValorFiltro<T>({ coluna, filtro, aoAlterar }: { coluna: ColunaQuadro<T>; filtro: Filtro; aoAlterar: (v: unknown) => void }) {
  if (filtro.operador === "em" || filtro.operador === "nao_em") {
    const valores = Array.isArray(filtro.valor) ? (filtro.valor as string[]) : [];
    return (
      <SeletorMultiplo
        rotulo={`Valores de ${coluna.titulo}`}
        valores={valores}
        opcoes={coluna.opcoes ?? []}
        aoAlterar={aoAlterar}
        estilo={coluna.tipo === "pessoa" || coluna.tipo === "pessoas" ? "pessoa" : "pilula"}
      />
    );
  }
  if (coluna.tipo === "checkbox") {
    return (
      <Selecao aria-label="Valor" value={filtro.valor ? "1" : "0"} onChange={(e) => aoAlterar(e.target.value === "1")}>
        <option value="1">Sim (marcado)</option>
        <option value="0">Não (desmarcado)</option>
      </Selecao>
    );
  }
  if (filtro.operador === "antes" || filtro.operador === "depois") {
    return <Entrada type="date" aria-label="Data" value={String(filtro.valor ?? "")} onChange={(e) => aoAlterar(e.target.value)} />;
  }
  if (filtro.operador === "proximos_dias") {
    return (
      <div className="flex items-center gap-2">
        <Entrada type="number" min={0} max={365} aria-label="Quantidade de dias" value={String(filtro.valor ?? 7)} onChange={(e) => aoAlterar(Number(e.target.value))} className="w-24" />
        <span className="text-sm text-crm-tinta-2">dias</span>
      </div>
    );
  }
  return (
    <Entrada
      type={coluna.tipo === "numero" || coluna.tipo === "moeda" ? "number" : "text"}
      aria-label="Valor"
      value={String(filtro.valor ?? "")}
      onChange={(e) => aoAlterar(e.target.value)}
      placeholder="Digite…"
    />
  );
}

/** Chips com os filtros ativos (texto legível; clique no X remove). */
export function ChipsFiltros<T>({ colunas, filtros, aoAlterar }: PropsFiltros<T>) {
  if (filtros.length === 0) return null;
  const descrever = (f: Filtro) => {
    const c = colunas.find((x) => x.id === f.coluna);
    if (!c) return null;
    let valor = "";
    if (Array.isArray(f.valor)) valor = (f.valor as string[]).map((v) => c.opcoes?.find((o) => o.valor === v)?.rotulo ?? v).join(", ");
    else if (f.operador === "antes" || f.operador === "depois") valor = formatarData(String(f.valor ?? ""));
    else if (f.operador === "proximos_dias") valor = `${f.valor ?? 7}`;
    else if (c.tipo === "checkbox") valor = f.valor ? "Sim" : "Não";
    else if (f.valor !== undefined) valor = String(f.valor);
    return `${c.titulo} ${ROTULOS_OPERADORES[f.operador]}${valor ? ` ${valor}` : ""}`;
  };
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Filtros ativos">
      {filtros.map((f) => {
        const texto = descrever(f);
        if (!texto) return null;
        return (
          <li key={f.id} className="inline-flex items-center gap-1 rounded-full border border-crm-verde-borda bg-crm-verde-claro py-0.5 pl-2.5 pr-1 text-xs font-semibold text-crm-verde">
            {texto}
            <button type="button" onClick={() => aoAlterar(filtros.filter((x) => x.id !== f.id))} className="rounded-full p-0.5 hover:bg-white" aria-label={`Remover filtro: ${texto}`}>
              <X size={12} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
