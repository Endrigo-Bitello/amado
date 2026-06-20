"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, ChevronLeft, Check, Calendar, Phone } from "lucide-react";
import { QUIZ_STEPS } from "./steps";
import { classifyLead, buildObservacoes } from "./scoring";
import { LeadData, Classification } from "./types";
import LocationPicker from "./LocationPicker";

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
  const [location, setLocation] = useState({ estado: "", municipio: "" });
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
    const updates: Partial<LeadData> = {};
    if (step.id === "location") {
      updates.estado = location.estado;
      updates.municipio = location.municipio;
    }
    if (step.id === "renda") {
      if (!formRef.current) return;
      const fd = new FormData(formRef.current);
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
              {step.id === "location" ? (
                <LocationPicker onChange={setLocation} />
              ) : (
                step.fields?.map((f) => (
                  <input
                    key={f.name}
                    name={f.name}
                    type={f.type || "text"}
                    placeholder={f.placeholder}
                    required
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
      </div>

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
