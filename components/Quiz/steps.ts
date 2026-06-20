import { QuizStep } from "./types";

export const QUIZ_STEPS: QuizStep[] = [
  {
    id: "welcome",
    question: "Olá! Vamos entender melhor o seu caso.",
    subtitle: "Somos a equipe do Amado & Amado Jr. Advogados. Atuamos com Direito Cannábico e Habeas Corpus para cultivo medicinal. Responda algumas perguntas para direcionarmos seu atendimento.",
    type: "single_choice",
    options: [
      { label: "Quero mais informações sobre como cultivar cannabis legalmente", score: 0, signal: "warm" }
    ],
    internal_purpose: "Entrada e consentimento de início"
  },
  {
    id: "location",
    question: "De onde você está falando?",
    subtitle: "Isso nos ajuda a entender sua região e os casos que já atendemos por aí.",
    type: "two_fields",
    fields: [
      { name: "estado", placeholder: "Estado (ex: SP, RJ, MG...)" },
      { name: "municipio", placeholder: "Cidade" }
    ],
    internal_purpose: "Segmentação geográfica para prova social local"
  },
  {
    id: "cultiva",
    question: "Você já cultiva cannabis atualmente?",
    type: "single_choice",
    options: [
      { label: "Sim, já cultivo", score: 3, signal: "hot" },
      { label: "Não, ainda não cultivo", score: 1, signal: "warm" }
    ],
    internal_purpose: "Urgência e risco jurídico imediato — quem já cultiva tem prioridade"
  },
  {
    id: "consulta",
    question: "Você já passou por consulta médica relacionada ao uso medicinal da cannabis?",
    type: "single_choice",
    options: [
      { label: "Sim, já tenho acompanhamento médico", score: 3, signal: "hot" },
      { label: "Não, ainda não fiz consulta", score: 1, signal: "warm" }
    ],
    internal_purpose: "Qualifica maturidade do processo — quem tem prescrição converte mais"
  },
  {
    id: "renda",
    question: "Qual é a sua profissão?",
    subtitle: "Usamos essa informação apenas para entender melhor o seu perfil e adequar o atendimento.",
    type: "two_fields",
    fields: [
      { name: "profissao", placeholder: "Sua profissão" }
    ],
    internal_purpose: "Coleta profissão — faixa de renda no passo seguinte"
  },
  {
    id: "faixaRenda",
    question: "Qual é a sua faixa de renda mensal aproximada?",
    type: "single_choice",
    options: [
      { label: "Acima de R$ 7.000", score: 3, signal: "hot" },
      { label: "Entre R$ 4.000 e R$ 7.000", score: 2, signal: "warm" },
      { label: "Abaixo de R$ 4.000", score: 1, signal: "warm" },
      { label: "Prefiro não informar", score: 0, signal: "cold" }
    ],
    internal_purpose: "Capacidade de investimento no processo jurídico"
  },
  {
    id: "motivacao",
    question: "Qual é a sua maior motivação para buscar o Habeas Corpus e cultivar com segurança jurídica?",
    type: "single_choice",
    options: [
      { label: "Já cultivo e quero ficar seguro juridicamente", score: 3, signal: "hot" },
      { label: "Tenho filhos e quero estar seguro", score: 3, signal: "hot" },
      { label: "Tenho medo de algum problema jurídico", score: 3, signal: "hot" },
      { label: "Quero iniciar um tratamento com segurança", score: 2, signal: "warm" },
      { label: "Quero entender se tenho direito", score: 1, signal: "warm" }
    ],
    internal_purpose: "Urgência emocional e intenção — define prioridade de atendimento"
  },
  {
    id: "agenda",
    question: "Qual é a sua disponibilidade para conversar com nossa equipe?",
    type: "single_choice",
    options: [
      { label: "Quero agendar agora", score: 3, signal: "hot", nextStep: "datetime" },
      { label: "Quero receber mais informações antes", score: 1, signal: "warm", nextStep: "contact" },
      { label: "Não quero agendar neste momento", score: 0, signal: "cold", nextStep: "contact" }
    ],
    internal_purpose: "Intenção de conversão — decisivo para classificação final"
  },
  {
    id: "datetime",
    question: "Ótimo! Escolha um dia e horário para a conversa.",
    subtitle: "Nossa equipe confirmará a disponibilidade pelo WhatsApp.",
    type: "single_choice",
    options: [
      { label: "Segunda a sexta, manhã (8h–12h)", score: 0, signal: "hot" },
      { label: "Segunda a sexta, tarde (13h–18h)", score: 0, signal: "hot" },
      { label: "Sábado, manhã (9h–12h)", score: 0, signal: "hot" }
    ],
    internal_purpose: "Coleta preferência de horário para agendamento"
  },
  {
    id: "contact",
    question: "Para finalizar, informe seus dados de contato.",
    subtitle: "Seus dados são protegidos e usados apenas para este atendimento, conforme a LGPD.",
    type: "contact",
    fields: [
      { name: "nome", placeholder: "Nome completo" },
      { name: "whatsapp", placeholder: "WhatsApp com DDD (ex: 11 99999-9999)", type: "tel" },
      { name: "email", placeholder: "E-mail (opcional)", type: "email" }
    ],
    internal_purpose: "Coleta final de contato + consentimento LGPD"
  }
];
