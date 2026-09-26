"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ClipboardCheck, FileText, Link2, Lock, Send, UserRound, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso } from "../../_lib/avisos";
import { opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { diferencaDias, formatarData, hojeSP } from "../../_lib/datas";
import { buscarTodos, mensagemErro, useGravacao } from "../../_lib/dados";
import { chamarFuncao } from "../../_lib/edge";
import type { Consulta } from "../../_lib/presets";
import { Link, navegar, useRota } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import type { Caso, Cliente, Documento, DocumentoComRelacoes, Lead, Solicitacao } from "../../_lib/tipos";
import { AvisoPreset, usePresetAtivo } from "../../_lib/usePreset";
import { OpcoesExibicao } from "../../_quadro/OpcoesExibicao";
import { Quadro } from "../../_quadro/Quadro";
import type { ColunaQuadro } from "../../_quadro/tipos";
import { Abas } from "../../_ui/Abas";
import { confirmar } from "../../_ui/Dialogos";
import { ListaBusca } from "../../_ui/Seletores";
import { Modal } from "../../_ui/Sobreposicoes";
import { CabecalhoPagina, Vazio } from "../../_ui/Visuais";
import { DetalheDocumento, useMudarStatusDocumento } from "../../_componentes/ChecklistDocumentos";
import { STATUS_DOCUMENTO } from "../../_componentes/statusDocumento";

const SELECT_DOCS = "*, caso:casos(id, titulo, codigo), cliente:clientes(id, nome, codigo), lead:leads(id, nome, codigo)";
const PENDENTES = ["nao_solicitado", "solicitado", "rejeitado"];

export default function Documentos() {
  const config = useConfig();
  const { parametro, definirParametros } = useRota();
  const aba = parametro("aba") === "validade" ? "validade" : parametro("aba") === "links" ? "links" : "documentos";
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <CabecalhoPagina
        icone={<FileText size={20} />}
        titulo={config.nome("documentos")}
        subtitulo="Checklists de todos os casos e clientes: o que falta, o que revisar e o que está vencendo."
      />
      <Abas
        abas={[
          { id: "documentos", rotulo: "Checklists", icone: <ClipboardCheck size={14} aria-hidden /> },
          { id: "validade", rotulo: "Validade de laudos e prescrições", icone: <CalendarClock size={14} aria-hidden /> },
          { id: "links", rotulo: "Links de envio", icone: <Link2 size={14} aria-hidden /> },
        ]}
        ativa={aba}
        aoTrocar={(a) => definirParametros({ aba: a === "documentos" ? null : a, preset: null, meus: null, v: null }, { substituir: true })}
        rotulo="Visões de documentos"
      />
      {aba === "documentos" && <QuadroDocumentos />}
      {aba === "validade" && <QuadroValidade />}
      {aba === "links" && <QuadroLinks />}
    </div>
  );
}

function vinculo(d: { caso: Pick<Caso, "id" | "titulo" | "codigo"> | null; cliente: Pick<Cliente, "id" | "nome" | "codigo"> | null; lead: Pick<Lead, "id" | "nome" | "codigo"> | null }) {
  if (d.caso) return { texto: `${d.caso.titulo}`, detalhe: d.cliente?.nome ?? null, href: `/crm/casos/${d.caso.id}?aba=documentos` };
  if (d.cliente) return { texto: d.cliente.nome, detalhe: "documentos gerais", href: `/crm/clientes/${d.cliente.id}?aba=documentos` };
  if (d.lead) return { texto: d.lead.nome, detalhe: "lead", href: `/crm/leads?item=${d.lead.id}` };
  return null;
}

