"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  AtSign,
  Bot,
  CalendarDays,
  FileText,
  Gavel,
  History,
  ListChecks,
  MessageSquare,
  Phone,
  Scale,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../_lib/auth";
import { useConfig } from "../_lib/config";
import { formatarDataHora, formatarRelativo } from "../_lib/datas";
import { executar, useGravacao } from "../_lib/dados";
import { supabase } from "../_lib/supabase";
import type { Comentario, Evento } from "../_lib/tipos";
import { Botao } from "../_ui/Botao";
import { AreaTexto } from "../_ui/Campos";
import { confirmarSimples } from "../_ui/Dialogos";
import { SeletorMultiplo } from "../_ui/Seletores";
import { Avatar, Carregando, ErroCarga, Vazio } from "../_ui/Visuais";

type EntidadeComentario = "lead" | "cliente" | "caso" | "tarefa" | "documento" | "prazo" | "processo" | "compromisso";

interface PropsAtividade {
  entidade: EntidadeComentario;
  registroId: string;
  /** Linha do tempo: filtra eventos por lead_id / cliente_id / caso_id. */
  eventosPor?: { coluna: "lead_id" | "cliente_id" | "caso_id"; id: string };
  acoesExtras?: ReactNode;
}

const ICONES_EVENTO: Record<string, ReactNode> = {
  criacao: <Sparkles size={14} />,
  etapa: <ArrowRightLeft size={14} />,
  fase: <ArrowRightLeft size={14} />,
  status: <ArrowRightLeft size={14} />,
  responsavel: <UserRound size={14} />,
  contato: <Phone size={14} />,
  tarefa: <ListChecks size={14} />,
  documento: <FileText size={14} />,
  arquivo: <FileText size={14} />,
  solicitacao: <FileText size={14} />,
  prazo: <Gavel size={14} />,
  andamento: <Gavel size={14} />,
  processo: <Scale size={14} />,
  natureza: <Scale size={14} />,
  agenda: <CalendarDays size={14} />,
  financeiro: <Wallet size={14} />,
  quiz: <Sparkles size={14} />,
  manual: <History size={14} />,
};

type ItemAtividade =
  | { tipo: "comentario"; data: string; comentario: Comentario }
  | { tipo: "evento"; data: string; evento: Evento };

