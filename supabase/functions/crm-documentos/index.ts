// Operações sensíveis de documentos: geração e revogação de links individuais
// para o cliente enviar documentos. O token é gerado aqui, mostrado uma única
// vez e apenas o hash SHA-256 é armazenado.

import {
  cabecalhosCors,
  erro,
  ErroValidacao,
  json,
  lerJson,
  respostaErroBanco,
  sha256Hex,
  texto,
} from "../_shared/http.ts";
import { clienteServico, usuarioAutenticado } from "../_shared/supabase.ts";

function tokenAleatorio(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function urlBase(req: Request): string {
  const configurada = Deno.env.get("CRM_SITE_URL");
  if (configurada) return configurada.replace(/\/+$/, "");
  const origem = req.headers.get("origin");
  return origem ? origem.replace(/\/+$/, "") : "";
}

interface Pedido {
  acao?: string;
  id?: string;
  cliente_id?: string;
  caso_id?: string;
  lead_id?: string;
  documentos_ids?: string[];
  validade_dias?: number;
  mensagem?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cabecalhosCors(req) });
  if (req.method !== "POST") return erro(req, "Método não permitido.", 405);

  const servico = clienteServico();
  const usuario = await usuarioAutenticado(req, servico);
  if (!usuario) return erro(req, "Sessão expirada. Entre novamente.", 401);

  let pedido: Pedido;
  try {
    pedido = await lerJson<Pedido>(req, 32 * 1024);
  } catch (e) {
    if (e instanceof ErroValidacao) return erro(req, e.message, e.status);
    return erro(req, "Dados inválidos.", 400);
  }

  if (pedido.acao === "criar_link") {
    const token = tokenAleatorio();
    const { data, error } = await servico.rpc("doc_criar_solicitacao", {
      p_ator: usuario.id,
      p: {
        token_hash: await sha256Hex(token),
        cliente_id: pedido.cliente_id ?? null,
        caso_id: pedido.caso_id ?? null,
        lead_id: pedido.lead_id ?? null,
        documentos_ids: Array.isArray(pedido.documentos_ids) ? pedido.documentos_ids.slice(0, 60) : [],
        validade_dias: Number(pedido.validade_dias ?? 7),
        mensagem: texto(pedido.mensagem, 1000),
      },
    });
    if (error) return respostaErroBanco(req, error, "crm-documentos:criar_link");
    const resultado = data as { id: string; expira_em: string };
    return json(req, {
      ok: true,
      id: resultado.id,
      expira_em: resultado.expira_em,
      url: `${urlBase(req)}/enviar-documentos#${token}`,
    });
  }

  if (pedido.acao === "revogar_link") {
    const { error } = await servico.rpc("doc_revogar_solicitacao", { p_ator: usuario.id, p_id: pedido.id ?? null });
    if (error) return respostaErroBanco(req, error, "crm-documentos:revogar_link");
    return json(req, { ok: true });
  }

  return erro(req, "Ação inválida.", 400);
});
