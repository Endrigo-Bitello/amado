"use client";

import { MoreHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import { Abas, type Aba } from "../_ui/Abas";
import { Menu, type ItemMenu } from "../_ui/Sobreposicoes";
import { ErroCarga, Carregando } from "../_ui/Visuais";

interface PropsPainel {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  selos?: ReactNode;
  acoes?: ReactNode;
  menu?: ItemMenu[];
  abas: Aba[];
  abaAtiva: string;
  aoTrocarAba: (id: string) => void;
  aoFechar: () => void;
  carregando?: boolean;
  erro?: unknown;
  aoTentarNovamente?: () => void;
  children: ReactNode;
  rotulo: string;
}

/** Estrutura da ficha exibida na gaveta lateral (cabeçalho, ações e abas). */
export function PainelItem({ titulo, subtitulo, selos, acoes, menu, abas, abaAtiva, aoTrocarAba, aoFechar, carregando, erro, aoTentarNovamente, children, rotulo }: PropsPainel) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b-2 border-crm-tinta bg-white px-4 pt-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {subtitulo && <p className="mb-1 text-xs font-semibold text-crm-tinta-3">{subtitulo}</p>}
            <h2 className="font-serif text-xl font-semibold leading-snug text-crm-tinta">{titulo}</h2>
            {selos && <div className="mt-2 flex flex-wrap items-center gap-1.5">{selos}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {menu && menu.length > 0 && (
              <Menu
                rotulo={`Mais ações — ${rotulo}`}
                itens={menu}
                gatilho={(p) => (
                  <button {...p} type="button" className="rounded-lg p-2 text-crm-tinta-2 hover:bg-crm-suave hover:text-crm-tinta" aria-label="Mais ações">
                    <MoreHorizontal size={18} />
                  </button>
                )}
              />
            )}
            <button type="button" onClick={aoFechar} className="rounded-lg p-2 text-crm-tinta-2 hover:bg-crm-suave hover:text-crm-tinta" aria-label="Fechar ficha">
              <X size={18} />
            </button>
          </div>
        </div>
        {acoes && <div className="mt-3 flex flex-wrap items-center gap-2">{acoes}</div>}
        <Abas abas={abas} ativa={abaAtiva} aoTrocar={aoTrocarAba} rotulo={`Seções de ${rotulo}`} className="mt-3 border-b-0" />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6" role="tabpanel" aria-label={abas.find((a) => a.id === abaAtiva)?.rotulo}>
        {carregando ? <Carregando /> : erro ? <ErroCarga aoTentarNovamente={aoTentarNovamente} /> : children}
      </div>
    </div>
  );
}
