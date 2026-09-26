"use client";

import { Filter, X } from "lucide-react";
import { useAuth } from "./auth";
import { useConfig } from "./config";
import { PRESETS, type ContextoPreset, type Preset } from "./presets";
import { useRota } from "./rotas";

export function useContextoPreset(somenteMeus: boolean): ContextoPreset | null {
  const { perfil } = useAuth();
  const config = useConfig();
  if (!perfil || config.carregando) return null;
  const abertas = config.etapasDe("lead").filter((e) => e.categoria === "aberta");
  const painel = config.cfg<{ horas_sem_retorno?: number; dias_prazos_proximos?: number }>("painel", {});
  return {
    usuarioId: perfil.id,
    somenteMeus,
    etapaInicialLead: abertas[0]?.id ?? null,
    etapasLeadAbertas: abertas.map((e) => e.id),
    horasSemRetorno: painel.horas_sem_retorno ?? 24,
    diasPrazosProximos: painel.dias_prazos_proximos ?? 7,
  };
}

/** Preset ativo na URL (?preset=...&meus=1) para um quadro. */
export function usePresetAtivo(tabelas: Preset["tabela"][]): { preset: Preset | null; ctx: ContextoPreset | null; limpar: () => void } {
  const { parametro, definirParametros } = useRota();
  const id = parametro("preset");
  const preset = id && PRESETS[id] && tabelas.includes(PRESETS[id].tabela) ? PRESETS[id] : null;
  const ctx = useContextoPreset(parametro("meus") === "1");
  return { preset, ctx, limpar: () => definirParametros({ preset: null, meus: null }) };
}

export function AvisoPreset({ preset, ctx, aoLimpar }: { preset: Preset | null; ctx: ContextoPreset | null; aoLimpar: () => void }) {
  if (!preset || !ctx) return null;
  return (
    <div role="status" className="flex items-start gap-2 rounded-xl border-2 border-crm-tinta bg-crm-ouro-claro px-3 py-2 text-sm shadow-crm-bruto">
      <Filter size={16} className="mt-0.5 shrink-0 text-crm-ouro-escuro" aria-hidden />
      <p className="flex-1">
        <strong>Filtro do painel: {preset.rotulo}</strong>
        {ctx.somenteMeus && " (somente meus)"} — {preset.descricao(ctx)}
      </p>
      <button type="button" onClick={aoLimpar} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-crm-tinta hover:bg-white/70">
        <X size={13} aria-hidden /> Remover filtro
      </button>
    </div>
  );
}
