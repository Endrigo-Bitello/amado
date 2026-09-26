"use client";

import { comSalvamento } from "./avisos";
import { ErroCrm } from "./dados";
import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL, supabase } from "./supabase";

/** Chama uma Edge Function do CRM com o token do usuário logado. */
export async function chamarFuncao<T = Record<string, unknown>>(nome: string, corpo: unknown): Promise<T> {
  return comSalvamento(async () => {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ErroCrm("Sua sessão expirou. Entre novamente.");
    let resposta: Response;
    try {
      resposta = await fetch(`${SUPABASE_URL}/functions/v1/${nome}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_CHAVE_PUBLICA,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(corpo),
      });
    } catch {
      throw new ErroCrm("Sem conexão com o servidor. Verifique a internet e tente novamente.");
    }
    const json = (await resposta.json().catch(() => null)) as ({ ok?: boolean; erro?: string; codigo?: string } & T) | null;
    if (!resposta.ok || !json || json.ok === false) {
      throw new ErroCrm(json?.erro ?? "Não foi possível concluir a operação. Tente novamente.", json?.codigo);
    }
    return json as T;
  });
}
