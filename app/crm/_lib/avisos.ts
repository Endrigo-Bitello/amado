"use client";

import { useSyncExternalStore } from "react";

// Avisos (toasts) e indicador global de salvamento, sem dependências externas.

export type TipoAviso = "sucesso" | "erro" | "info";

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  mensagem: string;
  acao?: { rotulo: string; executar: () => void };
}

let avisos: Aviso[] = [];
let proximoId = 1;
const ouvintesAvisos = new Set<() => void>();

function emitirAvisos() {
  ouvintesAvisos.forEach((f) => f());
}

export function mostrarAviso(tipo: TipoAviso, mensagem: string, acao?: Aviso["acao"], duracaoMs?: number) {
  const id = proximoId++;
  avisos = [...avisos.slice(-3), { id, tipo, mensagem, acao }];
  emitirAvisos();
  const duracao = duracaoMs ?? (tipo === "erro" ? 8000 : acao ? 7000 : 3500);
  window.setTimeout(() => fecharAviso(id), duracao);
}

export function fecharAviso(id: number) {
  avisos = avisos.filter((a) => a.id !== id);
  emitirAvisos();
}

export const aviso = {
  sucesso: (m: string, acao?: Aviso["acao"]) => mostrarAviso("sucesso", m, acao),
  erro: (m: string, acao?: Aviso["acao"]) => mostrarAviso("erro", m, acao),
  info: (m: string, acao?: Aviso["acao"]) => mostrarAviso("info", m, acao),
};

export function useAvisos(): Aviso[] {
  return useSyncExternalStore(
    (f) => {
      ouvintesAvisos.add(f);
      return () => ouvintesAvisos.delete(f);
    },
    () => avisos,
    () => avisos,
  );
}

// ---------------------------------------------------------------------------
// Estado de salvamento (exibido no topo: "Salvando…", "Alterações salvas")
// ---------------------------------------------------------------------------

interface EstadoSalvamento {
  pendentes: number;
  ultimoErro: string | null;
  salvoEm: number | null;
}

let estado: EstadoSalvamento = { pendentes: 0, ultimoErro: null, salvoEm: null };
const ouvintesSalvamento = new Set<() => void>();

function emitirSalvamento() {
  ouvintesSalvamento.forEach((f) => f());
}

export async function comSalvamento<T>(operacao: () => Promise<T>): Promise<T> {
  estado = { ...estado, pendentes: estado.pendentes + 1, ultimoErro: null };
  emitirSalvamento();
  try {
    const r = await operacao();
    estado = { ...estado, pendentes: Math.max(0, estado.pendentes - 1), salvoEm: Date.now() };
    return r;
  } catch (e) {
    estado = {
      ...estado,
      pendentes: Math.max(0, estado.pendentes - 1),
      ultimoErro: e instanceof Error ? e.message : "Falha ao salvar",
    };
    throw e;
  } finally {
    emitirSalvamento();
  }
}

export function useEstadoSalvamento(): EstadoSalvamento {
  return useSyncExternalStore(
    (f) => {
      ouvintesSalvamento.add(f);
      return () => ouvintesSalvamento.delete(f);
    },
    () => estado,
    () => estado,
  );
}
