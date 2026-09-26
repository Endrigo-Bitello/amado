"use client";

import { AlertTriangle, Clock, ExternalLink, Loader2, Mail, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { dataSP, formatarData, formatarDataHora, horaSP, instanteSP, situacaoVencimento } from "../_lib/datas";
import { formatarMoeda, formatarNumero, formatarTelefone, lerMoeda, linkWhatsApp } from "../_lib/formatos";
import { textoColuna } from "../_lib/filtros";
import { Botao } from "../_ui/Botao";
import { Entrada } from "../_ui/Campos";
import { ListaBusca } from "../_ui/Seletores";
import { Popover } from "../_ui/Sobreposicoes";
import { Avatar, GrupoAvatares, Pilula } from "../_ui/Visuais";
import type { ColunaQuadro } from "./tipos";

function vazio(v: unknown) {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

/** Exibição somente leitura do valor de uma coluna. */
export function ExibicaoCelula<T>({ coluna, item, compacto }: { coluna: ColunaQuadro<T>; item: T; compacto?: boolean }): ReactNode {
  if (coluna.exibir) return coluna.exibir(item);
  const v = coluna.valor(item);
  if (vazio(v) && coluna.tipo !== "checkbox") return <span className="text-crm-tinta-3/70" aria-label="vazio">—</span>;
  switch (coluna.tipo) {
    case "status":
    case "selecao": {
      const op = coluna.opcoes?.find((o) => o.valor === v);
      return (
        <Pilula cor={op?.cor} className={compacto ? "" : "w-full justify-center"} icone={compacto ? op?.icone : undefined}>
          {op?.rotulo ?? String(v)}
        </Pilula>
      );
    }
    case "pessoa": {
      const op = coluna.opcoes?.find((o) => o.valor === v);
      return (
        <span className="flex min-w-0 items-center gap-1.5">
          <Avatar nome={op?.rotulo ?? "?"} cor={op?.cor} tamanho={24} />
          <span className="truncate text-[13px]">{op?.rotulo.split(" ")[0] ?? "—"}</span>
        </span>
      );
    }
    case "pessoas": {
      const ids = (v as string[]) ?? [];
      const pessoas = ids.map((id) => coluna.opcoes?.find((o) => o.valor === id)).filter(Boolean).map((o) => ({ nome: o!.rotulo, cor: o!.cor }));
      return <GrupoAvatares pessoas={pessoas} tamanho={24} />;
    }
    case "multipla":
    case "etiquetas": {
      const ids = (v as string[]) ?? [];
      return (
        <span className="flex min-w-0 gap-1 overflow-hidden">
          {ids.map((id) => {
            const op = coluna.opcoes?.find((o) => o.valor === id);
            return (
              <Pilula key={id} cor={op?.cor} preenchida={false}>
                {op?.rotulo ?? id}
              </Pilula>
            );
          })}
        </span>
      );
    }
    case "checkbox":
      return <span className="text-[13px] text-crm-tinta-2">{v ? "Sim" : "Não"}</span>;
    case "moeda":
      return <span className="tabular-nums">{formatarMoeda(v as number)}</span>;
    case "numero":
      return <span className="tabular-nums">{formatarNumero(v as number)}</span>;
    case "data":
    case "data_hora": {
      const texto = coluna.tipo === "data" ? formatarData(String(v)) : formatarDataHora(String(v));
      const alerta = coluna.alertaVencimento?.(item);
      const situacao = alerta ? situacaoVencimento(String(v), coluna.diaInteiro?.(item) ?? coluna.tipo === "data") : null;
      if (situacao === "vencido") {
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-crm-perigo" title="Vencido">
            <AlertTriangle size={13} aria-hidden />
            <span className="tabular-nums">{texto}</span>
            <span className="sr-only">(vencido)</span>
          </span>
        );
      }
      if (situacao === "hoje") {
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-crm-alerta" title="Vence hoje">
            <Clock size={13} aria-hidden />
            <span className="tabular-nums">{texto}</span>
            <span className="sr-only">(vence hoje)</span>
          </span>
        );
      }
      return <span className="tabular-nums">{texto}</span>;
    }
    case "telefone": {
      const link = linkWhatsApp(String(v));
      return (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate tabular-nums">{formatarTelefone(String(v))}</span>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded p-0.5 text-crm-folha hover:bg-crm-verde-claro"
              aria-label="Abrir conversa no WhatsApp"
              title="Abrir no WhatsApp"
            >
              <MessageCircle size={14} />
            </a>
          )}
        </span>
      );
    }
    case "email":
      return (
        <a href={`mailto:${String(v)}`} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-1 text-crm-info hover:underline">
          <Mail size={13} className="shrink-0" aria-hidden />
          <span className="truncate">{String(v)}</span>
        </a>
      );
    case "link":
      return (
        <a
          href={String(v)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 font-semibold text-crm-info hover:underline"
        >
          Abrir <ExternalLink size={12} aria-hidden />
        </a>
      );
    default:
      return <span className="truncate" title={textoColuna(coluna, item)}>{textoColuna(coluna, item)}</span>;
  }
}

