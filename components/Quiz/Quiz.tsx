"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, ChevronLeft, Check, Calendar, Phone } from "lucide-react";
import { QUIZ_STEPS } from "./steps";
import { classifyLead, buildObservacoes } from "./scoring";
import { LeadData, Classification } from "./types";

const EMPTY_LEAD: Partial<LeadData> = {
  nome: "", whatsapp: "", email: "", estado: "", municipio: "",
  cultiva: "", consultaMedica: "", profissao: "", faixaRenda: "",
  motivacao: "", dataReuniao: "", horarioReuniao: "", aceitaAgenda: "",
  lgpd: false, score: 0, temperatura: null,
};

const TEMP_LABELS: Record<Classification, string> = {
  hot: "Atendimento prioritário",
  warm: "Em qualificação",
  cold: "Nutrição",
};

export default function Quiz() {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [lead, setLead] = useState<Partial<LeadData>>(EMPTY_LEAD);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lgpd, setLgpd] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const step = QUIZ_STEPS[stepIndex];

  const goNext = (addScore = 0, fieldUpdates: Partial<LeadData> = {}) => {
    setDirection(1);
    setScore((s) => s + addScore);
    setLead((l) => ({ ...l, ...fieldUpdates }));
    if (stepIndex < QUIZ_STEPS.length - 1) setStepIndex((i) => i + 1);
    else handleSubmit({ ...lead, ...fieldUpdates }, score + addScore);
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    setDirection(-1);
    setStepIndex((i) => i - 1);
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
    if (step.id === "welcome") { goNext(0, fieldMap); return; }

    // skip datetime if not scheduling
    if (step.id === "agenda" && opt.nextStep === "contact") {
      setDirection(1);
      setScore((s) => s + opt.score);
      setLead((l) => ({ ...l, ...fieldMap }));
      const contactIdx = QUIZ_STEPS.findIndex((s) => s.id === "contact");
      setStepIndex(contactIdx);
      return;
    }

    goNext(opt.score, fieldMap);
  };

  const handleTwoFields = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const updates: Partial<LeadData> = {};
    if (step.id === "location") {
      updates.estado = fd.get("estado") as string;
      updates.municipio = fd.get("municipio") as string;
    }
    if (step.id === "renda") {
      updates.profissao = fd.get("profissao") as string;
    }
    goNext(0, updates);
  };

  const handleContact = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const updates: Partial<LeadData> = {
      nome: fd.get("nome") as string,
      whatsapp: fd.get("whatsapp") as string,
      email: fd.get("email") as string,
      lgpd,
    };
    handleSubmit({ ...lead, ...updates }, score);
  };

  const handleSubmit = async (finalLead: Partial<LeadData>, finalScore: number) => {
    setSubmitting(true);
    const temperatura = classifyLead(finalLead, finalScore);
    const observacoes = buildObservacoes(finalLead);
    const payload = { ...finalLead, score: finalScore, temperatura, observacoes };

    try {
      await fetch("/api/quiz-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (_) {}

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
      <div className="flex flex-col items-center text-center gap-6 py-8 px-4">
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
        {temp === "hot" && (
          <a
            href={`https://wa.me/5548998003471?text=Olá, fiz o quiz no site e gostaria de confirmar meu atendimento. Meu nome é ${encodeURIComponent(lead.nome || "")}.`}
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
    <div className="relative w-full overflow-hidden">
      {/* Progress bar */}
      <div className="w-full h-1 bg-zinc-200 rounded-full mb-8">
        <div
          className="h-1 bg-[#263A2D] rounded-full transition-all duration-500"
          style={{ width: `${((stepIndex + 1) / QUIZ_STEPS.length) * 100}%` }}
        />
      </div>

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
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-2">
              {stepIndex + 1} de {QUIZ_STEPS.length}
            </p>
            <h3 className="font-serif text-xl md:text-2xl font-medium text-[#263A2D] leading-snug mb-2">
              {step.question}
            </h3>
            {step.subtitle && (
              <p className="text-sm text-zinc-500 leading-relaxed">{step.subtitle}</p>
            )}
          </div>

          {/* Single choice */}
          {step.type === "single_choice" && step.options && (
            <div className="flex flex-col gap-3">
              {step.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleOptionClick(i)}
                  className="w-full text-left px-5 py-4 rounded-2xl border-2 border-zinc-200 bg-white hover:border-[#263A2D] hover:bg-[#f0f5f1] transition-all duration-150 text-sm font-medium text-zinc-700 flex items-center justify-between group"
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
              {step.fields?.map((f) => (
                <input
                  key={f.name}
                  name={f.name}
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-700 focus:border-[#263A2D] outline-none transition-colors"
                />
              ))}
              <button
                type="submit"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#263A2D] text-white text-sm font-bold uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all mt-2"
              >
                Continuar <ChevronRight size={14} />
              </button>
            </form>
          )}

          {/* Contact */}
          {step.type === "contact" && (
            <form ref={formRef} onSubmit={(e) => { e.preventDefault(); handleContact(); }} className="flex flex-col gap-4">
              {step.fields?.map((f) => (
                <input
                  key={f.name}
                  name={f.name}
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  required={f.name !== "email"}
                  className="w-full px-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-sm text-zinc-700 focus:border-[#263A2D] outline-none transition-colors"
                />
              ))}
              <label className="flex items-start gap-3 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={lgpd}
                  onChange={(e) => setLgpd(e.target.checked)}
                  required
                  className="mt-0.5 accent-[#263A2D] w-4 h-4 flex-shrink-0"
                />
                <span className="text-xs text-zinc-500 leading-relaxed">
                  Autorizo o uso dos dados informados para contato, análise inicial da demanda e registro interno, nos termos da LGPD.
                </span>
              </label>
              <button
                type="submit"
                disabled={submitting || !lgpd}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#263A2D] text-white text-sm font-bold uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0"
              >
                {submitting ? "Enviando..." : (<><Calendar size={14} /> Enviar e confirmar</>)}
              </button>
            </form>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Back button */}
      {stepIndex > 0 && !done && (
        <button
          onClick={goBack}
          className="flex items-center gap-1 mt-6 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <ChevronLeft size={14} /> Voltar
        </button>
      )}
    </div>
  );
}
