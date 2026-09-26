"use client";

import { ArrowLeft, Loader2, Lock, LogIn, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase, supabaseConfigurado } from "../_lib/supabase";

function destinoSeguro(valor: string | null): string {
  // Evita redirecionamento para fora do CRM.
  if (!valor || !valor.startsWith("/crm") || valor.startsWith("//") || valor.startsWith("/crm/login")) return "/crm";
  return valor;
}

export function TelaLogin() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"entrar" | "recuperar">("entrar");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [proximo, setProximo] = useState("/crm");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setProximo(destinoSeguro(p.get("proximo")));
    if (p.get("motivo") === "sessao") setErro("Sua sessão expirou. Entre novamente.");
    if (!supabaseConfigurado) return;
    // Já logado: segue direto para o CRM.
    supabase()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) window.location.replace(destinoSeguro(p.get("proximo")));
      });
  }, []);

  const entrar = async () => {
    setErro(null);
    setMensagem(null);
    if (!email.trim() || !senha) {
      setErro("Informe e-mail e senha.");
      return;
    }
    setEnviando(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) {
      setErro(
        /invalid login credentials/i.test(error.message)
          ? "E-mail ou senha incorretos."
          : /banned|disabled/i.test(error.message)
            ? "Esta conta está desativada. Procure o administrador."
            : /rate|too many/i.test(error.message)
              ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
              : "Não foi possível entrar agora. Tente novamente.",
      );
      return;
    }
    window.location.replace(proximo);
  };

  const recuperar = async () => {
    setErro(null);
    setMensagem(null);
    if (!email.trim()) {
      setErro("Informe o e-mail da sua conta.");
      return;
    }
    setEnviando(true);
    await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/crm/redefinir-senha` });
    setEnviando(false);
    // Resposta neutra: não revela se o e-mail existe.
    setMensagem("Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Caso não receba, peça ao administrador para redefini-la.");
  };

  return (
    <div className="crm-root relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-crm-folha opacity-10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-crm-ouro opacity-20 blur-3xl" aria-hidden />
      <Link href="/" className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-crm-tinta-2 hover:bg-crm-suave hover:text-crm-tinta">
        <ArrowLeft size={16} aria-hidden /> Voltar ao site
      </Link>
      <main className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="font-serif text-3xl font-medium tracking-wide text-crm-verde">
            Amado <span className="font-light text-crm-ouro-escuro">&amp; Amado Jr.</span>
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-crm-tinta-3">Área restrita · CRM jurídico</p>
        </div>
        <div className="rounded-3xl border-2 border-crm-tinta bg-white p-7 shadow-[6px_6px_0_0_#263A2D] sm:p-8">
          <h1 className="font-serif text-xl font-semibold">{modo === "entrar" ? "Entrar no CRM" : "Recuperar acesso"}</h1>
          <p className="mt-1 text-sm text-crm-tinta-2">{modo === "entrar" ? "Use a conta criada pelo administrador do escritório." : "Enviaremos um link para você criar uma nova senha."}</p>
          {!supabaseConfigurado ? (
            <p role="alert" className="mt-5 rounded-xl border-2 border-crm-alerta bg-crm-alerta-claro p-3 text-sm text-crm-alerta">
              O CRM ainda não foi configurado nesta hospedagem (variáveis do Supabase ausentes).
            </p>
          ) : (
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (modo === "entrar") entrar();
                else recuperar();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-[13px] font-semibold text-crm-tinta-2">
                  E-mail
                </label>
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-crm-tinta-3" aria-hidden />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 w-full rounded-xl border border-crm-linha-forte bg-white pl-9 pr-3 text-[15px] outline-none focus:border-crm-folha focus:ring-2 focus:ring-crm-folha/20"
                  />
                </div>
              </div>
              {modo === "entrar" && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="senha" className="text-[13px] font-semibold text-crm-tinta-2">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-crm-tinta-3" aria-hidden />
                    <input
                      id="senha"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="h-11 w-full rounded-xl border border-crm-linha-forte bg-white pl-9 pr-3 text-[15px] outline-none focus:border-crm-folha focus:ring-2 focus:ring-crm-folha/20"
                    />
                  </div>
                </div>
              )}
              {erro && (
                <p role="alert" className="rounded-xl bg-crm-perigo-claro px-3 py-2 text-sm font-semibold text-crm-perigo">
                  {erro}
                </p>
              )}
              {mensagem && (
                <p role="status" className="rounded-xl bg-crm-verde-claro px-3 py-2 text-sm text-crm-verde">
                  {mensagem}
                </p>
              )}
              <button
                type="submit"
                disabled={enviando}
                className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 border-crm-tinta bg-crm-verde text-sm font-bold uppercase tracking-wider text-white shadow-[3px_3px_0_0_#1D2A21] transition-all hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_#1D2A21] disabled:opacity-60"
              >
                {enviando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <LogIn size={16} aria-hidden />}
                {modo === "entrar" ? "Entrar" : "Enviar link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setModo(modo === "entrar" ? "recuperar" : "entrar");
                  setErro(null);
                  setMensagem(null);
                }}
                className="text-sm font-semibold text-crm-folha hover:underline"
              >
                {modo === "entrar" ? "Esqueci minha senha" : "Voltar para o login"}
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-crm-tinta-3">Acesso monitorado. Dados protegidos conforme a LGPD e o sigilo profissional.</p>
      </main>
    </div>
  );
}
