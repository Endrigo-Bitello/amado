import { diaSemana, formatarData, lerYmd, somarDias } from "./datas";

// AUXÍLIO de contagem de prazos — NUNCA definitivo.
// O resultado é uma sugestão baseada nos parâmetros informados; regras
// específicas (prazos em dobro, processo penal, suspensões locais, calendário
// do tribunal, contagem a partir da publicação no DJe etc.) devem ser
// verificadas e o prazo confirmado por profissional habilitado.

export interface Feriado {
  data: string;
  descricao: string;
}

export interface ParametrosContagem {
  inicio: string; // data do evento que dispara a contagem (ex.: intimação, publicação)
  dias: number;
  tipo: "uteis" | "corridos";
  excluirInicio: boolean;
  considerarFeriados: boolean;
  considerarRecesso: boolean;
  recesso: { inicio: string; fim: string }; // "MM-DD"
  prorrogarFimNaoUtil: boolean;
}

export interface DiaIgnorado {
  data: string;
  motivo: string;
}

export interface ResultadoContagem {
  vencimento: string;
  diasContados: string[];
  ignorados: DiaIgnorado[];
  prorrogadoDe: string | null;
}

function emRecesso(data: string, recesso: { inicio: string; fim: string }): boolean {
  const mmdd = data.slice(5);
  // Recesso atravessa a virada do ano (ex.: 12-20 a 01-20).
  return recesso.inicio <= recesso.fim ? mmdd >= recesso.inicio && mmdd <= recesso.fim : mmdd >= recesso.inicio || mmdd <= recesso.fim;
}

function motivoNaoUtil(data: string, p: ParametrosContagem, feriados: Map<string, string>, apenasSuspensao = false): string | null {
  if (p.considerarRecesso && emRecesso(data, p.recesso)) return "recesso/suspensão de prazos";
  if (apenasSuspensao) return null;
  const ds = diaSemana(data);
  if (ds === 0) return "domingo";
  if (ds === 6) return "sábado";
  if (p.considerarFeriados && feriados.has(data)) return `feriado: ${feriados.get(data)}`;
  return null;
}

export function calcularPrazo(p: ParametrosContagem, listaFeriados: Feriado[]): ResultadoContagem {
  const feriados = new Map(listaFeriados.map((f) => [f.data, f.descricao]));
  const ignorados: DiaIgnorado[] = [];
  const diasContados: string[] = [];
  let atual = p.excluirInicio ? p.inicio : somarDias(p.inicio, -1);
  let guarda = 0;
  while (diasContados.length < p.dias && guarda < 2000) {
    guarda++;
    atual = somarDias(atual, 1);
    const motivo = motivoNaoUtil(atual, p, feriados, p.tipo === "corridos");
    if (motivo) {
      ignorados.push({ data: atual, motivo });
      continue;
    }
    diasContados.push(atual);
  }
  let vencimento = diasContados[diasContados.length - 1] ?? p.inicio;
  let prorrogadoDe: string | null = null;
  if (p.prorrogarFimNaoUtil) {
    let motivo = motivoNaoUtil(vencimento, p, feriados);
    while (motivo && guarda < 2400) {
      guarda++;
      if (!prorrogadoDe) prorrogadoDe = vencimento;
      ignorados.push({ data: vencimento, motivo: `${motivo} (vencimento prorrogado)` });
      vencimento = somarDias(vencimento, 1);
      motivo = motivoNaoUtil(vencimento, p, feriados);
    }
  }
  return { vencimento, diasContados, ignorados, prorrogadoDe };
}

export function descreverParametros(p: ParametrosContagem): string[] {
  const { ano } = lerYmd(p.inicio);
  return [
    `Data que dispara a contagem: ${formatarData(p.inicio)}`,
    `${p.dias} dia(s) ${p.tipo === "uteis" ? "úteis" : "corridos"}`,
    p.excluirInicio ? "Exclui o dia do começo e inclui o do vencimento" : "Inclui o dia do começo",
    p.considerarFeriados ? "Considera os feriados cadastrados no CRM (lista pode estar incompleta)" : "Não considera feriados",
    p.considerarRecesso ? `Considera suspensão de ${p.recesso.inicio.split("-").reverse().join("/")} a ${p.recesso.fim.split("-").reverse().join("/")} (ano ${ano})` : "Não considera recesso/suspensão",
    p.prorrogarFimNaoUtil ? "Prorroga o vencimento que cair em dia não útil para o próximo dia útil" : "Não prorroga o vencimento",
  ];
}
