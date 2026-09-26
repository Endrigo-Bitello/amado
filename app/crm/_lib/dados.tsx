"use client";

import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { comSalvamento, aviso } from "./avisos";
import { supabase } from "./supabase";

// ---------------------------------------------------------------------------
// Erros: mensagens claras e sem detalhes técnicos ou dados pessoais
// ---------------------------------------------------------------------------

export class ErroCrm extends Error {
  constructor(mensagem: string, public codigo?: string) {
    super(mensagem);
  }
}

export function mensagemErro(e: unknown): string {
  if (e instanceof ErroCrm) return e.message;
  const erro = e as { code?: string; message?: string } | null;
  const codigo = erro?.code ?? "";
  const msg = erro?.message ?? "";
  if (codigo === "42501" || /row-level security|permission denied/i.test(msg)) {
    return "Você não tem permissão para esta ação.";
  }
  if (codigo === "23505") return "Já existe um registro com estes dados.";
  if (codigo === "23503") {
    return "Este registro está vinculado a outros dados e não pode ser excluído. Use a opção de arquivar.";
  }
  if (codigo === "P0001" && msg) return msg;
  if (codigo === "PGRST116") return "Registro não encontrado ou sem permissão de acesso.";
  if (codigo === "22P02" || codigo === "23514" || codigo === "22007") return "Há dados em formato inválido.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return "Sem conexão com o servidor. Verifique a internet e tente novamente.";
  }
  if (/JWT|session/i.test(msg)) return "Sua sessão expirou. Entre novamente.";
  return "Não foi possível concluir a operação. Tente novamente.";
}

type Resultado<T> = { data: T | null; error: unknown; count?: number | null };

export async function executar<T>(consulta: PromiseLike<Resultado<T>>): Promise<T> {
  const { data, error } = await consulta;
  if (error) throw new ErroCrm(mensagemErro(error), (error as { code?: string }).code);
  return data as T;
}

/** Busca todas as linhas em páginas de 1.000 (limite do PostgREST). */
export async function buscarTodos<T>(
  construir: (de: number, ate: number) => PromiseLike<Resultado<T[]>>,
  limite = 10_000,
): Promise<{ linhas: T[]; truncado: boolean }> {
  const linhas: T[] = [];
  const tamanho = 1000;
  for (let de = 0; de < limite; de += tamanho) {
    const pagina = await executar(construir(de, de + tamanho - 1));
    linhas.push(...(pagina ?? []));
    if (!pagina || pagina.length < tamanho) return { linhas, truncado: false };
  }
  return { linhas, truncado: true };
}

// ---------------------------------------------------------------------------
// React Query
// ---------------------------------------------------------------------------

export function criarClienteConsultas() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        refetchInterval: 5 * 60_000,
        retry: (tentativas, erro) => {
          const codigo = (erro as ErroCrm)?.codigo;
          if (codigo === "42501" || codigo === "PGRST116") return false;
          return tentativas < 2;
        },
      },
    },
  });
}

// Tabelas observadas em tempo real → chaves de consulta invalidadas.
const TABELAS_TEMPO_REAL: Record<string, string[]> = {
  leads: ["leads", "painel", "busca"],
  clientes: ["clientes", "casos", "painel", "busca"],
  dados_clinicos: ["dados_clinicos"],
  casos: ["casos", "painel", "busca"],
  processos: ["casos", "processos"],
  partes: ["partes"],
  andamentos: ["andamentos", "eventos"],
  tarefas: ["tarefas", "painel", "agenda"],
  compromissos: ["compromissos", "painel", "agenda"],
  prazos: ["prazos", "painel", "agenda"],
  documentos: ["documentos", "painel"],
  arquivos: ["arquivos", "documentos"],
  midias: ["midias"],
  solicitacoes_documentos: ["solicitacoes"],
  interacoes: ["interacoes", "eventos", "leads"],
  comentarios: ["comentarios"],
  eventos: ["eventos"],
  notificacoes: ["notificacoes"],
  contratos: ["financeiro"],
  cobrancas: ["financeiro", "painel"],
  pagamentos: ["financeiro", "painel"],
  reembolsos: ["financeiro"],
  despesas: ["financeiro"],
  configuracoes: ["config"],
  etapas: ["config"],
  opcoes: ["config"],
  etiquetas: ["config"],
  campos_personalizados: ["config", "valores"],
  valores_personalizados: ["valores"],
  tipos_demanda: ["config"],
  categorias_documento: ["config"],
  modelos_checklist: ["config", "modelos"],
  modelos_checklist_grupos: ["modelos"],
  modelos_checklist_itens: ["modelos"],
  modelos_tarefas: ["config", "modelos"],
  automacoes: ["automacoes"],
  usuarios: ["config", "sessao"],
  perfis: ["config", "sessao"],
  visualizacoes: ["visualizacoes"],
  feriados: ["feriados"],
};

/** Assina as alterações do banco (Supabase Realtime) e atualiza quadros e indicadores. */
export function useTempoReal(ativo: boolean) {
  const consultas = useQueryClient();
  const pendentes = useRef(new Set<string>());
  const temporizador = useRef<number | null>(null);

  useEffect(() => {
    if (!ativo) return;
    const cliente = supabase();
    let canal = cliente.channel("crm-alteracoes");
    for (const tabela of Object.keys(TABELAS_TEMPO_REAL)) {
      canal = canal.on("postgres_changes", { event: "*", schema: "public", table: tabela }, () => {
        TABELAS_TEMPO_REAL[tabela].forEach((c) => pendentes.current.add(c));
        if (temporizador.current) window.clearTimeout(temporizador.current);
        temporizador.current = window.setTimeout(() => {
          const chaves = [...pendentes.current];
          pendentes.current.clear();
          chaves.forEach((c) => consultas.invalidateQueries({ queryKey: [c] }));
        }, 400);
      });
    }
    // Ao reconectar depois de uma queda, eventos do intervalo não são reenviados:
    // atualiza tudo o que está em tela para não exibir dados defasados.
    let conectouAntes = false;
    canal.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      if (conectouAntes) consultas.invalidateQueries();
      conectouAntes = true;
    });
    return () => {
      if (temporizador.current) window.clearTimeout(temporizador.current);
      cliente.removeChannel(canal);
    };
  }, [ativo, consultas]);
}

