"use client";

import { useQuery } from "@tanstack/react-query";
import { Play, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso } from "../../_lib/avisos";
import { opcoesEtapas, opcoesLista, opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { formatarDataHora, formatarRelativo } from "../../_lib/datas";
import { executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { supabase } from "../../_lib/supabase";
import type { Automacao, AutomacaoExecucao } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { Alternador, CaixaSelecao, Entrada, GrupoCampo, Selecao } from "../../_ui/Campos";
import { SeletorMultiplo } from "../../_ui/Seletores";
import { Carregando, ErroCarga, Selo } from "../../_ui/Visuais";
import { Aviso, SecaoAdmin, useAdmin } from "./comum";

type Parametros = Record<string, unknown>;

export function AdminAutomacoes() {
  const { pode } = useAuth();
  const { invalidar } = useGravacao();
  const [executando, setExecutando] = useState(false);
  const consulta = useQuery({
    queryKey: ["automacoes", "admin"],
    queryFn: async () => {
      const s = supabase();
      const [autos, execs] = await Promise.all([
        executar(s.from("automacoes").select("*").order("created_at")),
        executar(s.from("automacoes_execucoes").select("*").order("iniciado_em", { ascending: false }).limit(60)),
      ]);
      return { automacoes: (autos ?? []) as Automacao[], execucoes: (execs ?? []) as AutomacaoExecucao[] };
    },
  });

  const executarAgora = async () => {
    setExecutando(true);
    try {
      const r = (await executar(supabase().rpc("executar_automacoes_agora"))) as Record<string, number>;
      const total = Object.values(r ?? {}).reduce((t, n) => t + Number(n || 0), 0);
      aviso.sucesso(total > 0 ? `Automações executadas: ${total} aviso(s) gerado(s).` : "Automações executadas: nenhum aviso novo (avisos repetidos são evitados).");
      invalidar("automacoes", "notificacoes", "painel");
    } catch (e) {
      aviso.erro(mensagemErro(e));
    } finally {
      setExecutando(false);
    }
  };

  if (consulta.isLoading) return <Carregando />;
  if (consulta.error) return <ErroCarga mensagem={mensagemErro(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />;
  const { automacoes, execucoes } = consulta.data!;
  return (
    <div className="flex flex-col gap-6">
      <SecaoAdmin
        titulo="Automações"
        descricao="Regras seguras e parametrizáveis. Rodam automaticamente a cada 15 minutos (a do lead novo roda na chegada do lead) e geram tarefas e avisos internos, sem duplicar avisos."
        acoes={
          pode("admin.automacoes") && (
            <Botao variante="primario" tamanho="sm" icone={<Play size={14} />} carregando={executando} onClick={executarAgora}>
              Executar agora
            </Botao>
          )
        }
      >
        <Aviso>
          Nenhuma mensagem externa (WhatsApp, e-mail ou SMS) é enviada pelas automações: não há integração de envio configurada. Os avisos aparecem no sino de notificações e no painel Hoje, e as tarefas criadas
          automaticamente ficam marcadas como “automação”.
        </Aviso>
        <ul className="flex flex-col gap-3">
          {automacoes.map((a) => (
            <CartaoAutomacao key={a.id} automacao={a} execucoes={execucoes.filter((e) => e.automacao_id === a.id)} />
          ))}
        </ul>
      </SecaoAdmin>
    </div>
  );
}

function CartaoAutomacao({ automacao: a, execucoes }: { automacao: Automacao; execucoes: AutomacaoExecucao[] }) {
  const { salvar } = useAdmin();
  const [p, setP] = useState<Parametros>((a.parametros as Parametros) ?? {});
  const [alterado, setAlterado] = useState(false);
  useEffect(() => {
    setP((a.parametros as Parametros) ?? {});
    setAlterado(false);
  }, [a.parametros]);
  const mudar = (alt: Parametros) => {
    setP((x) => ({ ...x, ...alt }));
    setAlterado(true);
  };
  const ultimaFalha = execucoes.find((e) => e.erro);
  return (
    <li className={`flex flex-col gap-3 rounded-2xl border bg-white p-4 ${a.ativo ? "border-crm-verde-borda" : "border-crm-linha"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.ativo ? "bg-crm-verde text-crm-ouro-claro" : "bg-crm-suave text-crm-tinta-3"}`}>
          <Zap size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{a.nome}</p>
          <p className="text-sm text-crm-tinta-2">{a.descricao}</p>
          <p className="mt-1 text-xs text-crm-tinta-3">
            {a.tipo === "lead_novo_primeiro_contato"
              ? "Executa na chegada de cada lead."
              : a.ultima_execucao_em
                ? `Última execução ${formatarRelativo(a.ultima_execucao_em)} (${formatarDataHora(a.ultima_execucao_em)}).`
                : "Ainda não executada."}
            {execucoes.length > 0 && ` Nos últimos registros: ${execucoes.reduce((t, e) => t + e.itens_afetados, 0)} aviso(s)/tarefa(s) gerados.`}
          </p>
          {ultimaFalha && <p className="mt-1 text-xs font-semibold text-crm-perigo">Última falha em {formatarDataHora(ultimaFalha.iniciado_em)}. Verifique os parâmetros.</p>}
        </div>
        <Alternador ativo={a.ativo} mostrarRotulo rotulo={a.ativo ? "Ativa" : "Desativada"} aoAlterar={(v) => salvar("automacoes", { ativo: v }, { id: a.id }, v ? "Automação ativada." : "Automação desativada.", ["automacoes"])} />
      </div>
      <div className="grid gap-3 rounded-xl bg-crm-fundo p-3 sm:grid-cols-2 lg:grid-cols-3">
        <EditorParametros tipo={a.tipo} p={p} mudar={mudar} />
      </div>
      {alterado && (
        <div className="flex justify-end gap-2">
          <Botao tamanho="sm" onClick={() => { setP((a.parametros as Parametros) ?? {}); setAlterado(false); }}>
            Descartar
          </Botao>
          <Botao tamanho="sm" variante="primario" onClick={async () => { if (await salvar("automacoes", { parametros: p }, { id: a.id }, "Parâmetros salvos.", ["automacoes"])) setAlterado(false); }}>
            Salvar parâmetros
          </Botao>
        </div>
      )}
    </li>
  );
}

function Numero({ rotulo, valor, aoAlterar, min, max, ajuda }: { rotulo: string; valor: unknown; aoAlterar: (n: number) => void; min: number; max: number; ajuda?: string }) {
  return (
    <GrupoCampo rotulo={rotulo} ajuda={ajuda}>
      {(p) => <Entrada {...p} type="number" min={min} max={max} value={valor === undefined || valor === null ? "" : String(valor)} onChange={(e) => aoAlterar(Math.max(min, Math.min(max, Number(e.target.value) || min)))} />}
    </GrupoCampo>
  );
}

function EditorParametros({ tipo, p, mudar }: { tipo: string; p: Parametros; mudar: (alt: Parametros) => void }) {
  const config = useConfig();
  switch (tipo) {
    case "lead_novo_primeiro_contato": {
      const atribuir = (p.atribuir as { modo?: string; usuario_id?: string; perfil_id?: string; usuarios?: string[] }) ?? { modo: "nenhum" };
      return (
        <>
          <Numero rotulo="Prazo da tarefa (horas)" valor={p.prazo_horas ?? 24} min={1} max={720} aoAlterar={(n) => mudar({ prazo_horas: n })} />
          <GrupoCampo rotulo="Prioridade da tarefa">
            {(x) => (
              <Selecao {...x} value={String(p.prioridade ?? "alta")} onChange={(e) => mudar({ prioridade: e.target.value })}>
                {opcoesLista(config, "prioridade").map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </Selecao>
            )}
          </GrupoCampo>
          <GrupoCampo rotulo="Somente para as origens" ajuda="Vazio = todas.">
            {(x) => <SeletorMultiplo id={x.id} rotulo="Origens" valores={(p.origens as string[]) ?? []} opcoes={opcoesLista(config, "origem")} aoAlterar={(v) => mudar({ origens: v })} placeholder="Todas as origens" />}
          </GrupoCampo>
          <GrupoCampo rotulo="Responsável pelo lead novo">
            {(x) => (
              <Selecao {...x} value={atribuir.modo ?? "nenhum"} onChange={(e) => mudar({ atribuir: { ...atribuir, modo: e.target.value } })}>
                <option value="nenhum">Não atribuir automaticamente</option>
                <option value="fixo">Sempre a mesma pessoa</option>
                <option value="rodizio">Rodízio entre pessoas</option>
              </Selecao>
            )}
          </GrupoCampo>
          {atribuir.modo === "fixo" && (
            <GrupoCampo rotulo="Pessoa">
              {(x) => (
                <Selecao {...x} value={atribuir.usuario_id ?? ""} onChange={(e) => mudar({ atribuir: { ...atribuir, usuario_id: e.target.value } })}>
                  <option value="">Selecione…</option>
                  {opcoesUsuarios(config, false).map((u) => (
                    <option key={u.valor} value={u.valor}>
                      {u.rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </GrupoCampo>
          )}
          {atribuir.modo === "rodizio" && (
            <>
              <GrupoCampo rotulo="Perfil do rodízio" ajuda="Vazio = qualquer perfil.">
                {(x) => (
                  <Selecao {...x} value={atribuir.perfil_id ?? ""} onChange={(e) => mudar({ atribuir: { ...atribuir, perfil_id: e.target.value } })}>
                    <option value="">Qualquer perfil</option>
                    {config.perfis.map((pf) => (
                      <option key={pf.id} value={pf.id}>
                        {pf.nome}
                      </option>
                    ))}
                  </Selecao>
                )}
              </GrupoCampo>
              <GrupoCampo rotulo="Pessoas do rodízio" ajuda="Vazio = todas as pessoas ativas do perfil.">
                {(x) => <SeletorMultiplo id={x.id} rotulo="Pessoas do rodízio" estilo="pessoa" valores={atribuir.usuarios ?? []} opcoes={opcoesUsuarios(config, false)} aoAlterar={(v) => mudar({ atribuir: { ...atribuir, usuarios: v } })} placeholder="Todas" />}
              </GrupoCampo>
            </>
          )}
        </>
      );
    }
    case "lead_parado":
      return (
        <>
          <Numero rotulo="Dias sem movimentação" valor={p.dias ?? 3} min={1} max={90} aoAlterar={(n) => mudar({ dias: n })} />
          <GrupoCampo rotulo="Somente nas etapas" ajuda="Vazio = todas as etapas em andamento." className="sm:col-span-2">
            {(x) => <SeletorMultiplo id={x.id} rotulo="Etapas" valores={(p.etapas as string[]) ?? []} opcoes={opcoesEtapas(config, "lead").filter((o) => config.etapa(o.valor)?.categoria === "aberta")} aoAlterar={(v) => mudar({ etapas: v })} placeholder="Todas as etapas em andamento" />}
          </GrupoCampo>
        </>
      );
    case "documento_pendente":
      return <Numero rotulo="Avisar quando solicitado há mais de (dias)" valor={p.dias ?? 5} min={1} max={90} aoAlterar={(n) => mudar({ dias: n })} ajuda="Também avisa quando o prazo interno do documento vence." />;
    case "parcela_vencida":
      return <Numero rotulo="Avisar após (dias do vencimento)" valor={p.dias_apos_vencimento ?? 0} min={0} max={60} aoAlterar={(n) => mudar({ dias_apos_vencimento: n })} ajuda="0 = no dia seguinte ao vencimento. Avisos só para quem vê o financeiro." />;
    case "tarefa_prazo":
      return (
        <>
          <Numero rotulo="Avisar antes do prazo (horas)" valor={p.horas_antes ?? 24} min={1} max={168} aoAlterar={(n) => mudar({ horas_antes: n })} />
          <div className="flex items-end">
            <CaixaSelecao marcado={p.avisar_vencidas !== false} aoAlterar={(v) => mudar({ avisar_vencidas: v })} rotulo="Avisar também sobre tarefas atrasadas" />
          </div>
        </>
      );
    case "prazo_processual":
      return (
        <>
          <p className="text-xs text-crm-tinta-2 sm:col-span-2 lg:col-span-3">Os dias de antecedência são definidos em cada prazo (campo “Alertas”).</p>
          <CaixaSelecao marcado={p.avisar_vencidos !== false} aoAlterar={(v) => mudar({ avisar_vencidos: v })} rotulo="Avisar sobre prazos vencidos sem cumprimento" />
          <CaixaSelecao marcado={p.avisar_nao_conferidos !== false} aoAlterar={(v) => mudar({ avisar_nao_conferidos: v })} rotulo="Avisar sobre prazos aguardando conferência" />
        </>
      );
    case "documento_validade":
      return <Numero rotulo="Avisar antes do fim da validade (dias)" valor={p.dias_antes ?? 15} min={0} max={180} aoAlterar={(n) => mudar({ dias_antes: n })} />;
    default:
      return (
        <p className="text-sm text-crm-tinta-3">
          <Selo>Sem parâmetros editáveis</Selo>
        </p>
      );
  }
}