function useColunasDocumentos(salvar: (d: DocumentoComRelacoes, alt: Record<string, unknown>) => Promise<void>): ColunaQuadro<DocumentoComRelacoes>[] {
  const config = useConfig();
  const { pode } = useAuth();
  const mudarStatus = useMudarStatusDocumento();
  const ed = pode("documentos.editar") ? salvar : undefined;
  return useMemo<ColunaQuadro<DocumentoComRelacoes>[]>(
    () => [
      {
        id: "nome",
        titulo: "Documento",
        tipo: "texto",
        valor: (d) => d.nome,
        texto: (d) => `${d.nome} ${d.caso?.titulo ?? ""} ${d.cliente?.nome ?? ""} ${d.lead?.nome ?? ""}`,
        exibir: (d) => (
          <span className="flex min-w-0 items-center gap-1.5">
            {d.clinico && <Lock size={12} className="shrink-0 text-crm-perigo" aria-label="Dado de saúde (acesso restrito)" />}
            {d.financeiro && <Lock size={12} className="shrink-0 text-crm-ouro-escuro" aria-label="Documento financeiro (acesso restrito)" />}
            <span className="truncate">{d.nome}</span>
          </span>
        ),
        editar: ed ? (d, v) => salvar(d, { nome: v }) : undefined,
        largura: 260,
        obrigatoria: true,
      },
      {
        id: "status",
        titulo: "Situação",
        tipo: "status",
        valor: (d) => d.status,
        opcoes: STATUS_DOCUMENTO.map((s) => ({ valor: s.valor, rotulo: s.rotulo, cor: s.cor })),
        editar: pode("documentos.editar") ? (d, v) => mudarStatus(d, String(v ?? d.status)) : undefined,
        agrupavel: true,
        resumo: "distribuicao",
        largura: 150,
      },
      {
        id: "vinculo",
        titulo: "Caso / cliente",
        tipo: "texto",
        valor: (d) => vinculo(d)?.texto ?? null,
        exibir: (d) => {
          const v = vinculo(d);
          if (!v) return "—";
          return (
            <Link href={v.href} onClick={(e) => e.stopPropagation()} className="flex min-w-0 flex-col leading-tight hover:underline">
              <span className="truncate text-crm-info">{v.texto}</span>
              {v.detalhe && <span className="truncate text-[11px] text-crm-tinta-3">{v.detalhe}</span>}
            </Link>
          );
        },
        agrupavel: true,
        largura: 240,
      },
      { id: "cliente", titulo: config.nome("cliente"), tipo: "texto", valor: (d) => d.cliente?.nome ?? d.lead?.nome ?? null, agrupavel: true, largura: 180, oculta: true },
      {
        id: "categoria_id",
        titulo: "Categoria",
        tipo: "selecao",
        valor: (d) => d.categoria_id,
        opcoes: config.categorias.map((c) => ({ valor: c.id, rotulo: c.nome, cor: c.cor, desabilitada: !c.ativo })),
        agrupavel: true,
        largura: 170,
      },
      { id: "grupo", titulo: "Grupo do checklist", tipo: "texto", valor: (d) => d.grupo, agrupavel: true, largura: 170, oculta: true },
      { id: "obrigatorio", titulo: "Obrigatório", tipo: "checkbox", valor: (d) => d.obrigatorio, editar: ed ? (d, v) => salvar(d, { obrigatorio: Boolean(v) }) : undefined, agrupavel: true, largura: 110 },
      {
        id: "revisor_id",
        titulo: "Revisor",
        tipo: "pessoa",
        valor: (d) => d.revisor_id,
        opcoes: opcoesUsuarios(config),
        editar: ed ? (d, v) => salvar(d, { revisor_id: v }) : undefined,
        agrupavel: true,
        largura: 150,
      },
      {
        id: "prazo",
        titulo: "Prazo interno",
        tipo: "data",
        valor: (d) => d.prazo,
        editar: ed ? (d, v) => salvar(d, { prazo: v }) : undefined,
        alertaVencimento: (d) => PENDENTES.includes(d.status),
        largura: 130,
      },
      {
        id: "valido_ate",
        titulo: "Válido até",
        tipo: "data",
        valor: (d) => d.valido_ate,
        editar: ed ? (d, v) => salvar(d, { valido_ate: v }) : undefined,
        alertaVencimento: (d) => d.status !== "dispensado",
        largura: 130,
        descricao: "Validade de laudos, relatórios e prescrições.",
      },
      { id: "etapa", titulo: "Etapa", tipo: "texto", valor: (d) => d.etapa, largura: 150, oculta: true, agrupavel: true },
      { id: "enviado_pelo_cliente", titulo: "Enviado pelo cliente", tipo: "checkbox", valor: (d) => d.enviado_pelo_cliente, largura: 120, oculta: true, agrupavel: true },
      { id: "solicitado_em", titulo: "Solicitado em", tipo: "data_hora", valor: (d) => d.solicitado_em, largura: 150, oculta: true },
      { id: "recebido_em", titulo: "Recebido em", tipo: "data_hora", valor: (d) => d.recebido_em, largura: 150 },
      { id: "aprovado_em", titulo: "Aprovado em", tipo: "data_hora", valor: (d) => d.aprovado_em, largura: 150, oculta: true },
      { id: "aprovado_por", titulo: "Aprovado por", tipo: "pessoa", valor: (d) => d.aprovado_por, opcoes: opcoesUsuarios(config), largura: 150, oculta: true },
      { id: "clinico", titulo: "Dado de saúde", tipo: "checkbox", valor: (d) => d.clinico, largura: 110, oculta: true, agrupavel: true },
    ],
    [config, ed, salvar, pode, mudarStatus],
  );
}

