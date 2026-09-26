// Paleta de etiquetas/situações derivada da identidade do site (verdes,
// dourado e tons terrosos). O texto sobre cada cor é escolhido para manter
// contraste mínimo de 4,5:1.

export const PALETA: { nome: string; cor: string }[] = [
  { nome: "Floresta", cor: "#263A2D" },
  { nome: "Musgo", cor: "#285E31" },
  { nome: "Folha", cor: "#3D7B3E" },
  { nome: "Oliva", cor: "#7A8B2E" },
  { nome: "Lima", cor: "#C7E950" },
  { nome: "Ouro", cor: "#C5A880" },
  { nome: "Bronze", cor: "#A68658" },
  { nome: "Âmbar", cor: "#C9822B" },
  { nome: "Terracota", cor: "#B5532F" },
  { nome: "Vinho", cor: "#8E2C3D" },
  { nome: "Petróleo", cor: "#1F6E76" },
  { nome: "Ardósia", cor: "#3E5C8A" },
  { nome: "Lavanda", cor: "#6D5BA6" },
  { nome: "Grafite", cor: "#52525B" },
  { nome: "Cinza", cor: "#A1A1AA" },
  { nome: "Areia", cor: "#E9E1D0" },
];

function canal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminancia(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.padEnd(6, "0");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Cor do texto sobre um fundo colorido (branco ou tinta escura). */
export function corTexto(fundo: string | null | undefined): string {
  if (!fundo) return "#1D2A21";
  return contraste(fundo, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#1D2A21";
}

/** Fundo suave (10–16% de opacidade) para selos discretos. */
export function corSuave(cor: string | null | undefined, alfa = 0.14): string {
  if (!cor) return "rgba(29,42,33,0.06)";
  const h = cor.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

/** Versão escurecida da cor para texto sobre fundo suave (contraste ≥ 4,5 em fundo claro). */
export function corTextoSobreSuave(cor: string | null | undefined): string {
  if (!cor) return "#1D2A21";
  let h = cor.replace("#", "");
  for (let i = 0; i < 10 && contraste(`#${h}`, "#FFFFFF") < 4.8; i++) {
    const r = Math.round(parseInt(h.slice(0, 2), 16) * 0.82);
    const g = Math.round(parseInt(h.slice(2, 4), 16) * 0.82);
    const b = Math.round(parseInt(h.slice(4, 6), 16) * 0.82);
    h = [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  return `#${h}`;
}

export const DESTAQUES: Record<string, { rotulo: string; cor: string; hover: string }> = {
  floresta: { rotulo: "Verde floresta (padrão do site)", cor: "#263A2D", hover: "#1C2E22" },
  musgo: { rotulo: "Verde musgo", cor: "#285E31", hover: "#1F4A26" },
  folha: { rotulo: "Verde folha", cor: "#3D7B3E", hover: "#326533" },
};
