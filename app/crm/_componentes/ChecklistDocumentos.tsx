"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FilePlus2,
  Link2,
  Lock,
  MessageCircle,
  Paperclip,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../_lib/auth";
import { aviso } from "../_lib/avisos";
import { opcoesUsuarios } from "../_lib/colunas";
import { useConfig } from "../_lib/config";
import { diferencaDias, formatarData, formatarDataHora, hojeSP } from "../_lib/datas";
import { executar, mensagemErro, useGravacao } from "../_lib/dados";
import { chamarFuncao } from "../_lib/edge";
import { linkWhatsApp } from "../_lib/formatos";
import { supabase } from "../_lib/supabase";
import type { Arquivo, Documento, DocumentoHistorico, Solicitacao } from "../_lib/tipos";
import { Abas } from "../_ui/Abas";
import { Botao } from "../_ui/Botao";
import { AreaTexto, CaixaSelecao, Entrada, GrupoCampo, Selecao } from "../_ui/Campos";
import { confirmar, confirmarSimples } from "../_ui/Dialogos";
import { ListaBusca, SeletorCampo } from "../_ui/Seletores";
import { Modal, Popover } from "../_ui/Sobreposicoes";
import { BarraProgresso, Carregando, ErroCarga, Pilula, Selo, Vazio } from "../_ui/Visuais";
import { enviarArquivo, ListaArquivos } from "./Arquivos";
import { Atividade } from "./Atividade";
import { contarDocumentos, STATUS_DOCUMENTO } from "./statusDocumento";

export type EscopoDocumentos = { caso_id?: string; cliente_id?: string; lead_id?: string };

interface PropsChecklist {
  escopo: EscopoDocumentos;
  /** Nome e WhatsApp da pessoa (para compartilhar o link). */
  contato?: { nome: string; whatsapp?: string | null } | null;
  tipoDemandaId?: string | null;
}

function colunaEscopo(e: EscopoDocumentos): ["caso_id" | "cliente_id" | "lead_id", string] {
  if (e.caso_id) return ["caso_id", e.caso_id];
  if (e.cliente_id) return ["cliente_id", e.cliente_id];
  return ["lead_id", e.lead_id!];
}

export function useDocumentos(escopo: EscopoDocumentos) {
  const [coluna, id] = colunaEscopo(escopo);
  return useQuery({
    queryKey: ["documentos", coluna, id],
    queryFn: async () => {
      let q = supabase().from("documentos").select("*").eq(coluna, id);
      if (coluna === "cliente_id") q = q.is("caso_id", null);
      const docs = (await executar(q.order("ordem").order("nome"))) as Documento[];
      const ids = docs.map((d) => d.id);
      const arquivos = ids.length
        ? ((await executar(supabase().from("arquivos").select("id, documento_id, versao, created_at").in("documento_id", ids).is("removido_em", null))) as Pick<Arquivo, "id" | "documento_id" | "versao" | "created_at">[])
        : [];
      const contagem = new Map<string, number>();
      arquivos.forEach((a) => contagem.set(a.documento_id!, (contagem.get(a.documento_id!) ?? 0) + 1));
      return docs.map((d) => ({ ...d, arquivos: contagem.get(d.id) ?? 0 }));
    },
  });
}

/** Alteração de situação com as regras do checklist (motivo obrigatório para rejeitar/dispensar). */
export function useMudarStatusDocumento() {
  const { pode, desenvolvedor } = useAuth();
  const { atualizar } = useGravacao();
  return useCallback(
    async (d: Pick<Documento, "id" | "nome" | "status">, status: string) => {
      if (status === d.status) return;
      if ((status === "aprovado" || status === "rejeitado") && !pode("documentos.revisar")) {
        aviso.erro("Somente quem tem permissão de revisão pode aprovar ou rejeitar documentos.");
        return;
      }
      const alteracoes: Record<string, unknown> = { status };
      if (status === "rejeitado" || status === "dispensado") {
        const r = await confirmar({
          titulo: status === "rejeitado" ? "Rejeitar documento" : "Dispensar documento",
          mensagem: status === "rejeitado" ? `Informe por que “${d.nome}” precisa ser reenviado. O motivo fica no histórico (não é mostrado ao cliente).` : `Informe por que “${d.nome}” não é exigido neste caso.`,
          motivo: { rotulo: "Motivo", obrigatorio: !desenvolvedor },
          confirmar: status === "rejeitado" ? "Rejeitar" : "Dispensar",
          perigo: status === "rejeitado",
        });
        if (!r.confirmado) return;
        alteracoes[status === "rejeitado" ? "rejeitado_motivo" : "dispensado_motivo"] = r.motivo;
        if (status === "dispensado") alteracoes.obrigatorio = false;
      }
      await atualizar("documentos", d.id, alteracoes, { chaves: ["documentos", "painel", "eventos"] }).catch(() => undefined);
    },
    [pode, desenvolvedor, atualizar],
  );
}

