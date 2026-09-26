"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Somente a URL e a chave pública (anon/publishable) chegam ao navegador.
// A segurança dos dados depende da RLS e das Edge Functions no servidor.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_CHAVE_PUBLICA =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_CHAVE_PUBLICA);

export type ClienteCrm = SupabaseClient<Database>;

let cliente: ClienteCrm | null = null;

export function supabase(): ClienteCrm {
  if (!supabaseConfigurado) {
    throw new Error("CRM sem configuração do Supabase (NEXT_PUBLIC_SUPABASE_URL e chave pública).");
  }
  if (!cliente) {
    // Sessão guardada em cookies (lidos pelo proxy de /crm para a checagem inicial).
    cliente = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
      cookieOptions: { sameSite: "lax", secure: typeof location !== "undefined" && location.protocol === "https:" },
    });
  }
  return cliente;
}
