"use client";

import { useEffect } from "react";

// Guarda a origem da visita (UTMs, identificadores de clique, página de entrada
// e site de referência) para anexar ao lead do quiz. Não guarda dados pessoais.
// Vale por 90 dias; uma nova campanha substitui a anterior (último toque).

const CHAVE = "amado.atribuicao";
const VALIDADE_MS = 90 * 24 * 60 * 60 * 1000;
const PARAMETROS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"] as const;

export type Atribuicao = Partial<Record<(typeof PARAMETROS)[number], string>> & {
  pagina_entrada?: string;
  referrer?: string;
  registrado_em?: number;
};

function ler(): Atribuicao | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const valor = JSON.parse(bruto) as Atribuicao;
    if (!valor.registrado_em || Date.now() - valor.registrado_em > VALIDADE_MS) return null;
    return valor;
  } catch {
    return null;
  }
}

function gravar(valor: Atribuicao) {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(valor));
  } catch {
    /* navegação privada ou armazenamento bloqueado: segue sem atribuição */
  }
}

let memoria: Atribuicao | null = null;

export function lerAtribuicao(): Atribuicao {
  return ler() ?? memoria ?? {};
}

export function CapturaAtribuicao() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const campanha: Atribuicao = {};
    for (const p of PARAMETROS) {
      const v = url.searchParams.get(p);
      if (v) campanha[p] = v.slice(0, 150);
    }
    const referrerExterno = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer.slice(0, 300) : undefined;
    const atual = ler();
    if (Object.keys(campanha).length > 0) {
      memoria = { ...campanha, pagina_entrada: url.pathname.slice(0, 300), referrer: referrerExterno, registrado_em: Date.now() };
      gravar(memoria);
    } else if (!atual) {
      memoria = { pagina_entrada: url.pathname.slice(0, 300), referrer: referrerExterno, registrado_em: Date.now() };
      gravar(memoria);
    }
  }, []);
  return null;
}