export function ChecklistDocumentos({ escopo, contato, tipoDemandaId }: PropsChecklist) {
  const { pode } = useAuth();
  const config = useConfig();
  const { rpc, invalidar } = useGravacao();
  const mudarStatus = useMudarStatusDocumento();
  const consulta = useDocumentos(escopo);
  const [detalhe, setDetalhe] = useState<Documento | null>(null);
  const [avulso, setAvulso] = useState(false);
  const [solicitar, setSolicitar] = useState(false);
  const [agrupar, setAgrupar] = useState<"grupo" | "status">("grupo");
  const docs = useMemo(() => consulta.data ?? [], [consulta.data]);
  const cont = contarDocumentos(docs);
  const podeEditar = pode("documentos.editar");
  const podeRevisar = pode("documentos.revisar");

  const grupos = useMemo(() => {
    const mapa = new Map<string, typeof docs>();
    for (const d of docs) {
      const k = agrupar === "grupo" ? d.grupo ?? config.categoria(d.categoria_id)?.nome ?? "Outros documentos" : STATUS_DOCUMENTO.find((s) => s.valor === d.status)?.rotulo ?? d.status;
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(d);
    }
    return [...mapa.entries()];
  }, [docs, agrupar, config]);

  const aplicarModelo = async (modeloId: string) => {
    const n = await rpc<number>(
      "aplicar_checklist",
      { p_modelo: modeloId, p_caso: escopo.caso_id ?? null, p_cliente: escopo.caso_id ? null : escopo.cliente_id ?? null, p_lead: escopo.caso_id || escopo.cliente_id ? null : escopo.lead_id ?? null },
      { chaves: ["documentos", "eventos", "painel"] },
    ).catch(() => null);
    if (n !== null) aviso.sucesso(n > 0 ? `${n} ${n === 1 ? "item adicionado" : "itens adicionados"} ao checklist.` : "Todos os itens deste modelo já estavam no checklist.");
  };

  const enviar = async (d: Documento, arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    for (const arquivo of Array.from(arquivos)) {
      try {
        await enviarArquivo(arquivo, { documento_id: d.id, cliente_id: d.cliente_id, caso_id: d.caso_id, lead_id: d.lead_id, tipo: "documento" });
        aviso.sucesso(`“${arquivo.name}” anexado a ${d.nome}.`);
      } catch (e) {
        aviso.erro(mensagemErro(e));
      }
    }
    invalidar("documentos", "arquivos", "eventos", "painel");
  };

  const modelosSugeridos = config.modelosChecklist.filter((m) => m.ativo).sort((a, b) => Number(b.tipo_demanda_id === tipoDemandaId) - Number(a.tipo_demanda_id === tipoDemandaId));

  return (
    <div className="flex flex-col gap-4">
      {/* Contadores */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { rotulo: "Exigidos", valor: cont.exigidos, cor: "text-crm-tinta" },
          { rotulo: "Recebidos", valor: cont.recebidos, cor: "text-crm-info" },
          { rotulo: "Aprovados", valor: cont.aprovados, cor: "text-crm-sucesso" },
          { rotulo: "Faltantes", valor: cont.faltantes, cor: cont.faltantes ? "text-crm-perigo" : "text-crm-tinta-3" },
        ].map((c) => (
          <div key={c.rotulo} className="rounded-xl border border-crm-linha bg-white px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-crm-tinta-3">{c.rotulo}</p>
            <p className={`font-serif text-2xl font-semibold tabular-nums ${c.cor}`}>{c.valor}</p>
          </div>
        ))}
      </div>
      {cont.exigidos > 0 && <BarraProgresso valor={cont.aprovadosExigidos} total={cont.exigidos} rotulo="Documentos exigidos aprovados" />}

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2">
        {podeEditar && (
          <MenuModelos modelos={modelosSugeridos} tipoDemandaId={tipoDemandaId ?? null} aoAplicar={aplicarModelo} />
        )}
        {podeEditar && (
          <Botao tamanho="sm" variante="secundario" icone={<FilePlus2 size={14} />} onClick={() => setAvulso(true)}>
            Adicionar documento
          </Botao>
        )}
        {pode("documentos.solicitar_cliente") && docs.length > 0 && (
          <Botao tamanho="sm" variante="primario" icone={<Send size={14} />} onClick={() => setSolicitar(true)}>
            Solicitar ao cliente
          </Botao>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-crm-tinta-2">
          Agrupar por
          <Selecao value={agrupar} onChange={(e) => setAgrupar(e.target.value as "grupo" | "status")} className="h-8 max-w-56 text-xs">
            <option value="grupo">Grupo do checklist</option>
            <option value="status">Situação</option>
          </Selecao>
        </label>
      </div>

      <LinksAtivos escopo={escopo} />

      {consulta.isLoading ? (
        <Carregando />
      ) : consulta.error ? (
        <ErroCarga mensagem={mensagemErro(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />
      ) : docs.length === 0 ? (
        <Vazio
          icone={<ClipboardCheck size={24} />}
          titulo="Nenhum documento no checklist"
          descricao="Aplique um modelo de checklist do tipo de demanda ou adicione documentos avulsos. Os modelos são sugestões revisáveis pelo escritório."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map(([grupo, lista]) => (
            <section key={grupo} aria-label={grupo}>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-crm-tinta-3">
                {grupo} <span className="font-semibold">({lista.length})</span>
              </h4>
              <ul className="flex flex-col divide-y divide-crm-linha rounded-xl border border-crm-linha bg-white">
                {lista.map((d) => (
                  <LinhaDocumento
                    key={d.id}
                    documento={d}
                    arquivos={d.arquivos}
                    podeEditar={podeEditar}
                    podeRevisar={podeRevisar}
                    aoMudarStatus={(s) => mudarStatus(d, s)}
                    aoAbrir={() => setDetalhe(d)}
                    aoEnviar={(f) => enviar(d, f)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <DetalheDocumento documento={detalhe ? docs.find((d) => d.id === detalhe.id) ?? detalhe : null} aoFechar={() => setDetalhe(null)} />
      <FormDocumentoAvulso aberto={avulso} aoFechar={() => setAvulso(false)} escopo={escopo} />
      <SolicitarAoCliente aberto={solicitar} aoFechar={() => setSolicitar(false)} escopo={escopo} documentos={docs} contato={contato ?? null} />
    </div>
  );
}

function MenuModelos({ modelos, tipoDemandaId, aoAplicar }: { modelos: { id: string; nome: string; tipo_demanda_id: string | null; aviso: string | null }[]; tipoDemandaId: string | null; aoAplicar: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Botao ref={ref} tamanho="sm" variante="secundario" icone={<ClipboardCheck size={14} />} onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        Aplicar modelo
      </Botao>
      <Popover aberto={aberto} aoFechar={() => setAberto(false)} ancora={ref} largura={340} rotulo="Modelos de checklist">
        <div className="border-b border-crm-linha px-3 py-2 text-xs text-crm-tinta-3">Itens já existentes não são duplicados. Revise o resultado para o caso concreto.</div>
        <ListaBusca
          opcoes={modelos.map((m) => ({ valor: m.id, rotulo: m.nome, descricao: m.tipo_demanda_id && m.tipo_demanda_id === tipoDemandaId ? "Sugerido para este tipo de demanda" : undefined }))}
          selecionados={[]}
          aoAlternar={(v) => {
            setAberto(false);
            aoAplicar(v);
          }}
          vazioTexto="Nenhum modelo ativo. Crie modelos em Administração."
        />
      </Popover>
    </>
  );
}

function LinhaDocumento({
  documento: d,
  arquivos,
  podeEditar,
  podeRevisar,
  aoMudarStatus,
  aoAbrir,
  aoEnviar,
}: {
  documento: Documento;
  arquivos: number;
  podeEditar: boolean;
  podeRevisar: boolean;
  aoMudarStatus: (s: string) => void;
  aoAbrir: () => void;
  aoEnviar: (f: FileList | null) => void;
}) {
  const config = useConfig();
  const [menuStatus, setMenuStatus] = useState(false);
  const refStatus = useRef<HTMLButtonElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const status = STATUS_DOCUMENTO.find((s) => s.valor === d.status) ?? STATUS_DOCUMENTO[0];
  const prazoVencido = d.prazo && d.prazo < hojeSP() && ["nao_solicitado", "solicitado", "rejeitado"].includes(d.status);
  const validade = d.valido_ate ? diferencaDias(hojeSP(), d.valido_ate) : null;
  const revisor = config.usuario(d.revisor_id);
  const opcoes = STATUS_DOCUMENTO.map((s) => ({
    valor: s.valor,
    rotulo: s.rotulo,
    cor: s.cor,
    desabilitada: (s.valor === "aprovado" || s.valor === "rejeitado") && !podeRevisar,
  }));

  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <button type="button" onClick={aoAbrir} className="flex items-center gap-1.5 text-left text-sm font-semibold text-crm-tinta hover:underline">
          {d.clinico && <Lock size={13} className="shrink-0 text-crm-perigo" aria-label="Dado de saúde (acesso restrito)" />}
          {d.financeiro && <Lock size={13} className="shrink-0 text-crm-ouro-escuro" aria-label="Documento financeiro (acesso restrito)" />}
          <span className="truncate">{d.nome}</span>
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-crm-tinta-3">
          {d.obrigatorio ? <span className="font-semibold text-crm-tinta-2">Obrigatório</span> : <span>Opcional</span>}
          {d.etapa && <span>· {d.etapa}</span>}
          {d.prazo && (
            <span className={prazoVencido ? "inline-flex items-center gap-0.5 font-bold text-crm-perigo" : ""}>
              {prazoVencido && <AlertTriangle size={11} aria-hidden />}· prazo {formatarData(d.prazo)}
              {prazoVencido && " (vencido)"}
            </span>
          )}
          {revisor && <span>· revisão: {revisor.nome.split(" ")[0]}</span>}
          {validade !== null && (
            <span className={validade < 0 ? "inline-flex items-center gap-0.5 font-bold text-crm-perigo" : validade <= 30 ? "inline-flex items-center gap-0.5 font-bold text-crm-alerta" : ""}>
              <CalendarClock size={11} aria-hidden /> válido até {formatarData(d.valido_ate)}
              {validade < 0 ? " (vencido)" : validade <= 30 ? ` (${validade} dias)` : ""}
            </span>
          )}
          {d.enviado_pelo_cliente && <Selo tom="info">Enviado pelo cliente</Selo>}
          {d.condicao_descricao && d.status === "dispensado" && <span>· {d.condicao_descricao}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={aoAbrir} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-crm-tinta-2 hover:bg-crm-suave" aria-label={`${arquivos} arquivo(s) de ${d.nome}`}>
          <Paperclip size={13} aria-hidden /> {arquivos}
        </button>
        {podeEditar && (
          <>
            <input ref={entrada} type="file" className="sr-only" multiple onChange={(e) => { aoEnviar(e.target.files); e.target.value = ""; }} aria-label={`Enviar arquivo para ${d.nome}`} />
            <Botao tamanho="icone-sm" variante="fantasma" onClick={() => entrada.current?.click()} aria-label={`Enviar arquivo para ${d.nome}`} title="Enviar arquivo (nova versão)">
              <Upload size={15} />
            </Botao>
          </>
        )}
        {podeEditar ? (
          <>
            <button ref={refStatus} type="button" onClick={() => setMenuStatus(true)} aria-label={`Situação de ${d.nome}: ${status.rotulo}. Alterar`} aria-haspopup="listbox" className="min-w-32">
              <Pilula cor={status.cor} className="w-full justify-center">
                {status.rotulo}
              </Pilula>
            </button>
            <Popover aberto={menuStatus} aoFechar={() => setMenuStatus(false)} ancora={refStatus} largura={240} rotulo="Alterar situação">
              <ListaBusca
                opcoes={opcoes}
                selecionados={[d.status]}
                estilo="pilula"
                aoAlternar={(v) => {
                  setMenuStatus(false);
                  aoMudarStatus(v);
                }}
              />
            </Popover>
          </>
        ) : (
          <Pilula cor={status.cor} className="min-w-32 justify-center">
            {status.rotulo}
          </Pilula>
        )}
      </div>
    </li>
  );
}

export function DetalheDocumento({ documento: d, aoFechar }: { documento: Documento | null; aoFechar: () => void }) {
  const config = useConfig();
  const { pode, desenvolvedor } = useAuth();
  const { atualizar, excluir } = useGravacao();
  const [aba, setAba] = useState("arquivos");
  const historico = useQuery({
    queryKey: ["documentos", "historico", d?.id],
    enabled: Boolean(d),
    queryFn: async () => (await executar(supabase().from("documentos_historico").select("*").eq("documento_id", d!.id).order("created_at", { ascending: false }))) as DocumentoHistorico[],
  });
  if (!d) return null;
  const podeEditar = pode("documentos.editar");
  const salvar = (alt: Record<string, unknown>) => atualizar("documentos", d.id, alt, { chaves: ["documentos"] }).catch(() => undefined);
  const status = STATUS_DOCUMENTO.find((s) => s.valor === d.status);
  const excluirDocumento = async () => {
    if (!(await confirmarSimples({ titulo: `Excluir “${d.nome}” do checklist?`, mensagem: "O documento e o histórico dele serão apagados. As versões já enviadas continuam em Arquivos. Esta ação não pode ser desfeita.", confirmar: "Excluir definitivamente", perigo: true }))) return;
    try {
      await excluir("documentos", d.id, { chaves: ["documentos", "painel", "eventos"], mensagemSucesso: "Documento excluído." });
      aoFechar();
    } catch {
      /* aviso exibido pela camada de dados */
    }
  };

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="lg"
      titulo={d.nome}
      descricao={<span className="inline-flex items-center gap-2">Situação: <Pilula cor={status?.cor}>{status?.rotulo}</Pilula></span>}
      rodape={
        desenvolvedor ? (
          <Botao variante="perigo" icone={<Trash2 size={14} />} onClick={excluirDocumento}>
            Excluir documento
          </Botao>
        ) : undefined
      }
    >
      <Abas
        rotulo="Detalhes do documento"
        ativa={aba}
        aoTrocar={setAba}
        abas={[
          { id: "arquivos", rotulo: "Arquivos e versões" },
          { id: "dados", rotulo: "Dados" },
          { id: "historico", rotulo: "Histórico", contador: historico.data?.length },
          { id: "comentarios", rotulo: "Comentários" },
        ]}
      />
      <div className="pt-4">
        {aba === "arquivos" && <ListaArquivos escopo={{ documento_id: d.id, cliente_id: d.cliente_id, caso_id: d.caso_id, lead_id: d.lead_id }} filtroColuna="documento_id" titulo="Versões enviadas" mostrarVinculo={false} />}
        {aba === "dados" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <GrupoCampo rotulo="Nome do documento" className="sm:col-span-2">
              {(p) => <Entrada {...p} defaultValue={d.nome} disabled={!podeEditar} onBlur={(e) => e.target.value.trim() && e.target.value !== d.nome && salvar({ nome: e.target.value.trim() })} />}
            </GrupoCampo>
            <GrupoCampo rotulo="O que pedir ao cliente" className="sm:col-span-2" ajuda="Aparece para o cliente no link de envio.">
              {(p) => <AreaTexto {...p} defaultValue={d.descricao_cliente ?? ""} disabled={!podeEditar} onBlur={(e) => e.target.value !== (d.descricao_cliente ?? "") && salvar({ descricao_cliente: e.target.value || null })} />}
            </GrupoCampo>
            <GrupoCampo rotulo="Instrução interna para a equipe" className="sm:col-span-2" ajuda="Não aparece para o cliente.">
              {(p) => <AreaTexto {...p} defaultValue={d.instrucao_equipe ?? ""} disabled={!podeEditar} onBlur={(e) => e.target.value !== (d.instrucao_equipe ?? "") && salvar({ instrucao_equipe: e.target.value || null })} />}
            </GrupoCampo>
            <GrupoCampo rotulo="Prazo interno">
              {(p) => <Entrada {...p} type="date" defaultValue={d.prazo ?? ""} disabled={!podeEditar} onChange={(e) => salvar({ prazo: e.target.value || null })} />}
            </GrupoCampo>
            <GrupoCampo rotulo="Revisor">
              {(p) => <SeletorCampo {...p} rotulo="Revisor" valor={d.revisor_id} estilo="pessoa" opcoes={opcoesUsuarios(config, false)} aoAlterar={(v) => salvar({ revisor_id: v })} desabilitado={!podeEditar} />}
            </GrupoCampo>
            <GrupoCampo rotulo="Válido até" ajuda="Para laudos e prescrições: lembrete de atualização.">
              {(p) => <Entrada {...p} type="date" defaultValue={d.valido_ate ?? ""} disabled={!podeEditar} onChange={(e) => salvar({ valido_ate: e.target.value || null })} />}
            </GrupoCampo>
            <GrupoCampo rotulo="Etapa em que é necessário">
              {(p) => <Entrada {...p} defaultValue={d.etapa ?? ""} disabled={!podeEditar} onBlur={(e) => e.target.value !== (d.etapa ?? "") && salvar({ etapa: e.target.value || null })} />}
            </GrupoCampo>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <CaixaSelecao marcado={d.obrigatorio} aoAlterar={(v) => salvar({ obrigatorio: v })} desabilitado={!podeEditar} rotulo="Obrigatório neste caso" descricao="O advogado pode adaptar o checklist ao caso concreto." />
              <CaixaSelecao marcado={d.cliente_pode_enviar} aoAlterar={(v) => salvar({ cliente_pode_enviar: v })} desabilitado={!podeEditar} rotulo="O cliente pode enviar pelo link" />
            </div>
            {(d.rejeitado_motivo || d.dispensado_motivo) && (
              <p className="rounded-lg bg-crm-suave p-3 text-sm sm:col-span-2">
                <strong>{d.status === "dispensado" ? "Motivo da dispensa" : "Último motivo de rejeição"}:</strong> {d.status === "dispensado" ? d.dispensado_motivo : d.rejeitado_motivo}
              </p>
            )}
          </div>
        )}
        {aba === "historico" && (
          <ol className="flex flex-col gap-2">
            {(historico.data ?? []).map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-crm-linha bg-white px-3 py-2 text-sm">
                <span className="text-xs tabular-nums text-crm-tinta-3">{formatarDataHora(h.created_at)}</span>
                {h.de && (
                  <>
                    <Pilula cor={STATUS_DOCUMENTO.find((s) => s.valor === h.de)?.cor} preenchida={false}>
                      {STATUS_DOCUMENTO.find((s) => s.valor === h.de)?.rotulo}
                    </Pilula>
                    →
                  </>
                )}
                <Pilula cor={STATUS_DOCUMENTO.find((s) => s.valor === h.para)?.cor}>{STATUS_DOCUMENTO.find((s) => s.valor === h.para)?.rotulo}</Pilula>
                <span className="text-xs text-crm-tinta-2">
                  {h.via === "portal" ? "pelo cliente (link)" : h.via === "sistema" || h.via === "automacao" ? "automático" : config.usuario(h.usuario_id)?.nome ?? "—"}
                </span>
                {h.comentario && <span className="w-full text-xs text-crm-tinta-2">Motivo: {h.comentario}</span>}
              </li>
            ))}
          </ol>
        )}
        {aba === "comentarios" && <Atividade entidade="documento" registroId={d.id} />}
      </div>
      <p className="mt-4 flex items-center gap-1 text-xs text-crm-tinta-3">
        <ShieldCheck size={12} aria-hidden />
        Solicitado: {d.solicitado_em ? `${formatarDataHora(d.solicitado_em)} (${config.usuario(d.solicitado_por)?.nome ?? "link"})` : "—"} · Recebido:{" "}
        {d.recebido_em ? `${formatarDataHora(d.recebido_em)}${d.enviado_pelo_cliente ? " (cliente)" : ` (${config.usuario(d.recebido_por)?.nome ?? "—"})`}` : "—"} · Aprovado:{" "}
        {d.aprovado_em ? `${formatarDataHora(d.aprovado_em)} (${config.usuario(d.aprovado_por)?.nome ?? "—"})` : "—"}
      </p>
    </Modal>
  );
}

function FormDocumentoAvulso({ aberto, aoFechar, escopo }: { aberto: boolean; aoFechar: () => void; escopo: EscopoDocumentos }) {
  const config = useConfig();
  const { inserir } = useGravacao();
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [obrigatorio, setObrigatorio] = useState(true);
  const [prazo, setPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await inserir(
        "documentos",
        { ...escopo, nome: nome.trim(), categoria_id: categoria, descricao_cliente: descricao.trim() || null, obrigatorio, prazo: prazo || null, grupo: config.categoria(categoria)?.nome ?? "Documentos avulsos" },
        { chaves: ["documentos", "painel"], mensagemSucesso: "Documento adicionado ao checklist." },
      );
      setNome("");
      setDescricao("");
      aoFechar();
    } catch {
      /* aviso exibido */
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Adicionar documento ao checklist" rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" carregando={salvando} onClick={salvar} disabled={!nome.trim()}>Adicionar</Botao></>}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <GrupoCampo rotulo="Nome do documento" obrigatorio>{(p) => <Entrada {...p} data-autofoco value={nome} onChange={(e) => setNome(e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Categoria" ajuda="Categorias clínicas e financeiras têm acesso restrito.">
          {(p) => <SeletorCampo {...p} rotulo="Categoria" valor={categoria} opcoes={config.categorias.filter((c) => c.ativo).map((c) => ({ valor: c.id, rotulo: c.nome, cor: c.cor, descricao: c.clinico ? "Dados de saúde" : c.financeiro ? "Financeiro" : undefined }))} aoAlterar={setCategoria} />}
        </GrupoCampo>
        <GrupoCampo rotulo="O que pedir ao cliente">{(p) => <AreaTexto {...p} value={descricao} onChange={(e) => setDescricao(e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Prazo interno">{(p) => <Entrada {...p} type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />}</GrupoCampo>
        <CaixaSelecao marcado={obrigatorio} aoAlterar={setObrigatorio} rotulo="Obrigatório" />
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

function SolicitarAoCliente({
  aberto,
  aoFechar,
  escopo,
  documentos,
  contato,
}: {
  aberto: boolean;
  aoFechar: () => void;
  escopo: EscopoDocumentos;
  documentos: Documento[];
  contato: { nome: string; whatsapp?: string | null } | null;
}) {
  const config = useConfig();
  const { invalidar } = useGravacao();
  const elegiveis = documentos.filter((d) => d.cliente_pode_enviar && !["aprovado", "dispensado"].includes(d.status));
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [dias, setDias] = useState(7);
  const [mensagem, setMensagem] = useState("");
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<{ url: string; expira_em: string } | null>(null);

  // Ao abrir, pré-seleciona os documentos obrigatórios ainda faltantes.
  useEffect(() => {
    if (!aberto) return;
    setSelecionados(new Set(elegiveis.filter((d) => d.obrigatorio && ["nao_solicitado", "solicitado", "rejeitado"].includes(d.status)).map((d) => d.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const gerar = async () => {
    setGerando(true);
    try {
      const r = await chamarFuncao<{ url: string; expira_em: string }>("crm-documentos", {
        acao: "criar_link",
        ...escopo,
        documentos_ids: [...selecionados],
        validade_dias: dias,
        mensagem,
      });
      setResultado(r);
      invalidar("documentos", "solicitacoes", "eventos");
    } catch (e) {
      aviso.erro(mensagemErro(e));
    } finally {
      setGerando(false);
    }
  };

  const fechar = () => {
    setResultado(null);
    setSelecionados(new Set());
    setMensagem("");
    aoFechar();
  };

  const textoWhats = resultado
    ? config
        .texto("mensagem_link_documentos", "Olá, {nome}! Envie os documentos pelo link seguro: {link} (válido até {validade}).")
        .replace("{nome}", contato?.nome.split(" ")[0] ?? "")
        .replace("{link}", resultado.url)
        .replace("{validade}", formatarDataHora(resultado.expira_em))
    : "";
  const whats = contato?.whatsapp ? linkWhatsApp(contato.whatsapp, textoWhats) : null;

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      largura="md"
      titulo={resultado ? "Link gerado" : "Solicitar documentos ao cliente"}
      descricao={resultado ? "Envie este link ao cliente. Por segurança, ele não será exibido novamente — se perder, gere outro." : "O cliente verá apenas os documentos selecionados, sem acesso a fichas internas."}
      rodape={
        resultado ? (
          <Botao variante="primario" onClick={fechar}>
            Concluir
          </Botao>
        ) : (
          <>
            <Botao onClick={fechar}>Cancelar</Botao>
            <Botao variante="primario" icone={<Link2 size={15} />} carregando={gerando} disabled={selecionados.size === 0} onClick={gerar}>
              Gerar link seguro
            </Botao>
          </>
        )
      }
    >
      {resultado ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-xl border-2 border-crm-tinta bg-crm-verde-claro p-3">
            <code className="min-w-0 flex-1 truncate text-sm">{resultado.url}</code>
            <Botao
              tamanho="sm"
              variante="secundario"
              icone={<Copy size={14} />}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(resultado.url);
                  aviso.sucesso("Link copiado.");
                } catch {
                  aviso.erro("Não foi possível copiar. Selecione e copie manualmente.");
                }
              }}
            >
              Copiar
            </Botao>
          </div>
          <p className="text-sm text-crm-tinta-2">Válido até {formatarDataHora(resultado.expira_em)}. Você pode revogá-lo a qualquer momento.</p>
          {whats && (
            <a href={whats} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 self-start rounded-full border-2 border-crm-tinta bg-[#25D366] px-4 py-2 text-sm font-bold text-crm-tinta shadow-crm-bruto">
              <MessageCircle size={16} aria-hidden /> Enviar pelo WhatsApp <ExternalLink size={13} aria-hidden />
            </a>
          )}
          <p className="text-xs text-crm-tinta-3">O envio pelo WhatsApp abre o seu aplicativo com a mensagem pronta; nada é enviado automaticamente pelo CRM.</p>
        </div>
      ) : aberto ? (
        <div className="flex flex-col gap-4">
          {elegiveis.length === 0 ? (
            <Vazio compacto titulo="Nenhum documento pendente pode ser solicitado" descricao="Documentos aprovados, dispensados ou marcados como internos não entram no link." />
          ) : (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-[13px] font-semibold text-crm-tinta-2">Documentos incluídos no link</legend>
              {elegiveis.map((d) => (
                <CaixaSelecao
                  key={d.id}
                  marcado={selecionados.has(d.id)}
                  aoAlterar={(v) =>
                    setSelecionados((s) => {
                      const n = new Set(s);
                      if (v) n.add(d.id);
                      else n.delete(d.id);
                      return n;
                    })
                  }
                  rotulo={
                    <span className="inline-flex items-center gap-1.5">
                      {d.nome} {d.clinico && <Lock size={12} className="text-crm-perigo" aria-label="dado de saúde" />}
                    </span>
                  }
                  descricao={STATUS_DOCUMENTO.find((s) => s.valor === d.status)?.rotulo}
                />
              ))}
            </fieldset>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <GrupoCampo rotulo="Validade do link">
              {(p) => (
                <Selecao {...p} value={dias} onChange={(e) => setDias(Number(e.target.value))}>
                  {[1, 3, 7, 15, 30].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "dia" : "dias"}
                    </option>
                  ))}
                </Selecao>
              )}
            </GrupoCampo>
          </div>
          <GrupoCampo rotulo="Mensagem para o cliente (opcional)">{(p) => <AreaTexto {...p} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Aparece no topo da página de envio." />}</GrupoCampo>
        </div>
      ) : null}
    </Modal>
  );
}

function LinksAtivos({ escopo }: { escopo: EscopoDocumentos }) {
  const { pode } = useAuth();
  const { invalidar } = useGravacao();
  const [coluna, id] = colunaEscopo(escopo);
  const consulta = useQuery({
    queryKey: ["solicitacoes", coluna, id],
    queryFn: async () =>
      (await executar(supabase().from("solicitacoes_documentos").select("*").eq(coluna, id).is("revogada_em", null).gt("expira_em", new Date().toISOString()).order("created_at", { ascending: false }))) as Solicitacao[],
  });
  const lista = consulta.data ?? [];
  if (lista.length === 0) return null;
  const revogar = async (s: Solicitacao) => {
    const r = await confirmar({ titulo: "Revogar link?", mensagem: "O cliente não poderá mais enviar documentos por este link.", confirmar: "Revogar", perigo: true });
    if (!r.confirmado) return;
    try {
      await chamarFuncao("crm-documentos", { acao: "revogar_link", id: s.id });
      aviso.sucesso("Link revogado.");
      invalidar("solicitacoes", "eventos");
    } catch (e) {
      aviso.erro(mensagemErro(e));
    }
  };
  return (
    <div className="rounded-xl border border-crm-verde-borda bg-crm-verde-claro px-3 py-2">
      <p className="mb-1 text-xs font-bold text-crm-verde">Links de envio ativos</p>
      <ul className="flex flex-col gap-1 text-xs text-crm-tinta-2">
        {lista.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2">
            <Check size={12} className="text-crm-folha" aria-hidden />
            {s.documentos_ids.length} documento(s) · expira {formatarDataHora(s.expira_em)} · {s.total_acessos} acesso(s) · {s.total_envios} envio(s)
            {pode("documentos.solicitar_cliente") && (
              <button type="button" onClick={() => revogar(s)} className="inline-flex items-center gap-0.5 font-semibold text-crm-perigo hover:underline">
                <X size={12} aria-hidden /> Revogar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
