"use client";

import { AlertTriangle, Ban, CheckCircle2, CircleDashed, Clock, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { ErroCrm } from "../../_lib/dados";
import { chamarFuncao } from "../../_lib/edge";
import { supabase } from "../../_lib/supabase";
import { Pilula } from "../../_ui/Visuais";

export const SITUACOES: Record<string, { rotulo: string; cor: string; icone: ReactNode }> = {
  a_receber: { rotulo: "A receber", cor: "#3E5C8A", icone: <Clock size={12} aria-hidden /> },
  parcial: { rotulo: "Parcialmente pago", cor: "#C9822B", icone: <CircleDashed size={12} aria-hidden /> },
  pago: { rotulo: "Pago", cor: "#3D7B3E", icone: <CheckCircle2 size={12} aria-hidden /> },
  vencido: { rotulo: "Vencido", cor: "#B42318", icone: <AlertTriangle size={12} aria-hidden /> },
  cancelado: { rotulo: "Cancelado", cor: "#52525B", icone: <Ban size={12} aria-hidden /> },
  reembolsado: { rotulo: "Reembolsado", cor: "#6D5BA6", icone: <RotateCcw size={12} aria-hidden /> },
};

export function PilulaSituacao({ situacao, parcial }: { situacao: string | null; parcial?: boolean | null }) {
  const s = SITUACOES[situacao ?? "a_receber"] ?? SITUACOES.a_receber;
  return (
    <Pilula cor={s.cor} icone={s.icone}>
      {s.rotulo}
      {situacao === "vencido" && parcial ? " (parcial)" : ""}
    </Pilula>
  );
}

export const CATEGORIAS_COBRANCA: Record<string, string> = {
  honorarios: "Honorários",
  reembolso_despesas: "Reembolso de custas/despesas",
};

/** Executa uma ação financeira pela Edge Function (única via de escrita). */
export async function acaoFinanceira<T = unknown>(acao: string, dados: Record<string, unknown>): Promise<T> {
  const r = await chamarFuncao<{ resultado: T }>("crm-financeiro", { acao, dados });
  return r.resultado;
}

/** Envia comprovante/contrato ao armazenamento financeiro privado (URL assinada). */
export async function enviarComprovante(arquivo: File, clienteId: string, casoId: string | null, tipoArquivo: "comprovante_financeiro" | "contrato" = "comprovante_financeiro"): Promise<string> {
  const prep = await chamarFuncao<{ caminho: string; token_envio: string }>("crm-financeiro", {
    acao: "preparar_comprovante",
    dados: { cliente_id: clienteId, nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size },
  });
  const envio = await supabase().storage.from("crm-financeiro").uploadToSignedUrl(prep.caminho, prep.token_envio, arquivo, { contentType: arquivo.type });
  if (envio.error) throw new ErroCrm("Não foi possível enviar o comprovante. Tente novamente.");
  const conf = await chamarFuncao<{ arquivo_id: string }>("crm-financeiro", {
    acao: "confirmar_comprovante",
    dados: { cliente_id: clienteId, caso_id: casoId, caminho: prep.caminho, nome: arquivo.name, tipo: arquivo.type, tipo_arquivo: tipoArquivo },
  });
  return conf.arquivo_id;
}
