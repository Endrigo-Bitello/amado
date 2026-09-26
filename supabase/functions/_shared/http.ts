// Utilitários HTTP comuns às Edge Functions do CRM.
// Nunca registrar dados pessoais em logs: apenas códigos e identificadores técnicos.

const origensConfiguradas = (Deno.env.get("CRM_ORIGENS_PERMITIDAS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function origemPermitida(req: Request): boolean {
  if (origensConfiguradas.length === 0) return true;
  const origem = req.headers.get("origin");
  // Chamadas sem Origin (ex.: servidor a servidor) são aceitas; navegadores sempre enviam.
  return !origem || origensConfiguradas.includes(origem);
}

export function cabecalhosCors(req: Request): Record<string, string> {
  const origem = req.headers.get("origin") ?? "";
  const permitido =
    origensConfiguradas.length === 0
      ? "*"
      : origensConfiguradas.includes(origem)
        ? origem
        : origensConfiguradas[0];
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(req: Request, corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      ...cabecalhosCors(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function erro(req: Request, mensagem: string, status = 400, codigo?: string): Response {
  return json(req, { ok: false, erro: mensagem, codigo }, status);
}

export class ErroValidacao extends Error {
  constructor(mensagem: string, public status = 400, public codigo?: string) {
    super(mensagem);
  }
}

type ErroBanco = { code?: string; message?: string } | null | undefined;

// Converte erros do Postgres/PostgREST em mensagens adequadas ao usuário.
// Mensagens levantadas pelas funções do banco (código P0001) já são escritas
// para o usuário final, em português.
export function respostaErroBanco(req: Request, e: ErroBanco, contexto: string): Response {
  const codigo = e?.code ?? "desconhecido";
  console.error(`[${contexto}] erro de banco: ${codigo}`);
  if (codigo === "42501") return erro(req, "Você não tem permissão para esta operação.", 403, codigo);
  if (codigo === "P0001" && e?.message) return erro(req, e.message, 400, codigo);
  if (codigo === "23505") return erro(req, "Já existe um registro com estes dados.", 409, codigo);
  if (codigo === "23514" || codigo === "22P02" || codigo === "22007" || codigo === "22008") {
    return erro(req, "Há dados em formato inválido. Revise os campos e tente novamente.", 400, codigo);
  }
  return erro(req, "Não foi possível concluir a operação agora. Tente novamente em instantes.", 500, codigo);
}

export async function lerJson<T>(req: Request, limiteBytes = 64 * 1024): Promise<T> {
  const tamanho = Number(req.headers.get("content-length") ?? "0");
  if (tamanho > limiteBytes) throw new ErroValidacao("Dados enviados excedem o tamanho permitido.", 413);
  const texto = await req.text();
  if (texto.length > limiteBytes) throw new ErroValidacao("Dados enviados excedem o tamanho permitido.", 413);
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new ErroValidacao("Formato de dados inválido.");
  }
}

export function texto(valor: unknown, max: number): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

export async function sha256Hex(valor: string): Promise<string> {
  const dados = new TextEncoder().encode(valor);
  const hash = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ipDaRequisicao(req: Request): string {
  const encaminhado = req.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "desconhecido";
}

// Hash do IP com "sal" secreto: permite limitar abuso sem armazenar o IP.
export async function hashIp(req: Request): Promise<string> {
  const sal = Deno.env.get("CRM_SAL_HASH") ?? "sal-local-desenvolvimento";
  return (await sha256Hex(`${sal}:${ipDaRequisicao(req)}`)).slice(0, 40);
}

export function nomeArquivoSeguro(nome: string): string {
  const semAcento = nome.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const limpo = semAcento.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "");
  return (limpo || "arquivo").slice(-120);
}

export const TIPOS_ARQUIVO_DOCUMENTO = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
]);

export const TIPOS_ARQUIVO_FINANCEIRO = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
