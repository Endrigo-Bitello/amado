"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

// Navegação interna do CRM sem recarregar a página: usa history.pushState,
// que o Next.js sincroniza com usePathname/useSearchParams. Toda URL do CRM
// funciona também em acesso direto e após atualizar a página (rota catch-all).

export function navegar(url: string, opcoes?: { substituir?: boolean; manterRolagem?: boolean }) {
  if (typeof window === "undefined") return;
  const atual = window.location.pathname + window.location.search;
  if (url === atual) return;
  if (opcoes?.substituir) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  if (!opcoes?.manterRolagem) {
    const principal = document.getElementById("crm-principal");
    principal?.scrollTo({ top: 0 });
  }
}

export function useRota() {
  const caminho = usePathname() ?? "/crm";
  const busca = useSearchParams();
  const segmentos = useMemo(
    () => caminho.replace(/^\/crm\/?/, "").split("/").filter(Boolean),
    [caminho],
  );

  const parametro = useCallback((nome: string) => busca?.get(nome) ?? null, [busca]);

  const comParametros = useCallback(
    (alteracoes: Record<string, string | null | undefined>, base?: string) => {
      const p = new URLSearchParams(busca?.toString() ?? "");
      for (const [k, v] of Object.entries(alteracoes)) {
        if (v === null || v === undefined || v === "") p.delete(k);
        else p.set(k, v);
      }
      const qs = p.toString();
      return `${base ?? caminho}${qs ? `?${qs}` : ""}`;
    },
    [busca, caminho],
  );

  const definirParametros = useCallback(
    (alteracoes: Record<string, string | null | undefined>, opcoes?: { substituir?: boolean }) => {
      navegar(comParametros(alteracoes), { substituir: opcoes?.substituir, manterRolagem: true });
    },
    [comParametros],
  );

  return { caminho, segmentos, modulo: segmentos[0] ?? "hoje", parametro, comParametros, definirParametros };
}

type PropsLink = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode; substituir?: boolean };

export function Link({ href, children, onClick, substituir, ...resto }: PropsLink) {
  const aoClicar = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (resto.target === "_blank" || !href.startsWith("/crm")) return;
    e.preventDefault();
    navegar(href, { substituir });
  };
  return (
    <a href={href} onClick={aoClicar} {...resto}>
      {children}
    </a>
  );
}
