"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { fecharAviso, useAvisos } from "../_lib/avisos";
import { Botao } from "./Botao";
import { AreaTexto, GrupoCampo } from "./Campos";
import { Modal } from "./Sobreposicoes";

// ---------------------------------------------------------------------------
// Avisos (toasts) — anunciados a leitores de tela
// ---------------------------------------------------------------------------

export function AreaAvisos() {
  const avisos = useAvisos();
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
    >
      {avisos.map((a) => (
        <div
          key={a.id}
          role={a.tipo === "erro" ? "alert" : "status"}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border-2 bg-white px-4 py-3 text-sm shadow-crm-flutuante ${
            a.tipo === "erro" ? "border-crm-perigo" : a.tipo === "sucesso" ? "border-crm-folha" : "border-crm-tinta"
          }`}
        >
          <span className="mt-0.5 shrink-0" aria-hidden>
            {a.tipo === "erro" ? (
              <XCircle size={18} className="text-crm-perigo" />
            ) : a.tipo === "sucesso" ? (
              <CheckCircle2 size={18} className="text-crm-folha" />
            ) : (
              <Info size={18} className="text-crm-info" />
            )}
          </span>
          <p className="flex-1 text-crm-tinta">{a.mensagem}</p>
          {a.acao && (
            <button
              type="button"
              className="shrink-0 text-sm font-bold text-crm-folha underline-offset-2 hover:underline"
              onClick={() => {
                a.acao?.executar();
                fecharAviso(a.id);
              }}
            >
              {a.acao.rotulo}
            </button>
          )}
          <button type="button" onClick={() => fecharAviso(a.id)} className="shrink-0 text-crm-tinta-3 hover:text-crm-tinta" aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmação de ações (promise), com motivo opcional/obrigatório
// ---------------------------------------------------------------------------

interface PedidoConfirmacao {
  titulo: string;
  mensagem?: ReactNode;
  confirmar?: string;
  cancelar?: string;
  perigo?: boolean;
  motivo?: { rotulo: string; obrigatorio?: boolean; placeholder?: string };
  resolver: (r: { confirmado: boolean; motivo?: string }) => void;
}

let pedidoAtual: PedidoConfirmacao | null = null;
const ouvintes = new Set<() => void>();
const emitir = () => ouvintes.forEach((f) => f());

export function confirmar(opcoes: Omit<PedidoConfirmacao, "resolver">): Promise<{ confirmado: boolean; motivo?: string }> {
  return new Promise((resolver) => {
    pedidoAtual = { ...opcoes, resolver };
    emitir();
  });
}

export async function confirmarSimples(opcoes: Omit<PedidoConfirmacao, "resolver" | "motivo">): Promise<boolean> {
  return (await confirmar(opcoes)).confirmado;
}

export function DialogoConfirmacao() {
  const pedido = useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => pedidoAtual,
    () => null,
  );
  const [motivo, setMotivo] = useState("");
  useEffect(() => setMotivo(""), [pedido]);

  if (!pedido) return null;
  const responder = (confirmado: boolean) => {
    pedido.resolver({ confirmado, motivo: motivo.trim() || undefined });
    pedidoAtual = null;
    emitir();
  };
  const bloqueado = Boolean(pedido.motivo?.obrigatorio && motivo.trim().length < 3);

  return (
    <Modal
      aberto
      aoFechar={() => responder(false)}
      largura="sm"
      titulo={
        <span className="flex items-center gap-2">
          {pedido.perigo && <AlertTriangle size={18} className="text-crm-perigo" aria-hidden />}
          {pedido.titulo}
        </span>
      }
      rodape={
        <>
          <Botao variante="secundario" onClick={() => responder(false)}>
            {pedido.cancelar ?? "Cancelar"}
          </Botao>
          <Botao variante={pedido.perigo ? "perigo" : "primario"} onClick={() => responder(true)} disabled={bloqueado} data-autofoco={pedido.motivo ? undefined : true}>
            {pedido.confirmar ?? "Confirmar"}
          </Botao>
        </>
      }
    >
      {pedido.mensagem && <div className="text-sm leading-relaxed text-crm-tinta-2">{pedido.mensagem}</div>}
      {pedido.motivo && (
        <GrupoCampo rotulo={pedido.motivo.rotulo} obrigatorio={pedido.motivo.obrigatorio} className="mt-4">
          {(p) => (
            <AreaTexto
              {...p}
              data-autofoco
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={pedido.motivo?.placeholder}
            />
          )}
        </GrupoCampo>
      )}
    </Modal>
  );
}