/** Célula editável: abre o editor adequado ao tipo, salva e mostra o estado. */
export function CelulaEditavel<T>({ coluna, item, rotuloItem, compacto }: { coluna: ColunaQuadro<T>; item: T; rotuloItem: string; compacto?: boolean }) {
  const editavel = Boolean(coluna.editar) && (coluna.podeEditar?.(item) ?? true);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const salvar = async (novo: unknown) => {
    if (!coluna.editar) return;
    setSalvando(true);
    try {
      await coluna.editar(item, novo);
    } catch {
      /* aviso exibido pela camada de dados */
    } finally {
      setSalvando(false);
    }
  };

  const alinhamento = coluna.alinhamento === "direita" ? "justify-end text-right" : coluna.alinhamento === "centro" ? "justify-center" : "";
  const conteudo = (
    <span className={`flex min-w-0 flex-1 items-center ${alinhamento}`}>
      <ExibicaoCelula coluna={coluna} item={item} compacto={compacto} />
    </span>
  );

  if (!editavel) {
    return <div className={`flex h-full min-w-0 items-center px-2 text-[13px] ${alinhamento}`}>{conteudo}</div>;
  }

  if (coluna.tipo === "checkbox") {
    const v = Boolean(coluna.valor(item));
    return (
      <div className="flex h-full items-center justify-center px-2">
        <input
          type="checkbox"
          checked={v}
          disabled={salvando}
          onChange={(e) => salvar(e.target.checked)}
          aria-label={`${coluna.titulo} — ${rotuloItem}`}
          className="h-4 w-4 cursor-pointer accent-[#263A2D]"
        />
      </div>
    );
  }

  const textual = ["texto", "numero", "moeda", "telefone", "email", "link"].includes(coluna.tipo);
  if (textual && editando) {
    return <EditorTexto coluna={coluna} item={item} aoSalvar={(v) => { setEditando(false); salvar(v); }} aoCancelar={() => setEditando(false)} />;
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setEditando(true);
        }}
        aria-label={`Editar ${coluna.titulo} de ${rotuloItem}`}
        aria-haspopup={textual ? undefined : "dialog"}
        className={`group flex h-full w-full min-w-0 items-center gap-1 px-2 text-left text-[13px] transition-colors hover:bg-crm-suave/70 focus-visible:bg-crm-suave ${
          coluna.tipo === "status" || coluna.tipo === "selecao" ? "px-1.5" : ""
        }`}
      >
        {conteudo}
        {salvando && <Loader2 size={13} className="shrink-0 animate-spin text-crm-folha" aria-label="Salvando" />}
      </button>
      {!textual && (
        <Popover aberto={editando} aoFechar={() => setEditando(false)} ancora={ref} rotulo={`Editar ${coluna.titulo}`} largura={coluna.tipo === "texto_longo" ? 360 : coluna.tipo.startsWith("data") ? 280 : 260}>
          <EditorPopover coluna={coluna} item={item} aoSalvar={(v, fechar = true) => { if (fechar) setEditando(false); salvar(v); }} aoCancelar={() => setEditando(false)} />
        </Popover>
      )}
    </>
  );
}

