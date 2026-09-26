"use client";

import { useQuery } from "@tanstack/react-query";
import { Archive, ArchiveRestore, CalendarClock, CheckSquare, Copy, Link2, ListChecks, Plus, Trash2, UserRound, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso } from "../../_lib/avisos";
import { colunaEtiquetas, colunaPrioridade, colunaResponsavel, opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { fimDiaSP, formatarDataHora } from "../../_lib/datas";
import { buscarTodos, executar, useGravacao } from "../../_lib/dados";
import { idCurto } from "../../_lib/formatos";
import type { Consulta } from "../../_lib/presets";
import { Link, useRota } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import type { Tarefa, TarefaComRelacoes } from "../../_lib/tipos";
import { AvisoPreset, usePresetAtivo } from "../../_lib/usePreset";
import { OpcoesExibicao } from "../../_quadro/OpcoesExibicao";
import { Quadro } from "../../_quadro/Quadro";
import type { ColunaQuadro } from "../../_quadro/tipos";
import { Botao } from "../../_ui/Botao";
import { Entrada } from "../../_ui/Campos";
import { confirmarSimples } from "../../_ui/Dialogos";
import { ListaBusca, SeletorCampo } from "../../_ui/Seletores";
import { Gaveta, Modal } from "../../_ui/Sobreposicoes";
import { BarraProgresso, CabecalhoPagina, Carregando, Selo, Vazio } from "../../_ui/Visuais";
import { ListaArquivos } from "../../_componentes/Arquivos";
import { Atividade } from "../../_componentes/Atividade";
import { FormTarefa } from "../../_componentes/FormTarefa";
import { PainelItem } from "../../_componentes/PainelItem";
import { ListaPropriedades, SecaoFicha } from "../../_componentes/Propriedades";
import { STATUS_TAREFA } from "../../_componentes/Relacionados";

const SELECT = "*, lead:leads(id, nome, codigo), cliente:clientes(id, nome, codigo), caso:casos(id, titulo, codigo)";

function vinculoDe(t: TarefaComRelacoes) {
  if (t.caso) return { rotulo: `${t.caso.codigo} · ${t.caso.titulo}`, link: `/crm/casos/${t.caso.id}` };
  if (t.cliente) return { rotulo: `${t.cliente.codigo} · ${t.cliente.nome}`, link: `/crm/clientes/${t.cliente.id}` };
  if (t.lead) return { rotulo: `${t.lead.codigo} · ${t.lead.nome}`, link: `/crm/leads?item=${t.lead.id}` };
  return null;
}

export function useColunasTarefas(salvar: (t: TarefaComRelacoes, alt: Record<string, unknown>) => Promise<void>, podeEditar: (t: TarefaComRelacoes) => boolean): ColunaQuadro<TarefaComRelacoes>[] {
  const config = useConfig();
  return useMemo<ColunaQuadro<TarefaComRelacoes>[]>(() => {
    const ed = salvar;
    return [
      {
        id: "titulo",
        titulo: "Tarefa",
        tipo: "texto",
        valor: (t) => t.titulo,
        exibir: (t) => (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`truncate ${t.status === "concluida" ? "text-crm-tinta-3 line-through" : ""}`}>{t.titulo}</span>
            {t.origem === "automacao" && (
              <span title="Criada automaticamente" className="inline-flex shrink-0 items-center text-crm-ouro-escuro">
                <Zap size={12} aria-label="criada automaticamente" />
              </span>
            )}
            {t.depende_de && <Link2 size={12} className="shrink-0 text-crm-tinta-3" aria-label="depende de outra tarefa" />}
          </span>
        ),
        editar: (t, v) => ed(t, { titulo: v }),
        podeEditar,
        largura: 300,
        obrigatoria: true,
      },
      {
        id: "status",
        titulo: "Situação",
        tipo: "status",
        valor: (t) => t.status,
        opcoes: STATUS_TAREFA,
        editar: (t, v) => ed(t, { status: v ?? "a_fazer" }),
        podeEditar,
        agrupavel: true,
        largura: 150,
        resumo: "distribuicao",
      },
      { ...colunaResponsavel<TarefaComRelacoes>(config, ed), podeEditar },
      {
        id: "prazo",
        titulo: "Prazo",
        tipo: "data_hora",
        valor: (t) => t.prazo,
        exibir: undefined,
        editar: (t, v) => ed(t, { prazo: v, prazo_dia_inteiro: false }),
        podeEditar,
        diaInteiro: (t) => t.prazo_dia_inteiro,
        alertaVencimento: (t) => t.status !== "concluida" && t.status !== "cancelada",
        largura: 160,
      },
      { ...colunaPrioridade<TarefaComRelacoes>(config, ed), podeEditar },
      {
        id: "vinculo",
        titulo: "Vinculada a",
        tipo: "texto",
        valor: (t) => vinculoDe(t)?.rotulo ?? null,
        exibir: (t) => {
          const v = vinculoDe(t);
          return v ? (
            <Link href={v.link} onClick={(e) => e.stopPropagation()} className="truncate text-crm-info hover:underline">
              {v.rotulo}
            </Link>
          ) : (
            <span className="text-crm-tinta-3/70">—</span>
          );
        },
        agrupavel: true,
        largura: 240,
      },
      {
        id: "checklist",
        titulo: "Checklist",
        tipo: "numero",
        valor: (t) => (Array.isArray(t.checklist) ? (t.checklist as { feito: boolean }[]).filter((c) => c.feito).length : 0),
        exibir: (t) => {
          const itens = Array.isArray(t.checklist) ? (t.checklist as { feito: boolean }[]) : [];
          return itens.length ? (
            <span className="flex w-full items-center gap-1.5 text-xs">
              <CheckSquare size={12} className="text-crm-tinta-3" aria-hidden />
              {itens.filter((c) => c.feito).length}/{itens.length}
            </span>
          ) : (
            <span className="text-crm-tinta-3/70">—</span>
          );
        },
        largura: 100,
        ordenavel: false,
        filtravel: false,
      },
      {
        id: "origem",
        titulo: "Origem",
        tipo: "selecao",
        valor: (t) => t.origem,
        opcoes: [
          { valor: "manual", rotulo: "Manual", cor: "#A1A1AA" },
          { valor: "automacao", rotulo: "Automação", cor: "#C5A880" },
          { valor: "modelo", rotulo: "Modelo de tarefas", cor: "#1F6E76" },
        ],
        agrupavel: true,
        largura: 150,
        oculta: true,
      },
      { id: "concluida_em", titulo: "Concluída em", tipo: "data_hora", valor: (t) => t.concluida_em, largura: 150, oculta: true },
      { id: "created_at", titulo: "Criada em", tipo: "data_hora", valor: (t) => t.created_at, largura: 150, oculta: true },
      { ...colunaEtiquetas<TarefaComRelacoes>(config, "tarefa", ed), podeEditar },
    ];
  }, [config, salvar, podeEditar]);
}

