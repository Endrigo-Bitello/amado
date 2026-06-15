export type Classification = "hot" | "warm" | "cold";

export interface QuizOption {
  label: string;
  score: number;
  signal: Classification;
  nextStep?: string;
}

export interface QuizStep {
  id: string;
  question: string;
  subtitle?: string;
  type: "single_choice" | "text" | "date" | "time" | "two_fields" | "contact";
  options?: QuizOption[];
  fields?: { name: string; placeholder: string; type?: string }[];
  internal_purpose: string;
}

export interface LeadData {
  nome: string;
  whatsapp: string;
  email: string;
  estado: string;
  municipio: string;
  cultiva: string;
  consultaMedica: string;
  profissao: string;
  faixaRenda: string;
  motivacao: string;
  dataReuniao: string;
  horarioReuniao: string;
  aceitaAgenda: string;
  lgpd: boolean;
  score: number;
  temperatura: Classification | null;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}
