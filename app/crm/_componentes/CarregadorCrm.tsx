"use client";

import dynamic from "next/dynamic";

function TelaInicial() {
  return (
    <div className="crm-root flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
        <span className="font-serif text-2xl font-semibold tracking-wide text-crm-verde">
          Amado <span className="font-light text-crm-ouro-escuro">&amp; Amado Jr.</span>
        </span>
        <span className="h-1 w-24 overflow-hidden rounded-full bg-crm-suave-2">
          <span className="crm-esqueleto block h-full w-full" />
        </span>
        <span className="sr-only">Carregando o CRM</span>
      </div>
    </div>
  );
}

// A aplicação depende de APIs do navegador (sessão, tempo real); é carregada
// apenas no cliente.
const Aplicacao = dynamic(() => import("./Aplicacao"), { ssr: false, loading: TelaInicial });

export function CarregadorCrm() {
  return <Aplicacao />;
}
