"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Magnet, Scale, Search, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { executar } from "../_lib/dados";
import { supabase } from "../_lib/supabase";
import { classeCampo } from "../_ui/Campos";
import { Popover } from "../_ui/Sobreposicoes";

export type TipoRegistro = "lead" | "cliente" | "caso";

export interface RegistroSelecionado {
  tipo: TipoRegistro;
  id: string;
  titulo: string;
  subtitulo?: string | null;
}

const ICONES = { lead: Magnet, cliente: Users, caso: Scale };
const ROTULOS = { lead: "Lead", cliente: "Cliente", caso: "Caso" };

interface Props {
  id?: string;
  valor: RegistroSelecionado | null;
  aoAlterar: (r: RegistroSelecionado | null) => void;
  tipos?: TipoRegistro[];
  placeholder?: string;
  desabilitado?: boolean;
  "aria-describedby"?: string;
}

/** Busca e seleciona um lead, cliente ou caso (respeita as permissões do usuário). */
export function SeletorRegistro({ id, valor, aoAlterar, tipos = ["lead", "cliente", "caso"], placeholder = "Buscar por nome ou código…", desabilitado, ...aria }: Props) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [atrasado, setAtrasado] = useState("");
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setAtrasado(termo.trim()), 220);
    return () => window.clearTimeout(t);
  }, [termo]);
  const consulta = useQuery({
    queryKey: ["busca", "seletor", atrasado],
    enabled: aberto && atrasado.length >= 2,
    queryFn: async () => (await executar(supabase().rpc("busca_global", { p_termo: atrasado }))) as unknown as (RegistroSelecionado & { tipo: string; arquivado: boolean })[],
  });
  const resultados = (consulta.data ?? []).filter((r) => tipos.includes(r.tipo as TipoRegistro) && !r.arquivado);

  if (valor) {
    const Icone = ICONES[valor.tipo];
    return (
      <div className={`${classeCampo} flex h-9 items-center gap-2`}>
        <Icone size={15} className="shrink-0 text-crm-verde" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          <span className="text-xs font-bold text-crm-tinta-3">{ROTULOS[valor.tipo]}: </span>
          {valor.titulo}
        </span>
        {!desabilitado && (
          <button type="button" onClick={() => aoAlterar(null)} className="rounded p-0.5 text-crm-tinta-3 hover:text-crm-tinta" aria-label="Remover vínculo">
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <button id={id} ref={ref} type="button" disabled={desabilitado} onClick={() => setAberto(true)} className={`${classeCampo} flex h-9 items-center gap-2 text-left text-crm-tinta-3`} {...aria}>
        <Search size={15} aria-hidden />
        {placeholder}
      </button>
      <Popover aberto={aberto} aoFechar={() => setAberto(false)} ancora={ref} largura="ancora" rotulo="Buscar registro">
        <div className="flex items-center gap-2 border-b border-crm-linha px-3 py-2">
          <Search size={14} className="text-crm-tinta-3" aria-hidden />
          <input data-autofoco value={termo} onChange={(e) => setTermo(e.target.value)} placeholder={placeholder} aria-label="Buscar" className="w-full bg-transparent text-sm outline-none" />
          {consulta.isFetching && <Loader2 size={14} className="animate-spin text-crm-folha" aria-hidden />}
        </div>
        <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
          {atrasado.length < 2 && <li className="px-3 py-2 text-xs text-crm-tinta-3">Digite ao menos 2 letras.</li>}
          {atrasado.length >= 2 && !consulta.isFetching && resultados.length === 0 && <li className="px-3 py-2 text-xs text-crm-tinta-3">Nada encontrado.</li>}
          {resultados.map((r) => {
            const Icone = ICONES[r.tipo];
            return (
              <li key={`${r.tipo}-${r.id}`} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => {
                    aoAlterar({ tipo: r.tipo, id: r.id, titulo: r.titulo, subtitulo: r.subtitulo });
                    setAberto(false);
                    setTermo("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-crm-suave focus:bg-crm-suave focus:outline-none"
                >
                  <Icone size={15} className="shrink-0 text-crm-verde" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.titulo}</span>
                    <span className="block truncate text-xs text-crm-tinta-3">
                      {ROTULOS[r.tipo]}
                      {r.subtitulo ? ` · ${r.subtitulo}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    </>
  );
}