function EditorTexto<T>({ coluna, item, aoSalvar, aoCancelar }: { coluna: ColunaQuadro<T>; item: T; aoSalvar: (v: unknown) => void; aoCancelar: () => void }) {
  const inicial = coluna.valor(item);
  const [texto, setTexto] = useState(inicial === null || inicial === undefined ? "" : coluna.tipo === "moeda" ? String(inicial).replace(".", ",") : String(inicial));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const concluir = () => {
    const t = texto.trim();
    let valor: unknown = t === "" ? null : t;
    if (coluna.tipo === "numero") valor = t === "" ? null : Number(t.replace(",", "."));
    if (coluna.tipo === "moeda") valor = lerMoeda(t);
    if (String(valor ?? "") === String(inicial ?? "")) return aoCancelar();
    aoSalvar(valor);
  };
  return (
    <input
      ref={ref}
      value={texto}
      inputMode={coluna.tipo === "numero" || coluna.tipo === "moeda" ? "decimal" : coluna.tipo === "telefone" ? "tel" : undefined}
      type={coluna.tipo === "email" ? "email" : coluna.tipo === "link" ? "url" : "text"}
      aria-label={coluna.titulo}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={concluir}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          concluir();
        } else if (e.key === "Escape") {
          e.preventDefault();
          aoCancelar();
        }
      }}
      className="h-full w-full border-2 border-crm-folha bg-white px-2 text-[13px] outline-none"
    />
  );
}

function EditorPopover<T>({
  coluna,
  item,
  aoSalvar,
  aoCancelar,
}: {
  coluna: ColunaQuadro<T>;
  item: T;
  aoSalvar: (v: unknown, fechar?: boolean) => void;
  aoCancelar: () => void;
}) {
  const valor = coluna.valor(item);
  const [texto, setTexto] = useState(String(valor ?? ""));
  // Data e hora só existem em colunas de data (evita interpretar ids ou textos como datas).
  const ehData = coluna.tipo === "data" || coluna.tipo === "data_hora";
  const [data, setData] = useState(() => (ehData && valor ? (String(valor).length === 10 ? String(valor) : dataSP(String(valor))) : ""));
  const [hora, setHora] = useState(() => (ehData && valor && coluna.tipo === "data_hora" && String(valor).length > 10 ? horaSP(String(valor)) : ""));
  const [multiplos, setMultiplos] = useState<string[]>(Array.isArray(valor) ? (valor as string[]) : []);

  if (coluna.tipo === "status" || coluna.tipo === "selecao" || coluna.tipo === "pessoa") {
    const opcoes = coluna.tipo === "pessoa" ? [{ valor: "", rotulo: "Sem responsável", cor: null }, ...(coluna.opcoes ?? [])] : coluna.opcoes ?? [];
    return (
      <ListaBusca
        opcoes={opcoes}
        selecionados={[String(valor ?? "")]}
        estilo={coluna.tipo === "pessoa" ? "pessoa" : "pilula"}
        aoAlternar={(v) => (v === String(valor ?? "") ? aoCancelar() : aoSalvar(v || null))}
      />
    );
  }

  if (coluna.tipo === "pessoas" || coluna.tipo === "multipla" || coluna.tipo === "etiquetas") {
    return (
      <ListaBusca
        multipla
        opcoes={coluna.opcoes ?? []}
        selecionados={multiplos}
        estilo={coluna.tipo === "pessoas" ? "pessoa" : "texto"}
        aoAlternar={(v) => {
          const novo = multiplos.includes(v) ? multiplos.filter((x) => x !== v) : [...multiplos, v];
          setMultiplos(novo);
          aoSalvar(novo, false);
        }}
      />
    );
  }

  if (coluna.tipo === "data" || coluna.tipo === "data_hora") {
    const aplicar = () => {
      if (!data) return aoSalvar(null);
      if (coluna.tipo === "data") return aoSalvar(data);
      aoSalvar(instanteSP(data, hora || "09:00"));
    };
    return (
      <form
        className="flex flex-col gap-3 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar();
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
          Data
          <Entrada type="date" value={data} onChange={(e) => setData(e.target.value)} data-autofoco />
        </label>
        {coluna.tipo === "data_hora" && (
          <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
            Hora (Brasília)
            <Entrada type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
        )}
        <div className="flex justify-between gap-2">
          <Botao tamanho="sm" variante="fantasma" onClick={() => aoSalvar(null)}>
            Limpar
          </Botao>
          <Botao tamanho="sm" variante="primario" type="submit">
            Aplicar
          </Botao>
        </div>
      </form>
    );
  }

  // texto longo
  return (
    <form
      className="flex flex-col gap-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        aoSalvar(texto.trim() || null);
      }}
    >
      <textarea
        data-autofoco
        rows={5}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        aria-label={coluna.titulo}
        className="w-full rounded-lg border border-crm-linha-forte p-2 text-sm outline-none focus:border-crm-folha"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) aoSalvar(texto.trim() || null);
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-crm-tinta-3">Ctrl+Enter para salvar</span>
        <Botao tamanho="sm" variante="primario" type="submit">
          Salvar
        </Botao>
      </div>
    </form>
  );
}
