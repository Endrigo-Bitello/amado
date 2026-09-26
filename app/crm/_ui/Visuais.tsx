"use client";

import { AlertTriangle, Inbox, Loader2, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { corSuave, corTexto, corTextoSobreSuave } from "../_lib/cores";
import { iniciais } from "../_lib/formatos";
import { Botao } from "./Botao";

// ---------------------------------------------------------------------------
// Pílula de situação (cor + texto, nunca só cor)
// ---------------------------------------------------------------------------

interface PropsPilula {
  cor?: string | null;
  children: ReactNode;
  icone?: ReactNode;
  tamanho?: "sm" | "md";
  preenchida?: boolean;
  className?: string;
  titulo?: string;
}

export function Pilula({ cor, children, icone, tamanho = "sm", preenchida = true, className = "", titulo }: PropsPilula) {
  const estilo = preenchida
    ? { backgroundColor: cor ?? "#E9E1D0", color: corTexto(cor ?? "#E9E1D0") }
    : { backgroundColor: corSuave(cor), color: corTextoSobreSuave(cor) };
  return (
    <span
      title={titulo}
      style={estilo}
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-md font-semibold leading-none ${
        tamanho === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[13px]"
      } ${className}`}
    >
      {icone}
      <span className="truncate">{children}</span>
    </span>
  );
}

type Tom = "neutro" | "verde" | "ouro" | "perigo" | "alerta" | "info" | "sucesso";

const TONS: Record<Tom, string> = {
  neutro: "bg-crm-suave text-crm-tinta-2 border-crm-linha",
  verde: "bg-crm-verde-claro text-crm-verde border-crm-verde-borda",
  ouro: "bg-crm-ouro-claro text-crm-ouro-escuro border-[#E6D5B3]",
  perigo: "bg-crm-perigo-claro text-crm-perigo border-[#F5C2BD]",
  alerta: "bg-crm-alerta-claro text-crm-alerta border-[#F3D19A]",
  info: "bg-crm-info-claro text-crm-info border-[#C5D8EC]",
  sucesso: "bg-crm-sucesso-claro text-crm-sucesso border-[#BFDDC2]",
};

export function Selo({ tom = "neutro", children, icone, className = "", titulo }: { tom?: Tom; children: ReactNode; icone?: ReactNode; className?: string; titulo?: string }) {
  return (
    <span
      title={titulo}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TONS[tom]} ${className}`}
    >
      {icone}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Avatares
// ---------------------------------------------------------------------------

export function Avatar({ nome, cor, tamanho = 28, className = "" }: { nome?: string | null; cor?: string | null; tamanho?: number; className?: string }) {
  const fundo = cor ?? "#A1A1AA";
  return (
    <span
      title={nome ?? "Sem responsável"}
      aria-label={nome ?? "Sem responsável"}
      role="img"
      style={{ width: tamanho, height: tamanho, backgroundColor: nome ? fundo : "transparent", color: corTexto(fundo), fontSize: Math.max(10, tamanho * 0.38) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${nome ? "ring-2 ring-white" : "border-2 border-dashed border-crm-linha-forte text-crm-tinta-3"} ${className}`}
    >
      {nome ? iniciais(nome) : "?"}
    </span>
  );
}

export function GrupoAvatares({ pessoas, max = 3, tamanho = 26 }: { pessoas: { nome: string; cor?: string | null }[]; max?: number; tamanho?: number }) {
  const visiveis = pessoas.slice(0, max);
  const resto = pessoas.length - visiveis.length;
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {visiveis.map((p, i) => (
        <Avatar key={`${p.nome}-${i}`} nome={p.nome} cor={p.cor} tamanho={tamanho} />
      ))}
      {resto > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-crm-suave-2 text-[10px] font-bold text-crm-tinta-2 ring-2 ring-white"
          style={{ width: tamanho, height: tamanho }}
        >
          +{resto}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Estados de carregamento, vazio e erro
// ---------------------------------------------------------------------------

export function Carregando({ texto = "Carregando…", className = "" }: { texto?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center gap-2 py-10 text-sm text-crm-tinta-2 ${className}`}>
      <Loader2 size={18} className="animate-spin text-crm-folha" aria-hidden />
      {texto}
    </div>
  );
}

export function EsqueletoLinhas({ linhas = 6, colunas = 5 }: { linhas?: number; colunas?: number }) {
  return (
    <div role="status" aria-label="Carregando dados" className="flex flex-col gap-2 p-4">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: colunas }).map((__, j) => (
            <div key={j} className="crm-esqueleto h-7" style={{ flex: j === 0 ? 3 : 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Vazio({
  titulo,
  descricao,
  icone,
  acao,
  compacto,
}: {
  titulo: string;
  descricao?: ReactNode;
  icone?: ReactNode;
  acao?: ReactNode;
  compacto?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compacto ? "gap-2 py-6" : "gap-3 py-14"} px-4`}>
      <div className={`flex items-center justify-center rounded-2xl border-2 border-crm-linha bg-white text-crm-tinta-3 ${compacto ? "h-10 w-10" : "h-14 w-14"}`}>
        {icone ?? <Inbox size={compacto ? 18 : 24} aria-hidden />}
      </div>
      <div>
        <p className={`font-semibold text-crm-tinta ${compacto ? "text-sm" : "text-base"}`}>{titulo}</p>
        {descricao && <p className="mx-auto mt-1 max-w-md text-sm text-crm-tinta-2">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

export function ErroCarga({ mensagem, aoTentarNovamente }: { mensagem?: string; aoTentarNovamente?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#F5C2BD] bg-crm-perigo-claro text-crm-perigo">
        <AlertTriangle size={22} aria-hidden />
      </div>
      <div>
        <p className="font-semibold text-crm-tinta">Não foi possível carregar</p>
        <p className="mt-1 max-w-md text-sm text-crm-tinta-2">{mensagem ?? "Verifique a conexão e tente novamente."}</p>
      </div>
      {aoTentarNovamente && (
        <Botao variante="secundario" tamanho="sm" icone={<RotateCcw size={14} />} onClick={aoTentarNovamente}>
          Tentar novamente
        </Botao>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estrutura de página e cartões
// ---------------------------------------------------------------------------

export function CabecalhoPagina({
  titulo,
  subtitulo,
  acoes,
  icone,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  icone?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {icone && (
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-crm-tinta bg-crm-verde text-crm-ouro-claro shadow-crm-bruto sm:inline-flex">
            {icone}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl font-semibold tracking-tight text-crm-tinta">{titulo}</h1>
          {subtitulo && <p className="mt-0.5 text-sm text-crm-tinta-2">{subtitulo}</p>}
        </div>
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function Cartao({ children, className = "", titulo, acoes, semPadding }: { children: ReactNode; className?: string; titulo?: ReactNode; acoes?: ReactNode; semPadding?: boolean }) {
  return (
    <section className={`rounded-2xl border border-crm-linha bg-white shadow-crm-cartao ${className}`}>
      {(titulo || acoes) && (
        <header className="flex items-center justify-between gap-3 border-b border-crm-linha px-4 py-3">
          {titulo && <h2 className="text-sm font-bold text-crm-tinta">{titulo}</h2>}
          {acoes && <div className="flex items-center gap-1.5">{acoes}</div>}
        </header>
      )}
      <div className={semPadding ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-crm-linha-forte bg-white px-1 font-mono text-[10px] font-semibold text-crm-tinta-2">
      {children}
    </kbd>
  );
}

export function BarraProgresso({ valor, total, cor = "#3D7B3E", rotulo }: { valor: number; total: number; cor?: string; rotulo: string }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-crm-suave-2">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cor }} />
      </div>
      <span className="w-9 text-right text-xs font-semibold tabular-nums text-crm-tinta-2">{pct}%</span>
    </div>
  );
}

/** Barra segmentada (distribuição por situação), como a de grupos em quadros. */
export function BarraDistribuicao({ partes, altura = 8 }: { partes: { rotulo: string; valor: number; cor: string }[]; altura?: number }) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  if (total === 0) return <div className="rounded-full bg-crm-suave-2" style={{ height: altura }} aria-hidden />;
  return (
    <div
      className="flex w-full overflow-hidden rounded-full"
      style={{ height: altura }}
      role="img"
      aria-label={partes.filter((p) => p.valor > 0).map((p) => `${p.rotulo}: ${p.valor}`).join(", ")}
    >
      {partes
        .filter((p) => p.valor > 0)
        .map((p) => (
          <div key={p.rotulo} title={`${p.rotulo}: ${p.valor}`} style={{ width: `${(p.valor / total) * 100}%`, backgroundColor: p.cor }} />
        ))}
    </div>
  );
}
