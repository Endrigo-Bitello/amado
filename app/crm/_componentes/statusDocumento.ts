export const STATUS_DOCUMENTO: { valor: string; rotulo: string; cor: string; descricao: string }[] = [
  { valor: "nao_solicitado", rotulo: "Não solicitado", cor: "#A1A1AA", descricao: "Ainda não foi pedido ao cliente." },
  { valor: "solicitado", rotulo: "Solicitado", cor: "#C9822B", descricao: "Pedido ao cliente, aguardando envio." },
  { valor: "recebido", rotulo: "Recebido", cor: "#3E5C8A", descricao: "Arquivo recebido, aguardando revisão." },
  { valor: "em_revisao", rotulo: "Em revisão", cor: "#6D5BA6", descricao: "Em análise pela equipe." },
  { valor: "aprovado", rotulo: "Aprovado", cor: "#3D7B3E", descricao: "Conferido e aprovado." },
  { valor: "rejeitado", rotulo: "Rejeitado", cor: "#8E2C3D", descricao: "Precisa ser reenviado (exige motivo)." },
  { valor: "dispensado", rotulo: "Dispensado", cor: "#52525B", descricao: "Não exigido neste caso (exige motivo)." },
];

export function contarDocumentos(docs: { obrigatorio: boolean; status: string }[]) {
  const exigidos = docs.filter((d) => d.obrigatorio && d.status !== "dispensado");
  return {
    total: docs.length,
    exigidos: exigidos.length,
    recebidos: docs.filter((d) => ["recebido", "em_revisao", "aprovado"].includes(d.status)).length,
    aprovados: docs.filter((d) => d.status === "aprovado").length,
    faltantes: exigidos.filter((d) => ["nao_solicitado", "solicitado", "rejeitado"].includes(d.status)).length,
    aRevisar: docs.filter((d) => ["recebido", "em_revisao"].includes(d.status)).length,
    aprovadosExigidos: exigidos.filter((d) => d.status === "aprovado").length,
  };
}
