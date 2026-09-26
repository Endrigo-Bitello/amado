"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { executar } from "./dados";
import { supabase } from "./supabase";
import type { SessaoPerfil } from "./tipos";

type EstadoAuth =
  | { estado: "carregando" }
  | { estado: "anonimo" }
  | { estado: "sem_acesso"; email: string | null; motivo: "sem_cadastro" | "inativo" }
  | { estado: "ativo"; perfil: SessaoPerfil };

interface ContextoAuth {
  sessao: EstadoAuth;
  perfil: SessaoPerfil | null;
  pode: (permissao: string) => boolean;
  sair: () => Promise<void>;
  recarregar: () => void;
}

const Contexto = createContext<ContextoAuth | null>(null);

// Logout intencional: evita que o redirecionamento automático de "sessão
// ausente" dispute a navegação com o logout.
let saindo = false;
export const saindoDoCrm = () => saindo;

export function ProvedorAuth({ children }: { children: ReactNode }) {
  const consultas = useQueryClient();
  const [usuarioId, setUsuarioId] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const cliente = supabase();
    let ativo = true;
    // getUser valida o token no servidor de autenticação (não confia só no cookie).
    cliente.auth.getUser().then(({ data, error }) => {
      if (!ativo) return;
      if (error || !data.user) {
        setUsuarioId(null);
        return;
      }
      setUsuarioId(data.user.id);
      setEmail(data.user.email ?? null);
    });
    const { data: assinatura } = cliente.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "SIGNED_OUT") {
        setUsuarioId(null);
        consultas.clear();
      } else if (sessao?.user) {
        setUsuarioId(sessao.user.id);
        setEmail(sessao.user.email ?? null);
      }
    });
    return () => {
      ativo = false;
      assinatura.subscription.unsubscribe();
    };
  }, [consultas]);

  const perfilConsulta = useQuery({
    queryKey: ["sessao", usuarioId],
    enabled: Boolean(usuarioId),
    queryFn: async () => {
      const dados = await executar(supabase().rpc("meu_perfil"));
      return (dados as unknown as SessaoPerfil | null) ?? null;
    },
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });

  useEffect(() => {
    if (perfilConsulta.data?.ativo) {
      supabase().rpc("registrar_acesso").then(() => undefined);
    }
  }, [perfilConsulta.data?.id, perfilConsulta.data?.ativo]);

  const sessao: EstadoAuth = useMemo(() => {
    if (usuarioId === undefined) return { estado: "carregando" };
    if (usuarioId === null) return { estado: "anonimo" };
    if (perfilConsulta.isLoading) return { estado: "carregando" };
    const perfil = perfilConsulta.data;
    if (!perfil) return { estado: "sem_acesso", email, motivo: "sem_cadastro" };
    if (!perfil.ativo) return { estado: "sem_acesso", email, motivo: "inativo" };
    return { estado: "ativo", perfil };
  }, [usuarioId, perfilConsulta.isLoading, perfilConsulta.data, email]);

  const permissoes = useMemo(
    () => new Set(sessao.estado === "ativo" ? sessao.perfil.permissoes : []),
    [sessao],
  );

  const pode = useCallback((p: string) => permissoes.has(p), [permissoes]);

  const sair = useCallback(async () => {
    saindo = true;
    await supabase().auth.signOut();
    consultas.clear();
    window.location.replace("/crm/login");
  }, [consultas]);

  const valor = useMemo<ContextoAuth>(
    () => ({
      sessao,
      perfil: sessao.estado === "ativo" ? sessao.perfil : null,
      pode,
      sair,
      recarregar: () => perfilConsulta.refetch(),
    }),
    [sessao, pode, sair, perfilConsulta],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): ContextoAuth {
  const c = useContext(Contexto);
  if (!c) throw new Error("useAuth fora do ProvedorAuth");
  return c;
}

export function usePode(permissao: string): boolean {
  return useAuth().pode(permissao);
}