export default function Tarefas() {
  const { perfil, pode } = useAuth();
  const config = useConfig();
  const { parametro, definirParametros } = useRota();
  const { atualizar, inserir, excluir } = useGravacao();
  const { preset, ctx, limpar } = usePresetAtivo(["tarefas"]);
  const [concluidasAntigas, setConcluidasAntigas] = useState(false);
  const [arquivadas, setArquivadas] = useState(false);
  const [lote, setLote] = useState<{ tipo: "status" | "responsavel" | "prazo"; itens: TarefaComRelacoes[] } | null>(null);
  const itemId = parametro("item");
  const novo = parametro("novo") === "1";

  const consulta = useQuery({
    queryKey: ["tarefas", "quadro", { concluidasAntigas, arquivadas, preset: preset?.id, meus: ctx?.somenteMeus }],
    enabled: !preset || Boolean(ctx),
    queryFn: async () => {
      const limite = new Date(Date.now() - 30 * 86400_000).toISOString();
      return buscarTodos<TarefaComRelacoes>((de, ate) => {
        let q = supabase().from("tarefas").select(SELECT);
        if (preset && ctx) {
          q = preset.aplicar(q as unknown as Consulta, ctx) as unknown as typeof q;
        } else {
          if (!arquivadas) q = q.is("arquivado_em", null);
          if (!concluidasAntigas) q = q.or(`status.not.in.(concluida,cancelada),concluida_em.gte.${limite},updated_at.gte.${limite}`);
        }
        return q.order("prazo", { ascending: true, nullsFirst: false }).range(de, ate) as unknown as PromiseLike<{ data: TarefaComRelacoes[] | null; error: unknown }>;
      }, 8000);
    },
  });

  const salvar = useCallback(async (t: TarefaComRelacoes, alt: Record<string, unknown>) => {
    await atualizar("tarefas", t.id, alt, { chaves: ["tarefas", "painel", "eventos"] });
  }, [atualizar]);
  const podeEditar = useCallback((t: TarefaComRelacoes) => pode("tarefas.editar") || t.responsavel_id === perfil?.id || t.created_by === perfil?.id, [pode, perfil?.id]);
  const colunas = useColunasTarefas(salvar, podeEditar);
  const itens = consulta.data?.linhas ?? [];

  const aberta = useQuery({
    queryKey: ["tarefas", "item", itemId],
    enabled: Boolean(itemId),
    queryFn: async () => {
      const { data, error } = await supabase().from("tarefas").select(SELECT).eq("id", itemId!).maybeSingle();
      if (error) throw error;
      return data as unknown as TarefaComRelacoes | null;
    },
  });
  useEffect(() => {
    if (itemId && aberta.isFetched && !aberta.data) {
      aviso.erro("Tarefa não encontrada ou sem permissão de acesso.");
      definirParametros({ item: null });
    }
  }, [itemId, aberta.isFetched, aberta.data, definirParametros]);

  const acoesLote = [
    { id: "status", rotulo: "Mudar situação", icone: <ListChecks size={13} />, executar: (ts: TarefaComRelacoes[]) => setLote({ tipo: "status" as const, itens: ts }) },
    { id: "responsavel", rotulo: "Atribuir", icone: <UserRound size={13} />, executar: (ts: TarefaComRelacoes[]) => setLote({ tipo: "responsavel" as const, itens: ts }), visivel: pode("tarefas.editar") },
    { id: "prazo", rotulo: "Definir prazo", icone: <CalendarClock size={13} />, executar: (ts: TarefaComRelacoes[]) => setLote({ tipo: "prazo" as const, itens: ts }) },
    {
      id: "arquivar",
      rotulo: "Arquivar",
      icone: <Archive size={13} />,
      executar: async (ts: TarefaComRelacoes[]) => {
        await Promise.all(ts.map((t) => atualizar("tarefas", t.id, { arquivado_em: new Date().toISOString() }, { silencioso: true }).catch(() => undefined)));
        aviso.sucesso(`${ts.length} tarefa(s) arquivada(s).`);
      },
    },
    {
      id: "excluir",
      rotulo: "Excluir",
      icone: <Trash2 size={13} />,
      perigo: true,
      visivel: pode("tarefas.editar"),
      executar: async (ts: TarefaComRelacoes[]) => {
        if (!(await confirmarSimples({ titulo: `Excluir ${ts.length} tarefa(s)?`, mensagem: "Checklist, comentários e anexos das tarefas também serão removidos. Prefira arquivar.", confirmar: "Excluir", perigo: true }))) return;
        for (const t of ts) await excluir("tarefas", t.id).catch(() => undefined);
      },
    },
  ];

  const selecionada = aberta.data ?? itens.find((t) => t.id === itemId) ?? null;

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <CabecalhoPagina icone={<ListChecks size={20} />} titulo={config.nome("tarefas")} subtitulo={pode("tarefas.ver_todas") ? "Tarefas da equipe vinculadas a leads, clientes e casos." : "Suas tarefas e as que você criou."} />
      <Quadro<TarefaComRelacoes>
        id="tarefas"
        rotuloItens={config.nome("tarefas")}
        itens={itens}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoRecarregar={() => consulta.refetch()}
        truncado={consulta.data?.truncado}
        colunas={colunas}
        colunaTitulo="titulo"
        colunaStatus="status"
        chave={(t) => t.id}
        rotuloItem={(t) => t.titulo}
        aoAbrir={(t) => definirParametros({ item: t.id })}
        configPadrao={{ tipo: "tabela", agrupamento: "status", ordenacao: { coluna: "prazo", direcao: "asc" } }}
        kanban={{ coluna: "status", aoMover: (t, v) => salvar(t, { status: v ?? "a_fazer" }).catch(() => undefined), campos: ["responsavel_id", "prazo", "prioridade", "vinculo"] }}
        calendario={{ coluna: "prazo", evento: (t) => ({ id: t.id, titulo: t.titulo, cor: STATUS_TAREFA.find((s) => s.valor === t.status)?.cor ?? "#A1A1AA", tipo: "Tarefa", icone: <ListChecks size={11} />, concluido: t.status === "concluida", diaInteiro: t.prazo_dia_inteiro }) }}
        resumo={{ campos: ["status", "prazo"] }}
        aoCriarRapido={async (titulo, grupo) => {
          await inserir(
            "tarefas",
            {
              titulo,
              responsavel_id: grupo?.coluna === "responsavel_id" && grupo.valor ? grupo.valor : perfil?.id,
              ...(grupo?.coluna === "status" && grupo.valor ? { status: grupo.valor } : {}),
              ...(grupo?.coluna === "prioridade" && grupo.valor ? { prioridade: grupo.valor } : {}),
            },
            { chaves: ["tarefas", "painel"] },
          );
        }}
        aoNovo={() => definirParametros({ novo: "1" })}
        rotuloNovo="Nova tarefa"
        acoesLote={acoesLote}
        aviso={<AvisoPreset preset={preset} ctx={ctx} aoLimpar={limpar} />}
        destaqueLinha={(t) => (t.prazo && t.status !== "concluida" && t.status !== "cancelada" && new Date(t.prazo).getTime() < Date.now() ? "perigo" : null)}
        extrasBarra={
          !preset && (
            <OpcoesExibicao
              opcoes={[
                { id: "concluidas", rotulo: "Concluídas há mais de 30 dias", ativo: concluidasAntigas, aoAlterar: setConcluidasAntigas },
                { id: "arquivadas", rotulo: "Arquivadas", ativo: arquivadas, aoAlterar: setArquivadas },
              ]}
            />
          )
        }
        vazio={<Vazio icone={<ListChecks size={24} />} titulo="Nenhuma tarefa" descricao="Crie tarefas para organizar o trabalho da equipe. Automações também criam tarefas (ex.: primeiro contato com lead novo)." />}
      />
      <Gaveta aberto={Boolean(itemId)} aoFechar={() => definirParametros({ item: null })} rotulo={selecionada?.titulo ?? "Tarefa"} largura="md">
        {selecionada ? <PainelTarefa tarefa={selecionada} colunas={colunas} aoFechar={() => definirParametros({ item: null })} /> : <Carregando />}
      </Gaveta>
      <FormTarefa aberto={novo} aoFechar={() => definirParametros({ novo: null })} />
      <LoteTarefas pedido={lote} aoFechar={() => setLote(null)} />
    </div>
  );
}

