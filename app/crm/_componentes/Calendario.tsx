"use client";

import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { ReactNode } from "react";
import {
  NOMES_DIAS_CURTOS,
  dataSP,
  formatarDiaLongo,
  formatarMesAno,
  hojeSP,
  horaSP,
  inicioSemana,
  lerYmd,
  semanasDoMes,
  somarDias,
  somarMeses,
} from "../_lib/datas";
import { corSuave, corTextoSobreSuave } from "../_lib/cores";
import { Botao } from "../_ui/Botao";
import { Carregando, Vazio } from "../_ui/Visuais";

export type ModoCalendario = "mes" | "semana" | "dia";

export interface EventoCalendario {
  id: string;
  titulo: string;
  inicio: string;
  fim?: string | null;
  diaInteiro?: boolean;
  cor: string;
  tipo: string;
  icone?: ReactNode;
  alerta?: "vencido" | "hoje" | null;
  concluido?: boolean;
  detalhe?: string | null;
  aoAbrir: () => void;
}

interface PropsCalendario {
  eventos: EventoCalendario[];
  modo: ModoCalendario;
  data: string;
  aoMudarModo: (m: ModoCalendario) => void;
  aoMudarData: (d: string) => void;
  aoCriarNoDia?: (dia: string) => void;
  carregando?: boolean;
  legenda?: ReactNode;
}

function diaDoEvento(e: EventoCalendario): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(e.inicio) ? e.inicio : dataSP(e.inicio);
}

function ordenar(a: EventoCalendario, b: EventoCalendario) {
  if (Boolean(a.diaInteiro) !== Boolean(b.diaInteiro)) return a.diaInteiro ? -1 : 1;
  return a.inicio.localeCompare(b.inicio);
}

