import type { ReactNode } from "react";
import type { OpcaoLista } from "../_ui/Seletores";

export type TipoColuna =
  | "texto"
  | "texto_longo"
  | "numero"
  | "moeda"
  | "data"
  | "data_hora"
  | "status"
  | "selecao"
  | "pessoa"
  | "pessoas"
  | "multipla"
  | "etiquetas"
  | "checkbox"
  | "link"
  | "telefone"
  | "email";

export interface ColunaQuadro<T> {
  id: string;
  titulo: string;
  tipo: TipoColuna;
  /** Valor bruto (ordenar, filtrar, agrupar). */
  valor: (item: T) => unknown;
  /** Exibição personalizada da célula. */
  exibir?: (item: T) => ReactNode;
  /** Texto para busca e exportação. */
  texto?: (item: T) => string;
  opcoes?: OpcaoLista[];
  editar?: (item: T, valor: unknown) => Promise<void>;
  podeEditar?: (item: T) => boolean;
  largura?: number;
  alinhamento?: "esquerda" | "direita" | "centro";
  oculta?: boolean;
  obrigatoria?: boolean;
  agrupavel?: boolean;
  filtravel?: boolean;
  ordenavel?: boolean;
  /** Para datas: considera o dia inteiro (vencido só após o fim do dia). */
  diaInteiro?: (item: T) => boolean;
  /** Indica vencimento (ícone + texto) em colunas de data. */
  alertaVencimento?: (item: T) => boolean;
  /** Resumo no rodapé do grupo. */
  resumo?: "distribuicao" | "soma";
  descricao?: string;
}

export type Operador =
  | "contem"
  | "nao_contem"
  | "igual"
  | "diferente"
  | "vazio"
  | "preenchido"
  | "em"
  | "nao_em"
  | "maior"
  | "menor"
  | "hoje"
  | "atrasado"
  | "proximos_dias"
  | "antes"
  | "depois"
  | "eu";

export interface Filtro {
  id: string;
  coluna: string;
  operador: Operador;
  valor?: unknown;
}

export interface Ordenacao {
  coluna: string;
  direcao: "asc" | "desc";
}

export type TipoVisualizacao = "tabela" | "kanban" | "calendario" | "resumo";

export interface ConfigVisualizacao {
  tipo: TipoVisualizacao;
  busca: string;
  filtros: Filtro[];
  ordenacao: Ordenacao | null;
  agrupamento: string | null;
  colunasOcultas: string[];
  ordemColunas: string[];
  larguras: Record<string, number>;
  resumirPor?: string | null;
}

export interface AcaoLote<T> {
  id: string;
  rotulo: string;
  icone?: ReactNode;
  perigo?: boolean;
  /** Retorna uma promessa; o quadro limpa a seleção ao concluir. */
  executar: (itens: T[]) => Promise<void> | void;
  visivel?: boolean;
}

export interface ContextoFiltro {
  usuarioId: string | null;
}