function LoteTarefas({ pedido, aoFechar }: { pedido: { tipo: "status" | "responsavel" | "prazo"; itens: TarefaComRelacoes[] } | null; aoFechar: () => void }) {
  const config = useConfig();
  const { atualizar } = useGravacao();
  const [data, setData] = useState("");
  if (!pedido) return null;
  const aplicar = async (alt: Record<string, unknown>) => {
    const r = await Promise.allSettled(pedido.itens.map((t) => atualizar("tarefas", t.id, alt, { silencioso: true })));
    const falhas = r.filter((x) => x.status === "rejected").length;
    if (falhas) aviso.erro(`${falhas} tarefa(s) não puderam ser alteradas (permissão ou dependência pendente).`);
    else aviso.sucesso(`${pedido.itens.length} tarefa(s) atualizada(s).`);
    aoFechar();
  };
  return (
    <Modal aberto aoFechar={aoFechar} largura="sm" titulo={`Alterar ${pedido.itens.length} tarefa(s)`}>
      {pedido.tipo === "prazo" ? (
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (data) aplicar({ prazo: fimDiaSP(data), prazo_dia_inteiro: true }); }}>
          <label className="flex flex-1 flex-col gap-1 text-[13px] font-semibold text-crm-tinta-2">
            Novo prazo
            <Entrada type="date" value={data} onChange={(e) => setData(e.target.value)} data-autofoco />
          </label>
          <Botao type="submit" variante="primario" disabled={!data}>
            Aplicar
          </Botao>
        </form>
      ) : (
        <div className="-mx-2 max-h-80 overflow-y-auto rounded-xl border border-crm-linha">
          <ListaBusca
            opcoes={pedido.tipo === "status" ? STATUS_TAREFA : [{ valor: "", rotulo: "Sem responsável" }, ...opcoesUsuarios(config, false)]}
            selecionados={[]}
            estilo={pedido.tipo === "status" ? "pilula" : "pessoa"}
            aoAlternar={(v) => aplicar(pedido.tipo === "status" ? { status: v } : { responsavel_id: v || null })}
          />
        </div>
      )}
    </Modal>
  );
}

