const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtNumero = new Intl.NumberFormat("pt-BR");

export function formatarMoeda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const n = typeof valor === "string" ? Number(valor) : valor;
  return Number.isFinite(n) ? fmtMoeda.format(n) : "";
}

export function formatarNumero(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const n = typeof valor === "string" ? Number(valor) : valor;
  return Number.isFinite(n) ? fmtNumero.format(n) : "";
}

/** Converte "1.234,56" ou "1234.56" em número. */
export function lerMoeda(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function somenteDigitos(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\D/g, "");
}

export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return "";
  let d = somenteDigitos(valor);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
}

export function linkWhatsApp(valor: string | null | undefined, mensagem?: string): string | null {
  let d = somenteDigitos(valor);
  if (!d) return null;
  d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return `https://wa.me/${d}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}`;
}

export function formatarDocumento(valor: string | null | undefined): string {
  if (!valor) return "";
  const v = valor.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (v.length === 11 && /^\d+$/.test(v)) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
  if (v.length === 14) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
  return valor;
}

export function cpfValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

export function cnpjValido(valor: string): boolean {
  const v = valor.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!/^[0-9A-Z]{12}\d{2}$/.test(v) || /^(.)\1{13}$/.test(v)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((acc, p, i) => acc + (base.charCodeAt(i) - 48) * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(v.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(v.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(v[12]) && d2 === Number(v[13]);
}

export function documentoValido(valor: string): boolean {
  const v = valor.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return v.length === 11 ? cpfValido(v) : v.length === 14 ? cnpjValido(v) : false;
}

/** Número CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO */
export function formatarProcesso(valor: string | null | undefined): string {
  if (!valor) return "";
  const d = somenteDigitos(valor);
  if (d.length !== 20) return valor;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

/** Confere os dígitos verificadores do número CNJ (ISO 7064, módulo 97). */
export function numeroCnjValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 20) return false;
  const base = `${d.slice(0, 7)}${d.slice(9)}00`;
  let resto = 0;
  for (const ch of base) resto = (resto * 10 + Number(ch)) % 97;
  return 98 - resto === Number(d.slice(7, 9));
}

export function iniciais(nome: string | null | undefined): string {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(p));
  const letras = (partes.length > 1 ? [partes[0], partes[partes.length - 1]] : [partes[0] ?? nome]).map((p) => p[0]);
  return letras.join("").toUpperCase();
}

export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] ?? "";
}

export function plural(n: number, singular: string, pluralTexto?: string): string {
  return `${formatarNumero(n)} ${n === 1 ? singular : (pluralTexto ?? `${singular}s`)}`;
}

/** Normaliza para busca: minúsculas e sem acentos. */
export function normalizarBusca(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function tamanhoArquivo(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function slug(texto: string): string {
  return normalizarBusca(texto)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function idCurto(): string {
  return Math.random().toString(36).slice(2, 10);
}
