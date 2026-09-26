import { TZDate } from "@date-fns/tz";

// Todas as datas do CRM são exibidas e interpretadas no fuso do escritório.
export const FUSO = "America/Sao_Paulo";

const fmtPartes = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

export interface PartesData {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  diaSemana: number; // 0 = domingo
}

const DIAS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function partesSP(valor: string | Date | number): PartesData {
  const data = valor instanceof Date ? valor : new Date(valor);
  const partes = Object.fromEntries(fmtPartes.formatToParts(data).map((p) => [p.type, p.value]));
  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
    diaSemana: DIAS_EN.indexOf(String(partes.weekday)),
  };
}

const dois = (n: number) => String(n).padStart(2, "0");

export function ymd(ano: number, mes: number, dia: number): string {
  return `${ano}-${dois(mes)}-${dois(dia)}`;
}

/** Data (AAAA-MM-DD) de um instante, no fuso de São Paulo. */
export function dataSP(valor: string | Date | number): string {
  const p = partesSP(valor);
  return ymd(p.ano, p.mes, p.dia);
}

export function horaSP(valor: string | Date | number): string {
  const p = partesSP(valor);
  return `${dois(p.hora)}:${dois(p.minuto)}`;
}

export function hojeSP(): string {
  return dataSP(new Date());
}

export function lerYmd(valor: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = valor.slice(0, 10).split("-").map(Number);
  return { ano, mes, dia };
}

/** Converte data + hora locais de São Paulo em instante ISO (UTC). */
export function instanteSP(data: string, hora = "00:00"): string {
  const { ano, mes, dia } = lerYmd(data);
  const [h, m] = hora.split(":").map(Number);
  return new TZDate(ano, mes - 1, dia, h || 0, m || 0, 0, 0, FUSO).toISOString();
}

export function inicioDiaSP(data: string): string {
  return instanteSP(data, "00:00");
}

export function fimDiaSP(data: string): string {
  const { ano, mes, dia } = lerYmd(data);
  return new TZDate(ano, mes - 1, dia, 23, 59, 59, 999, FUSO).toISOString();
}

export function somarDias(data: string, dias: number): string {
  const { ano, mes, dia } = lerYmd(data);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function somarMeses(data: string, meses: number): string {
  const { ano, mes, dia } = lerYmd(data);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return ymd(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, Math.min(dia, ultimo));
}

export function diferencaDias(de: string, ate: string): number {
  const a = lerYmd(de);
  const b = lerYmd(ate);
  return Math.round((Date.UTC(b.ano, b.mes - 1, b.dia) - Date.UTC(a.ano, a.mes - 1, a.dia)) / 86_400_000);
}

export function diaSemana(data: string): number {
  const { ano, mes, dia } = lerYmd(data);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

export function inicioSemana(data: string): string {
  return somarDias(data, -diaSemana(data));
}

export function inicioMes(data: string): string {
  const { ano, mes } = lerYmd(data);
  return ymd(ano, mes, 1);
}

export function fimMes(data: string): string {
  const { ano, mes } = lerYmd(data);
  return ymd(ano, mes, new Date(Date.UTC(ano, mes, 0)).getUTCDate());
}

/** Semanas (domingo a sábado) que cobrem o mês da data informada. */
export function semanasDoMes(data: string): string[][] {
  const primeiro = inicioSemana(inicioMes(data));
  const ultimo = fimMes(data);
  const semanas: string[][] = [];
  let atual = primeiro;
  while (atual <= ultimo || semanas.length < 5) {
    const semana: string[] = [];
    for (let i = 0; i < 7; i++) {
      semana.push(atual);
      atual = somarDias(atual, 1);
    }
    semanas.push(semana);
    if (atual > ultimo && semanas.length >= 5) break;
  }
  return semanas;
}

// ---------------------------------------------------------------------------
// Formatação (pt-BR, fuso de São Paulo)
// ---------------------------------------------------------------------------

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const fmtDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const fmtDataCurta = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "short" });
const fmtMesAno = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });
const fmtDiaLongo = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

const ehSomenteData = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export function formatarData(valor: string | null | undefined): string {
  if (!valor) return "";
  if (ehSomenteData(valor)) {
    const { ano, mes, dia } = lerYmd(valor);
    return `${dois(dia)}/${dois(mes)}/${ano}`;
  }
  return fmtData.format(new Date(valor));
}

export function formatarDataHora(valor: string | null | undefined): string {
  if (!valor) return "";
  if (ehSomenteData(valor)) return formatarData(valor);
  return fmtDataHora.format(new Date(valor)).replace(",", "");
}

export function formatarDataCurta(valor: string | null | undefined): string {
  if (!valor) return "";
  const data = ehSomenteData(valor) ? new Date(instanteSP(valor, "12:00")) : new Date(valor);
  return fmtDataCurta.format(data).replace(".", "");
}

export function formatarMesAno(data: string): string {
  const { ano, mes } = lerYmd(data);
  const texto = fmtMesAno.format(new Date(Date.UTC(ano, mes - 1, 1)));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatarDiaLongo(data: string): string {
  const { ano, mes, dia } = lerYmd(data);
  const texto = fmtDiaLongo.format(new Date(Date.UTC(ano, mes - 1, dia)));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export const NOMES_DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "há 5 min", "há 3 h", "ontem", "há 4 dias", "em 2 dias". */
export function formatarRelativo(valor: string | null | undefined): string {
  if (!valor) return "";
  const agora = Date.now();
  const alvo = new Date(ehSomenteData(valor) ? instanteSP(valor, "12:00") : valor).getTime();
  const diffMin = Math.round((alvo - agora) / 60_000);
  const abs = Math.abs(diffMin);
  const futuro = diffMin > 0;
  if (abs < 1) return "agora";
  if (abs < 60) return futuro ? `em ${abs} min` : `há ${abs} min`;
  const horas = Math.round(abs / 60);
  if (horas < 24 && dataSP(alvo) === hojeSP()) return futuro ? `em ${horas} h` : `há ${horas} h`;
  const dias = diferencaDias(hojeSP(), dataSP(alvo));
  if (dias === -1) return "ontem";
  if (dias === 1) return "amanhã";
  if (dias === 0) return futuro ? `em ${horas} h` : `há ${horas} h`;
  if (Math.abs(dias) < 30) return dias > 0 ? `em ${dias} dias` : `há ${-dias} dias`;
  return formatarData(valor);
}

/** Situação temporal de um vencimento em relação ao agora. */
export function situacaoVencimento(valor: string | null | undefined, diaInteiro = false): "vencido" | "hoje" | "proximo" | "futuro" | null {
  if (!valor) return null;
  const agora = Date.now();
  const alvo = new Date(ehSomenteData(valor) ? fimDiaSP(valor) : valor).getTime();
  const diaAlvo = ehSomenteData(valor) ? valor : dataSP(valor);
  if (alvo < agora && !(diaInteiro && diaAlvo === hojeSP())) return "vencido";
  if (diaAlvo === hojeSP()) return "hoje";
  if (diferencaDias(hojeSP(), diaAlvo) <= 3) return "proximo";
  return "futuro";
}
