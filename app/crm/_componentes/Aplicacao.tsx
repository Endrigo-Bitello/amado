"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { LogOut, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { ProvedorAuth, saindoDoCrm, useAuth } from "../_lib/auth";
import { criarClienteConsultas } from "../_lib/dados";
import { supabaseConfigurado } from "../_lib/supabase";
import { Botao } from "../_ui/Botao";
import { Shell } from "./Shell";

export default function Aplicacao() {
  const [consultas] = useState(criarClienteConsultas);
  if (!supabaseConfigurado) return <CrmNaoConfigurado />;
  return (
    <QueryClientProvider client={consultas}>
      <ProvedorAuth>
        <Portao />
      </ProvedorAuth>
    </QueryClientProvider>
  );
}

function Portao() {
  const { sessao, sair } = useAuth();

  useEffect(() => {
    if (sessao.estado === "anonimo" && !saindoDoCrm()) {
      const proximo = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/crm/login?proximo=${encodeURIComponent(proximo)}`);
    }
  }, [sessao.estado]);

  if (sessao.estado === "carregando" || sessao.estado === "anonimo") {
    return (
      <div className="crm-root flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <span className="font-serif text-2xl font-semibold tracking-wide text-crm-verde">
          Amado <span className="font-light text-crm-ouro-escuro">&amp; Amado Jr.</span>
        </span>
        <span className="sr-only">Verificando sua sessão…</span>
      </div>
    );
  }

  if (sessao.estado === "sem_acesso") {
    return (
      <div className="crm-root flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border-2 border-crm-tinta bg-white p-8 text-center shadow-crm-bruto-verde">
          <ShieldAlert className="mx-auto mb-4 text-crm-alerta" size={36} aria-hidden />
          <h1 className="font-serif text-xl font-semibold">Acesso não liberado</h1>
          <p className="mt-2 text-sm text-crm-tinta-2">
            {sessao.motivo === "inativo"
              ? "Sua conta está desativada. Procure o administrador do escritório."
              : "Sua conta ainda não foi vinculada a um perfil do CRM. Procure o administrador do escritório."}
          </p>
          {sessao.email && <p className="mt-3 text-xs text-crm-tinta-3">Conta: {sessao.email}</p>}
          <Botao variante="secundario" className="mt-6" icone={<LogOut size={15} />} onClick={sair}>
            Sair
          </Botao>
        </div>
      </div>
    );
  }

  return <Shell />;
}

function CrmNaoConfigurado() {
  return (
    <div className="crm-root flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border-2 border-crm-tinta bg-white p-8 shadow-crm-bruto-verde">
        <h1 className="font-serif text-xl font-semibold">CRM ainda não configurado</h1>
        <p className="mt-2 text-sm leading-relaxed text-crm-tinta-2">
          Defina as variáveis de ambiente <code className="rounded bg-crm-suave px-1">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
          <code className="rounded bg-crm-suave px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (ou{" "}
          <code className="rounded bg-crm-suave px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>) na hospedagem e publique
          novamente. O passo a passo está em <code className="rounded bg-crm-suave px-1">docs/CRM.md</code>.
        </p>
      </div>
    </div>
  );
}