export function Atividade({ entidade, registroId, eventosPor, acoesExtras }: PropsAtividade) {
  const { perfil, simplificado, desenvolvedor } = useAuth();
  const config = useConfig();
  const { inserir, atualizar, excluir } = useGravacao();
  const [filtro, setFiltro] = useState<"tudo" | "comentarios" | "historico">("tudo");
  const [texto, setTexto] = useState("");
  const [mencoes, setMencoes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const comentarios = useQuery({
    queryKey: ["comentarios", entidade, registroId],
    queryFn: async () =>
      (await executar(
        supabase().from("comentarios").select("*").eq("entidade", entidade).eq("registro_id", registroId).order("created_at", { ascending: false }),
      )) as Comentario[],
  });

  const eventos = useQuery({
    queryKey: ["eventos", eventosPor?.coluna, eventosPor?.id],
    enabled: Boolean(eventosPor),
    queryFn: async () =>
      (await executar(
        supabase().from("eventos").select("*").eq(eventosPor!.coluna, eventosPor!.id).order("ocorrido_em", { ascending: false }).limit(300),
      )) as Evento[],
  });

  const itens = useMemo<ItemAtividade[]>(() => {
    const lista: ItemAtividade[] = [];
    if (filtro !== "historico") (comentarios.data ?? []).forEach((c) => lista.push({ tipo: "comentario", data: c.created_at, comentario: c }));
    if (filtro !== "comentarios") (eventos.data ?? []).forEach((e) => lista.push({ tipo: "evento", data: e.ocorrido_em, evento: e }));
    return lista.sort((a, b) => b.data.localeCompare(a.data));
  }, [comentarios.data, eventos.data, filtro]);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await inserir("comentarios", { entidade, registro_id: registroId, texto: texto.trim(), mencoes }, { chaves: ["comentarios"] });
      setTexto("");
      setMencoes([]);
    } finally {
      setEnviando(false);
    }
  };

  const remover = async (c: Comentario) => {
    if (!(await confirmarSimples({ titulo: "Remover comentário?", mensagem: "O comentário deixará de aparecer para a equipe.", confirmar: "Remover", perigo: true }))) return;
    await atualizar("comentarios", c.id, { removido_em: new Date().toISOString() }, { chaves: ["comentarios"] });
  };

  const excluirEvento = async (e: Evento) => {
    if (!(await confirmarSimples({ titulo: "Excluir da linha do tempo?", mensagem: `“${e.titulo}” deixará de aparecer no histórico. Esta ação não pode ser desfeita.`, confirmar: "Excluir", perigo: true }))) return;
    await excluir("eventos", String(e.id), { chaves: ["eventos"] }).catch(() => undefined);
  };

  const carregando = comentarios.isLoading || (eventosPor && eventos.isLoading);
  const erro = comentarios.error ?? eventos.error;

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2 rounded-2xl border border-crm-linha bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <label htmlFor={`comentario-${registroId}`} className="sr-only">
          Escrever comentário
        </label>
        <AreaTexto
          id={`comentario-${registroId}`}
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva um comentário para a equipe…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar();
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-48 flex-1">
            <SeletorMultiplo
              rotulo="Mencionar pessoas"
              placeholder="@ Mencionar alguém (notifica)"
              estilo="pessoa"
              valores={mencoes}
              opcoes={config.usuariosAtivos.filter((u) => u.id !== perfil?.id).map((u) => ({ valor: u.id, rotulo: u.nome, cor: u.cor }))}
              aoAlterar={setMencoes}
            />
          </div>
          {acoesExtras}
          <Botao type="submit" variante="primario" tamanho="sm" icone={<MessageSquare size={14} />} carregando={enviando} disabled={!texto.trim()}>
            Comentar
          </Botao>
        </div>
      </form>

      <div role="group" aria-label="Filtrar atividade" className="inline-flex self-start rounded-full border border-crm-linha-forte bg-white p-0.5">
        {(
          [
            ["tudo", "Tudo"],
            ["comentarios", "Comentários"],
            ["historico", "Histórico"],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filtro === id}
            onClick={() => setFiltro(id)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${filtro === id ? "bg-crm-verde text-white" : "text-crm-tinta-2 hover:text-crm-tinta"}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <Carregando />
      ) : erro ? (
        <ErroCarga aoTentarNovamente={() => { comentarios.refetch(); eventos.refetch(); }} />
      ) : itens.length === 0 ? (
        <Vazio compacto titulo="Sem atividade ainda" descricao="Comentários, contatos e alterações aparecerão aqui em ordem cronológica." />
      ) : (
        <ol className="relative flex flex-col gap-3 border-l-2 border-crm-linha pl-5">
          {itens.map((i) =>
            i.tipo === "comentario" ? (
              <li key={`c-${i.comentario.id}`} className="relative">
                <span className="absolute -left-[31px] top-1">
                  <Avatar nome={config.usuario(i.comentario.autor_id)?.nome} cor={config.usuario(i.comentario.autor_id)?.cor} tamanho={20} />
                </span>
                <div className="rounded-xl border border-crm-linha bg-white p-3">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-crm-tinta-3">
                    <span className="font-bold text-crm-tinta">{config.usuario(i.comentario.autor_id)?.nome ?? "Usuário"}</span>
                    <time dateTime={i.comentario.created_at} title={formatarDataHora(i.comentario.created_at)}>
                      {formatarRelativo(i.comentario.created_at)}
                    </time>
                    {i.comentario.editado_em && <span>(editado)</span>}
                    {(i.comentario.autor_id === perfil?.id || desenvolvedor) && !simplificado && (
                      <button type="button" onClick={() => remover(i.comentario)} className="ml-auto font-semibold hover:text-crm-perigo">
                        Remover
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-crm-tinta">{i.comentario.texto}</p>
                  {i.comentario.mencoes.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-crm-info">
                      <AtSign size={12} aria-hidden />
                      {i.comentario.mencoes.map((m) => config.usuario(m)?.nome ?? "usuário").join(", ")}
                    </p>
                  )}
                </div>
              </li>
            ) : (
              <li key={`e-${i.evento.id}`} className="relative">
                <span className="absolute -left-[29px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-crm-suave-2 text-crm-tinta-2 [&_svg]:h-2.5 [&_svg]:w-2.5">
                  {ICONES_EVENTO[i.evento.tipo] ?? <History size={10} />}
                </span>
                <p className="text-sm text-crm-tinta">{i.evento.titulo}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-crm-tinta-3">
                  <time dateTime={i.evento.ocorrido_em} title={formatarDataHora(i.evento.ocorrido_em)}>
                    {formatarDataHora(i.evento.ocorrido_em)}
                  </time>
                  {i.evento.automatico ? (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-crm-ouro-escuro">
                      <Bot size={12} aria-hidden /> automático
                    </span>
                  ) : (
                    i.evento.autor_id && <span>por {config.usuario(i.evento.autor_id)?.nome ?? "usuário"}</span>
                  )}
                  {desenvolvedor && (
                    <button type="button" onClick={() => excluirEvento(i.evento)} className="ml-auto font-semibold hover:text-crm-perigo">
                      Excluir
                    </button>
                  )}
                </p>
              </li>
            ),
          )}
        </ol>
      )}
    </div>
  );
}
