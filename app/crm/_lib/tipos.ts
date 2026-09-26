import type { Database, Tables } from "./database.types";

export type Linha<T extends keyof Database["public"]["Tables"]> = Tables<T>;

export type Usuario = Tables<"usuarios">;
export type Perfil = Tables<"perfis">;
export type PermissaoCatalogo = Tables<"permissoes_catalogo">;
export type Etapa = Tables<"etapas">;
export type Opcao = Tables<"opcoes">;
export type Etiqueta = Tables<"etiquetas">;
export type TipoDemanda = Tables<"tipos_demanda">;
export type CampoPersonalizado = Tables<"campos_personalizados">;
export type ValorPersonalizado = Tables<"valores_personalizados">;
export type Configuracao = Tables<"configuracoes">;
export type Visualizacao = Tables<"visualizacoes">;
export type Feriado = Tables<"feriados">;
export type Lead = Tables<"leads">;
export type Cliente = Tables<"clientes">;
export type DadosClinicos = Tables<"dados_clinicos">;
export type QuizSubmissao = Tables<"quiz_submissoes">;
export type QuizResposta = Tables<"quiz_respostas">;
export type Consentimento = Tables<"consentimentos">;
export type Interacao = Tables<"interacoes">;
export type Caso = Tables<"casos">;
export type Processo = Tables<"processos">;
export type Parte = Tables<"partes">;
export type Andamento = Tables<"andamentos">;
export type Tarefa = Tables<"tarefas">;
export type ModeloTarefas = Tables<"modelos_tarefas">;
export type Compromisso = Tables<"compromissos">;
export type Prazo = Tables<"prazos">;
export type PrazoHistorico = Tables<"prazos_historico">;
export type CategoriaDocumento = Tables<"categorias_documento">;
export type ModeloChecklist = Tables<"modelos_checklist">;
export type ModeloChecklistGrupo = Tables<"modelos_checklist_grupos">;
export type ModeloChecklistItem = Tables<"modelos_checklist_itens">;
export type Documento = Tables<"documentos">;
export type DocumentoHistorico = Tables<"documentos_historico">;
export type Solicitacao = Tables<"solicitacoes_documentos">;
export type Arquivo = Tables<"arquivos">;
export type Midia = Tables<"midias">;
export type Contrato = Tables<"contratos">;
export type Cobranca = Tables<"cobrancas">;
export type CobrancaSituacao = Database["public"]["Views"]["v_cobrancas"]["Row"];
export type Pagamento = Tables<"pagamentos">;
export type Reembolso = Tables<"reembolsos">;
export type Despesa = Tables<"despesas">;
export type Comentario = Tables<"comentarios">;
export type Evento = Tables<"eventos">;
export type Notificacao = Tables<"notificacoes">;
export type Auditoria = Tables<"auditoria">;
export type Automacao = Tables<"automacoes">;
export type AutomacaoExecucao = Tables<"automacoes_execucoes">;
export type Importacao = Tables<"importacoes">;

export type Entidade = "lead" | "cliente" | "caso";

export interface SessaoPerfil {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  oab: string | null;
  telefone: string | null;
  cor: string;
  ativo: boolean;
  perfil_id: string;
  perfil_nome: string;
  permissoes: string[];
}

export type CasoComRelacoes = Caso & {
  cliente: Pick<Cliente, "id" | "nome" | "codigo"> | null;
  processos: Pick<Processo, "id" | "numero" | "tribunal" | "principal" | "orgao" | "classe">[];
};

export type DocumentoComRelacoes = Documento & {
  caso: Pick<Caso, "id" | "titulo" | "codigo"> | null;
  cliente: Pick<Cliente, "id" | "nome" | "codigo"> | null;
  lead: Pick<Lead, "id" | "nome" | "codigo"> | null;
};

export type PrazoComRelacoes = Prazo & {
  caso: Pick<Caso, "id" | "titulo" | "codigo" | "cliente_id"> & { cliente: Pick<Cliente, "id" | "nome"> | null } | null;
  processo: Pick<Processo, "id" | "numero" | "tribunal"> | null;
};

export type TarefaComRelacoes = Tarefa & {
  lead: Pick<Lead, "id" | "nome" | "codigo"> | null;
  cliente: Pick<Cliente, "id" | "nome" | "codigo"> | null;
  caso: Pick<Caso, "id" | "titulo" | "codigo"> | null;
};

export type CobrancaComRelacoes = CobrancaSituacao & {
  cliente: Pick<Cliente, "id" | "nome" | "codigo"> | null;
  caso: Pick<Caso, "id" | "titulo" | "codigo"> | null;
};
