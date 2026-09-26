"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, ChevronLeft, Check, Calendar, Phone, AlertTriangle, RotateCcw } from "lucide-react";
import { QUIZ_STEPS } from "./steps";
import { classifyLead, buildObservacoes } from "./scoring";
import { LeadData, Classification } from "./types";
import LocationPicker from "./LocationPicker";
import { lerAtribuicao } from "@/components/Atribuicao";

const EMPTY_LEAD: Partial<LeadData> = {
  nome: "", whatsapp: "", email: "", estado: "", municipio: "",
  cultiva: "", consultaMedica: "", profissao: "", faixaRenda: "",
  motivacao: "", dataReuniao: "", horarioReuniao: "", aceitaAgenda: "",
  lgpd: false, score: 0, temperatura: null,
};

// Texto e versão do consentimento exibidos no formulário (registrados no CRM).
const TEXTO_LGPD = "Autorizo o uso dos dados informados para contato, análise inicial da demanda e registro interno, nos termos da LGPD.";
const VERSAO_LGPD = "2026-05-site";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const CRM_CONFIGURADO = Boolean(URL_SUPABASE && CHAVE_PUBLICA);
const CHAVE_SUBMISSAO = "amado.quiz.submissao";
const WHATSAPP_ESCRITORIO = "5548998003471";

// Mesmo identificador em todas as tentativas do mesmo envio: o servidor não
// duplica o lead se a primeira tentativa tiver chegado (ex.: queda de conexão).
function idSubmissao(): string {
  try {
    const existente = window.sessionStorage.getItem(CHAVE_SUBMISSAO);
    if (existente) return existente;
    const novo = crypto.randomUUID();
    window.sessionStorage.setItem(CHAVE_SUBMISSAO, novo);
    return novo;
  } catch {
    return crypto.randomUUID();
  }
}

function limparSubmissao() {
  try {
    window.sessionStorage.removeItem(CHAVE_SUBMISSAO);
  } catch {
    /* sem armazenamento */
  }
}

class ErroEnvio extends Error {
  constructor(mensagem: string, public corrigivel = false) {
    super(mensagem);
  }
}

