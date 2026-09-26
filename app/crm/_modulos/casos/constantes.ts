export const STATUS_CASO: Record<string, { rotulo: string; cor: string }> = {
  ativo: { rotulo: "Ativo", cor: "#3D7B3E" },
  suspenso: { rotulo: "Suspenso", cor: "#C9822B" },
  concluido: { rotulo: "Concluído", cor: "#52525B" },
};

export const SITUACAO_PROCESSO: Record<string, { rotulo: string; cor: string }> = {
  em_andamento: { rotulo: "Em andamento", cor: "#1F6E76" },
  suspenso: { rotulo: "Suspenso", cor: "#C9822B" },
  sentenciado: { rotulo: "Sentenciado", cor: "#6D5BA6" },
  transitado: { rotulo: "Transitado em julgado", cor: "#3D7B3E" },
  arquivado: { rotulo: "Arquivado", cor: "#52525B" },
};

export const STATUS_PRAZO: Record<string, { rotulo: string; cor: string }> = {
  pendente: { rotulo: "Pendente", cor: "#C9822B" },
  cumprido: { rotulo: "Cumprido", cor: "#3D7B3E" },
  cancelado: { rotulo: "Cancelado", cor: "#52525B" },
};