// ---------------------------------------------------------------------------
// Gravação com atualização otimista dos quadros
// ---------------------------------------------------------------------------

type ComId = { id: string };

function mesclarEmConsultas(consultas: QueryClient, chave: string, id: string, alteracoes: Record<string, unknown>) {
  const anteriores: [readonly unknown[], unknown][] = [];
  for (const [queryKey, dados] of consultas.getQueriesData<unknown>({ queryKey: [chave] })) {
    anteriores.push([queryKey, dados]);
    const atualizar = (item: unknown) =>
      item && typeof item === "object" && (item as ComId).id === id ? { ...(item as object), ...alteracoes } : item;
    if (Array.isArray(dados)) {
      consultas.setQueryData(queryKey, dados.map(atualizar));
    } else if (dados && typeof dados === "object" && Array.isArray((dados as { linhas?: unknown[] }).linhas)) {
      const d = dados as { linhas: unknown[] };
      consultas.setQueryData(queryKey, { ...d, linhas: d.linhas.map(atualizar) });
    } else if (dados && typeof dados === "object" && (dados as ComId).id === id) {
      consultas.setQueryData(queryKey, { ...(dados as object), ...alteracoes });
    }
  }
  return () => anteriores.forEach(([k, d]) => consultas.setQueryData(k, d));
}

export function useGravacao() {
  const consultas = useQueryClient();

  async function atualizar(
    tabela: string,
    id: string,
    alteracoes: Record<string, unknown>,
    opcoes?: { chaves?: string[]; mensagemSucesso?: string; silencioso?: boolean; colunaChave?: string },
  ) {
    const chaves = opcoes?.chaves ?? [tabela];
    const colunaChave = opcoes?.colunaChave ?? "id";
    const desfazer = chaves.map((c) => mesclarEmConsultas(consultas, c, id, alteracoes));
    try {
      await comSalvamento(() =>
        executar(supabase().from(tabela as never).update(alteracoes as never).eq(colunaChave, id).select(colunaChave)).then((linhas) => {
          if (Array.isArray(linhas) && linhas.length === 0) {
            throw new ErroCrm("Não foi possível salvar: o registro não existe mais ou você não tem permissão.");
          }
          return linhas;
        }),
      );
      if (opcoes?.mensagemSucesso) aviso.sucesso(opcoes.mensagemSucesso);
    } catch (e) {
      desfazer.forEach((f) => f());
      if (!opcoes?.silencioso) aviso.erro(mensagemErro(e));
      throw e;
    } finally {
      chaves.forEach((c) => consultas.invalidateQueries({ queryKey: [c] }));
    }
  }

  async function inserir<T = Record<string, unknown>>(
    tabela: string,
    dados: Record<string, unknown> | Record<string, unknown>[],
    opcoes?: { chaves?: string[]; mensagemSucesso?: string; silencioso?: boolean },
  ): Promise<T> {
    try {
      const resultado = await comSalvamento(() =>
        executar(supabase().from(tabela as never).insert(dados as never).select()),
      );
      if (opcoes?.mensagemSucesso) aviso.sucesso(opcoes.mensagemSucesso);
      return (Array.isArray(dados) ? resultado : (resultado as unknown[])[0]) as T;
    } catch (e) {
      if (!opcoes?.silencioso) aviso.erro(mensagemErro(e));
      throw e;
    } finally {
      (opcoes?.chaves ?? [tabela]).forEach((c) => consultas.invalidateQueries({ queryKey: [c] }));
    }
  }

  async function excluir(tabela: string, id: string, opcoes?: { chaves?: string[]; mensagemSucesso?: string }) {
    try {
      await comSalvamento(() => executar(supabase().from(tabela as never).delete().eq("id", id).select("id")).then((linhas) => {
        if (Array.isArray(linhas) && linhas.length === 0) {
          throw new ErroCrm("Não foi possível excluir: você não tem permissão ou o registro já foi removido.");
        }
      }));
      if (opcoes?.mensagemSucesso) aviso.sucesso(opcoes.mensagemSucesso);
    } catch (e) {
      aviso.erro(mensagemErro(e));
      throw e;
    } finally {
      (opcoes?.chaves ?? [tabela]).forEach((c) => consultas.invalidateQueries({ queryKey: [c] }));
    }
  }

  async function rpc<T>(nome: string, args: Record<string, unknown>, opcoes?: { chaves?: string[]; mensagemSucesso?: string; silencioso?: boolean }): Promise<T> {
    try {
      const r = await comSalvamento(() => executar<T>(supabase().rpc(nome as never, args as never) as never));
      if (opcoes?.mensagemSucesso) aviso.sucesso(opcoes.mensagemSucesso);
      return r;
    } catch (e) {
      if (!opcoes?.silencioso) aviso.erro(mensagemErro(e));
      throw e;
    } finally {
      (opcoes?.chaves ?? []).forEach((c) => consultas.invalidateQueries({ queryKey: [c] }));
    }
  }

  function invalidar(...chaves: string[]) {
    chaves.forEach((c) => consultas.invalidateQueries({ queryKey: [c] }));
  }

  return { atualizar, inserir, excluir, rpc, invalidar };
}
