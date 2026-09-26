// Mapeamento oficial do quiz do site (components/Quiz/steps.ts) para o banco.
// Ao alterar perguntas ou opções no site, atualize também este arquivo e rode
// `npm run verificar:quiz` (scripts/verificar-quiz.mjs) para conferir a paridade.
// Documentação do mapeamento: docs/CRM.md → "Quiz → banco de dados".

export const VERSAO_QUIZ = "2026-05-site";

export type Sinal = "hot" | "warm" | "cold";

export interface OpcaoQuiz {
  rotulo: string;
  pontos: number;
  sinal: Sinal;
}

export interface PerguntaQuiz {
  id: string;
  ordem: number;
  pergunta: string;
  // Coluna do lead que recebe a resposta (as respostas completas ficam em quiz_respostas).
  campo: string;
  tipo: "opcao" | "texto";
  opcoes?: OpcaoQuiz[];
}

export const PERGUNTAS: PerguntaQuiz[] = [
  {
    id: "welcome",
    ordem: 1,
    pergunta: "Olá! Vamos entender melhor o seu caso.",
    campo: "quiz_interesse",
    tipo: "opcao",
    opcoes: [{ rotulo: "Quero mais informações sobre como cultivar cannabis legalmente", pontos: 0, sinal: "warm" }],
  },
  { id: "location.estado", ordem: 2, pergunta: "De onde você está falando? (Estado)", campo: "estado", tipo: "texto" },
  { id: "location.municipio", ordem: 3, pergunta: "De onde você está falando? (Cidade)", campo: "municipio", tipo: "texto" },
  {
    id: "cultiva",
    ordem: 4,
    pergunta: "Você já cultiva cannabis atualmente?",
    campo: "quiz_cultiva",
    tipo: "opcao",
    opcoes: [
      { rotulo: "Sim, já cultivo", pontos: 3, sinal: "hot" },
      { rotulo: "Não, ainda não cultivo", pontos: 1, sinal: "warm" },
    ],
  },
  {
    id: "consulta",
    ordem: 5,
    pergunta: "Você já passou por consulta médica relacionada ao uso medicinal da cannabis?",
    campo: "quiz_consulta_medica",
    tipo: "opcao",
    opcoes: [
      { rotulo: "Sim, já tenho acompanhamento médico", pontos: 3, sinal: "hot" },
      { rotulo: "Não, ainda não fiz consulta", pontos: 1, sinal: "warm" },
    ],
  },
  { id: "renda", ordem: 6, pergunta: "Qual é a sua profissão?", campo: "profissao", tipo: "texto" },
  {
    id: "faixaRenda",
    ordem: 7,
    pergunta: "Qual é a sua faixa de renda mensal aproximada?",
    campo: "faixa_renda",
    tipo: "opcao",
    opcoes: [
      { rotulo: "Acima de R$ 7.000", pontos: 3, sinal: "hot" },
      { rotulo: "Entre R$ 4.000 e R$ 7.000", pontos: 2, sinal: "warm" },
      { rotulo: "Abaixo de R$ 4.000", pontos: 1, sinal: "warm" },
      { rotulo: "Prefiro não informar", pontos: 0, sinal: "cold" },
    ],
  },
  {
    id: "motivacao",
    ordem: 8,
    pergunta: "Qual é a sua maior motivação para buscar o Habeas Corpus e cultivar com segurança jurídica?",
    campo: "quiz_motivacao",
    tipo: "opcao",
    opcoes: [
      { rotulo: "Já cultivo e quero ficar seguro juridicamente", pontos: 3, sinal: "hot" },
      { rotulo: "Tenho filhos e quero estar seguro", pontos: 3, sinal: "hot" },
      { rotulo: "Tenho medo de algum problema jurídico", pontos: 3, sinal: "hot" },
      { rotulo: "Quero iniciar um tratamento com segurança", pontos: 2, sinal: "warm" },
      { rotulo: "Quero entender se tenho direito", pontos: 1, sinal: "warm" },
    ],
  },
  {
    id: "agenda",
    ordem: 9,
    pergunta: "Qual é a sua disponibilidade para conversar com nossa equipe?",
    campo: "quiz_agenda",
    tipo: "opcao",
    opcoes: [
      { rotulo: "Quero agendar agora", pontos: 3, sinal: "hot" },
      { rotulo: "Quero receber mais informações antes", pontos: 1, sinal: "warm" },
      { rotulo: "Não quero agendar neste momento", pontos: 0, sinal: "cold" },
    ],
  },
  {
    id: "datetime",
    ordem: 10,
    pergunta: "Ótimo! Escolha um dia e horário para a conversa.",
    campo: "quiz_horario",
    tipo: "opcao",
    opcoes: [
      { rotulo: "Segunda a sexta, manhã (8h–12h)", pontos: 0, sinal: "hot" },
      { rotulo: "Segunda a sexta, tarde (13h–18h)", pontos: 0, sinal: "hot" },
      { rotulo: "Sábado, manhã (9h–12h)", pontos: 0, sinal: "hot" },
    ],
  },
  { id: "contact.nome", ordem: 11, pergunta: "Nome completo", campo: "nome", tipo: "texto" },
  { id: "contact.whatsapp", ordem: 12, pergunta: "WhatsApp com DDD", campo: "whatsapp", tipo: "texto" },
  { id: "contact.email", ordem: 13, pergunta: "E-mail (opcional)", campo: "email", tipo: "texto" },
];

