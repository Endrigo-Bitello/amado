// Operações financeiras (honorários, parcelas, pagamentos, reembolsos, custas e
// despesas). As tabelas financeiras não aceitam escrita direta do navegador:
// todo lançamento passa por aqui, com verificação de permissão no banco e
// registro de auditoria. Não há integração bancária, fiscal ou cobrança
// automática ativa.

import {
  cabecalhosCors,
  erro,
  ErroValidacao,
  json,
  lerJson,
  nomeArquivoSeguro,
  respostaErroBanco,
  texto,
  TIPOS_ARQUIVO_FINANCEIRO,
} from "../_shared/http.ts";
import { clienteServico, temPermissao, usuarioAutenticado } from "../_shared/supabase.ts";

const BUCKET = "crm-financeiro";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ação da interface → função de serviço no banco.
const RPCS: Record<string, string> = {
  criar_contrato: "fin_criar_contrato",
  atualizar_contrato: "fin_atualizar_contrato",
  adicionar_cobranca: "fin_adicionar_cobranca",
  editar_cobranca: "fin_editar_cobranca",
  cancelar_cobranca: "fin_cancelar_cobranca",
  registrar_pagamento: "fin_registrar_pagamento",
  estornar_pagamento: "fin_estornar_pagamento",
  registrar_reembolso: "fin_registrar_reembolso",
  registrar_despesa: "fin_registrar_despesa",
  cancelar_despesa: "fin_cancelar_despesa",
};

interface Pedido {
  acao?: string;
  dados?: Record<string, unknown>;
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
  const acao = texto(pedido.acao, 40);
  const dados = (pedido.dados ?? {}) as Record<string, unknown>;

  if (RPCS[acao]) {
    const { data, error } = await servico.rpc(RPCS[acao], { p_ator: usuario.id, p: dados });
    if (error) return respostaErroBanco(req, error, `crm-financeiro:${acao}`);
    return json(req, { ok: true, resultado: data ?? null });
  }

  const podeAnexar =
    (await temPermissao(servico, usuario.id, "financeiro.lancar")) ||
    (await temPermissao(servico, usuario.id, "financeiro.contratos"));

  if (acao === "preparar_comprovante") {
    if (!podeAnexar) return erro(req, "Você não tem permissão para anexar comprovantes.", 403);
    const clienteId = texto(dados.cliente_id, 40);
    const nome = texto(dados.nome, 200);
    const tipo = texto(dados.tipo, 120).toLowerCase();
    const tamanho = Number(dados.tamanho ?? 0);
    if (!UUID.test(clienteId)) return erro(req, "Cliente inválido.", 400);
    if (!TIPOS_ARQUIVO_FINANCEIRO.has(tipo)) return erro(req, "Envie o comprovante em PDF ou imagem.", 415);
    if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > 20 * 1024 * 1024) {
      return erro(req, "O comprovante deve ter até 20 MB.", 413);
    }
    const caminho = `financeiro/${clienteId}/${crypto.randomUUID()}-${nomeArquivoSeguro(nome)}`;
    const { data, error } = await servico.storage.from(BUCKET).createSignedUploadUrl(caminho);
    if (error || !data) return erro(req, "Não foi possível preparar o envio do comprovante.", 500);
    return json(req, { ok: true, caminho, token_envio: data.token });
  }

  if (acao === "confirmar_comprovante") {
    if (!podeAnexar) return erro(req, "Você não tem permissão para anexar comprovantes.", 403);
    const caminho = texto(dados.caminho, 400);
    const { data: meta, error: erroInfo } = await servico.storage.from(BUCKET).info(caminho);
    if (erroInfo || !meta) return erro(req, "O arquivo não foi recebido. Envie novamente.", 409);
    const { data, error } = await servico.rpc("fin_registrar_arquivo", {
      p_ator: usuario.id,
      p: {
        caminho,
        nome: texto(dados.nome, 200) || caminho.split("/").pop(),
        mime: (meta as { contentType?: string }).contentType ?? texto(dados.tipo, 120),
        tamanho: (meta as { size?: number }).size ?? null,
        cliente_id: texto(dados.cliente_id, 40),
        caso_id: texto(dados.caso_id, 40) || null,
        tipo: texto(dados.tipo_arquivo, 30) || "comprovante_financeiro",
      },
    });
    if (error) return respostaErroBanco(req, error, "crm-financeiro:confirmar_comprovante");
    return json(req, { ok: true, arquivo_id: data });
  }

  return erro(req, "Ação inválida.", 400);
});
