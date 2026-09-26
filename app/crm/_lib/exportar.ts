"use client";

import { hojeSP } from "./datas";
import { ErroCrm, mensagemErro } from "./dados";
import { supabase } from "./supabase";

export interface ColunaExportacao<T> {
  titulo: string;
  texto: (item: T) => string | number | null | undefined;
}

/** Exporta linhas em CSV (separador ";" e UTF-8 com BOM, compatível com Excel) ou XLSX. */
export async function exportarPlanilha<T>(
  nomeBase: string,
  colunas: ColunaExportacao<T>[],
  itens: T[],
  formato: "csv" | "xlsx",
  quadro: string,
) {
  // Auditoria antes do download (sem dados pessoais); sem permissão, nada é gerado.
  const { error } = await supabase().rpc("registrar_exportacao", { p_quadro: quadro, p_quantidade: itens.length, p_formato: formato });
  if (error) throw new ErroCrm(mensagemErro(error));
  const XLSX = await import("xlsx");
  const linhas = itens.map((item) =>
    Object.fromEntries(colunas.map((c) => {
      const v = c.texto(item);
      return [c.titulo, v === null || v === undefined ? "" : v];
    })),
  );
  const planilha = XLSX.utils.json_to_sheet(linhas, { header: colunas.map((c) => c.titulo) });
  planilha["!cols"] = colunas.map((c) => ({ wch: Math.min(48, Math.max(12, c.titulo.length + 2)) }));
  const nome = `${nomeBase}-${hojeSP()}`;
  if (formato === "csv") {
    const csv = XLSX.utils.sheet_to_csv(planilha, { FS: ";" });
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    baixarBlob(blob, `${nome}.csv`);
  } else {
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, nomeBase.slice(0, 31));
    XLSX.writeFile(livro, `${nome}.xlsx`, { compression: true });
  }
}

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
