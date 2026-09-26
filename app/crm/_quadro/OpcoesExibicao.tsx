"use client";

import { Eye } from "lucide-react";
import { useRef, useState } from "react";
import { Botao } from "../_ui/Botao";
import { CaixaSelecao } from "../_ui/Campos";
import { Popover } from "../_ui/Sobreposicoes";

export interface OpcaoExibicao {
  id: string;
  rotulo: string;
  descricao?: string;
  ativo: boolean;
  aoAlterar: (v: boolean) => void;
}

/** Botão "Exibir" com opções que ampliam os dados carregados (arquivados, concluídos…). */
export function OpcoesExibicao({ opcoes }: { opcoes: OpcaoExibicao[] }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const ativas = opcoes.filter((o) => o.ativo).length;
  return (
    <>
      <Botao ref={ref} tamanho="sm" variante={ativas ? "sutil" : "secundario"} icone={<Eye size={14} />} onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        Exibir{ativas ? ` (+${ativas})` : ""}
      </Botao>
      <Popover aberto={aberto} aoFechar={() => setAberto(false)} ancora={ref} largura={300} rotulo="Opções de exibição">
        <div className="flex flex-col gap-3 p-4">
          <p className="text-xs font-semibold text-crm-tinta-3">Incluir também:</p>
          {opcoes.map((o) => (
            <CaixaSelecao key={o.id} marcado={o.ativo} aoAlterar={o.aoAlterar} rotulo={o.rotulo} descricao={o.descricao} />
          ))}
        </div>
      </Popover>
    </>
  );
}
