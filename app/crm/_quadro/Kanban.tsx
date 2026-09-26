"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRightLeft, GripVertical, Plus } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { agruparItens, type Grupo } from "../_lib/filtros";
import { Menu } from "../_ui/Sobreposicoes";
import { ExibicaoCelula } from "./Celulas";
import type { ColunaQuadro } from "./tipos";

interface PropsKanban<T> {
  itens: T[];
  colunaStatus: ColunaQuadro<T>;
  camposCartao: ColunaQuadro<T>[];
  chave: (item: T) => string;
  rotuloItem: (item: T) => string;
  aoAbrir: (item: T) => void;
  aoMover: (item: T, valor: string | null) => Promise<void> | void;
  aoCriarRapido?: (titulo: string, grupo: Grupo<T>) => Promise<void>;
  destaqueLinha?: (item: T) => "perigo" | "alerta" | null;
  extraCartao?: (item: T) => ReactNode;
}

export function Kanban<T>({ itens, colunaStatus, camposCartao, chave, rotuloItem, aoAbrir, aoMover, aoCriarRapido, destaqueLinha, extraCartao }: PropsKanban<T>) {
  const grupos = useMemo(() => agruparItens(itens, colunaStatus), [itens, colunaStatus]);
  const porId = useMemo(() => new Map(itens.map((i) => [chave(i), i])), [itens, chave]);
  const [arrastando, setArrastando] = useState<T | null>(null);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const nomeGrupo = (id: string | number | undefined) => grupos.find((g) => g.chave === String(id))?.rotulo ?? "";
  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Movendo ${rotuloItem(porId.get(String(active.id))!)}. Use as setas para escolher a coluna e Espaço para soltar.`,
    onDragOver: ({ active, over }) =>
      over ? `${rotuloItem(porId.get(String(active.id))!)} sobre a coluna ${nomeGrupo(over.id)}.` : "Fora das colunas.",
    onDragEnd: ({ active, over }) =>
      over ? `${rotuloItem(porId.get(String(active.id))!)} movido para ${nomeGrupo(over.id)}.` : "Movimento cancelado.",
    onDragCancel: () => "Movimento cancelado.",
  };

  const aoIniciar = (e: DragStartEvent) => setArrastando(porId.get(String(e.active.id)) ?? null);
  const aoSoltar = (e: DragEndEvent) => {
    setArrastando(null);
    const item = porId.get(String(e.active.id));
    if (!item || !e.over) return;
    const destino = String(e.over.id);
    const atual = String(colunaStatus.valor(item) ?? "__vazio__");
    if (destino === atual) return;
    aoMover(item, destino === "__vazio__" ? null : destino);
  };

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCorners}
      onDragStart={aoIniciar}
      onDragEnd={aoSoltar}
      onDragCancel={() => setArrastando(null)}
      accessibility={{
        announcements: anuncios,
        screenReaderInstructions: {
          draggable: "Para mover o cartão, pressione Espaço ou Enter, use as setas para escolher a coluna e pressione Espaço novamente para soltar. Esc cancela.",
        },
      }}
    >
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 sm:snap-none" style={{ minHeight: "calc(100dvh - 260px)" }}>
        {grupos.map((g) => (
          <ColunaKanban
            key={g.chave}
            grupo={g}
            grupos={grupos}
            camposCartao={camposCartao}
            chave={chave}
            rotuloItem={rotuloItem}
            aoAbrir={aoAbrir}
            aoMover={aoMover}
            aoCriarRapido={aoCriarRapido}
            destaqueLinha={destaqueLinha}
            extraCartao={extraCartao}
            colunaStatus={colunaStatus}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {arrastando ? (
          <div className="w-72 rotate-1 rounded-xl border-2 border-crm-tinta bg-white p-3 shadow-crm-flutuante">
            <p className="text-sm font-semibold">{rotuloItem(arrastando)}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function ColunaKanban<T>({
  grupo,
  grupos,
  camposCartao,
  chave,
  rotuloItem,
  aoAbrir,
  aoMover,
  aoCriarRapido,
  destaqueLinha,
  extraCartao,
  colunaStatus,
}: Omit<PropsKanban<T>, "itens"> & { grupo: Grupo<T>; grupos: Grupo<T>[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: grupo.chave });
  const [novo, setNovo] = useState("");
  const [criando, setCriando] = useState(false);
  const [limite, setLimite] = useState(60);
  const cor = grupo.cor ?? "#A1A1AA";

  return (
    <section
      ref={setNodeRef}
      aria-label={`Coluna ${grupo.rotulo}, ${grupo.itens.length} itens`}
      className={`flex w-[82vw] shrink-0 snap-start flex-col rounded-2xl border bg-crm-suave/70 sm:w-72 ${isOver ? "border-crm-folha ring-2 ring-crm-folha/30" : "border-crm-linha"}`}
    >
      <header className="flex items-center gap-2 rounded-t-2xl px-3 py-2.5" style={{ borderTop: `4px solid ${cor}` }}>
        <h3 className="flex-1 truncate text-sm font-bold text-crm-tinta">{grupo.rotulo}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-crm-tinta-2">{grupo.itens.length}</span>
      </header>
      <ul className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {grupo.itens.slice(0, limite).map((item) => (
          <CartaoKanban
            key={chave(item)}
            item={item}
            id={chave(item)}
            grupos={grupos}
            grupoAtual={grupo.chave}
            camposCartao={camposCartao}
            rotulo={rotuloItem(item)}
            aoAbrir={() => aoAbrir(item)}
            aoMover={(destino) => aoMover(item, destino === "__vazio__" ? null : destino)}
            destaque={destaqueLinha?.(item) ?? null}
            extra={extraCartao?.(item)}
            colunaStatus={colunaStatus}
          />
        ))}
        {grupo.itens.length > limite && (
          <li>
            <button type="button" className="w-full py-1 text-xs font-semibold text-crm-folha hover:underline" onClick={() => setLimite((l) => l + 60)}>
              Mostrar mais ({grupo.itens.length - limite})
            </button>
          </li>
        )}
        {grupo.itens.length === 0 && <li className="rounded-xl border-2 border-dashed border-crm-linha-forte/70 px-3 py-6 text-center text-xs text-crm-tinta-3">Solte cartões aqui</li>}
      </ul>
      {aoCriarRapido && grupo.chave !== "__vazio__" && (
        <form
          className="border-t border-crm-linha p-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!novo.trim()) return;
            setCriando(true);
            try {
              await aoCriarRapido(novo.trim(), grupo);
              setNovo("");
            } finally {
              setCriando(false);
            }
          }}
        >
          <label className="flex items-center gap-1.5 rounded-lg bg-white px-2 focus-within:ring-2 focus-within:ring-crm-folha/30">
            <Plus size={14} className="text-crm-tinta-3" aria-hidden />
            <input
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              disabled={criando}
              placeholder="Adicionar"
              aria-label={`Adicionar item em ${grupo.rotulo}`}
              className="h-8 w-full bg-transparent text-[13px] outline-none placeholder:text-crm-tinta-3"
            />
          </label>
        </form>
      )}
    </section>
  );
}

function CartaoKanban<T>({
  item,
  id,
  grupos,
  grupoAtual,
  camposCartao,
  rotulo,
  aoAbrir,
  aoMover,
  destaque,
  extra,
  colunaStatus,
}: {
  item: T;
  id: string;
  grupos: Grupo<T>[];
  grupoAtual: string;
  camposCartao: ColunaQuadro<T>[];
  rotulo: string;
  aoAbrir: () => void;
  aoMover: (destino: string) => void;
  destaque: "perigo" | "alerta" | null;
  extra?: ReactNode;
  colunaStatus: ColunaQuadro<T>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const estilo = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 };
  const podeMover = colunaStatus.podeEditar?.(item) ?? true;
  return (
    <li ref={setNodeRef} style={estilo}>
      <article
        className={`group rounded-xl border bg-white shadow-crm-cartao transition-shadow hover:shadow-md ${
          destaque === "perigo" ? "border-crm-perigo/60" : destaque === "alerta" ? "border-[#F3D19A]" : "border-crm-linha"
        }`}
      >
        <div className="flex items-start gap-1 p-2.5 pb-1">
          {podeMover && (
            <button
              type="button"
              {...listeners}
              {...attributes}
              aria-label={`Arrastar ${rotulo}`}
              className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-crm-tinta-3 hover:bg-crm-suave active:cursor-grabbing"
            >
              <GripVertical size={14} />
            </button>
          )}
          <button type="button" onClick={aoAbrir} className="min-w-0 flex-1 text-left text-sm font-semibold leading-snug text-crm-tinta hover:text-crm-musgo hover:underline">
            {rotulo}
          </button>
          {podeMover && (
            <Menu
              rotulo={`Mover ${rotulo}`}
              itens={grupos
                .filter((g) => g.chave !== grupoAtual && g.chave !== "__vazio__")
                .map((g) => ({ rotulo: g.rotulo, aoSelecionar: () => aoMover(g.chave) }))}
              gatilho={(p) => (
                <button
                  {...p}
                  type="button"
                  className="shrink-0 rounded p-1 text-crm-tinta-3 opacity-0 transition-opacity hover:bg-crm-suave hover:text-crm-tinta focus:opacity-100 group-hover:opacity-100"
                  aria-label={`Mover ${rotulo} para outra coluna`}
                  title="Mover para…"
                >
                  <ArrowRightLeft size={13} />
                </button>
              )}
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5 px-2.5 pb-2.5 pt-1 text-xs text-crm-tinta-2">
          {camposCartao.map((c) => {
            const v = c.valor(item);
            if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return null;
            return (
              <div key={c.id} className="flex min-w-0 items-center gap-2">
                <span className="w-20 shrink-0 truncate text-[10px] font-bold uppercase tracking-wide text-crm-tinta-3">{c.titulo}</span>
                <span className="min-w-0 flex-1 truncate">
                  <ExibicaoCelula coluna={c} item={item} compacto />
                </span>
              </div>
            );
          })}
          {extra}
        </div>
      </article>
    </li>
  );
}
