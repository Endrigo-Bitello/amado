// Entrada pública do quiz do site → CRM.
// Validação, prevenção de duplicidade (idempotência + detecção de lead aberto),
// proteção contra abuso (honeypot, tempo mínimo, limites por IP e telefone)
// e tratamento de falhas. Usa a service role apenas no servidor.

import {
  cabecalhosCors,
  erro,
  ErroValidacao,
  hashIp,
  json,
  lerJson,
  origemPermitida,
  respostaErroBanco,
  sha256Hex,
  texto,
} from "../_shared/http.ts";
import { clienteServico, dentroDoLimite } from "../_shared/supabase.ts";
import {
  calcularPontuacao,
  classificar,
  type ContatoQuiz,
  linhasRespostas,
  observacoes,
  respostaReconhecida,
  type RespostasQuiz,
  TEMPERATURA,
  TEXTO_LGPD_PADRAO,
  VERSAO_QUIZ,
} from "../_shared/quiz.ts";

interface Envio {
  submissao_id?: string;
  respostas?: Record<string, unknown>;
  contato?: Record<string, unknown>;
  lgpd?: { aceito?: unknown; texto?: unknown; versao?: unknown };
  score?: unknown;
  meta?: Record<string, unknown>;
  website?: unknown; // honeypot: humanos não preenchem
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR",
  "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

function validar(corpo: Envio) {
  const chave = texto(corpo.submissao_id, 40);
  if (!UUID.test(chave)) throw new ErroValidacao("Identificador de envio inválido. Atualize a página e tente novamente.");

  const c = corpo.contato ?? {};
  const contato: ContatoQuiz = {
    nome: texto(c.nome, 120).replace(/\s+/g, " "),
    whatsapp: texto(c.whatsapp, 30),
    email: texto(c.email, 160).toLowerCase(),
  };
  if (contato.nome.length < 2) throw new ErroValidacao("Informe o seu nome.");
  const digitos = contato.whatsapp.replace(/\D/g, "").replace(/^0+/, "");
  if (digitos.length < 10 || digitos.length > 13) {
    throw new ErroValidacao("Informe um WhatsApp válido com DDD (ex.: 48 99999-9999).");
  }
  if (contato.email && !EMAIL.test(contato.email)) throw new ErroValidacao("O e-mail informado parece incorreto.");

  if (corpo.lgpd?.aceito !== true) {
    throw new ErroValidacao("Para enviar, é necessário autorizar o uso dos dados conforme a LGPD.");
  }

  const r = corpo.respostas ?? {};
  const respostas: RespostasQuiz = {
    welcome: texto(r.welcome, 300) || undefined,
    estado: texto(r.estado, 2).toUpperCase() || undefined,
    municipio: texto(r.municipio, 120) || undefined,
    cultiva: texto(r.cultiva, 300) || undefined,
    consulta: texto(r.consulta, 300) || undefined,
    profissao: texto(r.profissao, 120) || undefined,
    faixaRenda: texto(r.faixaRenda, 300) || undefined,
    motivacao: texto(r.motivacao, 300) || undefined,
    agenda: texto(r.agenda, 300) || undefined,
    datetime: texto(r.datetime, 300) || undefined,
  };
  if (respostas.estado && !UFS.has(respostas.estado)) respostas.estado = undefined;

  const naoReconhecidas = (["welcome", "cultiva", "consulta", "faixaRenda", "motivacao", "agenda", "datetime"] as const)
    .filter((id) => !respostaReconhecida(id, respostas[id]));

  const m = corpo.meta ?? {};
  const meta = {
    pagina: texto(m.pagina, 300),
    referrer: texto(m.referrer, 300),
    utm_source: texto(m.utm_source, 150),
    utm_medium: texto(m.utm_medium, 150),
    utm_campaign: texto(m.utm_campaign, 150),
    utm_term: texto(m.utm_term, 150),
    utm_content: texto(m.utm_content, 150),
    gclid: texto(m.gclid, 200),
    fbclid: texto(m.fbclid, 200),
    iniciado_em: "",
    duracao_segundos: null as number | null,
  };
  const iniciado = Date.parse(texto(m.iniciado_em, 40));
  if (Number.isFinite(iniciado) && iniciado < Date.now() + 60_000) {
    meta.iniciado_em = new Date(iniciado).toISOString();
    meta.duracao_segundos = Math.max(0, Math.round((Date.now() - iniciado) / 1000));
  }

  const lgpdTexto = texto(corpo.lgpd?.texto, 2000) || TEXTO_LGPD_PADRAO;
  const lgpdVersao = texto(corpo.lgpd?.versao, 40) || VERSAO_QUIZ;
  const scoreInformado = Number.isFinite(Number(corpo.score)) ? Math.round(Number(corpo.score)) : null;

  return { chave, contato, respostas, meta, lgpdTexto, lgpdVersao, scoreInformado, naoReconhecidas };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cabecalhosCors(req) });
  if (req.method !== "POST") return erro(req, "Método não permitido.", 405);
  if (!origemPermitida(req)) return erro(req, "Origem não autorizada.", 403);

  let dados: ReturnType<typeof validar>;
  let corpo: Envio;
  try {
    corpo = await lerJson<Envio>(req, 32 * 1024);
    dados = validar(corpo);
  } catch (e) {
    if (e instanceof ErroValidacao) return erro(req, e.message, e.status);
    return erro(req, "Não foi possível ler os dados enviados.", 400);
  }

  const servico = clienteServico();
  const ipHash = await hashIp(req);
  const telefoneHash = (await sha256Hex(dados.contato.whatsapp.replace(/\D/g, ""))).slice(0, 32);

  // Proteção contra abuso -----------------------------------------------------
  const limitesOk =
    (await dentroDoLimite(servico, `quiz:ip:${ipHash}`, 8, 600)) &&
    (await dentroDoLimite(servico, `quiz:ip-dia:${ipHash}`, 40, 86_400)) &&
    (await dentroDoLimite(servico, `quiz:tel:${telefoneHash}`, 5, 3_600));
  if (!limitesOk) {
    return erro(req, "Recebemos muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.", 429);
  }

  let bloqueio: string | null = null;
  if (texto(corpo.website, 200) !== "") bloqueio = "honeypot";
  else if (dados.meta.duracao_segundos !== null && dados.meta.duracao_segundos < 4) bloqueio = "envio_rapido_demais";

  // Pontuação recalculada no servidor (não confia no navegador) --------------
  const pontuacao = calcularPontuacao(dados.respostas);
  const sinal = classificar(dados.respostas, dados.contato, pontuacao);
  const obs = [
    observacoes(dados.respostas, dados.contato),
    dados.naoReconhecidas.length > 0
      ? `Respostas não reconhecidas pelo mapeamento (${dados.naoReconhecidas.join(", ")}) — verificar versão do quiz.`
      : "",
  ].filter(Boolean).join(" ");

  const r = dados.respostas;
  const payload = {
    chave_idempotencia: dados.chave,
    bloqueio,
    contato: dados.contato,
    lead: {
      estado: r.estado ?? "",
      municipio: r.municipio ?? "",
      profissao: r.profissao ?? "",
      faixa_renda: r.faixaRenda ?? "",
      quiz_interesse: r.welcome ?? "",
      quiz_cultiva: r.cultiva ?? "",
      quiz_consulta_medica: r.consulta ?? "",
      quiz_motivacao: r.motivacao ?? "",
      quiz_agenda: r.agenda ?? "",
      quiz_horario: r.agenda === "Quero agendar agora" ? (r.datetime ?? "") : "",
    },
    respostas: linhasRespostas(r, dados.contato),
    respostas_brutas: { ...r, contato: dados.contato },
    score_informado: dados.scoreInformado,
    score_calculado: pontuacao,
    temperatura: TEMPERATURA[sinal],
    observacoes: obs,
    versao_quiz: VERSAO_QUIZ,
    meta: {
      ...dados.meta,
      user_agent: texto(req.headers.get("user-agent"), 300),
      ip_hash: ipHash,
    },
    consentimento: { concedido: true, texto: dados.lgpdTexto, versao: dados.lgpdVersao },
  };

  const { data, error } = await servico.rpc("quiz_registrar", { p: payload });
  if (error) return respostaErroBanco(req, error, "quiz-lead");

  const resultado = data as { ok: boolean; protocolo?: string; bloqueada?: boolean; duplicada?: boolean };
  // Para envios bloqueados a resposta é neutra (não orienta robôs).
  return json(req, { ok: true, protocolo: resultado.bloqueada ? null : resultado.protocolo ?? null });
});
