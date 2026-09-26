"use client";

import type { ColunaQuadro } from "../_quadro/tipos";
import type { OpcaoLista } from "../_ui/Seletores";
import type { Config } from "./config";

export function opcoesUsuarios(config: Config, incluirInativos = true): OpcaoLista[] {
  return config.usuarios
    .filter((u) => incluirInativos || u.ativo)
    .map((u) => ({ valor: u.id, rotulo: u.ativo ? u.nome : `${u.nome} (inativo)`, cor: u.cor, desabilitada: !u.ativo }));
}

export function opcoesLista(config: Config, lista: string): OpcaoLista[] {
  return config.opcoesDe(lista, true).map((o) => ({
    valor: o.valor,
    rotulo: o.ativo ? o.rotulo : `${o.rotulo} (arquivado)`,
    cor: o.cor,
    desabilitada: !o.ativo,
  }));
}

export function opcoesEtiquetas(config: Config, escopo: string): OpcaoLista[] {
  return config.etiquetas
    .filter((e) => e.escopos.includes(escopo))
    .map((e) => ({ valor: e.id, rotulo: e.ativo ? e.nome : `${e.nome} (arquivada)`, cor: e.cor, desabilitada: !e.ativo }));
}

export function opcoesTiposDemanda(config: Config): OpcaoLista[] {
  return config.tiposDemanda.map((t) => ({ valor: t.id, rotulo: t.ativo ? t.nome : `${t.nome} (inativo)`, cor: t.cor, desabilitada: !t.ativo }));
}

export function opcoesEtapas(config: Config, funil: "lead" | "caso"): OpcaoLista[] {
  return config.etapasDe(funil, true).map((e) => ({ valor: e.id, rotulo: e.ativo ? e.nome : `${e.nome} (arquivada)`, cor: e.cor, desabilitada: !e.ativo }));
}

type Salvar<T> = (item: T, alteracoes: Record<string, unknown>) => Promise<void>;

export function colunaResponsavel<T extends { responsavel_id: string | null }>(config: Config, salvar?: Salvar<T>, titulo = "Responsável"): ColunaQuadro<T> {
  return {
    id: "responsavel_id",
    titulo,
    tipo: "pessoa",
    valor: (i) => i.responsavel_id,
    opcoes: opcoesUsuarios(config),
    editar: salvar ? (i, v) => salvar(i, { responsavel_id: v }) : undefined,
    agrupavel: true,
    largura: 150,
  };
}

export function colunaPrioridade<T extends { prioridade: string }>(config: Config, salvar?: Salvar<T>): ColunaQuadro<T> {
  return {
    id: "prioridade",
    titulo: "Prioridade",
    tipo: "selecao",
    valor: (i) => i.prioridade,
    opcoes: opcoesLista(config, "prioridade"),
    editar: salvar ? (i, v) => salvar(i, { prioridade: v ?? "media" }) : undefined,
    agrupavel: true,
    largura: 120,
  };
}

export function colunaEtiquetas<T extends { etiquetas: string[] }>(config: Config, escopo: string, salvar?: Salvar<T>): ColunaQuadro<T> {
  return {
    id: "etiquetas",
    titulo: "Etiquetas",
    tipo: "etiquetas",
    valor: (i) => i.etiquetas,
    opcoes: opcoesEtiquetas(config, escopo),
    editar: salvar ? (i, v) => salvar(i, { etiquetas: v ?? [] }) : undefined,
    largura: 200,
    oculta: true,
  };
}
