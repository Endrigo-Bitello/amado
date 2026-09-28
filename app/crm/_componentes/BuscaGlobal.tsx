"use client";

import { useQuery } from "@tanstack/react-query";
import { Archive, CornerDownLeft, ListChecks, Loader2, Magnet, Scale, Search, Users } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { useAuth } from "../_lib/auth";
import { executar } from "../_lib/dados";
import { navegar } from "../_lib/rotas";
import { supabase } from "../_lib/supabase";
import { Modal } from "../_ui/Sobreposicoes";
import { Kbd } from "../_ui/Visuais";

let aberta = false;
const ouvintes = new Set<() => void>();
const emitir = () => ouvintes.forEach((f) => f());

export function abrirBuscaGlobal() {
  aberta = true;
  emitir();
}

function fechar() {
  aberta = false;
  emitir();
}

interface Resultado {
  tipo: "lead" | "cliente" | "caso" | "tarefa";
  id: string;
  titulo: string;
  subtitulo: string | null;
  arquivado: boolean;
}

const TIPOS = {
  lead: { rotulo: "Lead", icone: Magnet, link: (id: string) => `/crm/leads?item=${id}` },
  cliente: { rotulo: "Cliente", icone: Users, link: (id: string) => `/crm/clientes/${id}` },
  caso: { rotulo: "Caso", icone: Scale, link: (id: string) => `/crm/casos/${id}` },
  tarefa: { rotulo: "Tarefa", icone: ListChecks, link: (id: string) => `/crm/tarefas?item=${id}` },
};

export function BuscaGlobal() {
  const { simplificado } = useAuth();
  const estaAberta = useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => aberta,
    () => false,
  );
  const [termo, setTermo] = useState("");
  const [atrasado, setAtrasado] = useState("");
  const [ativo, setAtivo] = useState(0);
  const lista = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setAtrasado(termo.trim()), 220);
    return () => window.clearTimeout(t);
  }, [termo]);

  useEffect(() => {
    if (estaAberta) {
      setTermo("");
      setAtivo(0);
    }
  }, [estaAberta]);

  const consulta = useQuery({
    queryKey: ["busca", atrasado],
    enabled: estaAberta && atrasado.length >= 2,
    queryFn: async () => (await executar(supabase().rpc("busca_global", { p_termo: atrasado }))) as unknown as Resultado[],
    staleTime: 10_000,
  });
  // No modo simplificado a área de Leads não faz parte do menu.
  const resultados = (consulta.data ?? []).filter((r) => !simplificado || r.tipo !== "lead");

  const abrir = (r: Resultado) => {
    fechar();
    navegar(TIPOS[r.tipo].link(r.id));
  };

  const aoTeclar = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && resultados[ativo]) {
      e.preventDefault();
      abrir(resultados[ativo]);
    }
  };

  return (
    <Modal aberto={estaAberta} aoFechar={fechar} titulo="Busca global" largura="md">
      <div onKeyDown={aoTeclar} className="-mx-1 flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-xl border-2 border-crm-tinta bg-white px-3 shadow-crm-bruto">
          <Search size={18} className="text-crm-tinta-3" aria-hidden />
          <input
            data-autofoco
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setAtivo(0);
            }}
            placeholder="Nome, código, telefone, e-mail, CPF ou nº do processo"
            aria-label="Termo de busca"
            aria-controls="crm-resultados-busca"
            className="h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-crm-tinta-3"
          />
          {consulta.isFetching && <Loader2 size={16} className="animate-spin text-crm-folha" aria-hidden />}
        </div>
        {atrasado.length < 2 ? (
          <p className="px-1 text-sm text-crm-tinta-3">Digite ao menos 2 caracteres. A busca mostra apenas o que o seu perfil pode acessar.</p>
        ) : consulta.isError ? (
          <p role="alert" className="px-1 text-sm text-crm-perigo">Não foi possível buscar agora. Tente novamente.</p>
        ) : resultados.length === 0 && !consulta.isFetching ? (
          <p className="px-1 text-sm text-crm-tinta-2">Nenhum resultado para “{atrasado}”.</p>
        ) : (
          <ul id="crm-resultados-busca" ref={lista} role="listbox" aria-label="Resultados" className="flex max-h-[50vh] flex-col overflow-y-auto">
            {resultados.map((r, i) => {
              const tipo = TIPOS[r.tipo];
              const Icone = tipo.icone;
              return (
                <li key={`${r.tipo}-${r.id}`} role="option" aria-selected={i === ativo}>
                  <button
                    type="button"
                    onMouseEnter={() => setAtivo(i)}
                    onClick={() => abrir(r)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === ativo ? "bg-crm-verde-claro" : "hover:bg-crm-suave"}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-crm-suave-2 text-crm-verde">
                      <Icone size={16} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-crm-tinta">{r.titulo}</span>
                      <span className="block truncate text-xs text-crm-tinta-3">
                        {tipo.rotulo}
                        {r.subtitulo ? ` · ${r.subtitulo}` : ""}
                      </span>
                    </span>
                    {r.arquivado && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-crm-tinta-3">
                        <Archive size={12} aria-hidden /> Arquivado
                      </span>
                    )}
                    {i === ativo && <CornerDownLeft size={14} className="text-crm-tinta-3" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="flex items-center gap-2 px-1 text-xs text-crm-tinta-3">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navegar · <Kbd>Enter</Kbd> abrir · <Kbd>Esc</Kbd> fechar
        </p>
      </div>
    </Modal>
  );
}
