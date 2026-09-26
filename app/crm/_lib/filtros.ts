import type { ColunaQuadro, ContextoFiltro, Filtro, Operador, Ordenacao, TipoColuna } from "../_quadro/tipos";
import { dataSP, diferencaDias, fimDiaSP, hojeSP } from "./datas";
import { normalizarBusca } from "./formatos";

export const ROTULOS_OPERADORES: Record<Operador, string> = {
  contem: "contém",
  nao_contem: "não contém",
  igual: "é igual a",
  diferente: "é diferente de",
  vazio: "está vazio",
  preenchido: "está preenchido",
  em: "é",
  nao_em: "não é",
  maior: "maior que",
  menor: "menor que",
  hoje: "é hoje",
  atrasado: "está vencido",
  proximos_dias: "nos próximos dias",
  antes: "antes de",
  depois: "depois de",
  eu: "sou eu",
};

export function operadoresPara(tipo: TipoColuna): Operador[] {
  switch (tipo) {
    case "texto":
    case "texto_longo":
    case "email":
    case "telefone":
    case "link":
      return ["contem", "nao_contem", "igual", "vazio", "preenchido"];
    case "numero":
    case "moeda":
      return ["igual", "maior", "menor", "vazio", "preenchido"];
    case "data":
    case "data_hora":
      return ["hoje", "atrasado", "proximos_dias", "antes", "depois", "vazio", "preenchido"];
    case "pessoa":
      return ["em", "nao_em", "eu", "vazio", "preenchido"];
    case "status":
    case "selecao":
      return ["em", "nao_em", "vazio", "preenchido"];
    case "pessoas":
    case "multipla":
    case "etiquetas":
      return ["em", "nao_em", "vazio", "preenchido"];
    case "checkbox":
      return ["igual"];
  }
}

export function operadorPrecisaValor(op: Operador): boolean {
  return !["vazio", "preenchido", "hoje", "atrasado", "eu"].includes(op);
}