function QuadroDocumentos() {
  const config = useConfig();
  const { pode } = useAuth();
  const { atualizar } = useGravacao();
  const mudarStatus = useMudarStatusDocumento();
  const { preset, ctx, limpar } = usePresetAtivo(["documentos"]);
  const [concluidos, setConcluidos] = useState(false);
  const [aberto, setAberto] = useState<DocumentoComRelacoes | null>(null);
  const [lote, setLote] = useState<DocumentoComRelacoes[] | null>(null);

  const consulta = useQuery({
    queryKey: ["documentos", "quadro", { concluidos, preset: preset?.id, meus: ctx?.somenteMeus }],
    enabled: !preset || Boolean(ctx),
    queryFn: () => {
      const limite = new Date(Date.now() - 45 * 86400_000).toISOString();
      return buscarTodos<DocumentoComRelacoes>((de, ate) => {
        let q = supabase().from("documentos").select(SELECT_DOCS);
        if (preset && ctx) q = preset.aplicar(q as unknown as Consulta, ctx) as unknown as typeof q;
        else if (!concluidos) q = q.or(`status.not.in.(aprovado,dispensado),updated_at.gte.${limite}`);
        return q.order("prazo", { ascending: true, nullsFirst: false }).order("ordem").range(de, ate) as unknown as PromiseLike<{ data: DocumentoComRelacoes[] | null; error: unknown }>;
      }, 20000);
    },
  });
  const salvar = useCallback(async (d: DocumentoComRelacoes, alt: Record<string, unknown>) => {
    await atualizar("documentos", d.id, alt, { chaves: ["documentos", "painel"] });
  }, [atualizar]);
  const colunas = useColunasDocumentos(salvar);
  const itens = consulta.data?.linhas ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Quadro<DocumentoComRelacoes>
        id="documentos"
        rotuloItens={config.nome("documentos")}
        itens={itens}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoRecarregar={() => consulta.refetch()}
        truncado={consulta.data?.truncado}
        colunas={colunas}
        colunaTitulo="nome"
        colunaStatus="status"
        chave={(d) => d.id}
        rotuloItem={(d) => d.nome}
        aoAbrir={(d) => setAberto(d)}
        configPadrao={{ tipo: "tabela", agrupamento: "status", ordenacao: null }}
        kanban={{ coluna: "status", aoMover: (d, v) => (v ? mudarStatus(d, v) : undefined), campos: ["vinculo", "revisor_id", "prazo", "valido_ate"] }}
        calendario={{ coluna: "prazo", evento: (d) => ({ id: d.id, titulo: `${d.nome}${vinculo(d) ? ` — ${vinculo(d)!.texto}` : ""}`, cor: STATUS_DOCUMENTO.find((s) => s.valor === d.status)?.cor ?? "#A1A1AA", tipo: "Prazo de documento", diaInteiro: true, concluido: !PENDENTES.includes(d.status) }) }}
        resumo={{ campos: ["status", "obrigatorio", "prazo"] }}
        acoesLote={
          pode("documentos.editar")
            ? [
                { id: "revisor", rotulo: "Definir revisor", icone: <UserRound size={13} />, executar: (ds: DocumentoComRelacoes[]) => setLote(ds) },
                {
                  id: "solicitado",
                  rotulo: "Marcar como solicitado",
                  icone: <Send size={13} />,
                  executar: async (ds: DocumentoComRelacoes[]) => {
                    const alvo = ds.filter((d) => d.status === "nao_solicitado");
                    await Promise.all(alvo.map((d) => atualizar("documentos", d.id, { status: "solicitado" }, { silencioso: true }).catch(() => undefined)));
                    aviso.sucesso(`${alvo.length} documento(s) marcados como solicitados.`);
                  },
                },
              ]
            : []
        }
        aviso={<AvisoPreset preset={preset} ctx={ctx} aoLimpar={limpar} />}
        destaqueLinha={(d) => (PENDENTES.includes(d.status) && d.prazo && d.prazo < hojeSP() ? "perigo" : d.status === "rejeitado" ? "alerta" : null)}
        extrasBarra={!preset && <OpcoesExibicao opcoes={[{ id: "concluidos", rotulo: "Aprovados e dispensados antigos", ativo: concluidos, aoAlterar: setConcluidos }]} />}
        vazio={
          <Vazio
            icone={<ClipboardCheck size={24} />}
            titulo="Nenhum documento pendente"
            descricao="Os documentos aparecem aqui quando um checklist é aplicado a um caso, cliente ou lead."
          />
        }
      />
      <DetalheDocumento documento={aberto ? (itens.find((d) => d.id === aberto.id) as Documento | undefined) ?? aberto : null} aoFechar={() => setAberto(null)} />
      {lote && (
        <Modal aberto aoFechar={() => setLote(null)} largura="sm" titulo={`Definir revisor de ${lote.length} documento(s)`}>
          <div className="-mx-2 max-h-80 overflow-y-auto rounded-xl border border-crm-linha">
            <ListaBusca
              opcoes={[{ valor: "", rotulo: "Sem revisor definido" }, ...opcoesUsuarios(config, false)]}
              selecionados={[]}
              estilo="pessoa"
              aoAlternar={async (v) => {
                await Promise.all(lote.map((d) => atualizar("documentos", d.id, { revisor_id: v || null }, { silencioso: true }).catch(() => undefined)));
                aviso.sucesso(`${lote.length} documento(s) atualizado(s).`);
                setLote(null);
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

function QuadroValidade() {
  const { atualizar } = useGravacao();
  const [aberto, setAberto] = useState<DocumentoComRelacoes | null>(null);
  const consulta = useQuery({
    queryKey: ["documentos", "validade"],
    queryFn: () =>
      buscarTodos<DocumentoComRelacoes>(
        (de, ate) => supabase().from("documentos").select(SELECT_DOCS).not("valido_ate", "is", null).neq("status", "dispensado").order("valido_ate").range(de, ate) as unknown as PromiseLike<{ data: DocumentoComRelacoes[] | null; error: unknown }>,
        20000,
      ),
  });
  const salvar = useCallback(async (d: DocumentoComRelacoes, alt: Record<string, unknown>) => {
    await atualizar("documentos", d.id, alt, { chaves: ["documentos"] });
  }, [atualizar]);
  const base = useColunasDocumentos(salvar);
  const colunas = useMemo<ColunaQuadro<DocumentoComRelacoes>[]>(
    () => [
      ...base.filter((c) => ["nome", "vinculo", "valido_ate", "status", "categoria_id", "revisor_id"].includes(c.id)),
      {
        id: "situacao_validade",
        titulo: "Validade",
        tipo: "selecao",
        valor: (d) => {
          const dias = diferencaDias(hojeSP(), d.valido_ate!);
          return dias < 0 ? "vencido" : dias <= 30 ? "30" : dias <= 60 ? "60" : "ok";
        },
        opcoes: [
          { valor: "vencido", rotulo: "Vencido", cor: "#B42318" },
          { valor: "30", rotulo: "Vence em até 30 dias", cor: "#A15C07" },
          { valor: "60", rotulo: "Vence em 31–60 dias", cor: "#C5A880" },
          { valor: "ok", rotulo: "Em dia", cor: "#2E6B33" },
        ],
        exibir: (d) => {
          const dias = diferencaDias(hojeSP(), d.valido_ate!);
          if (dias < 0) return <span className="inline-flex items-center gap-1 text-[13px] font-bold text-crm-perigo"><CalendarClock size={13} aria-hidden /> Vencido há {-dias} dia(s)</span>;
          if (dias <= 30) return <span className="inline-flex items-center gap-1 text-[13px] font-bold text-crm-alerta"><CalendarClock size={13} aria-hidden /> Vence em {dias} dia(s)</span>;
          return <span className="text-[13px] text-crm-tinta-2">Em dia ({formatarData(d.valido_ate)})</span>;
        },
        agrupavel: true,
        largura: 190,
      },
    ],
    [base],
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-crm-linha bg-white px-3 py-2 text-sm text-crm-tinta-2">
        Documentos com data de validade (laudos, relatórios médicos, prescrições). A automação de pendências pode avisar o responsável antes do vencimento; nenhuma mensagem é enviada ao cliente automaticamente.
      </p>
      <Quadro<DocumentoComRelacoes>
        id="documentos-validade"
        rotuloItens="Documentos com validade"
        itens={consulta.data?.linhas ?? []}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoRecarregar={() => consulta.refetch()}
        colunas={colunas}
        colunaTitulo="nome"
        colunaStatus="situacao_validade"
        chave={(d) => d.id}
        rotuloItem={(d) => d.nome}
        aoAbrir={(d) => setAberto(d)}
        visualizacoes={["tabela", "calendario", "resumo"]}
        configPadrao={{ tipo: "tabela", agrupamento: "situacao_validade", ordenacao: { coluna: "valido_ate", direcao: "asc" } }}
        calendario={{ coluna: "valido_ate", evento: (d) => ({ id: d.id, titulo: `${d.nome}${vinculo(d) ? ` — ${vinculo(d)!.texto}` : ""}`, cor: "#A15C07", tipo: "Fim da validade", diaInteiro: true }) }}
        resumo={{ campos: ["situacao_validade", "valido_ate"] }}
        vazio={<Vazio icone={<CalendarClock size={24} />} titulo="Nenhum documento com validade cadastrada" descricao="Informe “Válido até” no detalhe do documento (ex.: laudos e prescrições)." />}
      />
      <DetalheDocumento documento={aberto} aoFechar={() => setAberto(null)} />
    </div>
  );
}

type LinkEnvio = Solicitacao & {
  caso: Pick<Caso, "id" | "titulo"> | null;
  cliente: Pick<Cliente, "id" | "nome"> | null;
  lead: Pick<Lead, "id" | "nome"> | null;
};

function situacaoLink(s: LinkEnvio) {
  if (s.revogada_em) return "revogado";
  if (new Date(s.expira_em).getTime() < Date.now()) return "expirado";
  return "ativo";
}

function QuadroLinks() {
  const config = useConfig();
  const { pode } = useAuth();
  const { invalidar } = useGravacao();
  const consulta = useQuery({
    queryKey: ["solicitacoes", "quadro"],
    queryFn: () =>
      buscarTodos<LinkEnvio>(
        (de, ate) =>
          supabase().from("solicitacoes_documentos").select("*, caso:casos(id, titulo), cliente:clientes(id, nome), lead:leads(id, nome)").order("created_at", { ascending: false }).range(de, ate) as unknown as PromiseLike<{ data: LinkEnvio[] | null; error: unknown }>,
        5000,
      ),
  });
  const revogar = useCallback(
    async (s: LinkEnvio) => {
      const r = await confirmar({ titulo: "Revogar link?", mensagem: "O cliente não poderá mais enviar documentos por este link.", confirmar: "Revogar", perigo: true });
      if (!r.confirmado) return;
      try {
        await chamarFuncao("crm-documentos", { acao: "revogar_link", id: s.id });
        aviso.sucesso("Link revogado.");
        invalidar("solicitacoes", "eventos");
      } catch (e) {
        aviso.erro(mensagemErro(e));
      }
    },
    [invalidar],
  );
  const colunas = useMemo<ColunaQuadro<LinkEnvio>[]>(
    () => [
      {
        id: "destinatario",
        titulo: "Enviado para",
        tipo: "texto",
        valor: (s) => s.cliente?.nome ?? s.lead?.nome ?? null,
        exibir: (s) => (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate">{s.cliente?.nome ?? s.lead?.nome ?? "—"}</span>
            {s.caso && <span className="truncate text-[11px] text-crm-tinta-3">{s.caso.titulo}</span>}
          </span>
        ),
        largura: 240,
        obrigatoria: true,
      },
      {
        id: "situacao",
        titulo: "Situação",
        tipo: "status",
        valor: situacaoLink,
        opcoes: [
          { valor: "ativo", rotulo: "Ativo", cor: "#2E6B33" },
          { valor: "expirado", rotulo: "Expirado", cor: "#A1A1AA" },
          { valor: "revogado", rotulo: "Revogado", cor: "#52525B" },
        ],
        agrupavel: true,
        largura: 120,
      },
      { id: "documentos", titulo: "Documentos", tipo: "numero", valor: (s) => s.documentos_ids.length, largura: 110, alinhamento: "direita" },
      { id: "created_at", titulo: "Criado em", tipo: "data_hora", valor: (s) => s.created_at, largura: 150 },
      { id: "criado_por", titulo: "Criado por", tipo: "pessoa", valor: (s) => s.criado_por, opcoes: opcoesUsuarios(config), agrupavel: true, largura: 150 },
      { id: "expira_em", titulo: "Expira em", tipo: "data_hora", valor: (s) => s.expira_em, largura: 150 },
      { id: "total_acessos", titulo: "Acessos", tipo: "numero", valor: (s) => s.total_acessos, largura: 90, alinhamento: "direita" },
      { id: "total_envios", titulo: "Arquivos enviados", tipo: "numero", valor: (s) => s.total_envios, largura: 130, alinhamento: "direita" },
      { id: "ultimo_acesso_em", titulo: "Último acesso", tipo: "data_hora", valor: (s) => s.ultimo_acesso_em, largura: 150 },
      {
        id: "acoes",
        titulo: "Ações",
        tipo: "texto",
        valor: () => null,
        exibir: (s) =>
          situacaoLink(s) === "ativo" && pode("documentos.solicitar_cliente") ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                revogar(s);
              }}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-crm-perigo hover:underline"
            >
              <X size={13} aria-hidden /> Revogar
            </button>
          ) : (
            <span className="text-[13px] text-crm-tinta-3">—</span>
          ),
        largura: 110,
        filtravel: false,
        ordenavel: false,
      },
    ],
    [config, pode, revogar],
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-crm-linha bg-white px-3 py-2 text-sm text-crm-tinta-2">
        Links individuais e com validade gerados na ficha do caso, cliente ou lead. O endereço completo só é exibido no momento da criação (o CRM guarda apenas uma assinatura do token).
      </p>
      <Quadro<LinkEnvio>
        id="links-envio"
        rotuloItens="Links de envio"
        itens={consulta.data?.linhas ?? []}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoRecarregar={() => consulta.refetch()}
        colunas={colunas}
        colunaTitulo="destinatario"
        colunaStatus="situacao"
        chave={(s) => s.id}
        rotuloItem={(s) => s.cliente?.nome ?? s.lead?.nome ?? "Link"}
        aoAbrir={(s) => {
          const destino = s.caso ? `/crm/casos/${s.caso.id}?aba=documentos` : s.cliente ? `/crm/clientes/${s.cliente.id}?aba=documentos` : s.lead ? `/crm/leads?item=${s.lead.id}` : null;
          if (destino) navegar(destino);
        }}
        visualizacoes={["tabela", "resumo"]}
        configPadrao={{ tipo: "tabela", agrupamento: "situacao", ordenacao: null }}
        resumo={{ campos: ["situacao", "total_envios"] }}
        vazio={<Vazio icone={<Link2 size={24} />} titulo="Nenhum link gerado" descricao="Gere links na aba Documentos da ficha do caso, do cliente ou do lead." />}
      />
    </div>
  );
}
