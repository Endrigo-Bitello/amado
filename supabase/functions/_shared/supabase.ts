import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.2";

// Cliente com a service role: usado SOMENTE dentro das Edge Functions.
// A chave nunca é enviada ao navegador.
export function clienteServico(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !chave) {
    throw new Error("Variáveis SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes.");
  }
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-crm-origem": "edge-function" } },
  });
}

// Valida o JWT do usuário logado e confirma que ele está ativo no CRM.
export async function usuarioAutenticado(
  req: Request,
  servico: SupabaseClient,
): Promise<{ id: string } | null> {
  const cabecalho = req.headers.get("Authorization") ?? "";
  const token = cabecalho.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await servico.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: perfil } = await servico
    .from("usuarios")
    .select("id, ativo")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!perfil || !perfil.ativo) return null;
  return { id: data.user.id };
}

export async function temPermissao(servico: SupabaseClient, usuario: string, permissao: string): Promise<boolean> {
  const { data, error } = await servico.rpc("tem_permissao_usuario", {
    p_usuario: usuario,
    p_permissao: permissao,
  });
  if (error) return false;
  return data === true;
}

// Limite de uso por chave e janela (contador atômico no banco).
export async function dentroDoLimite(
  servico: SupabaseClient,
  chave: string,
  maximo: number,
  janelaSegundos: number,
): Promise<boolean> {
  const { data, error } = await servico.rpc("verificar_limite", {
    p_chave: chave,
    p_maximo: maximo,
    p_janela_segundos: janelaSegundos,
  });
  if (error) {
    // Em caso de falha do contador, não bloqueia o visitante legítimo.
    console.error("[limite] falha ao verificar limite:", error.code);
    return true;
  }
  return data === true;
}