export default function Quiz() {
  const [stepIndex, setStepIndex] = useState(0);
  const [historico, setHistorico] = useState<number[]>([]);
  const [direction, setDirection] = useState(1);
  const [lead, setLead] = useState<Partial<LeadData>>(EMPTY_LEAD);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  // Pontos por etapa: voltar e responder de novo substitui a pontuação anterior.
  const [pontos, setPontos] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lgpd, setLgpd] = useState(false);
  const [location, setLocation] = useState({ estado: "", municipio: "" });
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const iniciadoEm = useRef(new Date().toISOString());

  const step = QUIZ_STEPS[stepIndex];
  const somaPontos = (mapa: Record<string, number>) => Object.values(mapa).reduce((t, n) => t + n, 0);

  const irPara = (proximo: number) => {
    setDirection(1);
    setHistorico((h) => [...h, stepIndex]);
    setStepIndex(proximo);
  };

  const goBack = () => {
    if (historico.length === 0) return;
    setDirection(-1);
    setStepIndex(historico[historico.length - 1]);
    setHistorico((h) => h.slice(0, -1));
    setErroEnvio(null);
  };

  const handleOptionClick = (optionIndex: number) => {
    const opt = step.options![optionIndex];
    const fieldMap: Partial<LeadData> = {};

    if (step.id === "cultiva") fieldMap.cultiva = opt.label;
    if (step.id === "consulta") fieldMap.consultaMedica = opt.label;
    if (step.id === "faixaRenda") fieldMap.faixaRenda = opt.label;
    if (step.id === "motivacao") fieldMap.motivacao = opt.label;
    if (step.id === "agenda") fieldMap.aceitaAgenda = opt.label;
    if (step.id === "datetime") fieldMap.horarioReuniao = opt.label;

    const novasRespostas = { ...respostas, [step.id]: opt.label };
    const novosPontos = { ...pontos, [step.id]: opt.score };

    // Sem agendamento: pula a escolha de horário e descarta uma escolha anterior.
    if (step.id === "agenda" && opt.nextStep === "contact") {
      delete novasRespostas.datetime;
      delete novosPontos.datetime;
      fieldMap.horarioReuniao = "";
      setRespostas(novasRespostas);
      setPontos(novosPontos);
      setLead((l) => ({ ...l, ...fieldMap }));
      irPara(QUIZ_STEPS.findIndex((s) => s.id === "contact"));
      return;
    }

    setRespostas(novasRespostas);
    setPontos(novosPontos);
    setLead((l) => ({ ...l, ...fieldMap }));
    if (stepIndex < QUIZ_STEPS.length - 1) irPara(stepIndex + 1);
  };

  const handleTwoFields = () => {
    const updates: Partial<LeadData> = {};
    const novas = { ...respostas };
    if (step.id === "location") {
      updates.estado = location.estado;
      updates.municipio = location.municipio;
      novas.estado = location.estado;
      novas.municipio = location.municipio;
    }
    if (step.id === "renda") {
      if (!formRef.current) return;
      const fd = new FormData(formRef.current);
      updates.profissao = String(fd.get("profissao") ?? "").trim();
      novas.profissao = updates.profissao;
    }
    setRespostas(novas);
    setLead((l) => ({ ...l, ...updates }));
    irPara(stepIndex + 1);
  };

  const handleContact = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const nome = String(fd.get("nome") ?? "").trim().replace(/\s+/g, " ");
    const whatsapp = String(fd.get("whatsapp") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const digitos = whatsapp.replace(/\D/g, "").replace(/^0+/, "");
    if (nome.length < 2) return setErroEnvio("Informe o seu nome.");
    if (digitos.length < 10 || digitos.length > 13) return setErroEnvio("Informe um WhatsApp válido com DDD (ex.: 48 99999-9999).");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setErroEnvio("O e-mail informado parece incorreto.");
    if (!lgpd) return setErroEnvio("Para enviar, é necessário autorizar o uso dos dados conforme a LGPD.");
    handleSubmit({ ...lead, nome, whatsapp, email, lgpd }, String(fd.get("website") ?? ""));
  };

  const enviarParaCrm = async (finalLead: Partial<LeadData>, score: number, website: string, submissaoId: string) => {
    const atribuicao = lerAtribuicao();
    let resposta: Response;
    try {
      resposta = await fetch(`${URL_SUPABASE}/functions/v1/quiz-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: CHAVE_PUBLICA },
        body: JSON.stringify({
          submissao_id: submissaoId,
          respostas: {
            welcome: respostas.welcome ?? "",
            estado: finalLead.estado ?? "",
            municipio: finalLead.municipio ?? "",
            cultiva: respostas.cultiva ?? "",
            consulta: respostas.consulta ?? "",
            profissao: finalLead.profissao ?? "",
            faixaRenda: respostas.faixaRenda ?? "",
            motivacao: respostas.motivacao ?? "",
            agenda: respostas.agenda ?? "",
            datetime: respostas.datetime ?? "",
          },
          contato: { nome: finalLead.nome, whatsapp: finalLead.whatsapp, email: finalLead.email ?? "" },
          lgpd: { aceito: finalLead.lgpd === true, texto: TEXTO_LGPD, versao: VERSAO_LGPD },
          score,
          meta: {
            pagina: window.location.pathname,
            referrer: atribuicao.referrer ?? "",
            pagina_entrada: atribuicao.pagina_entrada ?? "",
            utm_source: atribuicao.utm_source ?? "",
            utm_medium: atribuicao.utm_medium ?? "",
            utm_campaign: atribuicao.utm_campaign ?? "",
            utm_term: atribuicao.utm_term ?? "",
            utm_content: atribuicao.utm_content ?? "",
            gclid: atribuicao.gclid ?? "",
            fbclid: atribuicao.fbclid ?? "",
            iniciado_em: iniciadoEm.current,
          },
          website,
        }),
      });
    } catch {
      throw new ErroEnvio("Não foi possível enviar agora. Verifique sua conexão e tente novamente — suas respostas continuam aqui.");
    }
    const json = (await resposta.json().catch(() => null)) as { ok?: boolean; erro?: string; protocolo?: string | null } | null;
    if (resposta.ok && json?.ok) return json.protocolo ?? null;
    if (resposta.status === 400 && json?.erro) throw new ErroEnvio(json.erro, true);
    if (resposta.status === 429) throw new ErroEnvio(json?.erro ?? "Recebemos muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.");
    throw new ErroEnvio("Nosso sistema não respondeu como esperado. Tente novamente em instantes — suas respostas continuam aqui.");
  };

  const handleSubmit = async (finalLead: Partial<LeadData>, website: string) => {
    setSubmitting(true);
    setErroEnvio(null);
    const finalScore = somaPontos(pontos);
    const temperatura = classifyLead(finalLead, finalScore);
    const observacoes = buildObservacoes(finalLead);
    const atribuicao = lerAtribuicao();
    const payload = { ...finalLead, score: finalScore, temperatura, observacoes, utmSource: atribuicao.utm_source, utmMedium: atribuicao.utm_medium, utmCampaign: atribuicao.utm_campaign };
    const submissaoId = idSubmissao();

    // Integração anterior (Monday), mantida como destino secundário: uma única
    // vez por envio, sem bloquear o visitante. Só recebe envios de pessoas
    // (o campo-armadilha para robôs precisa estar vazio).
    if (!website) {
      try {
        const chaveLegado = `amado.quiz.legado.${submissaoId}`;
        if (!window.sessionStorage.getItem(chaveLegado)) {
          window.sessionStorage.setItem(chaveLegado, "1");
          fetch("/api/quiz-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => undefined);
        }
      } catch {
        fetch("/api/quiz-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => undefined);
      }
    }

    if (CRM_CONFIGURADO) {
      try {
        setProtocolo(await enviarParaCrm(finalLead, finalScore, website, submissaoId));
        limparSubmissao();
      } catch (e) {
        setErroEnvio(e instanceof Error ? e.message : "Não foi possível enviar agora. Tente novamente.");
        setSubmitting(false);
        return;
      }
    }

    setLead(payload);
    setSubmitting(false);
    setDone(true);
  };

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  };

  if (done) {
    const temp = lead.temperatura as Classification;
    const hasSchedule = lead.aceitaAgenda === "Quero agendar agora";
    return (
      <div className="flex flex-col items-center text-center gap-6 py-8 px-4" role="status">
        <div className="w-14 h-14 rounded-full bg-[#263A2D] flex items-center justify-center">
          <Check className="text-white" size={28} />
        </div>
        <h3 className="font-serif text-2xl font-medium text-[#263A2D]">
          {hasSchedule ? `Temos um acordo, ${lead.nome?.split(" ")[0]}!` : "Recebemos suas informações."}
        </h3>
        <p className="text-zinc-600 text-sm max-w-xs leading-relaxed">
          {hasSchedule
            ? `Sua preferência de horário foi registrada: ${lead.horarioReuniao}. Nossa equipe confirmará pelo WhatsApp em breve.`
            : "Nossa equipe analisará os dados e poderá entrar em contato pelo WhatsApp."}
        </p>
        {protocolo && <p className="text-xs text-zinc-500">Protocolo do seu atendimento: <strong className="text-[#263A2D]">{protocolo}</strong></p>}
        {temp === "hot" && (
          <a
            href={`https://wa.me/${WHATSAPP_ESCRITORIO}?text=${encodeURIComponent(`Olá, fiz o quiz no site e gostaria de confirmar meu atendimento. Meu nome é ${lead.nome || ""}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#263A2D] text-white text-sm font-bold uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <Phone size={14} />
            Confirmar pelo WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Progress bar — 3D green, centered */}
      <div className="mx-auto w-full max-w-md mb-10">
        <div className="relative h-5 w-full rounded-full bg-zinc-200 shadow-[inset_0_2px_5px_rgba(0,0,0,0.2)] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-b from-[#3c5c47] via-[#2f4a38] to-[#1c2e22] shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_2px_5px_rgba(0,0,0,0.3)] transition-all duration-500 ease-out"
            style={{ width: `${((stepIndex + 1) / QUIZ_STEPS.length) * 100}%` }}
          >
            <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-white/25" />
          </div>
        </div>
        <p className="mt-2.5 text-center text-[11px] uppercase tracking-widest text-zinc-400 font-bold">
          {stepIndex + 1} de {QUIZ_STEPS.length}
        </p>
      </div>

      <div className="-mx-2 overflow-x-clip px-2 pb-2">
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step.id}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="w-full"
        >
          {/* Avatar + speech bubble */}
          <div className="mb-5 flex items-start gap-3 sm:gap-5">
            <div className="relative shrink-0 h-12 w-12 sm:h-20 sm:w-20 overflow-hidden rounded-full bg-[#f0f5f1] ring-2 ring-[#263A2D]/10">
              <Image
                src="/assets/amado-icon.png"
                alt="Advogado Amado"
                fill
                sizes="(max-width: 640px) 48px, 80px"
                className="object-cover"
                priority
              />
            </div>
            <div className="relative flex-1 rounded-2xl rounded-tl-sm bg-[#f0f5f1] border-2 border-[#263A2D]/10 px-4 py-3.5 sm:px-6 sm:py-5">
              {/* tail pointing to avatar */}
              <span className="absolute -left-[9px] top-4 sm:top-5 h-4 w-4 rotate-45 bg-[#f0f5f1] border-l-2 border-b-2 border-[#263A2D]/10" />
              <h3 className="font-serif text-lg sm:text-xl md:text-2xl font-medium text-[#263A2D] leading-snug">
                {step.question}
              </h3>
            </div>
          </div>

          {/* Extra comment / instruction — outside, below bubble */}
          {step.subtitle && (
            <div className="mb-6 border-l-[3px] border-[#263A2D]/30 pl-4">
              <p className="text-sm sm:text-[15px] text-zinc-600 leading-relaxed [&_strong]:font-semibold [&_strong]:text-[#263A2D]">
                {step.subtitle}
              </p>
            </div>
          )}

          {/* Single choice */}
          {step.type === "single_choice" && step.options && (
            <div className="flex flex-col gap-3">
              {step.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleOptionClick(i)}
                  aria-pressed={respostas[step.id] === opt.label}
                  className={`w-full text-left px-5 py-4 rounded-2xl border-2 bg-white hover:border-[#263A2D] hover:bg-[#f0f5f1] transition-all duration-150 text-sm font-medium text-zinc-700 flex items-center justify-between group ${respostas[step.id] === opt.label ? "border-[#263A2D]" : "border-zinc-200"}`}
                >
                  <span>{opt.label}</span>
                  <ChevronRight size={16} className="text-zinc-300 group-hover:text-[#263A2D] transition-colors" />
                </button>
              ))}
            </div>
          )}

          {/* Two fields */}
          {step.type === "two_fields" && (
            <form ref={formRef} onSubmit={(e) => { e.preventDefault(); handleTwoFields(); }} className="flex flex-col gap-4">
              {step.id === "location" ? (
                <LocationPicker onChange={setLocation} />
              ) : (
                step.fields?.map((f) => (
                  <input
                    key={f.name}
                    name={f.name}
                    type={f.type || "text"}
                    placeholder={f.placeholder}
                    aria-label={f.placeholder}
                    defaultValue={respostas[f.name] ?? ""}
                    required
                    maxLength={120}
                    className="w-full px-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-700 focus:border-[#263A2D] outline-none transition-colors"
                  />
                ))
              )}
              <button
                type="submit"
                disabled={step.id === "location" && (!location.estado || !location.municipio)}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#263A2D] text-white text-sm font-bold uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                Continuar <ChevronRight size={14} />
              </button>
            </form>
          )}

          {/* Contact */}
          {step.type === "contact" && (
            <form ref={formRef} onSubmit={(e) => { e.preventDefault(); handleContact(); }} className="flex flex-col gap-4" noValidate>
              {step.fields?.map((f) => (
                <input
                  key={f.name}
                  name={f.name}
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  aria-label={f.placeholder}
                  defaultValue={(lead[f.name as keyof LeadData] as string | undefined) ?? ""}
                  required={f.name !== "email"}
                  maxLength={f.name === "email" ? 160 : 120}
                  autoComplete={f.name === "nome" ? "name" : f.name === "whatsapp" ? "tel" : "email"}
                  className="w-full px-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-700 focus:border-[#263A2D] outline-none transition-colors"
                />
              ))}
              {/* Campo-armadilha para robôs: invisível para pessoas e leitores de tela. */}
              <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                <label>
                  Site
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
                </label>
              </div>
              <label className="flex items-start gap-3 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={lgpd}
                  onChange={(e) => setLgpd(e.target.checked)}
                  required
                  className="mt-0.5 accent-[#263A2D] w-4 h-4 flex-shrink-0"
                />
                <span className="text-xs text-zinc-500 leading-relaxed">{TEXTO_LGPD}</span>
              </label>
              {erroEnvio && (
                <div role="alert" className="flex flex-col gap-2 rounded-xl border-2 border-[#B42318]/40 bg-[#FDECEA] px-4 py-3 text-left text-sm text-[#8A1C12]">
                  <p className="flex items-start gap-2 font-semibold">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                    {erroEnvio}
                  </p>
                  <a
                    href={`https://wa.me/${WHATSAPP_ESCRITORIO}?text=${encodeURIComponent("Olá, tentei enviar o quiz do site e não consegui. Gostaria de atendimento.")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#263A2D] underline"
                  >
                    Se preferir, fale com a equipe pelo WhatsApp
                  </a>
                </div>
              )}
              <button
                type="submit"
                disabled={submitting || !lgpd}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#263A2D] text-white text-sm font-bold uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0"
              >
                {submitting ? "Enviando..." : erroEnvio ? (<><RotateCcw size={14} /> Tentar novamente</>) : (<><Calendar size={14} /> Enviar e confirmar</>)}
              </button>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
      </div>

      {/* Back button */}
      {historico.length > 0 && !done && (
        <button
          onClick={goBack}
          disabled={submitting}
          className="flex items-center gap-1 mt-6 text-xs text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50"
        >
          <ChevronLeft size={14} /> Voltar
        </button>
      )}
    </div>
  );
}
