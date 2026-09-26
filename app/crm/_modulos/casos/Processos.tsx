"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Gavel, Pencil, PlugZap, Plus, Scale, Star, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso } from "../../_lib/avisos";
import { opcoesLista } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { formatarData, formatarDataHora, hojeSP, horaSP, instanteSP } from "../../_lib/datas";
import { ErroCrm, executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { formatarDocumento, formatarProcesso, numeroCnjValido, somenteDigitos } from "../../_lib/formatos";
import { supabase } from "../../_lib/supabase";
import type { Andamento, Parte, Processo } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { AreaTexto, CaixaSelecao, Entrada, GrupoCampo, Selecao } from "../../_ui/Campos";
import { confirmarSimples } from "../../_ui/Dialogos";
import { SeletorCampo } from "../../_ui/Seletores";
import { Menu, Modal } from "../../_ui/Sobreposicoes";
import { Carregando, ErroCarga, Pilula, Selo, Vazio } from "../../_ui/Visuais";
import { SeletorRegistro, type RegistroSelecionado } from "../../_componentes/SeletorRegistro";
import { SITUACAO_PROCESSO } from "./constantes";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export function useProcessosCaso(casoId: string) {
  return useQuery({
    queryKey: ["processos", "caso", casoId, "completo"],
    queryFn: async () => (await executar(supabase().from("processos").select("*").eq("caso_id", casoId).order("principal", { ascending: false }).order("created_at"))) as Processo[],
  });
}

// ---------------------------------------------------------------------------
// Processo judicial (cadastro manual; consulta automática NÃO conectada)
// ---------------------------------------------------------------------------

export function FormProcesso({ aberto, aoFechar, caso, processo }: { aberto: boolean; aoFechar: () => void; caso?: { id: string; titulo: string } | null; processo?: Processo | null }) {
  const { invalidar } = useGravacao();
  const [registro, setRegistro] = useState<RegistroSelecionado | null>(null);
  const [f, setF] = useState({
    numero: "",
    principal: false,
    classe: "",
    tribunal: "",
    orgao: "",
    comarca: "",
    uf: "",
    instancia: "1º grau",
    sistema: "",
    data_distribuicao: "",
    link_consulta: "",
    situacao: "em_andamento",
    segredo_justica: true,
    observacoes: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Processo sem número já existente no caso (ex.: criado junto com o caso judicial).
  const [editando, setEditando] = useState<Processo | null>(null);
  const alvo = processo ?? editando;
  const existentes = useQuery({
    queryKey: ["processos", "caso", registro?.id, "completo"],
    enabled: aberto && !processo && Boolean(registro?.id),
    queryFn: async () => (await executar(supabase().from("processos").select("*").eq("caso_id", registro!.id).order("principal", { ascending: false }).order("created_at"))) as Processo[],
  });
  const semNumero = !processo && !editando ? (existentes.data ?? []).find((x) => !x.numero) ?? null : null;

  useEffect(() => {
    if (!aberto) {
      setEditando(null);
      return;
    }
    setErro(null);
    setRegistro(caso ? { tipo: "caso", id: caso.id, titulo: caso.titulo } : null);
    setF({
      numero: processo?.numero ?? "",
      principal: processo?.principal ?? false,
      classe: processo?.classe ?? "",
      tribunal: processo?.tribunal ?? "",
      orgao: processo?.orgao ?? "",
      comarca: processo?.comarca ?? "",
      uf: processo?.uf ?? "",
      instancia: processo?.instancia ?? "1º grau",
      sistema: processo?.sistema ?? "",
      data_distribuicao: processo?.data_distribuicao ?? "",
      link_consulta: processo?.link_consulta ?? "",
      situacao: processo?.situacao ?? "em_andamento",
      segredo_justica: processo?.segredo_justica ?? true,
      observacoes: processo?.observacoes ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, processo?.id]);

  const alterar = (campo: keyof typeof f, valor: string | boolean) => setF((x) => ({ ...x, [campo]: valor }));
  const digitos = somenteDigitos(f.numero);
  const avisoNumero = f.numero.trim() && digitos.length === 20 && !numeroCnjValido(f.numero) ? "Os dígitos verificadores não conferem com o padrão CNJ. Revise o número." : f.numero.trim() && digitos.length !== 20 ? "Números no padrão CNJ têm 20 dígitos. Confira se o número está completo." : null;

  const salvar = async () => {
    if (!registro) return setErro("Selecione o caso.");
    if (f.link_consulta.trim() && !/^https:\/\//i.test(f.link_consulta.trim())) return setErro("O link de consulta deve começar com https://");
    const dados = {
      caso_id: registro.id,
      numero: f.numero.trim() ? (digitos.length === 20 ? formatarProcesso(f.numero) : f.numero.trim()) : null,
      principal: f.principal,
      classe: f.classe.trim() || null,
      tribunal: f.tribunal.trim().toUpperCase() || null,
      orgao: f.orgao.trim() || null,
      comarca: f.comarca.trim() || null,
      uf: f.uf || null,
      instancia: f.instancia.trim() || null,
      sistema: f.sistema.trim() || null,
      data_distribuicao: f.data_distribuicao || null,
      link_consulta: f.link_consulta.trim() || null,
      situacao: f.situacao,
      segredo_justica: f.segredo_justica,
      observacoes: f.observacoes.trim() || null,
    };
    setSalvando(true);
    setErro(null);
    try {
      const s = supabase();
      if (alvo) {
        const linhas = await executar(s.from("processos").update(dados).eq("id", alvo.id).select("id"));
        if (!linhas?.length) throw new ErroCrm("Não foi possível salvar: o processo não existe mais ou você não tem permissão.");
        aviso.sucesso("Processo atualizado.");
      } else {
        await executar(s.from("processos").insert(dados).select("id"));
        aviso.sucesso(dados.numero ? "Processo cadastrado." : "Processo cadastrado sem número — informe-o assim que houver protocolo.");
      }
      invalidar("processos", "casos", "eventos", "painel");
      aoFechar();
    } catch (e) {
      const codigo = (e as ErroCrm).codigo;
      setErro(codigo === "23505" ? "Este número de processo já está cadastrado em outro caso. Use a busca para localizá-lo." : mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      largura="lg"
      titulo={processo ? "Editar processo" : editando ? "Informar dados do processo existente" : "Cadastrar processo judicial"}
      descricao="Cadastro manual. A consulta automática aos tribunais não está conectada: andamentos e prazos são registrados pela equipe."
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" carregando={salvando} onClick={salvar}>
            {alvo ? "Salvar" : "Cadastrar processo"}
          </Botao>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        {erro && <p role="alert" className="rounded-xl border-2 border-crm-perigo bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo sm:col-span-2">{erro}</p>}
        <GrupoCampo rotulo="Caso" obrigatorio className="sm:col-span-2">
          {(p) => <SeletorRegistro {...p} tipos={["caso"]} valor={registro} aoAlterar={setRegistro} desabilitado={Boolean(caso) || Boolean(alvo)} />}
        </GrupoCampo>
        {semNumero && (
          <div role="status" className="flex flex-col gap-2 rounded-xl border-2 border-[#F3D19A] bg-crm-alerta-claro p-3 text-sm sm:col-span-2">
            <p className="text-crm-alerta">
              <strong>Este caso já tem um processo sem número</strong>
              {[semNumero.tribunal, semNumero.classe].filter(Boolean).length ? ` (${[semNumero.tribunal, semNumero.classe].filter(Boolean).join(" · ")})` : ""}. Se for o mesmo processo, informe o número nele em vez de cadastrar outro.
            </p>
            <Botao
              tamanho="sm"
              className="self-start"
              onClick={() => {
                setEditando(semNumero);
                setF((x) => ({
                  ...x,
                  principal: semNumero.principal,
                  classe: x.classe || semNumero.classe || "",
                  tribunal: x.tribunal || semNumero.tribunal || "",
                  orgao: x.orgao || semNumero.orgao || "",
                  comarca: x.comarca || semNumero.comarca || "",
                  uf: x.uf || semNumero.uf || "",
                  sistema: x.sistema || semNumero.sistema || "",
                  situacao: semNumero.situacao,
                  segredo_justica: semNumero.segredo_justica,
                  observacoes: x.observacoes || semNumero.observacoes || "",
                }));
              }}
            >
              Usar o processo existente
            </Botao>
          </div>
        )}
        <GrupoCampo rotulo="Número do processo" ajuda={avisoNumero ? undefined : "Deixe vazio se ainda não houver protocolo."} erro={null} className="sm:col-span-2">
          {(p) => (
            <>
              <Entrada {...p} data-autofoco value={f.numero} onChange={(e) => alterar("numero", e.target.value)} onBlur={() => digitos.length === 20 && alterar("numero", formatarProcesso(f.numero))} placeholder="0000000-00.0000.0.00.0000" inputMode="numeric" className="tabular-nums" />
              {avisoNumero && (
                <p className="flex items-center gap-1 text-xs font-semibold text-crm-alerta">
                  <AlertTriangle size={12} aria-hidden /> {avisoNumero}
                </p>
              )}
            </>
          )}
        </GrupoCampo>
        <GrupoCampo rotulo="Classe processual">{(p) => <Entrada {...p} value={f.classe} onChange={(e) => alterar("classe", e.target.value)} placeholder="Ex.: Mandado de Segurança Cível" />}</GrupoCampo>
        <GrupoCampo rotulo="Situação">
          {(p) => (
            <Selecao {...p} value={f.situacao} onChange={(e) => alterar("situacao", e.target.value)}>
              {Object.entries(SITUACAO_PROCESSO).map(([v, s]) => (
                <option key={v} value={v}>{s.rotulo}</option>
              ))}
            </Selecao>
          )}
        </GrupoCampo>
        <GrupoCampo rotulo="Tribunal">{(p) => <Entrada {...p} value={f.tribunal} onChange={(e) => alterar("tribunal", e.target.value)} placeholder="Ex.: TJSC, TRF4, STJ" />}</GrupoCampo>
        <GrupoCampo rotulo="Órgão julgador / vara">{(p) => <Entrada {...p} value={f.orgao} onChange={(e) => alterar("orgao", e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Comarca / subseção">{(p) => <Entrada {...p} value={f.comarca} onChange={(e) => alterar("comarca", e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="UF">
          {(p) => (
            <Selecao {...p} value={f.uf} onChange={(e) => alterar("uf", e.target.value)}>
              <option value="">—</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </Selecao>
          )}
        </GrupoCampo>
        <GrupoCampo rotulo="Instância">{(p) => <Entrada {...p} value={f.instancia} onChange={(e) => alterar("instancia", e.target.value)} placeholder="1º grau, 2º grau, tribunal superior…" />}</GrupoCampo>
        <GrupoCampo rotulo="Sistema">{(p) => <Entrada {...p} value={f.sistema} onChange={(e) => alterar("sistema", e.target.value)} placeholder="Ex.: eproc, PJe, e-SAJ" />}</GrupoCampo>
        <GrupoCampo rotulo="Distribuição">{(p) => <Entrada {...p} type="date" value={f.data_distribuicao} onChange={(e) => alterar("data_distribuicao", e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Link de consulta pública" ajuda="Opcional. Abre a página do tribunal em nova aba.">{(p) => <Entrada {...p} type="url" value={f.link_consulta} onChange={(e) => alterar("link_consulta", e.target.value)} placeholder="https://" />}</GrupoCampo>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <CaixaSelecao marcado={f.principal} aoAlterar={(v) => alterar("principal", v)} rotulo="Processo principal do caso" descricao="Aparece no quadro de casos e nos relatórios." />
          <CaixaSelecao marcado={f.segredo_justica} aoAlterar={(v) => alterar("segredo_justica", v)} rotulo="Tramita em segredo de justiça" />
        </div>
        <GrupoCampo rotulo="Observações" className="sm:col-span-2">{(p) => <AreaTexto {...p} rows={2} value={f.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} />}</GrupoCampo>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

/** Aviso honesto sobre a integração com tribunais (preparada, mas não ativa). */
export function AvisoIntegracaoTribunais() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-crm-linha bg-crm-fundo px-3 py-2 text-xs text-crm-tinta-2">
      <PlugZap size={14} className="mt-0.5 shrink-0 text-crm-tinta-3" aria-hidden />
      <span>
        <strong>Consulta automática aos tribunais: não conectada.</strong> Processos, andamentos e prazos são cadastrados manualmente pela equipe. A estrutura está preparada para
        uma integração futura (fonte, identificador externo e data de sincronização por processo).
      </span>
    </p>
  );
}

export function ListaProcessos({ casoId, casoTitulo, natureza }: { casoId: string; casoTitulo: string; natureza: string }) {
  const { pode } = useAuth();
  const { atualizar, excluir } = useGravacao();
  const consulta = useProcessosCaso(casoId);
  const [form, setForm] = useState<{ processo: Processo | null } | null>(null);
  const lista = consulta.data ?? [];

  const remover = async (p: Processo) => {
    if (!(await confirmarSimples({ titulo: "Remover processo do caso?", mensagem: `O processo ${p.numero ?? "sem número"} será removido. Andamentos e prazos vinculados continuam no caso, sem o vínculo com este processo.`, confirmar: "Remover", perigo: true }))) return;
    await excluir("processos", p.id, { chaves: ["processos", "casos", "eventos"], mensagemSucesso: "Processo removido." }).catch(() => undefined);
  };

  if (consulta.isLoading) return <Carregando />;
  if (consulta.error) return <ErroCarga mensagem={mensagemErro(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AvisoIntegracaoTribunais />
        {pode("casos.editar") && (
          <Botao variante="primario" tamanho="sm" icone={<Plus size={14} />} onClick={() => setForm({ processo: null })}>
            Cadastrar processo
          </Botao>
        )}
      </div>
      {natureza === "judicial" && !lista.some((p) => p.numero) && (
        <p role="status" className="flex items-center gap-2 rounded-xl border-2 border-[#F3D19A] bg-crm-alerta-claro px-3 py-2 text-sm font-semibold text-crm-alerta">
          <AlertTriangle size={16} aria-hidden /> Processo judicial sem número cadastrado.
        </p>
      )}
      {lista.length === 0 ? (
        <Vazio
          compacto
          icone={<Scale size={18} />}
          titulo="Nenhum processo vinculado"
          descricao="Casos internos não precisam de processo. Ao cadastrar um processo, o caso passa a ser um processo judicial."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {lista.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 rounded-2xl border border-crm-linha bg-white p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold tabular-nums ${p.numero ? "" : "text-crm-alerta"}`}>{p.numero ?? "Sem número"}</span>
                    {p.principal && <Selo tom="verde">Principal</Selo>}
                    {p.segredo_justica && <Selo>Segredo de justiça</Selo>}
                  </p>
                  <p className="text-xs text-crm-tinta-2">{[p.classe, p.tribunal, p.orgao, p.comarca && `${p.comarca}${p.uf ? `/${p.uf}` : ""}`, p.instancia].filter(Boolean).join(" · ") || "Dados do processo não informados"}</p>
                </div>
                <Pilula cor={SITUACAO_PROCESSO[p.situacao]?.cor}>{SITUACAO_PROCESSO[p.situacao]?.rotulo ?? p.situacao}</Pilula>
                {pode("casos.editar") && (
                  <Menu
                    rotulo={`Ações do processo ${p.numero ?? "sem número"}`}
                    itens={[
                      { rotulo: "Editar", icone: <Pencil size={15} />, aoSelecionar: () => setForm({ processo: p }) },
                      ...(!p.principal ? [{ rotulo: "Tornar principal", icone: <Star size={15} />, aoSelecionar: () => atualizar("processos", p.id, { principal: true }, { chaves: ["processos", "casos"], mensagemSucesso: "Processo principal alterado." }).catch(() => undefined) }] : []),
                      { rotulo: "Remover do caso", icone: <Trash2 size={15} />, aoSelecionar: () => remover(p), perigo: true, separadorAntes: true },
                    ]}
                    gatilho={(g) => (
                      <button {...g} type="button" className="rounded-lg border border-crm-linha px-2 py-1 text-xs font-semibold hover:bg-crm-suave" aria-label={`Ações do processo ${p.numero ?? "sem número"}`}>
                        Ações
                      </button>
                    )}
                  />
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-crm-tinta-3">Sistema</dt>
                <dd>{p.sistema ?? "—"}</dd>
                <dt className="text-crm-tinta-3">Distribuição</dt>
                <dd>{formatarData(p.data_distribuicao) || "—"}</dd>
                <dt className="text-crm-tinta-3">Origem do cadastro</dt>
                <dd>{p.fonte === "manual" ? "Manual" : p.fonte === "importacao" ? "Importação" : "Integração"}</dd>
                <dt className="text-crm-tinta-3">Última consulta automática</dt>
                <dd>{p.ultima_sincronizacao_em ? formatarDataHora(p.ultima_sincronizacao_em) : "Não conectada"}</dd>
              </dl>
              {p.observacoes && <p className="whitespace-pre-wrap text-xs text-crm-tinta-2">{p.observacoes}</p>}
              {!p.numero && pode("casos.editar") && (
                <Botao tamanho="sm" icone={<Pencil size={13} />} className="self-start" onClick={() => setForm({ processo: p })}>
                  Informar número do processo
                </Botao>
              )}
              {p.link_consulta && (
                <a href={p.link_consulta} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 self-start text-xs font-semibold text-crm-info hover:underline">
                  Consultar no tribunal <ExternalLink size={12} aria-hidden />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      <FormProcesso aberto={Boolean(form)} aoFechar={() => setForm(null)} caso={{ id: casoId, titulo: casoTitulo }} processo={form?.processo} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Andamentos (movimentações) — registro manual
// ---------------------------------------------------------------------------

export interface SugestaoPrazo {
  processoId: string | null;
  titulo: string;
  ciencia: string;
  referencia: string;
}

export function FormAndamento({ aberto, aoFechar, casoId, processos, aoSugerirPrazo }: { aberto: boolean; aoFechar: () => void; casoId: string; processos: Pick<Processo, "id" | "numero">[]; aoSugerirPrazo?: (s: SugestaoPrazo) => void }) {
  const config = useConfig();
  const { pode } = useAuth();
  const { inserir } = useGravacao();
  const [processo, setProcesso] = useState<string | null>(null);
  const [data, setData] = useState(hojeSP());
  const [hora, setHora] = useState("12:00");
  const [tipo, setTipo] = useState<string | null>("despacho");
  const [descricao, setDescricao] = useState("");
  const [importante, setImportante] = useState(false);
  const [criarPrazo, setCriarPrazo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setProcesso(processos[0]?.id ?? null);
    setData(hojeSP());
    setHora(horaSP(new Date()));
    setTipo("despacho");
    setDescricao("");
    setImportante(false);
    setCriarPrazo(false);
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const salvar = async () => {
    if (descricao.trim().length < 3) return setErro("Descreva o andamento.");
    setSalvando(true);
    setErro(null);
    try {
      await inserir(
        "andamentos",
        { caso_id: casoId, processo_id: processo, data: instanteSP(data, hora), tipo: tipo ?? "outro", descricao: descricao.trim(), importante, fonte: "manual" },
        { chaves: ["andamentos", "eventos"], mensagemSucesso: "Andamento registrado.", silencioso: true },
      );
      aoFechar();
      if (criarPrazo && aoSugerirPrazo) {
        aoSugerirPrazo({ processoId: processo, titulo: "", ciencia: data, referencia: `${config.rotulo("tipo_andamento", tipo)} de ${formatarData(data)}` });
      }
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
      titulo="Registrar andamento"
      descricao="Movimentação informada manualmente (a consulta automática aos tribunais não está conectada)."
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" carregando={salvando} onClick={salvar}>Registrar</Botao>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        {erro && <p role="alert" className="rounded-xl border-2 border-crm-perigo bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo sm:col-span-2">{erro}</p>}
        {processos.length > 0 && (
          <GrupoCampo rotulo="Processo" className="sm:col-span-2">
            {(p) => <SeletorCampo {...p} rotulo="Processo" valor={processo} opcoes={processos.map((x) => ({ valor: x.id, rotulo: x.numero ?? "Processo sem número" }))} aoAlterar={setProcesso} rotuloVazio="Andamento interno (sem processo)" />}
          </GrupoCampo>
        )}
        <GrupoCampo rotulo="Data">{(p) => <Entrada {...p} type="date" value={data} onChange={(e) => setData(e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Hora">{(p) => <Entrada {...p} type="time" value={hora} onChange={(e) => setHora(e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Tipo" className="sm:col-span-2">
          {(p) => <SeletorCampo {...p} rotulo="Tipo de andamento" valor={tipo} opcoes={opcoesLista(config, "tipo_andamento").filter((o) => !o.desabilitada)} aoAlterar={setTipo} permitirVazio={false} />}
        </GrupoCampo>
        <GrupoCampo rotulo="Descrição" obrigatorio className="sm:col-span-2">
          {(p) => <AreaTexto {...p} data-autofoco rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Deferida a liminar para autorizar o cultivo…" />}
        </GrupoCampo>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <CaixaSelecao marcado={importante} aoAlterar={setImportante} rotulo="Marcar como importante" descricao="Destaca o andamento na linha do tempo." />
          {aoSugerirPrazo && pode("prazos.editar") && <CaixaSelecao marcado={criarPrazo} aoAlterar={setCriarPrazo} rotulo="Cadastrar um prazo a partir deste andamento" descricao="Abre o cadastro de prazo com a data de ciência preenchida." />}
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

export function ListaAndamentos({ casoId, aoSugerirPrazo }: { casoId: string; aoSugerirPrazo?: (s: SugestaoPrazo) => void }) {
  const config = useConfig();
  const { pode, perfil } = useAuth();
  const { excluir } = useGravacao();
  const processos = useProcessosCaso(casoId);
  const [novo, setNovo] = useState(false);
  const [filtroProcesso, setFiltroProcesso] = useState<string>("");
  const [soImportantes, setSoImportantes] = useState(false);
  const consulta = useQuery({
    queryKey: ["andamentos", "caso", casoId],
    queryFn: async () => (await executar(supabase().from("andamentos").select("*").eq("caso_id", casoId).order("data", { ascending: false }).limit(500))) as Andamento[],
  });
  const lista = useMemo(
    () => (consulta.data ?? []).filter((a) => (!filtroProcesso || (filtroProcesso === "sem" ? !a.processo_id : a.processo_id === filtroProcesso)) && (!soImportantes || a.importante)),
    [consulta.data, filtroProcesso, soImportantes],
  );
  const numeros = new Map((processos.data ?? []).map((p) => [p.id, p.numero ?? "sem número"]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-3">
          {(processos.data?.length ?? 0) > 1 && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
              Processo
              <Selecao value={filtroProcesso} onChange={(e) => setFiltroProcesso(e.target.value)} className="min-w-40 max-w-56">
                <option value="">Todos</option>
                {(processos.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.numero ?? "Sem número"}</option>)}
                <option value="sem">Sem processo (internos)</option>
              </Selecao>
            </label>
          )}
          <CaixaSelecao marcado={soImportantes} aoAlterar={setSoImportantes} rotulo="Só importantes" />
        </div>
        {pode("casos.editar") && (
          <Botao variante="primario" tamanho="sm" icone={<Gavel size={14} />} onClick={() => setNovo(true)}>
            Registrar andamento
          </Botao>
        )}
      </div>
      {consulta.isLoading ? (
        <Carregando />
      ) : consulta.error ? (
        <ErroCarga mensagem={mensagemErro(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />
      ) : lista.length === 0 ? (
        <Vazio compacto icone={<Gavel size={18} />} titulo="Nenhum andamento registrado" descricao="Registre despachos, decisões, intimações e demais movimentações." />
      ) : (
        <ol className="relative flex flex-col gap-3 border-l-2 border-crm-linha pl-5">
          {lista.map((a) => (
            <li key={a.id} className="relative">
              <span className={`absolute -left-[27px] top-3 h-3 w-3 rounded-full border-2 border-white ${a.importante ? "bg-crm-ouro" : "bg-crm-folha"}`} aria-hidden />
              <article className={`rounded-xl border bg-white p-3 ${a.importante ? "border-crm-ouro" : "border-crm-linha"}`}>
                <header className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold tabular-nums text-crm-tinta">{formatarDataHora(a.data)}</span>
                  <Pilula cor="#E9E1D0">{config.rotulo("tipo_andamento", a.tipo)}</Pilula>
                  {a.importante && <Selo tom="ouro" icone={<Star size={11} aria-hidden />}>Importante</Selo>}
                  {a.processo_id && <span className="tabular-nums text-crm-tinta-2">{numeros.get(a.processo_id)}</span>}
                  <span className="ml-auto text-crm-tinta-3">
                    {a.fonte === "integracao" ? "Integração" : `Manual · ${config.usuario(a.registrado_por)?.nome ?? "—"}`}
                  </span>
                  {pode("casos.editar") && (a.registrado_por === perfil?.id || perfil?.perfil_id === "admin") && (
                    <button
                      type="button"
                      className="rounded p-1 text-crm-tinta-3 hover:bg-crm-perigo-claro hover:text-crm-perigo"
                      aria-label="Excluir andamento"
                      onClick={async () => {
                        if (await confirmarSimples({ titulo: "Excluir andamento?", mensagem: "O registro sai da lista de andamentos (a linha do tempo mantém o histórico de que ele existiu).", confirmar: "Excluir", perigo: true }))
                          excluir("andamentos", a.id, { chaves: ["andamentos"] }).catch(() => undefined);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </header>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">{a.descricao}</p>
              </article>
            </li>
          ))}
        </ol>
      )}
      <FormAndamento aberto={novo} aoFechar={() => setNovo(false)} casoId={casoId} processos={processos.data ?? []} aoSugerirPrazo={aoSugerirPrazo} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Partes
// ---------------------------------------------------------------------------

function FormParte({ aberto, aoFechar, casoId, processos, parte }: { aberto: boolean; aoFechar: () => void; casoId: string; processos: Pick<Processo, "id" | "numero">[]; parte: Parte | null }) {
  const config = useConfig();
  const { invalidar } = useGravacao();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<string | null>("impetrante");
  const [documento, setDocumento] = useState("");
  const [processo, setProcesso] = useState<string | null>(null);
  const [cliente, setCliente] = useState<RegistroSelecionado | null>(null);
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setNome(parte?.nome ?? "");
    setTipo(parte?.tipo ?? "impetrante");
    setDocumento(parte?.documento ?? "");
    setProcesso(parte?.processo_id ?? null);
    setCliente(parte?.cliente_id ? { tipo: "cliente", id: parte.cliente_id, titulo: parte.nome } : null);
    setObs(parte?.observacoes ?? "");
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, parte?.id]);

  const salvar = async () => {
    if (!nome.trim()) return setErro("Informe o nome da parte.");
    const dados = { caso_id: casoId, nome: nome.trim(), tipo: tipo ?? "terceiro", documento: documento.trim() || null, processo_id: processo, cliente_id: cliente?.id ?? null, observacoes: obs.trim() || null };
    setSalvando(true);
    setErro(null);
    try {
      if (parte) await executar(supabase().from("partes").update(dados).eq("id", parte.id).select("id"));
      else await executar(supabase().from("partes").insert(dados).select("id"));
      invalidar("partes");
      aviso.sucesso(parte ? "Parte atualizada." : "Parte adicionada.");
      aoFechar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={parte ? "Editar parte" : "Adicionar parte"} rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" carregando={salvando} onClick={salvar}>Salvar</Botao></>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        {erro && <p role="alert" className="rounded-xl border-2 border-crm-perigo bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo sm:col-span-2">{erro}</p>}
        <GrupoCampo rotulo="Nome" obrigatorio className="sm:col-span-2">{(p) => <Entrada {...p} data-autofoco value={nome} onChange={(e) => setNome(e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Qualificação">{(p) => <SeletorCampo {...p} rotulo="Qualificação" valor={tipo} opcoes={opcoesLista(config, "tipo_parte").filter((o) => !o.desabilitada)} aoAlterar={setTipo} permitirVazio={false} />}</GrupoCampo>
        <GrupoCampo rotulo="CPF/CNPJ">{(p) => <Entrada {...p} value={documento} onChange={(e) => setDocumento(e.target.value)} />}</GrupoCampo>
        {processos.length > 0 && (
          <GrupoCampo rotulo="Processo" className="sm:col-span-2">
            {(p) => <SeletorCampo {...p} rotulo="Processo" valor={processo} opcoes={processos.map((x) => ({ valor: x.id, rotulo: x.numero ?? "Processo sem número" }))} aoAlterar={setProcesso} rotuloVazio="Todos os processos do caso" />}
          </GrupoCampo>
        )}
        <GrupoCampo rotulo="É cliente do escritório?" ajuda="Vincule quando a parte for um cliente cadastrado." className="sm:col-span-2">
          {(p) => <SeletorRegistro {...p} tipos={["cliente"]} valor={cliente} aoAlterar={(r) => { setCliente(r); if (r && !nome.trim()) setNome(r.titulo); }} />}
        </GrupoCampo>
        <GrupoCampo rotulo="Observações" className="sm:col-span-2">{(p) => <AreaTexto {...p} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />}</GrupoCampo>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

export function ListaPartes({ casoId, compacto }: { casoId: string; compacto?: boolean }) {
  const config = useConfig();
  const { pode } = useAuth();
  const { excluir } = useGravacao();
  const processos = useProcessosCaso(casoId);
  const [form, setForm] = useState<{ parte: Parte | null } | null>(null);
  const consulta = useQuery({
    queryKey: ["partes", "caso", casoId],
    queryFn: async () => (await executar(supabase().from("partes").select("*").eq("caso_id", casoId).order("created_at"))) as Parte[],
  });
  const lista = consulta.data ?? [];
  return (
    <div className="flex flex-col gap-2">
      {consulta.isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-crm-linha-forte bg-white px-3 py-3 text-sm text-crm-tinta-3">Nenhuma parte cadastrada.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-crm-linha rounded-xl border border-crm-linha bg-white">
          {lista.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-3 py-2">
              <Users size={14} className="shrink-0 text-crm-tinta-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.nome}</p>
                <p className="truncate text-xs text-crm-tinta-2">
                  {config.rotulo("tipo_parte", p.tipo)}
                  {p.documento && ` · ${formatarDocumento(p.documento)}`}
                  {p.cliente_id && " · cliente do escritório"}
                  {!compacto && p.observacoes && ` · ${p.observacoes}`}
                </p>
              </div>
              {pode("casos.editar") && (
                <Menu
                  rotulo={`Ações da parte ${p.nome}`}
                  itens={[
                    { rotulo: "Editar", icone: <Pencil size={15} />, aoSelecionar: () => setForm({ parte: p }) },
                    {
                      rotulo: "Remover",
                      icone: <Trash2 size={15} />,
                      perigo: true,
                      aoSelecionar: async () => {
                        if (await confirmarSimples({ titulo: "Remover parte?", mensagem: `${p.nome} será removida do caso.`, confirmar: "Remover", perigo: true })) excluir("partes", p.id, { chaves: ["partes"] }).catch(() => undefined);
                      },
                    },
                  ]}
                  gatilho={(g) => (
                    <button {...g} type="button" className="rounded p-1 text-xs font-semibold text-crm-tinta-2 hover:bg-crm-suave" aria-label={`Ações da parte ${p.nome}`}>
                      <Pencil size={13} />
                    </button>
                  )}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {pode("casos.editar") && (
        <Botao tamanho="sm" variante="fantasma" icone={<UserPlus size={14} />} onClick={() => setForm({ parte: null })} className="self-start">
          Adicionar parte
        </Botao>
      )}
      <FormParte aberto={Boolean(form)} aoFechar={() => setForm(null)} casoId={casoId} processos={processos.data ?? []} parte={form?.parte ?? null} />
    </div>
  );
}
