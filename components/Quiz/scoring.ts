import { Classification, LeadData } from "./types";

export function classifyLead(data: Partial<LeadData>, score: number): Classification {
  // Regra especial: sem WhatsApp = frio
  if (!data.whatsapp) return "cold";

  // Regra especial: não quer agendar = frio
  if (data.aceitaAgenda === "Não quero agendar neste momento") return "cold";

  // Regra especial: quente garantido
  if (
    data.cultiva === "Sim, já cultivo" &&
    data.consultaMedica === "Sim, já tenho acompanhamento médico" &&
    data.faixaRenda === "Acima de R$ 7.000" &&
    data.aceitaAgenda === "Quero agendar agora"
  ) return "hot";

  if (score >= 12) return "hot";
  if (score >= 6) return "warm";
  return "cold";
}

export function buildObservacoes(data: Partial<LeadData>): string {
  const obs: string[] = [];
  if (data.cultiva === "Sim, já cultivo") obs.push("Já cultiva — risco jurídico imediato.");
  if (data.consultaMedica === "Sim, já tenho acompanhamento médico") obs.push("Tem acompanhamento médico.");
  if (data.aceitaAgenda === "Quero agendar agora") obs.push("Aceitou agendar — alta intenção.");
  if (data.aceitaAgenda === "Quero receber mais informações antes") obs.push("Quer material educativo antes de agendar.");
  if (!data.whatsapp) obs.push("Não informou WhatsApp — não contatar.");
  return obs.join(" ");
}