function ehVazio(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

function comoLista(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (ehVazio(v)) return [];
  return [String(v)];
}

function paraInstante(v: unknown, diaInteiro: boolean): number | null {
  if (ehVazio(v)) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(fimDiaSP(s)).getTime();
  if (diaInteiro) return new Date(fimDiaSP(dataSP(s))).getTime();
  return new Date(s).getTime();
}

function diaDe(v: unknown): string {
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : dataSP(s);
}

export function aplicarFiltro<T>(item: T, coluna: ColunaQuadro<T>, filtro: Filtro, ctx: ContextoFiltro): boolean {
  const bruto = coluna.valor(item);
  const valor = filtro.valor;
  switch (filtro.operador) {
    case "vazio":
      return ehVazio(bruto);
    case "preenchido":
      return !ehVazio(bruto);
    case "contem":
      return normalizarBusca(coluna.texto ? coluna.texto(item) : bruto).includes(normalizarBusca(valor));
    case "nao_contem":
      return !normalizarBusca(coluna.texto ? coluna.texto(item) : bruto).includes(normalizarBusca(valor));
    case "igual":
      if (coluna.tipo === "checkbox") return Boolean(bruto) === Boolean(valor);
      if (coluna.tipo === "numero" || coluna.tipo === "moeda") return Number(bruto) === Number(valor);
      return normalizarBusca(bruto) === normalizarBusca(valor);
    case "diferente":
      return normalizarBusca(bruto) !== normalizarBusca(valor);
    case "maior":
      return !ehVazio(bruto) && Number(bruto) > Number(valor);
    case "menor":
      return !ehVazio(bruto) && Number(bruto) < Number(valor);
    case "em": {
      const alvo = comoLista(valor);
      if (alvo.length === 0) return true;
      const atual = comoLista(bruto);
      return atual.some((a) => alvo.includes(a));
    }
    case "nao_em": {
      const alvo = comoLista(valor);
      const atual = comoLista(bruto);
      return !atual.some((a) => alvo.includes(a));
    }
    case "eu":
      return comoLista(bruto).includes(ctx.usuarioId ?? "__ninguem__");
    case "hoje":
      return !ehVazio(bruto) && diaDe(bruto) === hojeSP();
    case "atrasado": {
      const t = paraInstante(bruto, coluna.diaInteiro?.(item) ?? coluna.tipo === "data");
      return t !== null && t < Date.now();
    }
    case "proximos_dias": {
      if (ehVazio(bruto)) return false;
      const d = diferencaDias(hojeSP(), diaDe(bruto));
      return d >= 0 && d <= Number(valor ?? 7);
    }
    case "antes": {
      if (ehVazio(bruto) || ehVazio(valor)) return false;
      return diaDe(bruto) < String(valor);
    }
    case "depois": {
      if (ehVazio(bruto) || ehVazio(valor)) return false;
      return diaDe(bruto) > String(valor);
    }
  }
}

export function filtrarItens<T>(itens: T[], colunas: ColunaQuadro<T>[], filtros: Filtro[], busca: string, ctx: ContextoFiltro): T[] {
  const porId = new Map(colunas.map((c) => [c.id, c]));
  const ativos = filtros.filter((f) => porId.has(f.coluna) && (!operadorPrecisaValor(f.operador) || !ehVazio(f.valor)));
  const termo = normalizarBusca(busca.trim());
  const pesquisaveis = colunas.filter((c) => !["checkbox"].includes(c.tipo));
  return itens.filter((item) => {
    for (const f of ativos) {
      if (!aplicarFiltro(item, porId.get(f.coluna)!, f, ctx)) return false;
    }
    if (!termo) return true;
    return pesquisaveis.some((c) => normalizarBusca(textoColuna(c, item)).includes(termo));
  });
}

export function textoColuna<T>(coluna: ColunaQuadro<T>, item: T): string {
  if (coluna.texto) return coluna.texto(item);
  const v = coluna.valor(item);
  if (ehVazio(v)) return "";
  if (coluna.opcoes && (coluna.tipo === "status" || coluna.tipo === "selecao" || coluna.tipo === "pessoa" || coluna.tipo === "pessoas" || coluna.tipo === "multipla" || coluna.tipo === "etiquetas")) {
    return comoLista(v)
      .map((x) => coluna.opcoes!.find((o) => o.valor === x)?.rotulo ?? x)
      .join(", ");
  }
  if (coluna.tipo === "checkbox") return v ? "Sim" : "Não";
  return String(v);
}

export function ordenarItens<T>(itens: T[], colunas: ColunaQuadro<T>[], ordenacao: Ordenacao | null): T[] {
  if (!ordenacao) return itens;
  const coluna = colunas.find((c) => c.id === ordenacao.coluna);
  if (!coluna) return itens;
  const fator = ordenacao.direcao === "asc" ? 1 : -1;
  const indiceOpcao = new Map((coluna.opcoes ?? []).map((o, i) => [o.valor, i]));
  const chave = (item: T): string | number | null => {
    const v = coluna.valor(item);
    if (ehVazio(v)) return null;
    if (coluna.tipo === "numero" || coluna.tipo === "moeda") return Number(v);
    if ((coluna.tipo === "status" || coluna.tipo === "selecao") && indiceOpcao.size) return indiceOpcao.get(String(v)) ?? 999;
    if (coluna.tipo === "checkbox") return v ? 1 : 0;
    if (coluna.tipo === "data" || coluna.tipo === "data_hora") return new Date(String(v).length === 10 ? `${v}T12:00:00-03:00` : String(v)).getTime();
    return normalizarBusca(textoColuna(coluna, item));
  };
  return [...itens].sort((a, b) => {
    const ka = chave(a);
    const kb = chave(b);
    if (ka === null && kb === null) return 0;
    if (ka === null) return 1;
    if (kb === null) return -1;
    return ka < kb ? -fator : ka > kb ? fator : 0;
  });
}

export interface Grupo<T> {
  chave: string;
  rotulo: string;
  cor: string | null;
  itens: T[];
  valor: unknown;
}

export function agruparItens<T>(itens: T[], coluna: ColunaQuadro<T> | undefined): Grupo<T>[] {
  if (!coluna) return [{ chave: "__todos__", rotulo: "", cor: null, itens, valor: null }];
  const grupos = new Map<string, Grupo<T>>();
  const ordem: string[] = [];
  for (const o of coluna.opcoes ?? []) {
    if (!(coluna.tipo === "pessoas" || coluna.tipo === "multipla" || coluna.tipo === "etiquetas")) {
      ordem.push(o.valor);
      grupos.set(o.valor, { chave: o.valor, rotulo: o.rotulo, cor: o.cor ?? null, itens: [], valor: o.valor });
    }
  }
  for (const item of itens) {
    const v = coluna.valor(item);
    let chaves = comoLista(v);
    if (coluna.tipo === "data" || coluna.tipo === "data_hora") {
      chaves = ehVazio(v) ? [] : [diaDe(v).slice(0, 7)];
    }
    if (chaves.length === 0) chaves = ["__vazio__"];
    for (const k of chaves) {
      if (!grupos.has(k)) {
        const op = coluna.opcoes?.find((o) => o.valor === k);
        const rotulo =
          k === "__vazio__"
            ? `Sem ${coluna.titulo.toLowerCase()}`
            : op?.rotulo ?? (coluna.tipo === "data" || coluna.tipo === "data_hora" ? rotuloMes(k) : k);
        grupos.set(k, { chave: k, rotulo, cor: op?.cor ?? null, itens: [], valor: k === "__vazio__" ? null : k });
        if (k !== "__vazio__") ordem.push(k);
      }
      grupos.get(k)!.itens.push(item);
    }
  }
  const lista = ordem.map((k) => grupos.get(k)!).filter((g) => g.itens.length > 0 || (coluna.opcoes ?? []).some((o) => o.valor === g.chave));
  if (coluna.tipo === "data" || coluna.tipo === "data_hora") lista.sort((a, b) => a.chave.localeCompare(b.chave));
  if (grupos.has("__vazio__")) lista.push(grupos.get("__vazio__")!);
  return lista;
}

function rotuloMes(anoMes: string): string {
  const [ano, mes] = anoMes.split("-").map(Number);
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(ano, mes - 1, 1)));
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}
