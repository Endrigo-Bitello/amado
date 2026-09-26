"use client";

import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import { aviso, comSalvamento } from "../../_lib/avisos";
import { corTexto, PALETA } from "../../_lib/cores";
import { ErroCrm, executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { supabase } from "../../_lib/supabase";

/** Seção de uma página da Administração. */
export function SecaoAdmin({ titulo, descricao, acoes, children }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-lg font-semibold text-crm-tinta">{titulo}</h2>
          {descricao && <p className="mt-0.5 max-w-3xl text-sm text-crm-tinta-2">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
      {children}
    </section>
  );
}

/** Escolha de cor restrita à paleta da identidade visual (contraste garantido). */
export function SeletorCor({ valor, aoAlterar, rotulo }: { valor: string | null | undefined; aoAlterar: (cor: string) => void; rotulo: string }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-1.5">
      {PALETA.map((p) => {
        const selecionada = (valor ?? "").toLowerCase() === p.cor.toLowerCase();
        return (
          <button
            key={p.cor}
            type="button"
            role="radio"
            aria-checked={selecionada}
            aria-label={p.nome}
            title={p.nome}
            onClick={() => aoAlterar(p.cor)}
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${selecionada ? "border-crm-tinta" : "border-white shadow-[0_0_0_1px_#CFC7B8]"}`}
            style={{ backgroundColor: p.cor }}
          >
            {selecionada && <Check size={13} strokeWidth={3} style={{ color: corTexto(p.cor) }} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/** Botões de mover para cima/baixo (alternativa acessível ao arrastar). */
export function BotoesOrdem({ aoSubir, aoDescer, primeiro, ultimo, rotulo }: { aoSubir: () => void; aoDescer: () => void; primeiro: boolean; ultimo: boolean; rotulo: string }) {
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={primeiro} onClick={aoSubir} className="rounded p-0.5 text-crm-tinta-3 hover:bg-crm-suave hover:text-crm-tinta disabled:opacity-30" aria-label={`Mover ${rotulo} para cima`}>
        <ArrowUp size={13} />
      </button>
      <button type="button" disabled={ultimo} onClick={aoDescer} className="rounded p-0.5 text-crm-tinta-3 hover:bg-crm-suave hover:text-crm-tinta disabled:opacity-30" aria-label={`Mover ${rotulo} para baixo`}>
        <ArrowDown size={13} />
      </button>
    </span>
  );
}

/** Gravações da Administração: salvam, avisam e atualizam a configuração de todos (tempo real). */
export function useAdmin() {
  const { invalidar } = useGravacao();
  const salvar = useCallback(
    async (tabela: string, dados: Record<string, unknown>, filtro?: Record<string, unknown>, mensagem?: string, chaves: string[] = ["config"]) => {
      try {
        await comSalvamento(async () => {
          let q;
          if (filtro) {
            let u = supabase().from(tabela as never).update(dados as never);
            for (const [k, v] of Object.entries(filtro)) u = u.eq(k, v as never);
            q = u.select();
          } else {
            q = supabase().from(tabela as never).insert(dados as never).select();
          }
          const linhas = (await executar(q)) as unknown[];
          if (filtro && linhas.length === 0) throw new ErroCrm("Nada foi salvo: o item não existe mais ou você não tem permissão.");
          return linhas;
        });
        if (mensagem) aviso.sucesso(mensagem);
        return true;
      } catch (e) {
        aviso.erro(mensagemErro(e));
        return false;
      } finally {
        invalidar(...chaves);
      }
    },
    [invalidar],
  );
  const excluir = useCallback(
    async (tabela: string, filtro: Record<string, unknown>, mensagem?: string, chaves: string[] = ["config"]) => {
      try {
        await comSalvamento(async () => {
          let q = supabase().from(tabela as never).delete();
          for (const [k, v] of Object.entries(filtro)) q = q.eq(k, v as never);
          const linhas = (await executar(q.select())) as unknown[];
          if (linhas.length === 0) throw new ErroCrm("Nada foi excluído: o item não existe mais ou você não tem permissão.");
        });
        if (mensagem) aviso.sucesso(mensagem);
        return true;
      } catch (e) {
        aviso.erro(mensagemErro(e));
        return false;
      } finally {
        invalidar(...chaves);
      }
    },
    [invalidar],
  );
  /** Regrava a ordem (10, 20, 30…) dos itens na sequência informada. */
  const reordenar = useCallback(
    async (tabela: string, chaves: Record<string, unknown>[], chavesConsulta: string[] = ["config"]) => {
      try {
        await comSalvamento(async () => {
          for (let i = 0; i < chaves.length; i++) {
            let q = supabase().from(tabela as never).update({ ordem: (i + 1) * 10 } as never);
            for (const [k, v] of Object.entries(chaves[i])) q = q.eq(k, v as never);
            await executar(q.select());
          }
        });
      } catch (e) {
        aviso.erro(mensagemErro(e));
      } finally {
        invalidar(...chavesConsulta);
      }
    },
    [invalidar],
  );
  return { salvar, excluir, reordenar, invalidar };
}

export function mover<T>(lista: T[], de: number, para: number): T[] {
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item);
  return nova;
}

/** Identificador estável (a–z, 0–9, _) a partir de um rótulo. */
export function valorDe(rotulo: string): string {
  return (
    rotulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50) || "opcao"
  );
}

export function Aviso({ children, tom = "info" }: { children: ReactNode; tom?: "info" | "alerta" }) {
  return (
    <p className={`rounded-xl border px-3 py-2 text-sm ${tom === "alerta" ? "border-[#F3D19A] bg-crm-alerta-claro text-crm-alerta" : "border-crm-linha bg-crm-fundo text-crm-tinta-2"}`}>
      {children}
    </p>
  );
}
