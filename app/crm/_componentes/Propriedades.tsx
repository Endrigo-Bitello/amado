"use client";

import { AlertCircle, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../_lib/auth";
import { colunasPersonalizadas, useSalvarValorPersonalizado, useValoresPersonalizados } from "../_lib/campos";
import { useConfig } from "../_lib/config";
import type { Entidade } from "../_lib/tipos";
import { CelulaEditavel } from "../_quadro/Celulas";
import type { ColunaQuadro } from "../_quadro/tipos";

/** Lista rótulo → valor com edição no próprio lugar (mesmos editores do quadro). */
export function ListaPropriedades<T>({ item, colunas, rotuloItem, obrigatorios = [] }: { item: T; colunas: ColunaQuadro<T>[]; rotuloItem: string; obrigatorios?: string[] }) {
  return (
    <dl className="flex flex-col divide-y divide-crm-linha rounded-xl border border-crm-linha bg-white">
      {colunas.map((c) => {
        const v = c.valor(item);
        const faltando = obrigatorios.includes(c.id) && (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0));
        return (
          <div key={c.id} className="grid min-h-10 grid-cols-[minmax(110px,38%)_1fr] items-stretch">
            <dt className="flex items-center gap-1 px-3 py-2 text-[13px] font-semibold text-crm-tinta-2" title={c.descricao}>
              <span className="truncate">{c.titulo}</span>
              {faltando && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-crm-alerta" title="Campo obrigatório não preenchido">
                  <AlertCircle size={12} aria-hidden />
                  <span className="sr-only">obrigatório, não preenchido</span>
                </span>
              )}
            </dt>
            <dd className="min-w-0 border-l border-crm-linha">
              <CelulaEditavel coluna={c} item={item} rotuloItem={rotuloItem} compacto />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function SecaoFicha({ titulo, children, acoes, descricao }: { titulo: string; children: ReactNode; acoes?: ReactNode; descricao?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-crm-tinta-3">{titulo}</h3>
          {descricao && <p className="text-xs text-crm-tinta-3">{descricao}</p>}
        </div>
        {acoes}
      </div>
      {children}
    </section>
  );
}

/** Campos personalizados do registro, agrupados por seção definida pelo administrador. */
export function CamposPersonalizadosFicha<T extends { id: string }>({ entidade, item, rotuloItem }: { entidade: Entidade; item: T; rotuloItem: string }) {
  const config = useConfig();
  const { pode } = useAuth();
  const valores = useValoresPersonalizados(entidade);
  const salvar = useSalvarValorPersonalizado(entidade);
  const campos = config.camposDe(entidade);
  if (campos.length === 0) return null;
  const permissaoEdicao = entidade === "lead" ? "leads.editar" : entidade === "cliente" ? "clientes.editar" : "casos.editar";
  const colunas = colunasPersonalizadas<T>(campos, valores.data, salvar, pode(permissaoEdicao));
  const secoes = new Map<string, { campos: typeof campos; colunas: ColunaQuadro<T>[] }>();
  campos.forEach((c, i) => {
    if (!secoes.has(c.secao)) secoes.set(c.secao, { campos: [], colunas: [] });
    secoes.get(c.secao)!.campos.push(c);
    secoes.get(c.secao)!.colunas.push(colunas[i]);
  });
  return (
    <>
      {[...secoes.entries()].map(([secao, g]) => (
        <SecaoFicha
          key={secao}
          titulo={secao}
          descricao={
            g.campos.some((c) => c.visibilidade !== "todos") ? (
              <span className="inline-flex items-center gap-1">
                <Lock size={11} aria-hidden /> Alguns campos têm acesso restrito.
              </span>
            ) : undefined
          }
        >
          <ListaPropriedades item={item} colunas={g.colunas} rotuloItem={rotuloItem} obrigatorios={g.campos.filter((c) => c.obrigatorio).map((c) => `cp_${c.id}`)} />
        </SecaoFicha>
      ))}
    </>
  );
}
