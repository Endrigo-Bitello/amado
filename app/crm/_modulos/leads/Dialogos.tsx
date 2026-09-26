"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { opcoesLista, opcoesTiposDemanda, opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { useGravacao } from "../../_lib/dados";
import { documentoValido } from "../../_lib/formatos";
import { navegar } from "../../_lib/rotas";
import type { Lead } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { AreaTexto, CaixaSelecao, Entrada, GrupoCampo, Selecao } from "../../_ui/Campos";
import { SeletorCampo } from "../../_ui/Seletores";
import { Modal } from "../../_ui/Sobreposicoes";
import { AvisoDuplicados, useDuplicados } from "../../_componentes/Duplicados";

// ---------------------------------------------------------------------------
// Motivo de perda (obrigatório para etapas de "não convertido")
// ---------------------------------------------------------------------------

export function DialogoMotivoPerda({
  pedido,
  aoFechar,
}: {
  pedido: { lead: Lead; etapaId: string } | null;
  aoFechar: () => void;
}) {
  const config = useConfig();
  const { atualizar } = useGravacao();
  const [motivo, setMotivo] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    setMotivo(null);
    setDetalhe("");
  }, [pedido]);
  if (!pedido) return null;
  const etapa = config.etapa(pedido.etapaId);
  const salvar = async () => {
    if (!motivo) return;
    setSalvando(true);
    try {
      await atualizar(
        "leads",
        pedido.lead.id,
        { etapa_id: pedido.etapaId, motivo_perda: motivo, motivo_perda_detalhe: detalhe.trim() || null },
        { chaves: ["leads", "painel", "eventos"], mensagemSucesso: `Lead movido para “${etapa?.nome}”.` },
      );
      aoFechar();
    } catch {
      /* aviso exibido */
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="sm"
      titulo={`Mover para “${etapa?.nome ?? "Não convertido"}”`}
      descricao={`Registre o motivo para ${pedido.lead.nome}. Ele alimenta o relatório de conversão.`}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={salvar} carregando={salvando} disabled={!motivo}>
            Confirmar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <GrupoCampo rotulo="Motivo" obrigatorio>
          {(p) => <SeletorCampo {...p} rotulo="Motivo" valor={motivo} opcoes={opcoesLista(config, "motivo_perda").filter((o) => !o.desabilitada)} aoAlterar={setMotivo} permitirVazio={false} />}
        </GrupoCampo>
        <GrupoCampo rotulo="Detalhes (opcional)">{(p) => <AreaTexto {...p} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} />}</GrupoCampo>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Cadastro manual de lead com detecção de duplicidade
// ---------------------------------------------------------------------------

export function FormLead({ aberto, aoFechar, etapaInicial }: { aberto: boolean; aoFechar: () => void; etapaInicial?: string | null }) {
  const config = useConfig();
  const { perfil } = useAuth();
  const { inserir } = useGravacao();
  const [d, setD] = useState({ nome: "", whatsapp: "", email: "", estado: "", municipio: "", origem: "whatsapp", tipo_demanda_id: null as string | null, responsavel_id: null as string | null, observacoes: "", proxima_acao: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const dup = useDuplicados({ telefone: d.whatsapp, email: d.email }, aberto);
  useEffect(() => {
    if (aberto) {
      setD({ nome: "", whatsapp: "", email: "", estado: "", municipio: "", origem: "whatsapp", tipo_demanda_id: null, responsavel_id: perfil?.id ?? null, observacoes: "", proxima_acao: "" });
      setErro(null);
    }
  }, [aberto, perfil?.id]);
  const campo = (k: keyof typeof d) => (v: string | null) => setD((x) => ({ ...x, [k]: v }));

  const salvar = async () => {
    if (d.nome.trim().length < 2) return setErro("Informe o nome.");
    setSalvando(true);
    try {
      const criado = await inserir<Lead>(
        "leads",
        {
          nome: d.nome.trim(),
          whatsapp: d.whatsapp.trim() || null,
          email: d.email.trim() || null,
          estado: d.estado.trim().toUpperCase() || null,
          municipio: d.municipio.trim() || null,
          origem: d.origem,
          tipo_demanda_id: d.tipo_demanda_id,
          responsavel_id: d.responsavel_id,
          observacoes: d.observacoes.trim() || null,
          proxima_acao: d.proxima_acao.trim() || null,
          etapa_id: etapaInicial ?? undefined,
        },
        { chaves: ["leads", "painel"], mensagemSucesso: "Lead cadastrado." },
      );
      aoFechar();
      navegar(`/crm/leads?item=${criado.id}`, { manterRolagem: true });
    } catch {
      /* aviso exibido */
    } finally {
      setSalvando(false);
    }
  };
  const temDuplicado = (dup.data?.leads.length ?? 0) + (dup.data?.clientes.length ?? 0) > 0;

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo lead"
      descricao="Cadastro manual (WhatsApp, indicação, telefone…). Leads do quiz entram automaticamente."
      largura="md"
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={salvar} carregando={salvando}>
            {temDuplicado ? "Cadastrar mesmo assim" : "Cadastrar lead"}
          </Botao>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <GrupoCampo rotulo="Nome" obrigatorio erro={erro} className="sm:col-span-2">
          {(p) => <Entrada {...p} data-autofoco value={d.nome} onChange={(e) => campo("nome")(e.target.value)} />}
        </GrupoCampo>
        <GrupoCampo rotulo="WhatsApp">{(p) => <Entrada {...p} type="tel" inputMode="tel" value={d.whatsapp} onChange={(e) => campo("whatsapp")(e.target.value)} placeholder="(48) 99999-9999" />}</GrupoCampo>
        <GrupoCampo rotulo="E-mail">{(p) => <Entrada {...p} type="email" value={d.email} onChange={(e) => campo("email")(e.target.value)} />}</GrupoCampo>
        {temDuplicado && (
          <div className="sm:col-span-2">
            <AvisoDuplicados dados={{ telefone: d.whatsapp, email: d.email }} />
          </div>
        )}
        <GrupoCampo rotulo="UF">{(p) => <Entrada {...p} maxLength={2} value={d.estado} onChange={(e) => campo("estado")(e.target.value)} placeholder="SC" />}</GrupoCampo>
        <GrupoCampo rotulo="Município">{(p) => <Entrada {...p} value={d.municipio} onChange={(e) => campo("municipio")(e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Origem">{(p) => <SeletorCampo {...p} rotulo="Origem" valor={d.origem} opcoes={opcoesLista(config, "origem").filter((o) => !o.desabilitada)} aoAlterar={(v) => campo("origem")(v ?? "manual")} permitirVazio={false} />}</GrupoCampo>
        <GrupoCampo rotulo="Tipo de demanda">{(p) => <SeletorCampo {...p} rotulo="Tipo de demanda" valor={d.tipo_demanda_id} opcoes={opcoesTiposDemanda(config).filter((o) => !o.desabilitada)} aoAlterar={campo("tipo_demanda_id")} />}</GrupoCampo>
        <GrupoCampo rotulo="Responsável">{(p) => <SeletorCampo {...p} rotulo="Responsável" valor={d.responsavel_id} estilo="pessoa" opcoes={opcoesUsuarios(config, false)} aoAlterar={campo("responsavel_id")} />}</GrupoCampo>
        <GrupoCampo rotulo="Próxima ação">{(p) => <Entrada {...p} value={d.proxima_acao} onChange={(e) => campo("proxima_acao")(e.target.value)} placeholder="Ex.: ligar amanhã cedo" />}</GrupoCampo>
        <GrupoCampo rotulo="Observações" className="sm:col-span-2">{(p) => <AreaTexto {...p} value={d.observacoes} onChange={(e) => campo("observacoes")(e.target.value)} />}</GrupoCampo>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Conversão de lead em cliente (sem perda de informações) + primeiro caso
// ---------------------------------------------------------------------------

export function ConverterLead({ lead, aoFechar }: { lead: Lead | null; aoFechar: () => void }) {
  const config = useConfig();
  const { pode } = useAuth();
  const { rpc, invalidar } = useGravacao();
  const [d, setD] = useState<Record<string, string>>({});
  const [representante, setRepresentante] = useState(false);
  const [existente, setExistente] = useState<string | null>(null);
  const [criarCaso, setCriarCaso] = useState(true);
  const [caso, setCaso] = useState({ titulo: "", tipo_demanda_id: null as string | null, natureza: "interno", aplicar_checklist: true, aplicar_tarefas: true });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const dup = useDuplicados({ telefone: lead?.whatsapp, email: lead?.email, cpf: d.cpf_cnpj, ignorar: lead?.id }, Boolean(lead));

  useEffect(() => {
    if (!lead) return;
    setD({ nome: lead.nome, cpf_cnpj: lead.cpf ?? "", email: lead.email ?? "", whatsapp: lead.whatsapp ?? "", profissao: lead.profissao ?? "", cidade: lead.municipio ?? "", uf: lead.estado ?? "", data_nascimento: "", estado_civil: "", nacionalidade: "brasileira", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", representante_nome: "", representante_cpf: "", representante_parentesco: "", representante_contato: "" });
    setRepresentante(false);
    setExistente(null);
    setCriarCaso(pode("casos.editar"));
    const tipo = config.tipo(lead.tipo_demanda_id);
    setCaso({ titulo: tipo?.nome ?? "", tipo_demanda_id: lead.tipo_demanda_id, natureza: "interno", aplicar_checklist: true, aplicar_tarefas: true });
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  if (!lead) return null;
  const clientesExistentes = dup.data?.clientes ?? [];
  const campo = (k: string) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));

  const converter = async () => {
    if (!existente) {
      if (!d.nome?.trim()) return setErro("Informe o nome do cliente.");
      if (d.cpf_cnpj && !documentoValido(d.cpf_cnpj)) return setErro("CPF/CNPJ inválido. Confira os dígitos ou deixe em branco.");
    }
    setSalvando(true);
    setErro(null);
    try {
      const r = await rpc<{ cliente_id: string; caso_id: string | null }>(
        "converter_lead",
        {
          p_lead: lead.id,
          p_dados: {
            ...(existente ? { cliente_existente_id: existente } : { ...d, possui_representante: representante }),
            ...(criarCaso && pode("casos.editar") ? { caso: { ...caso, titulo: caso.titulo || config.tipo(caso.tipo_demanda_id)?.nome || "Novo caso" } } : {}),
          },
        },
        { chaves: ["leads", "clientes", "casos", "documentos", "tarefas", "eventos", "painel"], silencioso: true },
      );
      invalidar("leads", "clientes", "casos");
      aoFechar();
      navegar(r.caso_id ? `/crm/casos/${r.caso_id}` : `/crm/clientes/${r.cliente_id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível converter.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura="lg"
      titulo={`Converter ${lead.nome} em cliente`}
      descricao="O histórico do atendimento (quiz, contatos, tarefas, documentos e comentários) passa a aparecer na ficha do cliente. O lead é mantido e marcado como contratado."
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={converter} carregando={salvando}>
            Converter em cliente
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {erro && (
          <p role="alert" className="rounded-xl border-2 border-crm-perigo bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo">
            {erro}
          </p>
        )}
        {clientesExistentes.length > 0 && (
          <fieldset className="rounded-xl border-2 border-[#F3D19A] bg-crm-alerta-claro p-3">
            <legend className="px-1 text-sm font-bold text-crm-alerta">Já existe cliente com os mesmos dados</legend>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="destino" checked={!existente} onChange={() => setExistente(null)} className="accent-[#263A2D]" /> Criar um novo cliente
              </label>
              {clientesExistentes.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="destino" checked={existente === c.id} onChange={() => setExistente(c.id)} className="accent-[#263A2D]" />
                  Vincular a <strong>{c.codigo} — {c.nome}</strong> <span className="text-xs text-crm-tinta-2">(mesmo {c.motivos.join(", ")})</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {!existente && (
          <div className="grid gap-4 sm:grid-cols-2">
            <GrupoCampo rotulo="Nome completo" obrigatorio className="sm:col-span-2">{(p) => <Entrada {...p} value={d.nome ?? ""} onChange={campo("nome")} />}</GrupoCampo>
            <GrupoCampo rotulo="CPF ou CNPJ" ajuda="Usado para evitar clientes duplicados.">{(p) => <Entrada {...p} value={d.cpf_cnpj ?? ""} onChange={campo("cpf_cnpj")} />}</GrupoCampo>
            <GrupoCampo rotulo="Data de nascimento">{(p) => <Entrada {...p} type="date" value={d.data_nascimento ?? ""} onChange={campo("data_nascimento")} />}</GrupoCampo>
            <GrupoCampo rotulo="WhatsApp">{(p) => <Entrada {...p} value={d.whatsapp ?? ""} onChange={campo("whatsapp")} />}</GrupoCampo>
            <GrupoCampo rotulo="E-mail">{(p) => <Entrada {...p} type="email" value={d.email ?? ""} onChange={campo("email")} />}</GrupoCampo>
            <GrupoCampo rotulo="Estado civil">
              {(p) => (
                <Selecao {...p} value={d.estado_civil ?? ""} onChange={campo("estado_civil")}>
                  <option value="">—</option>
                  {["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Selecao>
              )}
            </GrupoCampo>
            <GrupoCampo rotulo="Profissão">{(p) => <Entrada {...p} value={d.profissao ?? ""} onChange={campo("profissao")} />}</GrupoCampo>
            <GrupoCampo rotulo="CEP">{(p) => <Entrada {...p} value={d.cep ?? ""} onChange={campo("cep")} inputMode="numeric" />}</GrupoCampo>
            <GrupoCampo rotulo="Endereço">{(p) => <Entrada {...p} value={d.logradouro ?? ""} onChange={campo("logradouro")} />}</GrupoCampo>
            <GrupoCampo rotulo="Número">{(p) => <Entrada {...p} value={d.numero ?? ""} onChange={campo("numero")} />}</GrupoCampo>
            <GrupoCampo rotulo="Bairro">{(p) => <Entrada {...p} value={d.bairro ?? ""} onChange={campo("bairro")} />}</GrupoCampo>
            <GrupoCampo rotulo="Cidade">{(p) => <Entrada {...p} value={d.cidade ?? ""} onChange={campo("cidade")} />}</GrupoCampo>
            <GrupoCampo rotulo="UF">{(p) => <Entrada {...p} maxLength={2} value={d.uf ?? ""} onChange={campo("uf")} />}</GrupoCampo>
            <div className="sm:col-span-2">
              <CaixaSelecao marcado={representante} aoAlterar={setRepresentante} rotulo="Possui representante legal" descricao="Paciente menor de idade ou representado (ativa documentos do responsável no checklist)." />
            </div>
            {representante && (
              <>
                <GrupoCampo rotulo="Nome do representante">{(p) => <Entrada {...p} value={d.representante_nome ?? ""} onChange={campo("representante_nome")} />}</GrupoCampo>
                <GrupoCampo rotulo="CPF do representante">{(p) => <Entrada {...p} value={d.representante_cpf ?? ""} onChange={campo("representante_cpf")} />}</GrupoCampo>
                <GrupoCampo rotulo="Parentesco / vínculo">{(p) => <Entrada {...p} value={d.representante_parentesco ?? ""} onChange={campo("representante_parentesco")} />}</GrupoCampo>
                <GrupoCampo rotulo="Contato do representante">{(p) => <Entrada {...p} value={d.representante_contato ?? ""} onChange={campo("representante_contato")} />}</GrupoCampo>
              </>
            )}
          </div>
        )}
        {pode("casos.editar") && (
          <fieldset className="rounded-xl border border-crm-linha bg-crm-fundo p-4">
            <legend className="px-1">
              <CaixaSelecao marcado={criarCaso} aoAlterar={setCriarCaso} rotulo={<strong>Abrir o primeiro caso agora</strong>} />
            </legend>
            {criarCaso && (
              <div className="grid gap-4 sm:grid-cols-2">
                <GrupoCampo rotulo="Tipo de demanda">
                  {(p) => (
                    <SeletorCampo {...p} rotulo="Tipo de demanda" valor={caso.tipo_demanda_id} opcoes={opcoesTiposDemanda(config).filter((o) => !o.desabilitada)} aoAlterar={(v) => setCaso((c) => ({ ...c, tipo_demanda_id: v, titulo: c.titulo || config.tipo(v)?.nome || "" }))} />
                  )}
                </GrupoCampo>
                <GrupoCampo rotulo="Título do caso">{(p) => <Entrada {...p} value={caso.titulo} onChange={(e) => setCaso((c) => ({ ...c, titulo: e.target.value }))} />}</GrupoCampo>
                <GrupoCampo rotulo="Natureza">
                  {(p) => (
                    <Selecao {...p} value={caso.natureza} onChange={(e) => setCaso((c) => ({ ...c, natureza: e.target.value }))}>
                      <option value="interno">Caso interno (ainda sem processo)</option>
                      <option value="judicial">Processo judicial</option>
                    </Selecao>
                  )}
                </GrupoCampo>
                <div className="flex flex-col justify-end gap-2">
                  <CaixaSelecao marcado={caso.aplicar_checklist} aoAlterar={(v) => setCaso((c) => ({ ...c, aplicar_checklist: v }))} rotulo="Aplicar checklist do tipo de demanda" />
                  <CaixaSelecao marcado={caso.aplicar_tarefas} aoAlterar={(v) => setCaso((c) => ({ ...c, aplicar_tarefas: v }))} rotulo="Criar tarefas de preparação da ação" />
                </div>
              </div>
            )}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