export function Calendario({ eventos, modo, data, aoMudarModo, aoMudarData, aoCriarNoDia, carregando, legenda }: PropsCalendario) {
  const porDia = new Map<string, EventoCalendario[]>();
  for (const e of eventos) {
    const d = diaDoEvento(e);
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d)!.push(e);
  }
  porDia.forEach((l) => l.sort(ordenar));

  const navegar = (direcao: -1 | 1) => {
    if (modo === "mes") aoMudarData(somarMeses(data, direcao));
    else if (modo === "semana") aoMudarData(somarDias(data, 7 * direcao));
    else aoMudarData(somarDias(data, direcao));
  };

  const inicioSem = inicioSemana(data);
  const titulo =
    modo === "mes"
      ? formatarMesAno(data)
      : modo === "semana"
        ? `${lerYmd(inicioSem).dia}/${lerYmd(inicioSem).mes} a ${lerYmd(somarDias(inicioSem, 6)).dia}/${lerYmd(somarDias(inicioSem, 6)).mes}/${lerYmd(somarDias(inicioSem, 6)).ano}`
        : formatarDiaLongo(data);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Botao variante="secundario" tamanho="icone-sm" onClick={() => navegar(-1)} aria-label="Período anterior">
            <ChevronLeft size={16} />
          </Botao>
          <Botao variante="secundario" tamanho="icone-sm" onClick={() => navegar(1)} aria-label="Próximo período">
            <ChevronRight size={16} />
          </Botao>
          <Botao variante="secundario" tamanho="sm" onClick={() => aoMudarData(hojeSP())}>
            Hoje
          </Botao>
        </div>
        <h2 className="min-w-0 flex-1 truncate font-serif text-lg font-semibold" aria-live="polite">
          {titulo}
        </h2>
        <div role="group" aria-label="Modo do calendário" className="inline-flex rounded-full border border-crm-linha-forte bg-white p-0.5">
          {(["dia", "semana", "mes"] as ModoCalendario[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={modo === m}
              onClick={() => aoMudarModo(m)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${modo === m ? "bg-crm-verde text-white" : "text-crm-tinta-2 hover:text-crm-tinta"}`}
            >
              {m === "dia" ? "Dia" : m === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>
      {legenda}
      {carregando ? (
        <Carregando />
      ) : modo === "mes" ? (
        <VisaoMes data={data} porDia={porDia} aoCriarNoDia={aoCriarNoDia} aoVerDia={(d) => { aoMudarData(d); aoMudarModo("dia"); }} />
      ) : modo === "semana" ? (
        <VisaoSemana inicio={inicioSem} porDia={porDia} aoCriarNoDia={aoCriarNoDia} aoVerDia={(d) => { aoMudarData(d); aoMudarModo("dia"); }} />
      ) : (
        <VisaoDia dia={data} eventos={porDia.get(data) ?? []} aoCriarNoDia={aoCriarNoDia} />
      )}
    </div>
  );
}

function ChipEvento({ e, compacto }: { e: EventoCalendario; compacto?: boolean }) {
  const hora = e.diaInteiro || /^\d{4}-\d{2}-\d{2}$/.test(e.inicio) ? null : horaSP(e.inicio);
  return (
    <button
      type="button"
      onClick={e.aoAbrir}
      title={`${e.tipo}: ${e.titulo}${hora ? ` às ${hora}` : ""}${e.alerta === "vencido" ? " (vencido)" : ""}`}
      className={`flex w-full min-w-0 items-center gap-1 rounded-md px-1.5 text-left text-[11px] font-semibold leading-tight hover:brightness-95 ${compacto ? "py-0.5" : "py-1"} ${e.concluido ? "opacity-60 line-through" : ""}`}
      style={{ backgroundColor: corSuave(e.cor, 0.16), color: corTextoSobreSuave(e.cor), boxShadow: `inset 3px 0 0 0 ${e.cor}` }}
    >
      {e.alerta === "vencido" ? (
        <AlertTriangle size={11} className="shrink-0 text-crm-perigo" aria-label="vencido" />
      ) : e.concluido ? (
        <CheckCircle2 size={11} className="shrink-0" aria-label="concluído" />
      ) : (
        <span className="shrink-0" aria-hidden>
          {e.icone}
        </span>
      )}
      {hora && <span className="shrink-0 tabular-nums">{hora}</span>}
      <span className="truncate">{e.titulo}</span>
      <span className="sr-only"> — {e.tipo}</span>
    </button>
  );
}

function VisaoMes({
  data,
  porDia,
  aoCriarNoDia,
  aoVerDia,
}: {
  data: string;
  porDia: Map<string, EventoCalendario[]>;
  aoCriarNoDia?: (d: string) => void;
  aoVerDia: (d: string) => void;
}) {
  const semanas = semanasDoMes(data);
  const mes = lerYmd(data).mes;
  const hoje = hojeSP();
  return (
    <div className="overflow-hidden rounded-2xl border border-crm-linha bg-white shadow-crm-cartao">
      <div className="grid grid-cols-7 border-b border-crm-linha bg-crm-suave text-center text-[11px] font-bold uppercase tracking-wide text-crm-tinta-2">
        {NOMES_DIAS_CURTOS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {semanas.flat().map((dia) => {
          const lista = porDia.get(dia) ?? [];
          const foraDoMes = lerYmd(dia).mes !== mes;
          const ehHoje = dia === hoje;
          return (
            <div key={dia} className={`group relative min-h-24 border-b border-r border-crm-linha p-1 sm:min-h-28 ${foraDoMes ? "bg-crm-fundo" : "bg-white"}`}>
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => aoVerDia(dia)}
                  aria-label={`Ver o dia ${formatarDiaLongo(dia)}${lista.length ? `, ${lista.length} itens` : ""}`}
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold ${
                    ehHoje ? "bg-crm-verde text-white" : foraDoMes ? "text-crm-tinta-3" : "text-crm-tinta hover:bg-crm-suave"
                  }`}
                >
                  {lerYmd(dia).dia}
                </button>
                {aoCriarNoDia && (
                  <button
                    type="button"
                    onClick={() => aoCriarNoDia(dia)}
                    className="rounded p-0.5 text-crm-tinta-3 opacity-0 hover:bg-crm-suave hover:text-crm-tinta focus:opacity-100 group-hover:opacity-100"
                    aria-label={`Criar em ${formatarDiaLongo(dia)}`}
                  >
                    <Plus size={13} />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {lista.slice(0, 3).map((e) => (
                  <ChipEvento key={e.id} e={e} compacto />
                ))}
                {lista.length > 3 && (
                  <button type="button" onClick={() => aoVerDia(dia)} className="px-1 text-left text-[11px] font-bold text-crm-folha hover:underline">
                    +{lista.length - 3} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisaoSemana({
  inicio,
  porDia,
  aoCriarNoDia,
  aoVerDia,
}: {
  inicio: string;
  porDia: Map<string, EventoCalendario[]>;
  aoCriarNoDia?: (d: string) => void;
  aoVerDia: (d: string) => void;
}) {
  const hoje = hojeSP();
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {Array.from({ length: 7 }).map((_, i) => {
        const dia = somarDias(inicio, i);
        const lista = porDia.get(dia) ?? [];
        return (
          <section key={dia} aria-label={formatarDiaLongo(dia)} className={`flex min-h-40 flex-col rounded-xl border bg-white ${dia === hoje ? "border-crm-verde ring-2 ring-crm-verde/15" : "border-crm-linha"}`}>
            <header className="flex items-center justify-between border-b border-crm-linha px-2.5 py-1.5">
              <button type="button" onClick={() => aoVerDia(dia)} className="text-left text-xs font-bold text-crm-tinta hover:underline">
                {NOMES_DIAS_CURTOS[i]} {lerYmd(dia).dia}/{lerYmd(dia).mes}
              </button>
              {aoCriarNoDia && (
                <button type="button" onClick={() => aoCriarNoDia(dia)} className="rounded p-0.5 text-crm-tinta-3 hover:bg-crm-suave hover:text-crm-tinta" aria-label={`Criar em ${formatarDiaLongo(dia)}`}>
                  <Plus size={13} />
                </button>
              )}
            </header>
            <div className="flex flex-1 flex-col gap-1 p-1.5">
              {lista.length === 0 && <span className="px-1 py-2 text-[11px] text-crm-tinta-3">Livre</span>}
              {lista.map((e) => (
                <ChipEvento key={e.id} e={e} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function VisaoDia({ dia, eventos, aoCriarNoDia }: { dia: string; eventos: EventoCalendario[]; aoCriarNoDia?: (d: string) => void }) {
  if (eventos.length === 0) {
    return (
      <div className="rounded-2xl border border-crm-linha bg-white">
        <Vazio
          titulo="Nada agendado para este dia"
          acao={
            aoCriarNoDia && (
              <Botao variante="secundario" tamanho="sm" icone={<Plus size={14} />} onClick={() => aoCriarNoDia(dia)}>
                Criar compromisso
              </Botao>
            )
          }
        />
      </div>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {eventos.map((e) => {
        const hora = e.diaInteiro || /^\d{4}-\d{2}-\d{2}$/.test(e.inicio) ? "Dia todo" : horaSP(e.inicio);
        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={e.aoAbrir}
              className="flex w-full items-start gap-3 rounded-xl border border-crm-linha bg-white p-3 text-left shadow-crm-cartao hover:border-crm-linha-forte"
              style={{ boxShadow: `inset 4px 0 0 0 ${e.cor}` }}
            >
              <span className="w-16 shrink-0 pt-0.5 text-sm font-bold tabular-nums text-crm-tinta">{hora}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: corTextoSobreSuave(e.cor) }}>
                  {e.icone} {e.tipo}
                  {e.alerta === "vencido" && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-crm-perigo">
                      <AlertTriangle size={11} aria-hidden /> Vencido
                    </span>
                  )}
                  {e.concluido && <span className="ml-1 text-crm-sucesso">Concluído</span>}
                </span>
                <span className={`block text-sm font-semibold text-crm-tinta ${e.concluido ? "line-through opacity-70" : ""}`}>{e.titulo}</span>
                {e.detalhe && <span className="block truncate text-xs text-crm-tinta-2">{e.detalhe}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