export const TEXTO_LGPD_PADRAO =
  "Autorizo o uso dos dados informados para contato, análise inicial da demanda e registro interno, nos termos da LGPD.";

export interface RespostasQuiz {
  welcome?: string;
  estado?: string;
  municipio?: string;
  cultiva?: string;
  consulta?: string;
  profissao?: string;
  faixaRenda?: string;
  motivacao?: string;
  agenda?: string;
  datetime?: string;
}

export interface ContatoQuiz {
  nome: string;
  whatsapp: string;
  email: string;
}

function opcao(perguntaId: string, rotulo: string | undefined): OpcaoQuiz | null {
  if (!rotulo) return null;
  const pergunta = PERGUNTAS.find((p) => p.id === perguntaId);
  return pergunta?.opcoes?.find((o) => o.rotulo === rotulo) ?? null;
}

// Mesma regra de components/Quiz/scoring.ts (pontuação recalculada no servidor).
export function calcularPontuacao(r: RespostasQuiz): number {
  const ids: (keyof RespostasQuiz)[] = ["cultiva", "consulta", "faixaRenda", "motivacao", "agenda"];
  return ids.reduce((total, id) => total + (opcao(id, r[id])?.pontos ?? 0), 0);
}

export function classificar(r: RespostasQuiz, contato: ContatoQuiz, pontuacao: number): Sinal {
  if (!contato.whatsapp) return "cold";
  if (r.agenda === "Não quero agendar neste momento") return "cold";
  if (
    r.cultiva === "Sim, já cultivo" &&
    r.consulta === "Sim, já tenho acompanhamento médico" &&
    r.faixaRenda === "Acima de R$ 7.000" &&
    r.agenda === "Quero agendar agora"
  ) {
    return "hot";
  }
  if (pontuacao >= 12) return "hot";
  if (pontuacao >= 6) return "warm";
  return "cold";
}

export function observacoes(r: RespostasQuiz, contato: ContatoQuiz): string {
  const obs: string[] = [];
  if (r.cultiva === "Sim, já cultivo") obs.push("Já cultiva — risco jurídico imediato.");
  if (r.consulta === "Sim, já tenho acompanhamento médico") obs.push("Tem acompanhamento médico.");
  if (r.agenda === "Quero agendar agora") obs.push("Aceitou agendar — alta intenção.");
  if (r.agenda === "Quero receber mais informações antes") obs.push("Quer material educativo antes de agendar.");
  if (!contato.whatsapp) obs.push("Não informou WhatsApp — não contatar.");
  return obs.join(" ");
}

export const TEMPERATURA: Record<Sinal, "quente" | "morno" | "frio"> = {
  hot: "quente",
  warm: "morno",
  cold: "frio",
};

// Linhas para quiz_respostas: uma por pergunta respondida, com o texto exibido.
export function linhasRespostas(r: RespostasQuiz, contato: ContatoQuiz) {
  const valores: Record<string, string | undefined> = {
    welcome: r.welcome,
    "location.estado": r.estado,
    "location.municipio": r.municipio,
    cultiva: r.cultiva,
    consulta: r.consulta,
    renda: r.profissao,
    faixaRenda: r.faixaRenda,
    motivacao: r.motivacao,
    agenda: r.agenda,
    datetime: r.agenda === "Quero agendar agora" ? r.datetime : undefined,
    "contact.nome": contato.nome,
    "contact.whatsapp": contato.whatsapp,
    "contact.email": contato.email,
  };
  return PERGUNTAS.filter((p) => valores[p.id]).map((p) => {
    const resposta = valores[p.id] ?? "";
    const op = p.tipo === "opcao" ? p.opcoes?.find((o) => o.rotulo === resposta) : undefined;
    return {
      ordem: p.ordem,
      pergunta_id: p.id,
      pergunta: p.pergunta,
      campo: p.campo,
      resposta,
      valor: resposta,
      pontuacao: p.tipo === "opcao" ? (op ? op.pontos : null) : null,
    };
  });
}

export function respostaReconhecida(perguntaId: string, rotulo: string | undefined): boolean {
  if (!rotulo) return true;
  return opcao(perguntaId, rotulo) !== null;
}
