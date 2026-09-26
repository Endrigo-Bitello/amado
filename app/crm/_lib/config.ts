"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { executar } from "./dados";
import { supabase } from "./supabase";
import type {
  CampoPersonalizado,
  CategoriaDocumento,
  Configuracao,
  Entidade,
  Etapa,
  Etiqueta,
  ModeloChecklist,
  ModeloTarefas,
  Opcao,
  Perfil,
  TipoDemanda,
  Usuario,
} from "./tipos";

// Configurações editáveis pela Administração, carregadas uma vez e mantidas
// atualizadas em tempo real (sem novo deploy).

export interface DadosConfig {
  usuarios: Pick<Usuario, "id" | "nome" | "email" | "perfil_id" | "cor" | "ativo" | "cargo" | "oab">[];
  perfis: Perfil[];
  etapas: Etapa[];
  opcoes: Opcao[];
  etiquetas: Etiqueta[];
  tiposDemanda: TipoDemanda[];
  campos: CampoPersonalizado[];
  categorias: CategoriaDocumento[];
  modelosChecklist: Pick<ModeloChecklist, "id" | "nome" | "tipo_demanda_id" | "ativo" | "aviso">[];
  modelosTarefas: Pick<ModeloTarefas, "id" | "nome" | "tipo_demanda_id" | "ativo">[];
  configuracoes: Record<string, unknown>;
}

async function carregarConfig(): Promise<DadosConfig> {
  const s = supabase();
  const [usuarios, perfis, etapas, opcoes, etiquetas, tipos, campos, categorias, modelos, modelosTarefas, cfg] = await Promise.all([
    executar(s.from("usuarios").select("id, nome, email, perfil_id, cor, ativo, cargo, oab").order("nome")),
    executar(s.from("perfis").select("*").order("ordem")),
    executar(s.from("etapas").select("*").order("ordem")),
    executar(s.from("opcoes").select("*").order("ordem")),
    executar(s.from("etiquetas").select("*").order("nome")),
    executar(s.from("tipos_demanda").select("*").order("ordem")),
    executar(s.from("campos_personalizados").select("*").order("ordem")),
    executar(s.from("categorias_documento").select("*").order("ordem")),
    executar(s.from("modelos_checklist").select("id, nome, tipo_demanda_id, ativo, aviso").order("nome")),
    executar(s.from("modelos_tarefas").select("id, nome, tipo_demanda_id, ativo").order("nome")),
    executar(s.from("configuracoes").select("*")),
  ]);
  return {
    usuarios: usuarios ?? [],
    perfis: perfis ?? [],
    etapas: etapas ?? [],
    opcoes: opcoes ?? [],
    etiquetas: etiquetas ?? [],
    tiposDemanda: tipos ?? [],
    campos: campos ?? [],
    categorias: categorias ?? [],
    modelosChecklist: modelos ?? [],
    modelosTarefas: modelosTarefas ?? [],
    configuracoes: Object.fromEntries(((cfg ?? []) as Configuracao[]).map((c) => [c.chave, c.valor])),
  };
}

const VAZIO: DadosConfig = {
  usuarios: [],
  perfis: [],
  etapas: [],
  opcoes: [],
  etiquetas: [],
  tiposDemanda: [],
  campos: [],
  categorias: [],
  modelosChecklist: [],
  modelosTarefas: [],
  configuracoes: {},
};

export const NOMENCLATURA_PADRAO: Record<string, string> = {
  hoje: "Hoje",
  leads: "Leads",
  lead: "Lead",
  clientes: "Clientes",
  cliente: "Cliente",
  casos: "Casos e processos",
  caso: "Caso",
  tarefas: "Tarefas",
  tarefa: "Tarefa",
  agenda: "Agenda",
  documentos: "Documentos",
  financeiro: "Financeiro",
  relatorios: "Relatórios",
  admin: "Administração",
};

export function useConfig() {
  // Tempo real atualiza na hora; a releitura periódica cobre eventuais eventos perdidos.
  const consulta = useQuery({ queryKey: ["config"], queryFn: carregarConfig, staleTime: 5 * 60_000, refetchInterval: 2 * 60_000 });
  const dados = consulta.data ?? VAZIO;

  return useMemo(() => {
    const usuariosPorId = new Map(dados.usuarios.map((u) => [u.id, u]));
    const etapasPorId = new Map(dados.etapas.map((e) => [e.id, e]));
    const tiposPorId = new Map(dados.tiposDemanda.map((t) => [t.id, t]));
    const etiquetasPorId = new Map(dados.etiquetas.map((e) => [e.id, e]));
    const categoriasPorId = new Map(dados.categorias.map((c) => [c.id, c]));
    const nomenclaturas = { ...NOMENCLATURA_PADRAO, ...((dados.configuracoes.nomenclaturas as Record<string, string>) ?? {}) };
    const textos = (dados.configuracoes.textos as Record<string, string>) ?? {};

    return {
      ...dados,
      carregando: consulta.isLoading,
      erro: consulta.error,
      usuariosAtivos: dados.usuarios.filter((u) => u.ativo),
      usuario: (id: string | null | undefined) => (id ? usuariosPorId.get(id) ?? null : null),
      etapa: (id: string | null | undefined) => (id ? etapasPorId.get(id) ?? null : null),
      etapasDe: (funil: "lead" | "caso", incluirInativas = false) =>
        dados.etapas.filter((e) => e.funil === funil && (incluirInativas || e.ativo)),
      tipo: (id: string | null | undefined) => (id ? tiposPorId.get(id) ?? null : null),
      etiqueta: (id: string) => etiquetasPorId.get(id) ?? null,
      categoria: (id: string | null | undefined) => (id ? categoriasPorId.get(id) ?? null : null),
      opcoesDe: (lista: string, incluirInativas = false) =>
        dados.opcoes.filter((o) => o.lista === lista && (incluirInativas || o.ativo)),
      rotulo: (lista: string, valor: string | null | undefined) =>
        valor ? dados.opcoes.find((o) => o.lista === lista && o.valor === valor)?.rotulo ?? valor : "",
      corOpcao: (lista: string, valor: string | null | undefined) =>
        dados.opcoes.find((o) => o.lista === lista && o.valor === valor)?.cor ?? null,
      camposDe: (entidade: Entidade, incluirInativos = false) =>
        dados.campos.filter((c) => c.entidade === entidade && (incluirInativos || c.ativo)),
      nome: (chave: string) => nomenclaturas[chave] ?? NOMENCLATURA_PADRAO[chave] ?? chave,
      texto: (chave: string, padrao = "") => textos[chave] ?? padrao,
      cfg: <T,>(chave: string, padrao: T): T => ((dados.configuracoes[chave] as T) ?? padrao),
    };
  }, [dados, consulta.isLoading, consulta.error]);
}

export type Config = ReturnType<typeof useConfig>;