function PainelTarefa({ tarefa: t, colunas, aoFechar }: { tarefa: TarefaComRelacoes; colunas: ColunaQuadro<TarefaComRelacoes>[]; aoFechar: () => void }) {
  const { pode, perfil } = useAuth();
  const config = useConfig();
  const { atualizar, inserir, excluir } = useGravacao();
  const [aba, setAba] = useState("dados");
  const [novoItem, setNovoItem] = useState("");
  const podeEditar = pode("tarefas.editar") || t.responsavel_id === perfil?.id || t.created_by === perfil?.id;
  const checklist = (Array.isArray(t.checklist) ? t.checklist : []) as { id: string; texto: string; feito: boolean }[];
  const vinculo = vinculoDe(t);
  const col = (id: string) => colunas.find((c) => c.id === id)!;
  const salvarChecklist = (lista: typeof checklist) => atualizar("tarefas", t.id, { checklist: lista }, { chaves: ["tarefas"] }).catch(() => undefined);

  const dependencias = useQuery({
    queryKey: ["tarefas", "dependencias", t.id, t.caso_id, t.lead_id, t.cliente_id],
    queryFn: async () => {
      let q = supabase().from("tarefas").select("id, titulo, status").neq("id", t.id).is("arquivado_em", null);
      if (t.caso_id) q = q.eq("caso_id", t.caso_id);
      else if (t.cliente_id) q = q.eq("cliente_id", t.cliente_id);
      else if (t.lead_id) q = q.eq("lead_id", t.lead_id);
      else q = q.eq("responsavel_id", t.responsavel_id ?? perfil?.id ?? "");
      return (await executar(q.order("created_at").limit(100))) as Pick<Tarefa, "id" | "titulo" | "status">[];
    },
  });
  const dependeDe = dependencias.data?.find((d) => d.id === t.depende_de);

  const duplicar = async () => {
    const copia = await inserir<Tarefa>(
      "tarefas",
      {
        titulo: `${t.titulo} (cópia)`,
        descricao: t.descricao,
        prioridade: t.prioridade,
        responsavel_id: t.responsavel_id,
        prazo: t.prazo,
        prazo_dia_inteiro: t.prazo_dia_inteiro,
        lead_id: t.lead_id,
        cliente_id: t.cliente_id,
        caso_id: t.caso_id,
        checklist: checklist.map((c) => ({ ...c, id: idCurto(), feito: false })),
        etiquetas: t.etiquetas,
      },
      { chaves: ["tarefas"], mensagemSucesso: "Tarefa duplicada." },
    );
    window.history.replaceState(null, "", `/crm/tarefas?item=${copia.id}`);
  };

  return (
    <PainelItem
      rotulo={t.titulo}
      titulo={t.titulo}
      subtitulo={vinculo ? <Link href={vinculo.link} className="hover:underline">{vinculo.rotulo}</Link> : "Tarefa sem vínculo"}
      aoFechar={aoFechar}
      selos={
        <>
          {t.origem === "automacao" && (
            <Selo tom="ouro" icone={<Zap size={11} aria-hidden />} titulo="Criada automaticamente por uma automação">
              Automática
            </Selo>
          )}
          {t.origem === "modelo" && <Selo tom="info">Modelo de tarefas</Selo>}
          {t.arquivado_em && <Selo>Arquivada</Selo>}
          {t.status === "concluida" && t.concluida_em && <Selo tom="sucesso">Concluída {formatarDataHora(t.concluida_em)} por {config.usuario(t.concluida_por)?.nome ?? "—"}</Selo>}
        </>
      }
      acoes={
        podeEditar && t.status !== "concluida" ? (
          <Botao variante="primario" tamanho="sm" icone={<CheckSquare size={14} />} onClick={() => atualizar("tarefas", t.id, { status: "concluida" }, { chaves: ["tarefas", "painel"], mensagemSucesso: "Tarefa concluída." }).catch(() => undefined)}>
            Concluir tarefa
          </Botao>
        ) : undefined
      }
      menu={[
        { rotulo: "Duplicar tarefa", icone: <Copy size={15} />, aoSelecionar: duplicar },
        ...(podeEditar
          ? [{ rotulo: t.arquivado_em ? "Restaurar" : "Arquivar", icone: t.arquivado_em ? <ArchiveRestore size={15} /> : <Archive size={15} />, aoSelecionar: () => atualizar("tarefas", t.id, { arquivado_em: t.arquivado_em ? null : new Date().toISOString() }, { chaves: ["tarefas"], mensagemSucesso: t.arquivado_em ? "Tarefa restaurada." : "Tarefa arquivada." }).catch(() => undefined) }]
          : []),
        ...(pode("tarefas.editar") || t.created_by === perfil?.id
          ? [{
              rotulo: "Excluir",
              icone: <Trash2 size={15} />,
              perigo: true,
              separadorAntes: true,
              aoSelecionar: async () => {
                if (!(await confirmarSimples({ titulo: "Excluir tarefa?", mensagem: "Checklist, comentários e anexos serão removidos. Prefira arquivar.", confirmar: "Excluir", perigo: true }))) return;
                await excluir("tarefas", t.id, { mensagemSucesso: "Tarefa excluída." }).catch(() => undefined);
                aoFechar();
              },
            }]
          : []),
      ]}
      abas={[
        { id: "dados", rotulo: "Dados" },
        { id: "comentarios", rotulo: "Comentários" },
        { id: "anexos", rotulo: "Anexos" },
      ]}
      abaAtiva={aba}
      aoTrocarAba={setAba}
    >
      {aba === "dados" && (
        <div className="flex flex-col gap-5">
          <ListaPropriedades item={t} rotuloItem={t.titulo} colunas={["status", "responsavel_id", "prazo", "prioridade", "etiquetas"].map(col)} />
          <SecaoFicha titulo="Descrição">
            <ListaPropriedades
              item={t}
              rotuloItem={t.titulo}
              colunas={[{ id: "descricao", titulo: "Descrição", tipo: "texto_longo", valor: (x: TarefaComRelacoes) => x.descricao, exibir: (x: TarefaComRelacoes) => <span className="whitespace-pre-wrap">{x.descricao || "—"}</span>, editar: podeEditar ? (x: TarefaComRelacoes, v: unknown) => atualizar("tarefas", x.id, { descricao: v }, { chaves: ["tarefas"] }) : undefined } as ColunaQuadro<TarefaComRelacoes>]}
            />
          </SecaoFicha>
          <SecaoFicha titulo={`Checklist (${checklist.filter((c) => c.feito).length}/${checklist.length})`}>
            {checklist.length > 0 && <BarraProgresso valor={checklist.filter((c) => c.feito).length} total={checklist.length} rotulo="Progresso do checklist" />}
            <ul className="flex flex-col gap-1">
              {checklist.map((c) => (
                <li key={c.id} className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white">
                  <input type="checkbox" checked={c.feito} disabled={!podeEditar} onChange={(e) => salvarChecklist(checklist.map((x) => (x.id === c.id ? { ...x, feito: e.target.checked } : x)))} aria-label={c.texto} className="h-4 w-4 accent-[#263A2D]" />
                  <span className={`flex-1 text-sm ${c.feito ? "text-crm-tinta-3 line-through" : ""}`}>{c.texto}</span>
                  {podeEditar && (
                    <button type="button" onClick={() => salvarChecklist(checklist.filter((x) => x.id !== c.id))} className="rounded p-1 text-crm-tinta-3 opacity-0 hover:text-crm-perigo focus:opacity-100 group-hover:opacity-100" aria-label={`Remover ${c.texto}`}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {podeEditar && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!novoItem.trim()) return;
                  salvarChecklist([...checklist, { id: idCurto(), texto: novoItem.trim(), feito: false }]);
                  setNovoItem("");
                }}
              >
                <Entrada value={novoItem} onChange={(e) => setNovoItem(e.target.value)} placeholder="Adicionar subitem" aria-label="Novo subitem" />
                <Botao type="submit" variante="secundario" tamanho="icone" aria-label="Adicionar subitem">
                  <Plus size={16} />
                </Botao>
              </form>
            )}
          </SecaoFicha>
          <SecaoFicha titulo="Dependência" descricao="Esta tarefa só pode ser concluída depois da tarefa escolhida.">
            <SeletorCampo
              rotulo="Depende de"
              valor={t.depende_de}
              opcoes={(dependencias.data ?? []).map((d) => ({ valor: d.id, rotulo: d.titulo, descricao: STATUS_TAREFA.find((s) => s.valor === d.status)?.rotulo }))}
              aoAlterar={(v) => atualizar("tarefas", t.id, { depende_de: v }, { chaves: ["tarefas"] }).catch(() => undefined)}
              rotuloVazio="Sem dependência"
              desabilitado={!podeEditar}
            />
            {dependeDe && dependeDe.status !== "concluida" && dependeDe.status !== "cancelada" && (
              <p className="text-xs font-semibold text-crm-alerta">Bloqueada até a conclusão de “{dependeDe.titulo}”.</p>
            )}
          </SecaoFicha>
          <p className="text-xs text-crm-tinta-3">
            Criada em {formatarDataHora(t.created_at)} {t.created_by ? `por ${config.usuario(t.created_by)?.nome ?? "—"}` : "automaticamente"}.
          </p>
        </div>
      )}
      {aba === "comentarios" && <Atividade entidade="tarefa" registroId={t.id} />}
      {aba === "anexos" && <ListaArquivos escopo={{ tarefa_id: t.id }} filtroColuna="tarefa_id" tipo="anexo" titulo="Anexos da tarefa" />}
    </PainelItem>
  );
}
