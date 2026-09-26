"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Calculator, CheckCircle2, ClipboardCheck, Gavel, History, Paperclip, Pencil, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso, comSalvamento } from "../../_lib/avisos";
import { opcoesLista, opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { dataSP, formatarData, formatarDataHora, formatarRelativo, horaSP, hojeSP, instanteSP, situacaoVencimento } from "../../_lib/datas";
import { ErroCrm, executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { calcularPrazo, descreverParametros, type ParametrosContagem } from "../../_lib/prazos";
import { supabase } from "../../_lib/supabase";
import type { Feriado, Prazo, PrazoHistorico, Processo } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { AreaTexto, CaixaSelecao, Entrada, GrupoCampo, Selecao } from "../../_ui/Campos";
import { confirmar } from "../../_ui/Dialogos";
import { SeletorCampo } from "../../_ui/Seletores";
import { Menu, Modal } from "../../_ui/Sobreposicoes";
import { Carregando, Pilula, Selo, Vazio } from "../../_ui/Visuais";
import { abrirArquivo, enviarArquivo } from "../../_componentes/Arquivos";
import { SeletorRegistro, type RegistroSelecionado } from "../../_componentes/SeletorRegistro";
import { STATUS_PRAZO } from "./constantes";

// ---------------------------------------------------------------------------
// Formulário de prazo (novo ou correção)
// ---------------------------------------------------------------------------

export interface SugestaoPrazoForm {
  processoId?: string | null;
  titulo?: string;
  ciencia?: string;
  referencia?: string;
}

export function FormPrazo({ aberto, aoFechar, caso, prazo, sugestao }: { aberto: boolean; aoFechar: () => void; caso?: { id: string; titulo: string } | null; prazo?: Prazo | null; sugestao?: SugestaoPrazoForm | null }) {
  const config = useConfig();
  const { perfil, pode } = useAuth();
  const { inserir, invalidar } = useGravacao();
  const padroes = config.cfg<{ alertas_padrao?: number[]; hora_padrao?: string; recesso?: { ativo: boolean; inicio: string; fim: string } }>("prazos", {});
  const [registro, setRegistro] = useState<RegistroSelecionado | null>(null);
  const [processo, setProcesso] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [origem, setOrigem] = useState<string | null>("intimacao_eletronica");
  const [referencia, setReferencia] = useState("");
  const [ciencia, setCiencia] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("23:59");
  const [responsavel, setResponsavel] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState<string | null>("alta");
  const [alertas, setAlertas] = useState("5, 2, 1, 0");
  const [conferido, setConferido] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [calculo, setCalculo] = useState<Record<string, unknown> | null>(null);
  const [auxilio, setAuxilio] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setMotivo("");
    setAuxilio(false);
    if (prazo) {
      setRegistro({ tipo: "caso", id: prazo.caso_id, titulo: caso?.titulo ?? "Caso" });
      setProcesso(prazo.processo_id);
      setTitulo(prazo.titulo);
      setDescricao(prazo.descricao ?? "");
      setOrigem(prazo.origem);
      setReferencia(prazo.referencia_origem ?? "");
      setCiencia(prazo.data_ciencia ?? "");
      setData(dataSP(prazo.vencimento));
      setHora(horaSP(prazo.vencimento));
      setResponsavel(prazo.responsavel_id);
      setPrioridade(prazo.prioridade);
      setAlertas(prazo.alertas_dias.join(", "));
      setConferido(prazo.conferido);
      setCalculo((prazo.calculo as Record<string, unknown>) ?? null);
    } else {
      setRegistro(caso ? { tipo: "caso", id: caso.id, titulo: caso.titulo } : null);
      setProcesso(sugestao?.processoId ?? null);
      setTitulo(sugestao?.titulo ?? "");
      setDescricao("");
      setOrigem("intimacao_eletronica");
      setReferencia(sugestao?.referencia ?? "");
      setCiencia(sugestao?.ciencia ?? "");
      setData("");
      setHora(padroes.hora_padrao ?? "23:59");
      setResponsavel(perfil?.id ?? null);
      setPrioridade("alta");
      setAlertas((padroes.alertas_padrao ?? [5, 2, 1, 0]).join(", "));
      setConferido(false);
      setCalculo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, prazo?.id]);

  const processos = useQuery({
    queryKey: ["processos", "caso", registro?.id],
    enabled: aberto && Boolean(registro?.id),
    queryFn: async () => (await executar(supabase().from("processos").select("id, numero, tribunal, principal").eq("caso_id", registro!.id).order("principal", { ascending: false }))) as Pick<Processo, "id" | "numero" | "tribunal" | "principal">[],
  });
  useEffect(() => {
    if (!prazo && processos.data?.length && !processo) setProcesso(processos.data[0].id);
  }, [processos.data, prazo, processo]);

  const alterouVencimento = prazo ? `${dataSP(prazo.vencimento)} ${horaSP(prazo.vencimento)}` !== `${data} ${hora}` : false;
  // Uma correção de vencimento desfaz a conferência anterior (regra aplicada também no banco).
  const exigiraNovaConferencia = Boolean(prazo?.conferido && alterouVencimento);

  const salvar = async () => {
    if (!registro) return setErro("Selecione o caso.");
    if (!titulo.trim()) return setErro("Descreva o prazo.");
    if (!data) return setErro("Informe a data de vencimento.");
    if (prazo && alterouVencimento && motivo.trim().length < 3) return setErro("Informe o motivo da correção do vencimento (fica no histórico).");
    const listaAlertas = alertas.split(/[,; ]+/).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 0 && x <= 60);
    const dados: Record<string, unknown> = {
      caso_id: registro.id,
      processo_id: processo,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      origem,
      referencia_origem: referencia.trim() || null,
      data_ciencia: ciencia || null,
      vencimento: instanteSP(data, hora || "23:59"),
      responsavel_id: responsavel,
      prioridade: prioridade ?? "alta",
      alertas_dias: [...new Set(listaAlertas)].sort((a, b) => b - a),
      conferido: pode("prazos.conferir") ? conferido : prazo?.conferido ?? false,
      calculo,
    };
    setSalvando(true);
    setErro(null);
    try {
      if (prazo) {
        if (alterouVencimento) dados.motivo_alteracao = motivo.trim();
        else delete dados.vencimento;
        if (exigiraNovaConferencia) dados.conferido = false;
        // Controle de concorrência: só grava se ninguém alterou o prazo nesse meio-tempo.
        const linhas = await comSalvamento(() => executar(supabase().from("prazos").update(dados as never).eq("id", prazo.id).eq("versao", prazo.versao).select("id")));
        if (!linhas || (linhas as unknown[]).length === 0) throw new ErroCrm("Este prazo foi alterado por outra pessoa enquanto você editava. Feche, confira a versão atual e tente novamente.");
        aviso.sucesso(alterouVencimento ? "Prazo corrigido — a alteração ficou no histórico." : "Prazo atualizado.");
        invalidar("prazos", "painel", "agenda", "eventos");
      } else {
        await inserir("prazos", dados, { chaves: ["prazos", "painel", "agenda", "eventos"], mensagemSucesso: dados.conferido ? "Prazo cadastrado e conferido." : "Prazo cadastrado — aguardando conferência.", silencioso: true });
      }
      aoFechar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      largura="xl"
      titulo={prazo ? "Corrigir prazo processual" : "Novo prazo processual"}
      descricao={config.texto("aviso_prazos", "O CRM não calcula prazos processuais de forma definitiva. Todo prazo deve ser conferido por profissional habilitado.")}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={salvar} carregando={salvando}>
            {prazo ? "Salvar correção" : "Cadastrar prazo"}
          </Botao>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <form className="grid content-start gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
          {erro && <p role="alert" className="rounded-xl border-2 border-crm-perigo bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo sm:col-span-2">{erro}</p>}
          <GrupoCampo rotulo="Caso" obrigatorio className="sm:col-span-2">
            {(p) => <SeletorRegistro {...p} tipos={["caso"]} valor={registro} aoAlterar={setRegistro} desabilitado={Boolean(caso) || Boolean(prazo)} />}
          </GrupoCampo>
          <GrupoCampo rotulo="Processo" className="sm:col-span-2">
            {(p) => (
              <SeletorCampo
                {...p}
                rotulo="Processo"
                valor={processo}
                opcoes={(processos.data ?? []).map((x) => ({ valor: x.id, rotulo: x.numero ?? "Processo sem número", descricao: x.tribunal ?? undefined }))}
                aoAlterar={setProcesso}
                rotuloVazio="Sem processo vinculado"
              />
            )}
          </GrupoCampo>
          <GrupoCampo rotulo="Prazo (o que deve ser feito)" obrigatorio className="sm:col-span-2">
            {(p) => <Entrada {...p} data-autofoco value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Manifestação sobre informações da autoridade coatora" />}
          </GrupoCampo>
          <GrupoCampo rotulo="Origem da informação">
            {(p) => <SeletorCampo {...p} rotulo="Origem" valor={origem} opcoes={opcoesLista(config, "origem_prazo").filter((o) => !o.desabilitada)} aoAlterar={setOrigem} permitirVazio={false} />}
          </GrupoCampo>
          <GrupoCampo rotulo="Referência" ajuda="Ex.: evento 45, intimação ID 123456.">
            {(p) => <Entrada {...p} value={referencia} onChange={(e) => setReferencia(e.target.value)} />}
          </GrupoCampo>
          <GrupoCampo rotulo="Data da ciência/publicação">{(p) => <Entrada {...p} type="date" value={ciencia} onChange={(e) => setCiencia(e.target.value)} />}</GrupoCampo>
          <div />
          <GrupoCampo rotulo="Vencimento (data)" obrigatorio>{(p) => <Entrada {...p} type="date" value={data} onChange={(e) => setData(e.target.value)} />}</GrupoCampo>
          <GrupoCampo rotulo="Horário limite (Brasília)">{(p) => <Entrada {...p} type="time" value={hora} onChange={(e) => setHora(e.target.value)} />}</GrupoCampo>
          {prazo && alterouVencimento && (
            <GrupoCampo rotulo="Motivo da correção do vencimento" obrigatorio className="sm:col-span-2" ajuda="Correções exigem nova conferência.">
              {(p) => <AreaTexto {...p} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: republicação da intimação em 02/10" />}
            </GrupoCampo>
          )}
          <GrupoCampo rotulo="Responsável">{(p) => <SeletorCampo {...p} rotulo="Responsável" valor={responsavel} estilo="pessoa" opcoes={opcoesUsuarios(config, false)} aoAlterar={setResponsavel} />}</GrupoCampo>
          <GrupoCampo rotulo="Prioridade">{(p) => <SeletorCampo {...p} rotulo="Prioridade" valor={prioridade} estilo="pilula" opcoes={opcoesLista(config, "prioridade")} aoAlterar={setPrioridade} permitirVazio={false} />}</GrupoCampo>
          <GrupoCampo rotulo="Alertas (dias antes do vencimento)" ajuda="Separe por vírgula. 0 = no dia." className="sm:col-span-2">
            {(p) => <Entrada {...p} value={alertas} onChange={(e) => setAlertas(e.target.value)} />}
          </GrupoCampo>
          <GrupoCampo rotulo="Observações" className="sm:col-span-2">{(p) => <AreaTexto {...p} rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />}</GrupoCampo>
          <div className={`rounded-xl border-2 p-3 sm:col-span-2 ${conferido && !exigiraNovaConferencia ? "border-crm-folha bg-crm-verde-claro" : "border-[#F3D19A] bg-crm-alerta-claro"}`}>
            {exigiraNovaConferencia ? (
              <p className="flex items-center gap-2 text-sm text-crm-alerta">
                <ShieldAlert size={16} aria-hidden /> A correção do vencimento desfaz a conferência anterior. Depois de salvar, o prazo precisará ser conferido novamente.
              </p>
            ) : pode("prazos.conferir") ? (
              <CaixaSelecao
                marcado={conferido}
                aoAlterar={setConferido}
                rotulo={<strong>Conferi este prazo e confirmo o vencimento</strong>}
                descricao="Sua conferência fica registrada com nome, data e hora. Deixe desmarcado se ainda precisa conferir."
              />
            ) : (
              <p className="flex items-center gap-2 text-sm text-crm-alerta">
                <ShieldAlert size={16} aria-hidden /> O prazo ficará “a conferir” até que um profissional habilitado confirme.
              </p>
            )}
          </div>
          <button type="submit" className="hidden" />
        </form>
        <AuxilioContagem
          aberto={auxilio}
          aoAlternar={() => setAuxilio((a) => !a)}
          inicioSugerido={ciencia}
          recessoPadrao={padroes.recesso}
          aoAplicar={(venc, calc) => {
            setData(venc);
            setCalculo(calc);
            if (pode("prazos.conferir")) setConferido(false);
            aviso.info("Data sugerida aplicada. Confira os parâmetros antes de confirmar o prazo.");
          }}
          calculoSalvo={calculo}
        />
      </div>
    </Modal>
  );
}

function AuxilioContagem({
  aberto,
  aoAlternar,
  inicioSugerido,
  recessoPadrao,
  aoAplicar,
  calculoSalvo,
}: {
  aberto: boolean;
  aoAlternar: () => void;
  inicioSugerido: string;
  recessoPadrao?: { ativo: boolean; inicio: string; fim: string };
  aoAplicar: (vencimento: string, calculo: Record<string, unknown>) => void;
  calculoSalvo: Record<string, unknown> | null;
}) {
  const { perfil } = useAuth();
  const [p, setP] = useState<ParametrosContagem>({
    inicio: inicioSugerido || hojeSP(),
    dias: 15,
    tipo: "uteis",
    excluirInicio: true,
    considerarFeriados: true,
    considerarRecesso: recessoPadrao?.ativo ?? true,
    recesso: { inicio: recessoPadrao?.inicio ?? "12-20", fim: recessoPadrao?.fim ?? "01-20" },
    prorrogarFimNaoUtil: true,
  });
  useEffect(() => {
    if (inicioSugerido) setP((x) => ({ ...x, inicio: inicioSugerido }));
  }, [inicioSugerido]);
  const feriados = useQuery({
    queryKey: ["feriados"],
    enabled: aberto,
    queryFn: async () => (await executar(supabase().from("feriados").select("*").order("data"))) as Feriado[],
  });
  const resultado = useMemo(() => (feriados.data && p.inicio && p.dias > 0 ? calcularPrazo(p, feriados.data) : null), [p, feriados.data]);

  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-crm-linha bg-crm-fundo p-4">
      <button type="button" onClick={aoAlternar} aria-expanded={aberto} className="flex items-center gap-2 text-left text-sm font-bold">
        <Calculator size={16} className="text-crm-verde" aria-hidden /> Auxílio de contagem (opcional)
      </button>
      <p className="text-xs text-crm-tinta-2">Sugere uma data a partir dos parâmetros abaixo. Não substitui a análise do prazo no caso concreto.</p>
      {calculoSalvo && !aberto && (
        <p className="text-xs text-crm-tinta-3">Este prazo tem uma contagem auxiliar registrada ({String((calculoSalvo as { resumo?: string }).resumo ?? "")}).</p>
      )}
      {aberto && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <GrupoCampo rotulo="Início da contagem">{(x) => <Entrada {...x} type="date" value={p.inicio} onChange={(e) => setP({ ...p, inicio: e.target.value })} />}</GrupoCampo>
            <GrupoCampo rotulo="Quantidade de dias">{(x) => <Entrada {...x} type="number" min={1} max={365} value={p.dias} onChange={(e) => setP({ ...p, dias: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })} />}</GrupoCampo>
          </div>
          <GrupoCampo rotulo="Tipo de contagem">
            {(x) => (
              <Selecao {...x} value={p.tipo} onChange={(e) => setP({ ...p, tipo: e.target.value as "uteis" | "corridos" })}>
                <option value="uteis">Dias úteis</option>
                <option value="corridos">Dias corridos</option>
              </Selecao>
            )}
          </GrupoCampo>
          <CaixaSelecao marcado={p.excluirInicio} aoAlterar={(v) => setP({ ...p, excluirInicio: v })} rotulo="Excluir o dia do começo" />
          <CaixaSelecao marcado={p.considerarFeriados} aoAlterar={(v) => setP({ ...p, considerarFeriados: v })} rotulo="Considerar feriados cadastrados" descricao="Cadastre feriados locais/do tribunal em Administração." />
          <CaixaSelecao marcado={p.considerarRecesso} aoAlterar={(v) => setP({ ...p, considerarRecesso: v })} rotulo={`Considerar suspensão ${p.recesso.inicio.split("-").reverse().join("/")}–${p.recesso.fim.split("-").reverse().join("/")}`} />
          <CaixaSelecao marcado={p.prorrogarFimNaoUtil} aoAlterar={(v) => setP({ ...p, prorrogarFimNaoUtil: v })} rotulo="Prorrogar vencimento em dia não útil" />
          {feriados.isLoading ? (
            <Carregando />
          ) : resultado ? (
            <div className="flex flex-col gap-2 rounded-xl border-2 border-crm-tinta bg-white p-3">
              <p className="text-sm">
                Data sugerida: <strong className="text-base">{formatarData(resultado.vencimento)}</strong>
                {resultado.prorrogadoDe && <span className="text-xs text-crm-tinta-2"> (prorrogada de {formatarData(resultado.prorrogadoDe)})</span>}
              </p>
              <details className="text-xs text-crm-tinta-2">
                <summary className="cursor-pointer font-semibold">Parâmetros e dias desconsiderados ({resultado.ignorados.length})</summary>
                <ul className="mt-1 list-disc pl-4">
                  {descreverParametros(p).map((d) => <li key={d}>{d}</li>)}
                </ul>
                {resultado.ignorados.length > 0 && (
                  <ul className="mt-1 max-h-32 overflow-y-auto pl-4">
                    {resultado.ignorados.map((i) => (
                      <li key={`${i.data}-${i.motivo}`}>{formatarData(i.data)} — {i.motivo}</li>
                    ))}
                  </ul>
                )}
              </details>
              <p className="flex items-start gap-1 text-xs font-semibold text-crm-alerta">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden /> Sugestão não definitiva: confira as regras aplicáveis ao processo antes de confirmar.
              </p>
              <Botao
                tamanho="sm"
                variante="secundario"
                onClick={() =>
                  aoAplicar(resultado.vencimento, {
                    parametros: p,
                    resultado: resultado.vencimento,
                    prorrogado_de: resultado.prorrogadoDe,
                    dias_desconsiderados: resultado.ignorados,
                    gerado_em: new Date().toISOString(),
                    gerado_por: perfil?.id,
                    resumo: `${p.dias} dias ${p.tipo === "uteis" ? "úteis" : "corridos"} a partir de ${formatarData(p.inicio)}`,
                    aviso: "Auxílio de contagem — sujeito à conferência de profissional habilitado.",
                  })
                }
              >
                Usar esta data (exigirá conferência)
              </Botao>
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Cumprimento com comprovante
// ---------------------------------------------------------------------------

export function CumprirPrazo({ prazo, aoFechar }: { prazo: Prazo | null; aoFechar: () => void }) {
  const { invalidar } = useGravacao();
  const [obs, setObs] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setObs("");
    setArquivo(null);
  }, [prazo?.id]);
  if (!prazo) return null;
  const salvar = async () => {
    setSalvando(true);
    try {
      let arquivoId: string | null = null;
      if (arquivo) {
        const a = await enviarArquivo(arquivo, { caso_id: prazo.caso_id, tipo: "comprovante_prazo", descricao: `Comprovante de cumprimento: ${prazo.titulo}` });
        arquivoId = a.id;
      }
      const linhas = await comSalvamento(() =>
        executar(supabase().from("prazos").update({ status: "cumprido", comprovante_arquivo_id: arquivoId, cumprimento_obs: obs.trim() || null }).eq("id", prazo.id).eq("versao", prazo.versao).select("id")),
      );
      if (!linhas || (linhas as unknown[]).length === 0) throw new ErroCrm("O prazo foi alterado por outra pessoa. Atualize e tente novamente.");
      aviso.sucesso("Prazo marcado como cumprido.");
      invalidar("prazos", "painel", "agenda", "eventos", "arquivos");
      aoFechar();
    } catch (e) {
      aviso.erro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Registrar cumprimento do prazo" descricao={`${prazo.titulo} · vencimento ${formatarDataHora(prazo.vencimento)}`} rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" carregando={salvando} onClick={salvar}>Marcar como cumprido</Botao></>}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <input ref={ref} type="file" className="sr-only" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} aria-label="Comprovante de cumprimento" />
          <Botao tamanho="sm" icone={<Paperclip size={14} />} onClick={() => ref.current?.click()}>
            Anexar comprovante (protocolo)
          </Botao>
          <span className="truncate text-xs text-crm-tinta-2">{arquivo?.name ?? "Opcional, recomendado"}</span>
        </div>
        <GrupoCampo rotulo="Observação">{(p) => <AreaTexto {...p} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: petição protocolada — evento 52" />}</GrupoCampo>
      </div>
    </Modal>
  );
}

export function HistoricoPrazo({ prazoId }: { prazoId: string }) {
  const config = useConfig();
  const consulta = useQuery({
    queryKey: ["prazos", "historico", prazoId],
    queryFn: async () => (await executar(supabase().from("prazos_historico").select("*").eq("prazo_id", prazoId).order("created_at", { ascending: false }))) as PrazoHistorico[],
  });
  if (consulta.isLoading) return <Carregando />;
  const rotulos: Record<string, string> = { criacao: "Cadastro", vencimento: "Vencimento", conferido: "Conferência", responsavel: "Responsável", status: "Situação", titulo: "Descrição" };
  return (
    <ol className="flex flex-col gap-2">
      {(consulta.data ?? []).map((h) => (
        <li key={h.id} className="rounded-lg border border-crm-linha bg-white px-3 py-2 text-sm">
          <span className="text-xs tabular-nums text-crm-tinta-3">{formatarDataHora(h.created_at)} · {config.usuario(h.usuario_id)?.nome ?? "sistema"}</span>
          <p>
            <strong>{rotulos[h.campo] ?? h.campo}:</strong> {h.valor_anterior ? `${h.valor_anterior} → ` : ""}
            {h.campo === "status" ? STATUS_PRAZO[h.valor_novo ?? ""]?.rotulo ?? h.valor_novo : h.valor_novo}
          </p>
          {h.motivo && <p className="text-xs text-crm-tinta-2">Motivo: {h.motivo}</p>}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Lista de prazos de um caso
// ---------------------------------------------------------------------------

export function ListaPrazosCaso({ casoId, casoTitulo, destaque }: { casoId: string; casoTitulo: string; destaque?: string | null }) {
  const config = useConfig();
  const { pode } = useAuth();
  const { invalidar } = useGravacao();
  const [novo, setNovo] = useState(false);
  const [editar, setEditar] = useState<Prazo | null>(null);
  const [cumprir, setCumprir] = useState<Prazo | null>(null);
  const [historico, setHistorico] = useState<Prazo | null>(null);
  const consulta = useQuery({
    queryKey: ["prazos", "caso", casoId],
    queryFn: async () => (await executar(supabase().from("prazos").select("*, comprovante:arquivos(id, bucket, caminho, nome), processo:processos(id, numero)").eq("caso_id", casoId).order("vencimento"))) as unknown as (Prazo & { comprovante: { id: string; bucket: string; caminho: string; nome: string } | null; processo: { id: string; numero: string | null } | null })[],
  });

  const conferir = async (p: Prazo) => {
    const r = await confirmar({ titulo: "Confirmar conferência do prazo?", mensagem: `Você confirma que conferiu o vencimento de “${p.titulo}” em ${formatarDataHora(p.vencimento)}? Seu nome ficará registrado.`, confirmar: "Confirmar conferência" });
    if (!r.confirmado) return;
    try {
      const linhas = await comSalvamento(() => executar(supabase().from("prazos").update({ conferido: true }).eq("id", p.id).eq("versao", p.versao).select("id")));
      if (!linhas || (linhas as unknown[]).length === 0) throw new ErroCrm("O prazo foi alterado por outra pessoa. Atualize antes de conferir.");
      aviso.sucesso("Prazo conferido.");
      invalidar("prazos", "painel", "eventos");
    } catch (e) {
      aviso.erro(mensagemErro(e));
    }
  };
  const alterarStatus = async (p: Prazo, status: "cancelado" | "pendente") => {
    const r = await confirmar({ titulo: status === "cancelado" ? "Cancelar prazo?" : "Reabrir prazo?", mensagem: "Informe o motivo; ele fica no histórico do prazo.", motivo: { rotulo: "Motivo", obrigatorio: true }, confirmar: "Confirmar", perigo: status === "cancelado" });
    if (!r.confirmado) return;
    try {
      await comSalvamento(() => executar(supabase().from("prazos").update({ status, motivo_alteracao: r.motivo }).eq("id", p.id).select("id")));
      invalidar("prazos", "painel", "eventos");
    } catch (e) {
      aviso.erro(mensagemErro(e));
    }
  };

  const lista = consulta.data ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-crm-tinta-2">{config.texto("aviso_prazos", "Prazos são informados pela equipe e exigem conferência de profissional habilitado.")}</p>
        {pode("prazos.editar") && (
          <Botao variante="primario" tamanho="sm" icone={<Gavel size={14} />} onClick={() => setNovo(true)}>
            Novo prazo
          </Botao>
        )}
      </div>
      {consulta.isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Vazio compacto icone={<Gavel size={18} />} titulo="Nenhum prazo cadastrado" />
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((p) => {
            const s = p.status === "pendente" ? situacaoVencimento(p.vencimento) : null;
            return (
              <li key={p.id} className={`rounded-xl border bg-white p-3 ${destaque === p.id ? "ring-2 ring-crm-folha" : ""} ${s === "vencido" ? "border-crm-perigo/50" : "border-crm-linha"}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{p.titulo}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-crm-tinta-2">
                      <span className={`font-bold tabular-nums ${s === "vencido" ? "text-crm-perigo" : s === "hoje" ? "text-crm-alerta" : ""}`}>
                        {s === "vencido" && <AlertTriangle size={11} className="mr-0.5 inline" aria-hidden />}
                        Vence {formatarDataHora(p.vencimento)} {p.status === "pendente" && `(${s === "vencido" ? "vencido" : formatarRelativo(p.vencimento)})`}
                      </span>
                      {p.processo?.numero && <span>· {p.processo.numero}</span>}
                      <span>· {config.rotulo("origem_prazo", p.origem)}{p.referencia_origem ? ` (${p.referencia_origem})` : ""}</span>
                      <span>· {config.usuario(p.responsavel_id)?.nome ?? "sem responsável"}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pilula cor={STATUS_PRAZO[p.status]?.cor}>{STATUS_PRAZO[p.status]?.rotulo}</Pilula>
                    {p.status === "pendente" &&
                      (p.conferido ? (
                        <Selo tom="sucesso" icone={<ShieldCheck size={11} aria-hidden />} titulo={`Conferido por ${config.usuario(p.conferido_por)?.nome ?? "—"} em ${formatarDataHora(p.conferido_em)}`}>
                          Conferido
                        </Selo>
                      ) : (
                        <Selo tom="alerta" icone={<ShieldAlert size={11} aria-hidden />}>A conferir</Selo>
                      ))}
                    {p.calculo && <Selo tom="info" icone={<Calculator size={11} aria-hidden />} titulo="Data sugerida pelo auxílio de contagem">Auxílio</Selo>}
                    <Menu
                      rotulo={`Ações do prazo ${p.titulo}`}
                      itens={[
                        ...(p.status === "pendente" && pode("prazos.conferir") && !p.conferido ? [{ rotulo: "Conferir e confirmar", icone: <ClipboardCheck size={15} />, aoSelecionar: () => conferir(p) }] : []),
                        ...(p.status === "pendente" && pode("prazos.editar") ? [{ rotulo: "Registrar cumprimento", icone: <CheckCircle2 size={15} />, aoSelecionar: () => setCumprir(p) }] : []),
                        ...(pode("prazos.editar") ? [{ rotulo: "Corrigir / editar", icone: <Pencil size={15} />, aoSelecionar: () => setEditar(p) }] : []),
                        { rotulo: "Histórico de alterações", icone: <History size={15} />, aoSelecionar: () => setHistorico(p) },
                        ...(p.status === "pendente" && pode("prazos.editar") ? [{ rotulo: "Cancelar prazo", icone: <XCircle size={15} />, aoSelecionar: () => alterarStatus(p, "cancelado"), perigo: true, separadorAntes: true }] : []),
                        ...(p.status !== "pendente" && pode("prazos.editar") ? [{ rotulo: "Reabrir prazo", icone: <History size={15} />, aoSelecionar: () => alterarStatus(p, "pendente"), separadorAntes: true }] : []),
                      ]}
                      gatilho={(g) => (
                        <button {...g} type="button" className="rounded-lg border border-crm-linha px-2 py-1 text-xs font-semibold hover:bg-crm-suave" aria-label={`Ações do prazo ${p.titulo}`}>
                          Ações
                        </button>
                      )}
                    />
                  </div>
                </div>
                {p.status === "cumprido" && (
                  <p className="mt-2 text-xs text-crm-sucesso">
                    Cumprido em {formatarDataHora(p.cumprido_em)} por {config.usuario(p.cumprido_por)?.nome ?? "—"}
                    {p.cumprimento_obs ? ` — ${p.cumprimento_obs}` : ""}
                    {p.comprovante && (
                      <button type="button" className="ml-2 font-semibold text-crm-info underline" onClick={() => abrirArquivo(p.comprovante!)}>
                        ver comprovante
                      </button>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <FormPrazo aberto={novo} aoFechar={() => setNovo(false)} caso={{ id: casoId, titulo: casoTitulo }} />
      <FormPrazo aberto={Boolean(editar)} aoFechar={() => setEditar(null)} caso={{ id: casoId, titulo: casoTitulo }} prazo={editar} />
      <CumprirPrazo prazo={cumprir} aoFechar={() => setCumprir(null)} />
      {historico && (
        <Modal aberto aoFechar={() => setHistorico(null)} titulo="Histórico do prazo" descricao={historico.titulo}>
          <HistoricoPrazo prazoId={historico.id} />
        </Modal>
      )}
    </div>
  );
}
