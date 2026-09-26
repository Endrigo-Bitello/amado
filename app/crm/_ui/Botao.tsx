"use client";

import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variante = "primario" | "secundario" | "fantasma" | "perigo" | "sutil" | "ouro";
type Tamanho = "sm" | "md" | "lg" | "icone" | "icone-sm";

const VARIANTES: Record<Variante, string> = {
  // Assinatura do site: botão arredondado com borda escura e sombra deslocada.
  primario:
    "rounded-full bg-[var(--crm-destaque)] text-white border-2 border-crm-tinta shadow-crm-bruto hover:bg-[var(--crm-destaque-hover)] hover:translate-x-px hover:translate-y-px hover:shadow-[1px_1px_0_0_#1D2A21] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  ouro:
    "rounded-full bg-crm-ouro text-crm-tinta border-2 border-crm-tinta shadow-crm-bruto hover:bg-crm-ouro-claro hover:translate-x-px hover:translate-y-px hover:shadow-[1px_1px_0_0_#1D2A21]",
  secundario:
    "rounded-full bg-white text-crm-tinta border border-crm-linha-forte hover:border-crm-tinta-3 hover:bg-crm-suave",
  fantasma: "rounded-lg text-crm-tinta-2 hover:text-crm-tinta hover:bg-crm-suave",
  sutil: "rounded-lg bg-crm-suave text-crm-tinta hover:bg-crm-suave-2",
  perigo:
    "rounded-full bg-crm-perigo text-white border-2 border-[#7a1a12] hover:bg-[#9b1e14]",
};

const TAMANHOS: Record<Tamanho, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
  icone: "h-9 w-9 justify-center",
  "icone-sm": "h-8 w-8 justify-center",
};

export interface PropsBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  icone?: ReactNode;
  carregando?: boolean;
  larguraTotal?: boolean;
}

export const Botao = forwardRef<HTMLButtonElement, PropsBotao>(function Botao(
  { variante = "secundario", tamanho = "md", icone, carregando, larguraTotal, className = "", children, disabled, type, ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={`inline-flex shrink-0 items-center font-semibold whitespace-nowrap transition-all duration-150 select-none disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-x-0 disabled:translate-y-0 ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${larguraTotal ? "w-full justify-center" : ""} ${className}`}
      {...resto}
    >
      {carregando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icone}
      {children}
    </button>
  );
});
