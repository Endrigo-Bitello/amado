"use client";

import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowRightLeft, Magnet, Tag, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso } from "../../_lib/avisos";
import { opcoesEtapas, opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { buscarTodos, useGravacao } from "../../_lib/dados";
import type { Consulta } from "../../_lib/presets";
import { useRota } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import type { Lead } from "../../_lib/tipos";
import { AvisoPreset, usePresetAtivo } from "../../_lib/usePreset";
import { OpcoesExibicao } from "../../_quadro/OpcoesExibicao";
import { Quadro } from "../../_quadro/Quadro";
import { confirmar, confirmarSimples } from "../../_ui/Dialogos";
import { ListaBusca } from "../../_ui/Seletores";
import { Gaveta, Modal } from "../../_ui/Sobreposicoes";
import { CabecalhoPagina, Carregando, Vazio } from "../../_ui/Visuais";
import { Botao } from "../../_ui/Botao";
import { useColunasLeads } from "./colunasLeads";
import { ConverterLead, DialogoMotivoPerda, FormLead } from "./Dialogos";
import { PainelLead } from "./PainelLead";

export default function Leads() {
  const config = useConfig();
  const { pode } = useAuth();
  const { parametro, definirParametros } = useRota();
  const { atualizar, inserir, excluir } = useGravacao();
  const { preset, ctx, limpar } = usePresetAtivo(["leads"]);
  const [incluirAntigos, setIncluirAntigos] = useState(false);
  const [incluirArquivados, setIncluirArquivados] = useState(false);
  const [perda, setPerda] = useState<{ lead: Lead; etapaId: string } | null>(null);
  const [converter, setConverter] = useState<Lead | null>(null);
  const [lote, setLote] = useState<{ tipo: "etapa" | "responsavel" | "etiqueta"; itens: Lead[] } | null>(null);
  const itemId = parametro("item");
  const novo = parametro("novo") === "1";

  const abertas = config.etapasDe("lead", true).filter((e) => e.categoria === "aberta").map((e) => e.id);
  const consulta = useQuery({
    queryKey: ["leads", "quadro", { incluirAntigos, incluirArquivados, preset: preset?.id, meus: ctx?.somenteMeus }],
    enabled: !config.carregando && (!preset || Boolean(ctx)),
    queryFn: async () => {
      const limite = new Date(Date.now() - 180 * 86400_000).toISOString();
      return buscarTodos<Lead>((de, ate) => {
        let q = supabase().from("leads").select("*").is("mesclado_em_id", null);
        if (preset && ctx) {
          q = preset.aplicar(q as unknown as Consulta, ctx) as unknown as typeof q;
        } else {
          if (!incluirArquivados) q = q.is("arquivado_em", null);
          if (!incluirAntigos && abertas.length) q = q.or(`etapa_id.in.(${abertas.join(",")}),etapa_alterada_em.gte.${limite}`);
        }
        return q.order("created_at", { ascending: false }).range(de, ate);
      }, 6000);
    },
  });

  // Lead aberto na gaveta (pode não estar na lista filtrada, ex.: arquivado ou vindo de link)
  const leadAberto = useQuery({
    queryKey: ["leads", "item", itemId],
    enabled: Boolean(itemId),
    queryFn: async () => {
      const { data, error } = await supabase().from("leads").select("*").eq("id", itemId!).maybeSingle();
      if (error) throw error;
      return data as Lead | null;
    },
  });

  const salvar = useCallback(
    async (l: Lead, alteracoes: Record<string, unknown>) => {
      await atualizar("leads", l.id, alteracoes, { chaves: ["leads", "painel"] });
    },
    [atualizar],
  );

  const mudarEtapa = useCallback(
    async (l: Lead, etapaId: string | null) => {
      if (!etapaId || etapaId === l.etapa_id) return;
      const etapa = config.etapa(etapaId);
      if (etapa?.categoria === "perdida") {
        setPerda({ lead: l, etapaId });
        return;
      }
      if (etapa?.categoria === "ganha" && !l.cliente_id) {
        const r = await confirmar({
          titulo: `Mover para “${etapa.nome}”`,
          mensagem: "Deseja converter este lead em cliente agora? A conversão cria a ficha do cliente (e, se quiser, o primeiro caso) sem perder o histórico do atendimento.",
          confirmar: "Converter em cliente",
          cancelar: "Só mudar a etapa",
        });
        if (r.confirmado && pode("clientes.editar")) {
          setConverter(l);
          return;
        }
      }
      await salvar(l, { etapa_id: etapaId });
    },
    [config, salvar, pode],
  );

  const colunas = useColunasLeads(salvar, mudarEtapa);
  const itens = consulta.data?.linhas ?? [];
  const selecionado = leadAberto.data ?? itens.find((l) => l.id === itemId) ?? null;

  useEffect(() => {
    if (itemId && leadAberto.isFetched && !leadAberto.data) {
      aviso.erro("Lead não encontrado ou sem permissão de acesso.");
      definirParametros({ item: null });
    }
  }, [itemId, leadAberto.isFetched, leadAberto.data, definirParametros]);

  const acoesLote = useMemo(
    () =>
      pode("leads.editar")
        ? [
            { id: "etapa", rotulo: "Mudar etapa", icone: <ArrowRightLeft size={13} />, executar: (ls: Lead[]) => setLote({ tipo: "etapa" as const, itens: ls }) },
            { id: "responsavel", rotulo: "Atribuir responsável", icone: <UserRound size={13} />, executar: (ls: Lead[]) => setLote({ tipo: "responsavel" as const, itens: ls }) },
            { id: "etiqueta", rotulo: "Adicionar etiqueta", icone: <Tag size={13} />, executar: (ls: Lead[]) => setLote({ tipo: "etiqueta" as const, itens: ls }) },
            {
              id: "arquivar",
              rotulo: "Arquivar",
              icone: <Archive size={13} />,
              executar: async (ls: Lead[]) => {
                if (!(await confirmarSimples({ titulo: `Arquivar ${ls.length} lead(s)?`, mensagem: "Eles saem dos quadros, mas continuam disponíveis em “Arquivados”. Nada é apagado.", confirmar: "Arquivar" }))) return;
                await Promise.all(ls.map((l) => atualizar("leads", l.id, { arquivado_em: new Date().toISOString() }, { silencioso: true })));
                aviso.sucesso(`${ls.length} lead(s) arquivado(s).`);
              },
            },
            ...(pode("leads.excluir")
              ? [
                  {
                    id: "excluir",
                    rotulo: "Excluir",
                    icone: <Trash2 size={13} />,
                    perigo: true,
                    executar: async (ls: Lead[]) => {
                      if (!(await confirmarSimples({ titulo: `Excluir ${ls.length} lead(s) definitivamente?`, mensagem: "Contatos, tarefas e comentários desses leads serão apagados. Prefira arquivar. Esta ação não pode ser desfeita.", confirmar: "Excluir definitivamente", perigo: true }))) return;
                      for (const l of ls) await excluir("leads", l.id).catch(() => undefined);
                    },
                  },
                ]
              : []),
          ]
        : [],
    [pode, atualizar, excluir],
  );

  if (config.carregando) return <Carregando />;
  const etapaNovo = config.etapasDe("lead")[0]?.id;

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <CabecalhoPagina
        icone={<Magnet size={20} />}
        titulo={config.nome("leads")}
        subtitulo="Atendimento comercial: do primeiro contato à contratação."
      />
      <Quadro<Lead>
        id="leads"
        rotuloItens={config.nome("leads")}
        itens={itens}
        carregando={consulta.isLoading}
        erro={consulta.error}
        aoRecarregar={() => consulta.refetch()}
        truncado={consulta.data?.truncado}
        colunas={colunas}
        colunaTitulo="nome"
        colunaStatus="etapa_id"
        chave={(l) => l.id}
        rotuloItem={(l) => l.nome}
        aoAbrir={(l) => definirParametros({ item: l.id })}
        configPadrao={{ tipo: "tabela", agrupamento: "etapa_id", ordenacao: null }}
        kanban={{ coluna: "etapa_id", aoMover: (l, v) => mudarEtapa(l, v), campos: ["responsavel_id", "temperatura", "whatsapp", "proxima_acao_em"] }}
        calendario={{ coluna: "proxima_acao_em", evento: (l) => ({ id: l.id, titulo: `${l.nome}${l.proxima_acao ? ` — ${l.proxima_acao}` : ""}`, cor: config.etapa(l.etapa_id)?.cor ?? "#3E5C8A", tipo: "Próxima ação" }) }}
        resumo={{ campos: ["etapa_id"] }}
        aoCriarRapido={
          pode("leads.editar")
            ? async (nome, grupo) => {
                await inserir("leads", { nome, origem: "manual", ...(grupo?.coluna === "etapa_id" && grupo.valor ? { etapa_id: grupo.valor } : {}), ...(grupo?.coluna === "responsavel_id" && grupo.valor ? { responsavel_id: grupo.valor } : {}) }, { chaves: ["leads", "painel"] });
              }
            : undefined
        }
        aoNovo={pode("leads.editar") ? () => definirParametros({ novo: "1" }) : undefined}
        rotuloNovo="Novo lead"
        acoesLote={acoesLote}
        aviso={<AvisoPreset preset={preset} ctx={ctx} aoLimpar={limpar} />}
        destaqueLinha={(l) => (l.proxima_acao_em && new Date(l.proxima_acao_em).getTime() < Date.now() && config.etapa(l.etapa_id)?.categoria === "aberta" ? "alerta" : null)}
        extrasBarra={
          !preset && (
            <OpcoesExibicao
              opcoes={[
                { id: "antigos", rotulo: "Encerrados há mais de 6 meses", descricao: "Contratados e não convertidos antigos.", ativo: incluirAntigos, aoAlterar: setIncluirAntigos },
                { id: "arquivados", rotulo: "Arquivados", ativo: incluirArquivados, aoAlterar: setIncluirArquivados },
              ]}
            />
          )
        }
        vazio={
          <Vazio
            icone={<Magnet size={24} />}
            titulo="Nenhum lead por aqui ainda"
            descricao="Os leads do quiz do site aparecem automaticamente. Você também pode cadastrar leads manualmente."
            acao={pode("leads.editar") && <Botao variante="primario" onClick={() => definirParametros({ novo: "1" })}>Cadastrar lead</Botao>}
          />
        }
      />

      <Gaveta aberto={Boolean(itemId)} aoFechar={() => definirParametros({ item: null })} rotulo={selecionado?.nome ?? "Lead"} largura="lg">
        {selecionado ? (
          <PainelLead lead={selecionado} colunas={colunas} aoFechar={() => definirParametros({ item: null })} aoConverter={setConverter} aoExcluido={() => definirParametros({ item: null })} />
        ) : (
          <Carregando />
        )}
      </Gaveta>

      <FormLead aberto={novo} aoFechar={() => definirParametros({ novo: null })} etapaInicial={etapaNovo} />
      <DialogoMotivoPerda pedido={perda} aoFechar={() => setPerda(null)} />
      <ConverterLead lead={converter} aoFechar={() => setConverter(null)} />
      <AcaoLoteLeads pedido={lote} aoFechar={() => setLote(null)} aoPerda={(l, etapaId) => setPerda({ lead: l, etapaId })} />
    </div>
  );
}

