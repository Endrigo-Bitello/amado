"use client";

import { executar } from "./dados";
import { supabase } from "./supabase";

export type TipoExclusaoDev = "cliente" | "caso" | "contrato" | "cobranca" | "pagamento" | "reembolso" | "despesa";

/**
 * Exclusão em cascata, exclusiva da conta de desenvolvimento (função dev_excluir
 * no banco). Em seguida apaga do armazenamento os arquivos removidos junto.
 */
export async function excluirComoDev(tipo: TipoExclusaoDev, id: string): Promise<void> {
  const arquivos = ((await executar(supabase().rpc("dev_excluir", { p_tipo: tipo, p_id: id }))) ?? []) as unknown as { bucket: string; caminho: string }[];
  const porBucket = new Map<string, string[]>();
  for (const a of arquivos) porBucket.set(a.bucket, [...(porBucket.get(a.bucket) ?? []), a.caminho]);
  for (const [bucket, caminhos] of porBucket) {
    // Uma falha aqui só deixa arquivos órfãos no armazenamento; o banco já está consistente.
    for (let i = 0; i < caminhos.length; i += 100) await supabase().storage.from(bucket).remove(caminhos.slice(i, i + 100));
  }
}
