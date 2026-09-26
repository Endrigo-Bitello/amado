"use client";

import { useQuery } from "@tanstack/react-query";
import { buscarTodos, useGravacao } from "./dados";
import { supabase } from "./supabase";
import type { CampoPersonalizado, Entidade } from "./tipos";
import type { ColunaQuadro, TipoColuna } from "../_quadro/tipos";

export type MapaValores = Map<string, Record<string, unknown>>;

/** Valores dos campos personalizados de um tipo de registro (RLS aplica visibilidade). */
export function useValoresPersonalizados(entidade: Entidade, ativo = true) {
  return useQuery({
    queryKey: ["valores", entidade],
    enabled: ativo,
    queryFn: async () => {
      const { linhas } = await buscarTodos((de, ate) =>
        supabase().from("valores_personalizados").select("campo_id, registro_id, valor").eq("entidade", entidade).range(de, ate),
      );
      const mapa: MapaValores = new Map();
      for (const l of linhas) {
        if (!mapa.has(l.registro_id)) mapa.set(l.registro_id, {});
        mapa.get(l.registro_id)![l.campo_id] = l.valor;
      }
      return mapa;
    },
  });
}

const TIPOS: Record<CampoPersonalizado["tipo"], TipoColuna> = {
  texto: "texto",
  texto_longo: "texto_longo",
  numero: "numero",
  moeda: "moeda",
  data: "data",
  selecao: "selecao",
  multipla: "multipla",
  checkbox: "checkbox",
  link: "link",
};

interface OpcaoCampo {
  id: string;
  rotulo: string;
  cor?: string | null;
  arquivado?: boolean;
}

export function opcoesDoCampo(campo: CampoPersonalizado): OpcaoCampo[] {
  return Array.isArray(campo.opcoes) ? (campo.opcoes as unknown as OpcaoCampo[]) : [];
}

export function useSalvarValorPersonalizado(entidade: Entidade) {
  const { invalidar } = useGravacao();
  return async (campo: CampoPersonalizado, registroId: string, valor: unknown) => {
    const s = supabase();
    const vazio = valor === null || valor === undefined || valor === "" || (Array.isArray(valor) && valor.length === 0);
    const { error } = vazio
      ? await s.from("valores_personalizados").delete().eq("campo_id", campo.id).eq("registro_id", registroId)
      : await s.from("valores_personalizados").upsert({ campo_id: campo.id, registro_id: registroId, entidade, valor: valor as never });
    invalidar("valores");
    if (error) throw error;
  };
}

/** Converte campos personalizados em colunas de quadro/ficha. */
export function colunasPersonalizadas<T extends { id: string }>(
  campos: CampoPersonalizado[],
  valores: MapaValores | undefined,
  salvar: (campo: CampoPersonalizado, registroId: string, valor: unknown) => Promise<void>,
  podeEditar: boolean,
): ColunaQuadro<T>[] {
  return campos.map((c) => {
    const opcoes = opcoesDoCampo(c);
    return {
      id: `cp_${c.id}`,
      titulo: c.rotulo,
      tipo: TIPOS[c.tipo],
      descricao: c.ajuda ?? undefined,
      valor: (item: T) => valores?.get(item.id)?.[c.id] ?? null,
      opcoes: opcoes.length
        ? opcoes.map((o) => ({ valor: o.id, rotulo: o.arquivado ? `${o.rotulo} (arquivada)` : o.rotulo, cor: o.cor ?? "#C5A880", desabilitada: o.arquivado }))
        : undefined,
      editar: podeEditar ? (item: T, v: unknown) => salvar(c, item.id, v) : undefined,
      oculta: !c.mostrar_no_quadro,
      agrupavel: c.tipo === "selecao" || c.tipo === "checkbox",
      alinhamento: c.tipo === "moeda" || c.tipo === "numero" ? "direita" : undefined,
      largura: c.tipo === "texto_longo" ? 240 : 170,
    } satisfies ColunaQuadro<T>;
  });
}