function AcaoLoteLeads({ pedido, aoFechar, aoPerda }: { pedido: { tipo: "etapa" | "responsavel" | "etiqueta"; itens: Lead[] } | null; aoFechar: () => void; aoPerda: (l: Lead, etapaId: string) => void }) {
  const config = useConfig();
  const { atualizar } = useGravacao();
  if (!pedido) return null;
  const n = pedido.itens.length;
  const aplicar = async (valor: string) => {
    if (pedido.tipo === "etapa") {
      const etapa = config.etapa(valor);
      if (etapa?.categoria === "perdida") {
        aoFechar();
        if (n === 1) aoPerda(pedido.itens[0], valor);
        else aviso.info("Para mover para uma etapa de perda, faça um lead por vez (o motivo é obrigatório).");
        return;
      }
      await Promise.all(pedido.itens.map((l) => atualizar("leads", l.id, { etapa_id: valor }, { silencioso: true }).catch(() => undefined)));
    } else if (pedido.tipo === "responsavel") {
      await Promise.all(pedido.itens.map((l) => atualizar("leads", l.id, { responsavel_id: valor || null }, { silencioso: true }).catch(() => undefined)));
    } else {
      await Promise.all(pedido.itens.map((l) => atualizar("leads", l.id, { etiquetas: [...new Set([...l.etiquetas, valor])] }, { silencioso: true }).catch(() => undefined)));
    }
    aviso.sucesso(`${n} lead(s) atualizado(s).`);
    aoFechar();
  };
  const opcoes =
    pedido.tipo === "etapa"
      ? opcoesEtapas(config, "lead").filter((o) => !o.desabilitada)
      : pedido.tipo === "responsavel"
        ? [{ valor: "", rotulo: "Sem responsável" }, ...opcoesUsuarios(config, false)]
        : config.etiquetas.filter((e) => e.ativo && e.escopos.includes("lead")).map((e) => ({ valor: e.id, rotulo: e.nome, cor: e.cor }));
  return (
    <Modal aberto aoFechar={aoFechar} largura="sm" titulo={pedido.tipo === "etapa" ? `Mudar etapa de ${n} lead(s)` : pedido.tipo === "responsavel" ? `Atribuir ${n} lead(s)` : `Adicionar etiqueta a ${n} lead(s)`}>
      <div className="-mx-2 max-h-80 overflow-y-auto rounded-xl border border-crm-linha">
        <ListaBusca opcoes={opcoes} selecionados={[]} estilo={pedido.tipo === "responsavel" ? "pessoa" : "pilula"} aoAlternar={aplicar} />
      </div>
    </Modal>
  );
}
