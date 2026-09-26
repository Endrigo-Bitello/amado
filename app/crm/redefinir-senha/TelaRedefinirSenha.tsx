"use client";

import { KeyRound, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase, supabaseConfigurado } from "../_lib/supabase";

export function TelaRedefinirSenha() {
  const [estado, setEstado] = useState<"verificando" | "pronto" | "invalido" | "concluido">("verificando");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!supabaseConfigurado) {
      setEstado("invalido");
      return;
    }
    const cliente = supabase();
    const codigo = new URLSearchParams(window.location.search).get("code");
    const validar = async () => {
      if (codigo) {
        const { error } = await cliente.auth.exchangeCodeForSession(codigo);
        if (error) {
          setEstado("invalido");
          return;
        }
        window.history.replaceState(null, "", "/crm/redefinir-senha");
      }
      const { data } = await cliente.auth.getUser();
      setEstado(data.user ? "pronto" : "invalido");
    };
    validar();
  }, []);

  const salvar = async () => {
    if (senha.length < 10 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return setErro("Use ao menos 10 caracteres, com letras e números.");
    if (senha !== confirmacao) return setErro("As senhas não coincidem.");
    setSalvando(true);
    const { error } = await supabase().auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) return setErro("Não foi possível salvar a nova senha. Solicite um novo link.");
    setEstado("concluido");
    window.setTimeout(() => window.location.replace("/crm"), 1500);
  };

  return (
    <div className="crm-root flex min-h-screen items-center justify-center px-4">
      <main className="w-full max-w-md rounded-3xl border-2 border-crm-tinta bg-white p-8 shadow-[6px_6px_0_0_#263A2D]">
        <KeyRound className="mb-3 text-crm-verde" size={28} aria-hidden />
        <h1 className="font-serif text-xl font-semibold">Criar nova senha</h1>
        {estado === "verificando" && (
          <p className="mt-4 flex items-center gap-2 text-sm text-crm-tinta-2" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden /> Validando o link…
          </p>
        )}
        {estado === "invalido" && (
          <p role="alert" className="mt-4 text-sm text-crm-perigo">
            Link inválido ou expirado. Solicite um novo em <Link href="/crm/login" className="font-semibold underline">Entrar → Esqueci minha senha</Link>, ou peça ao administrador para redefinir sua senha.
          </p>
        )}
        {estado === "concluido" && (
          <p role="status" className="mt-4 text-sm text-crm-verde">
            Senha alterada. Redirecionando para o CRM…
          </p>
        )}
        {estado === "pronto" && (
          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              salvar();
            }}
          >
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-crm-tinta-2">
              Nova senha
              <input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="h-11 rounded-xl border border-crm-linha-forte px-3 text-[15px] font-normal outline-none focus:border-crm-folha focus:ring-2 focus:ring-crm-folha/20" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-crm-tinta-2">
              Confirmar nova senha
              <input type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} className="h-11 rounded-xl border border-crm-linha-forte px-3 text-[15px] font-normal outline-none focus:border-crm-folha focus:ring-2 focus:ring-crm-folha/20" />
            </label>
            {erro && (
              <p role="alert" className="text-sm font-semibold text-crm-perigo">
                {erro}
              </p>
            )}
            <button type="submit" disabled={salvando} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 border-crm-tinta bg-crm-verde text-sm font-bold uppercase tracking-wider text-white shadow-[3px_3px_0_0_#1D2A21] disabled:opacity-60">
              {salvando && <Loader2 size={16} className="animate-spin" aria-hidden />} Salvar senha
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
