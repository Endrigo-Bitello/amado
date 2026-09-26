// Portal público de envio de documentos pelo cliente.
// Acesso por link individual, com token aleatório (apenas o hash fica no banco),
// validade limitada e possibilidade de revogação. O cliente enxerga somente os
// documentos incluídos no link — nunca fichas internas ou dados de terceiros.

import {
  cabecalhosCors,
  erro,
  ErroValidacao,
  hashIp,
  json,
  lerJson,
  nomeArquivoSeguro,
  origemPermitida,
  sha256Hex,
  texto,
  TIPOS_ARQUIVO_DOCUMENTO,
} from "../_shared/http.ts";
import { clienteServico, dentroDoLimite } from "../_shared/supabase.ts";

const TOKEN = /^[A-Za-z0-9_-]{40,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "crm-documentos";

const MENSAGENS: Record<string, [number, string]> = {
  "portal:invalido": [404, "Link inválido. Confira se o endereço está completo ou peça um novo link ao escritório."],
  "portal:revogado": [410, "Este link foi desativado pelo escritório. Solicite um novo link à equipe."],
  "portal:expirado": [410, "Este link expirou. Solicite um novo link à equipe do escritório."],
  "portal:documento": [400, "Este documento não aceita novos envios por este link."],
  "portal:limite": [429, "Limite de envios para este documento atingido. Fale com a equipe do escritório."],
  "portal:caminho": [400, "Envio inválido. Tente novamente."],
};

function erroPortal(req: Request, mensagemBanco: string | undefined, contexto: string): Response {
  const chave = Object.keys(MENSAGENS).find((k) => mensagemBanco?.includes(k));
  if (chave) {
    const [status, mensagem] = MENSAGENS[chave];
    return erro(req, mensagem, status, chave);
  }
  console.error(`[portal-cliente] falha em ${contexto}`);
  return erro(req, "Não foi possível concluir agora. Tente novamente em instantes.", 500);
}

interface Pedido {
  acao?: string;
  token?: string;
  documento_id?: string;
  arquivo?: { nome?: string; tipo?: string; tamanho?: number };
  caminho?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cabecalhosCors(req) });
  if (req.method !== "POST") return erro(req, "Método não permitido.", 405);
  if (!origemPermitida(req)) return erro(req, "Origem não autorizada.", 403);

  let pedido: Pedido;
  try {
    pedido = await lerJson<Pedido>(req, 8 * 1024);
  } catch (e) {
    if (e instanceof ErroValidacao) return erro(req, e.message, e.status);
    return erro(req, "Dados inválidos.", 400);
  }

  const token = texto(pedido.token, 80);
  if (!TOKEN.test(token)) return erro(req, MENSAGENS["portal:invalido"][1], 404, "portal:invalido");

  const servico = clienteServico();
  const tokenHash = await sha256Hex(token);
  const ipHash = await hashIp(req);
  const permitido =
    (await dentroDoLimite(servico, `portal:ip:${ipHash}`, 240, 3_600)) &&
    (await dentroDoLimite(servico, `portal:token:${tokenHash.slice(0, 32)}`, 300, 3_600));
  if (!permitido) return erro(req, "Muitas tentativas em pouco tempo. Aguarde alguns minutos.", 429);

  const acao = texto(pedido.acao, 20);

  if (acao === "abrir") {
    const { data, error } = await servico.rpc("portal_abrir", { p_token_hash: tokenHash });
    if (error) return erroPortal(req, error.message, "abrir");
    const { data: cfg } = await servico
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", ["textos", "portal"]);
    const textos = (cfg?.find((c) => c.chave === "textos")?.valor ?? {}) as Record<string, string>;
    const portal = (cfg?.find((c) => c.chave === "portal")?.valor ?? {}) as Record<string, number>;
    return json(req, {
      ok: true,
      ...(data as Record<string, unknown>),
      textos: {
        titulo: textos.portal_titulo ?? "Envio seguro de documentos",
        instrucoes: textos.portal_instrucoes ?? "",
        rodape: textos.portal_rodape ?? "",
      },
      tamanho_maximo_mb: Math.min(Number(portal.tamanho_maximo_mb ?? 25), 50),
    });
  }

  const documentoId = texto(pedido.documento_id, 40);
  if (!UUID.test(documentoId)) return erro(req, "Documento inválido.", 400);

  if (acao === "preparar") {
    const nome = texto(pedido.arquivo?.nome, 200);
    const tipo = texto(pedido.arquivo?.tipo, 120).toLowerCase();
    const tamanho = Number(pedido.arquivo?.tamanho ?? 0);
    const { data: cfg } = await servico.from("configuracoes").select("valor").eq("chave", "portal").maybeSingle();
    const limiteMb = Math.min(Number((cfg?.valor as Record<string, number> | undefined)?.tamanho_maximo_mb ?? 25), 50);
    if (!nome) return erro(req, "Arquivo sem nome.", 400);
    if (!TIPOS_ARQUIVO_DOCUMENTO.has(tipo)) {
      return erro(req, "Formato não aceito. Envie PDF, foto (JPG, PNG, HEIC) ou vídeo (MP4, MOV).", 415);
    }
    if (!Number.isFinite(tamanho) || tamanho <= 0) return erro(req, "Arquivo vazio.", 400);
    if (tamanho > limiteMb * 1024 * 1024) return erro(req, `O arquivo excede o limite de ${limiteMb} MB.`, 413);

    const { data, error } = await servico.rpc("portal_preparar_envio", {
      p_token_hash: tokenHash,
      p_documento: documentoId,
    });
    if (error) return erroPortal(req, error.message, "preparar");
    const info = data as { solicitacao_id: string; documento_id: string };
    const caminho = `portal/${info.solicitacao_id}/${info.documento_id}/${crypto.randomUUID()}-${nomeArquivoSeguro(nome)}`;
    const { data: assinado, error: erroAssinatura } = await servico.storage.from(BUCKET).createSignedUploadUrl(caminho);
    if (erroAssinatura || !assinado) return erroPortal(req, undefined, "assinatura");
    return json(req, { ok: true, caminho, token_envio: assinado.token, url_envio: assinado.signedUrl });
  }

  if (acao === "confirmar") {
    const caminho = texto(pedido.caminho, 400);
    if (!caminho.startsWith("portal/")) return erro(req, MENSAGENS["portal:caminho"][1], 400);
    const { data: meta, error: erroInfo } = await servico.storage.from(BUCKET).info(caminho);
    if (erroInfo || !meta) return erro(req, "O arquivo ainda não foi recebido. Tente enviar novamente.", 409);
    const nomeOriginal = texto(pedido.arquivo?.nome, 200) || caminho.split("/").pop() || "arquivo";
    const { data, error } = await servico.rpc("portal_registrar_envio", {
      p_token_hash: tokenHash,
      p_documento: documentoId,
      p_caminho: caminho,
      p_nome: nomeOriginal,
      p_mime: (meta as { contentType?: string }).contentType ?? texto(pedido.arquivo?.tipo, 120),
      p_tamanho: (meta as { size?: number }).size ?? null,
    });
    if (error) return erroPortal(req, error.message, "confirmar");
    return json(req, { ok: true, ...(data as Record<string, unknown>) });
  }

  return erro(req, "Ação inválida.", 400);
});
