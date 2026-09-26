"use client";

import { useQuery } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowLeft, FilePlus2, MessageCircle, MoreHorizontal, Phone, Scale, ShieldCheck, Trash2, Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso } from "../../_lib/avisos";
import { colunaEtiquetas, colunaResponsavel, opcoesLista } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { formatarData, formatarDataHora } from "../../_lib/datas";
import { ErroCrm, executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { documentoValido, formatarDocumento, formatarMoeda, formatarTelefone, linkWhatsApp } from "../../_lib/formatos";
import { Link, navegar, useRota } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import type { Caso, Cliente, Consentimento, Lead, Processo } from "../../_lib/tipos";
import type { ColunaQuadro } from "../../_quadro/tipos";
import { Abas } from "../../_ui/Abas";
import { Botao } from "../../_ui/Botao";
import { confirmarSimples } from "../../_ui/Dialogos";
import { Menu } from "../../_ui/Sobreposicoes";
import { Carregando, ErroCarga, Pilula, Selo, Vazio } from "../../_ui/Visuais";
import { ListaArquivos } from "../../_componentes/Arquivos";
import { Atividade } from "../../_componentes/Atividade";
import { ChecklistDocumentos } from "../../_componentes/ChecklistDocumentos";
import { Midias } from "../../_componentes/Midias";
import { CamposPersonalizadosFicha, ListaPropriedades, SecaoFicha } from "../../_componentes/Propriedades";
import { RegistrarContato } from "../../_componentes/RegistrarContato";
import { CompromissosRelacionados, TarefasRelacionadas } from "../../_componentes/Relacionados";
import { STATUS_CASO } from "../casos/constantes";
import { FormCaso } from "../casos/FormCaso";
import { FinanceiroEntidade, resumoFinanceiro, useFinanceiroEntidade } from "../financeiro/FinanceiroEntidade";
import { DadosClinicos } from "./DadosClinicos";

type CasoResumo = Caso & { processos: Pick<Processo, "id" | "numero" | "tribunal" | "principal">[] };


export default function FichaCliente({ id }: { id: string }) {
  const { pode } = useAuth();
  const config = useConfig();
  const { parametro, definirParametros } = useRota();
  const { atualizar, excluir } = useGravacao();
  const aba = parametro("aba") ?? "visao";
  const [novoCaso, setNovoCaso] = useState(false);
  const [contato, setContato] = useState(false);

  const cliente = useQuery({
    queryKey: ["clientes", "ficha", id],
    queryFn: async () => (await executar(supabase().from("clientes").select("*").eq("id", id).maybeSingle())) as Cliente | null,
  });
  const casos = useQuery({
    queryKey: ["casos", "cliente", id],
    queryFn: async () => (await executar(supabase().from("casos").select("*, processos(id, numero, tribunal, principal)").eq("cliente_id", id).order("created_at", { ascending: false }))) as unknown as CasoResumo[],
  });
  const c = cliente.data;
  const leadOrigem = useQuery({
    queryKey: ["leads", "origem", c?.lead_origem_id],
    enabled: Boolean(c?.lead_origem_id) && pode("leads.ver"),
    queryFn: async () => (await executar(supabase().from("leads").select("id, codigo, nome, created_at, origem").eq("id", c!.lead_origem_id!).maybeSingle())) as Pick<Lead, "id" | "codigo" | "nome" | "created_at" | "origem"> | null,
  });

  const salvar = useCallback(
    async (_c: Cliente, alt: Record<string, unknown>) => {
      await atualizar("clientes", id, alt, { chaves: ["clientes"] });
    },
    [atualizar, id],
  );
  const ed = pode("clientes.editar") ? salvar : undefined;

  const campos = useMemo(() => {
    const t = (idc: keyof Cliente, titulo: string, tipo: ColunaQuadro<Cliente>["tipo"] = "texto", extra: Partial<ColunaQuadro<Cliente>> = {}): ColunaQuadro<Cliente> => ({
      id: idc,
      titulo,
      tipo,
      valor: (x) => x[idc] as unknown,
      editar: ed ? (x, v) => salvar(x, { [idc]: v }) : undefined,
      ...extra,
    });
    return {
      pessoais: [
        t("nome", "Nome"),
        t("nome_social", "Nome social"),
        t("tipo_pessoa", "Tipo de pessoa", "selecao", { opcoes: [{ valor: "PF", rotulo: "Pessoa física", cor: "#3E5C8A" }, { valor: "PJ", rotulo: "Pessoa jurídica", cor: "#A68658" }] }),
        t("cpf_cnpj", "CPF/CNPJ", "texto", {
          exibir: (x) => <span className="tabular-nums">{formatarDocumento(x.cpf_cnpj) || "—"}</span>,
          editar: ed
            ? async (x, v) => {
                if (v && !documentoValido(String(v))) {
                  aviso.erro("CPF/CNPJ inválido. Confira os dígitos.");
                  throw new ErroCrm("CPF/CNPJ inválido");
                }
                await salvar(x, { cpf_cnpj: v });
              }
            : undefined,
        }),
        t("rg", "RG"),
        t("data_nascimento", "Data de nascimento", "data"),
        t("estado_civil", "Estado civil"),
        t("nacionalidade", "Nacionalidade"),
        t("profissao", "Profissão"),
        colunaResponsavel<Cliente>(config, ed),
        t("origem", "Origem", "selecao", { opcoes: opcoesLista(config, "origem"), editar: ed ? (x, v) => salvar(x, { origem: v ?? "manual" }) : undefined }),
        t("status", "Situação", "selecao", { opcoes: [{ valor: "ativo", rotulo: "Ativo", cor: "#3D7B3E" }, { valor: "inativo", rotulo: "Inativo", cor: "#A1A1AA" }], editar: ed ? (x, v) => salvar(x, { status: v ?? "ativo" }) : undefined }),
        colunaEtiquetas<Cliente>(config, "cliente", ed),
      ],
      contato: [t("whatsapp", "WhatsApp", "telefone"), t("telefone_secundario", "Telefone secundário", "telefone"), t("email", "E-mail", "email")],
      endereco: [t("cep", "CEP"), t("logradouro", "Endereço"), t("numero", "Número"), t("complemento", "Complemento"), t("bairro", "Bairro"), t("cidade", "Cidade"), t("uf", "UF")],
      representante: [
        t("possui_representante", "Possui representante legal", "checkbox"),
        t("representante_nome", "Nome do representante"),
        t("representante_cpf", "CPF do representante"),
        t("representante_parentesco", "Parentesco / vínculo"),
        t("representante_contato", "Contato do representante", "telefone"),
      ],
      observacoes: [t("observacoes", "Observações", "texto_longo", { exibir: (x) => <span className="line-clamp-4 whitespace-pre-wrap">{x.observacoes || "—"}</span> })],
    };
  }, [config, ed, salvar]);

  if (cliente.isLoading) return <Carregando />;
  if (cliente.error) return <ErroCarga mensagem={mensagemErro(cliente.error)} aoTentarNovamente={() => cliente.refetch()} />;
  if (!c) return <Vazio titulo="Cliente não encontrado" descricao="O cliente pode ter sido excluído ou você não tem permissão de acesso." acao={<Link href="/crm/clientes" className="font-semibold text-crm-folha underline">Voltar para clientes</Link>} />;

  const listaCasos = casos.data ?? [];
  const whats = linkWhatsApp(c.whatsapp, `Olá, ${c.nome.split(" ")[0]}! Aqui é do escritório Amado & Amado Jr. Advogados.`);
  const casosOpcoes = listaCasos.map((k) => ({ id: k.id, titulo: `${k.codigo} · ${k.titulo}` }));

  const arquivar = async () => {
    const arquivado = Boolean(c.arquivado_em);
    if (!arquivado && !(await confirmarSimples({ titulo: "Arquivar cliente?", mensagem: "O cliente sai dos quadros, mas a ficha continua acessível pela busca e em “Arquivados”. Casos e financeiro não são alterados.", confirmar: "Arquivar" }))) return;
    await atualizar("clientes", c.id, { arquivado_em: arquivado ? null : new Date().toISOString() }, { chaves: ["clientes"], mensagemSucesso: arquivado ? "Cliente restaurado." : "Cliente arquivado." }).catch(() => undefined);
  };
  const excluirDefinitivo = async () => {
    if (!(await confirmarSimples({ titulo: "Excluir cliente definitivamente?", mensagem: "Só é possível excluir clientes sem casos e sem lançamentos financeiros. Prefira arquivar. Esta ação não pode ser desfeita.", confirmar: "Excluir definitivamente", perigo: true }))) return;
    try {
      await excluir("clientes", c.id, { mensagemSucesso: "Cliente excluído." });
      navegar("/crm/clientes");
    } catch {
      /* aviso exibido (ex.: vínculos existentes) */
    }
  };

  const abas = [
    { id: "visao", rotulo: "Visão geral" },
    { id: "casos", rotulo: "Casos", contador: listaCasos.length },
    ...(pode("saude.ver_todos") || pode("saude.ver_atribuidos") ? [{ id: "clinico", rotulo: "Dados clínicos" }] : []),
    ...(pode("documentos.ver") ? [{ id: "documentos", rotulo: "Documentos" }, { id: "midias", rotulo: "Vídeos" }] : []),
    ...(pode("financeiro.ver") ? [{ id: "financeiro", rotulo: "Financeiro" }] : []),
    { id: "atividade", rotulo: "Histórico" },
    { id: "tarefas", rotulo: "Tarefas e agenda" },
    ...(pode("documentos.ver") ? [{ id: "arquivos", rotulo: "Arquivos" }] : []),
    ...(c.lead_origem_id && pode("leads.ver") ? [{ id: "atendimento", rotulo: "Atendimento e LGPD" }] : []),
  ];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <Link href="/crm/clientes" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-crm-tinta-2 hover:text-crm-tinta">
        <ArrowLeft size={15} aria-hidden /> {config.nome("clientes")}
      </Link>

      <header className="flex flex-col gap-4 rounded-2xl border-2 border-crm-tinta bg-white p-5 shadow-crm-bruto-verde lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-crm-verde text-crm-ouro-claro">
            <Users size={22} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-crm-tinta-3">
              {config.nome("cliente")} {c.codigo} · desde {formatarData(c.created_at.slice(0, 10))}
            </p>
            <h1 className="font-serif text-2xl font-semibold leading-tight">{c.nome}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Pilula cor={c.status === "ativo" ? "#3D7B3E" : "#A1A1AA"}>{c.status === "ativo" ? "Ativo" : "Inativo"}</Pilula>
              {c.arquivado_em && <Selo>Arquivado</Selo>}
              {c.possui_representante && <Selo tom="info">Com representante legal</Selo>}
              {c.cpf_cnpj && <span className="text-xs tabular-nums text-crm-tinta-2">{formatarDocumento(c.cpf_cnpj)}</span>}
              {c.whatsapp && <span className="text-xs text-crm-tinta-2">· {formatarTelefone(c.whatsapp)}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pode("casos.editar") && (
            <Botao variante="primario" tamanho="sm" icone={<Scale size={14} />} onClick={() => setNovoCaso(true)}>
              Novo caso
            </Botao>
          )}
          {pode("clientes.editar") && (
            <Botao tamanho="sm" icone={<Phone size={14} />} onClick={() => setContato(true)}>
              Registrar contato
            </Botao>
          )}
          {whats && (
            <a href={whats} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-crm-linha-forte bg-white px-3 text-[13px] font-semibold hover:bg-crm-suave">
              <MessageCircle size={14} aria-hidden /> WhatsApp
            </a>
          )}
          <Menu
            rotulo="Mais ações do cliente"
            itens={[
              ...(pode("clientes.editar") ? [{ rotulo: c.arquivado_em ? "Restaurar cliente" : "Arquivar cliente", icone: c.arquivado_em ? <ArchiveRestore size={15} /> : <Archive size={15} />, aoSelecionar: arquivar }] : []),
              ...(pode("clientes.excluir") ? [{ rotulo: "Excluir definitivamente", icone: <Trash2 size={15} />, aoSelecionar: excluirDefinitivo, perigo: true, separadorAntes: true }] : []),
            ]}
            gatilho={(p) => (
              <button {...p} type="button" className="rounded-full border border-crm-linha-forte bg-white p-1.5 text-crm-tinta-2 hover:bg-crm-suave" aria-label="Mais ações">
                <MoreHorizontal size={16} />
              </button>
            )}
          />
        </div>
      </header>

      <Abas abas={abas} ativa={aba} aoTrocar={(a) => definirParametros({ aba: a === "visao" ? null : a }, { substituir: true })} rotulo="Seções da ficha do cliente" />

      <div role="tabpanel">
        {aba === "visao" && (
          <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <div className="flex flex-col gap-5">
              <SecaoFicha titulo="Dados pessoais"><ListaPropriedades item={c} rotuloItem={c.nome} colunas={campos.pessoais} /></SecaoFicha>
              <SecaoFicha titulo="Contato"><ListaPropriedades item={c} rotuloItem={c.nome} colunas={campos.contato} /></SecaoFicha>
              <SecaoFicha titulo="Endereço"><ListaPropriedades item={c} rotuloItem={c.nome} colunas={campos.endereco} /></SecaoFicha>
              <SecaoFicha titulo="Representante legal" descricao="Para pacientes menores de idade ou representados.">
                <ListaPropriedades item={c} rotuloItem={c.nome} colunas={c.possui_representante ? campos.representante : campos.representante.slice(0, 1)} />
              </SecaoFicha>
              <SecaoFicha titulo="Observações"><ListaPropriedades item={c} rotuloItem={c.nome} colunas={campos.observacoes} /></SecaoFicha>
              <CamposPersonalizadosFicha entidade="cliente" item={c} rotuloItem={c.nome} />
            </div>
            <aside className="flex flex-col gap-5">
              <SecaoFicha
                titulo={`Casos (${listaCasos.length})`}
                acoes={pode("casos.editar") && <Botao tamanho="sm" variante="fantasma" icone={<FilePlus2 size={14} />} onClick={() => setNovoCaso(true)}>Novo</Botao>}
              >
                <ListaCasos casos={listaCasos} carregando={casos.isLoading} />
              </SecaoFicha>
              {pode("financeiro.ver") && <ResumoFinanceiroCliente clienteId={c.id} />}
              {leadOrigem.data && (
                <SecaoFicha titulo="Origem">
                  <p className="rounded-xl border border-crm-linha bg-white p-3 text-sm">
                    Convertido do lead{" "}
                    <Link href={`/crm/leads?item=${leadOrigem.data.id}`} className="font-semibold text-crm-info underline">
                      {leadOrigem.data.codigo}
                    </Link>{" "}
                    ({config.rotulo("origem", leadOrigem.data.origem)}, entrada em {formatarData(leadOrigem.data.created_at.slice(0, 10))}).
                  </p>
                </SecaoFicha>
              )}
            </aside>
          </div>
        )}
        {aba === "casos" && (
          <div className="flex flex-col gap-3">
            {pode("casos.editar") && (
              <Botao variante="primario" tamanho="sm" icone={<Scale size={14} />} onClick={() => setNovoCaso(true)} className="self-start">
                Novo caso para {c.nome.split(" ")[0]}
              </Botao>
            )}
            <ListaCasos casos={listaCasos} carregando={casos.isLoading} detalhado />
          </div>
        )}
        {aba === "clinico" && <DadosClinicos clienteId={c.id} />}
        {aba === "documentos" && (
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-bold">Documentos gerais do cliente</h2>
              <p className="text-xs text-crm-tinta-3">Documentos que não pertencem a um caso específico. Os checklists de cada caso ficam na ficha do caso.</p>
              <ChecklistDocumentos escopo={{ cliente_id: c.id }} contato={{ nome: c.nome, whatsapp: c.whatsapp }} />
            </section>
            {listaCasos.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-bold">Checklists dos casos</h2>
                <ul className="flex flex-col gap-1.5">
                  {listaCasos.map((k) => (
                    <li key={k.id}>
                      <Link href={`/crm/casos/${k.id}?aba=documentos`} className="flex items-center gap-2 rounded-xl border border-crm-linha bg-white px-3 py-2 text-sm hover:bg-crm-suave">
                        <span className="font-mono text-xs text-crm-tinta-3">{k.codigo}</span>
                        <span className="flex-1 font-semibold">{k.titulo}</span>
                        <span className="text-xs text-crm-folha">Abrir documentos →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
        {aba === "midias" && <Midias clienteId={c.id} />}
        {aba === "financeiro" && <FinanceiroEntidade cliente={{ id: c.id, nome: c.nome }} casos={casosOpcoes} />}
        {aba === "atividade" && <Atividade entidade="cliente" registroId={c.id} eventosPor={{ coluna: "cliente_id", id: c.id }} acoesExtras={pode("clientes.editar") && <Botao tamanho="sm" icone={<Phone size={14} />} onClick={() => setContato(true)}>Registrar contato</Botao>} />}
        {aba === "tarefas" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <TarefasRelacionadas coluna="cliente_id" id={c.id} vinculo={{ cliente: { id: c.id, titulo: c.nome } }} />
            <CompromissosRelacionados coluna="cliente_id" id={c.id} vinculo={{ cliente: { id: c.id, titulo: c.nome } }} />
          </div>
        )}
        {aba === "arquivos" && <ListaArquivos escopo={{ cliente_id: c.id }} filtroColuna="cliente_id" />}
        {aba === "atendimento" && c.lead_origem_id && <AtendimentoOrigem leadId={c.lead_origem_id} />}
      </div>

      <FormCaso aberto={novoCaso} aoFechar={() => setNovoCaso(false)} cliente={{ id: c.id, nome: c.nome }} />
      <RegistrarContato aberto={contato} aoFechar={() => setContato(false)} vinculo={{ cliente_id: c.id }} />
    </div>
  );
}

function ListaCasos({ casos, carregando, detalhado }: { casos: CasoResumo[]; carregando: boolean; detalhado?: boolean }) {
  const config = useConfig();
  if (carregando) return <Carregando />;
  if (casos.length === 0) return <Vazio compacto titulo="Nenhum caso" descricao="Crie o primeiro caso deste cliente." />;
  return (
    <ul className="flex flex-col divide-y divide-crm-linha rounded-xl border border-crm-linha bg-white">
      {casos.map((k) => {
        const principal = k.processos.find((p) => p.principal) ?? k.processos[0];
        const fase = config.etapa(k.fase_id);
        return (
          <li key={k.id}>
            <Link href={`/crm/casos/${k.id}`} className="flex flex-col gap-1 px-3 py-2.5 hover:bg-crm-suave">
              <span className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-crm-tinta-3">{k.codigo}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{k.titulo}</span>
                <Pilula cor={STATUS_CASO[k.status]?.cor}>{STATUS_CASO[k.status]?.rotulo}</Pilula>
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-crm-tinta-2">
                <Selo tom={k.natureza === "judicial" ? "info" : "neutro"}>{k.natureza === "judicial" ? "Processo judicial" : "Caso interno"}</Selo>
                {fase && <span>{fase.nome}</span>}
                {principal?.numero ? <span className="tabular-nums">· {principal.numero}</span> : k.natureza === "judicial" && <span className="font-semibold text-crm-alerta">· sem nº do processo</span>}
                {detalhado && config.tipo(k.tipo_demanda_id) && <span>· {config.tipo(k.tipo_demanda_id)?.nome}</span>}
                {detalhado && <span>· responsável: {config.usuario(k.responsavel_id)?.nome ?? "—"}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ResumoFinanceiroCliente({ clienteId }: { clienteId: string }) {
  const consulta = useFinanceiroEntidade(clienteId, null);
  const { definirParametros } = useRota();
  if (consulta.isLoading || !consulta.data) return null;
  const r = resumoFinanceiro(consulta.data.cobrancas, consulta.data.despesas, consulta.data.reembolsos);
  if (r.contratado === 0 && r.adiantadoEscritorio === 0) return null;
  return (
    <SecaoFicha titulo="Financeiro" acoes={<button type="button" onClick={() => definirParametros({ aba: "financeiro" })} className="text-xs font-semibold text-crm-folha hover:underline">Detalhes</button>}>
      <dl className="grid grid-cols-2 gap-2 rounded-xl border border-crm-linha bg-white p-3 text-sm">
        <dt className="text-crm-tinta-2">Contratado</dt>
        <dd className="text-right font-semibold">{formatarMoeda(r.contratado)}</dd>
        <dt className="text-crm-tinta-2">Recebido</dt>
        <dd className="text-right font-semibold text-crm-sucesso">{formatarMoeda(r.recebido)}</dd>
        <dt className="text-crm-tinta-2">Em aberto</dt>
        <dd className="text-right font-semibold">{formatarMoeda(r.emAberto)}</dd>
        {r.vencido > 0 && (
          <>
            <dt className="font-semibold text-crm-perigo">Vencido</dt>
            <dd className="text-right font-bold text-crm-perigo">{formatarMoeda(r.vencido)}</dd>
          </>
        )}
      </dl>
    </SecaoFicha>
  );
}

function AtendimentoOrigem({ leadId }: { leadId: string }) {
  const consulta = useQuery({
    queryKey: ["leads", "origem-completa", leadId],
    queryFn: async () => {
      const s = supabase();
      const [lead, consentimentos] = await Promise.all([
        executar(s.from("leads").select("*").eq("id", leadId).maybeSingle()),
        executar(s.from("consentimentos").select("*").eq("lead_id", leadId).order("registrado_em", { ascending: false })),
      ]);
      return { lead: lead as Lead | null, consentimentos: (consentimentos ?? []) as Consentimento[] };
    },
  });
  if (consulta.isLoading) return <Carregando />;
  const l = consulta.data?.lead;
  if (!l) return <Vazio compacto titulo="Lead de origem indisponível" />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Este cliente veio do lead{" "}
        <Link href={`/crm/leads?item=${l.id}`} className="font-semibold text-crm-info underline">
          {l.codigo} — {l.nome}
        </Link>
        . Todo o histórico do atendimento (quiz, contatos, tarefas e documentos) também aparece nas abas desta ficha.
      </p>
      <SecaoFicha titulo="Respostas mais recentes do quiz">
        <dl className="grid gap-2 rounded-xl border border-crm-linha bg-white p-3 text-sm sm:grid-cols-2">
          {[
            ["Interesse", l.quiz_interesse],
            ["Já cultiva?", l.quiz_cultiva],
            ["Consulta médica?", l.quiz_consulta_medica],
            ["Profissão", l.profissao],
            ["Faixa de renda", l.faixa_renda],
            ["Motivação", l.quiz_motivacao],
            ["Disponibilidade", l.quiz_agenda],
            ["Horário preferido", l.quiz_horario],
          ]
            .filter(([, v]) => v)
            .map(([r, v]) => (
              <div key={r as string}>
                <dt className="text-xs font-semibold text-crm-tinta-3">{r}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
      </SecaoFicha>
      <SecaoFicha titulo="Consentimentos registrados (LGPD)">
        {(consulta.data?.consentimentos ?? []).length === 0 ? (
          <p className="text-sm text-crm-tinta-3">Nenhum registro de consentimento.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {consulta.data!.consentimentos.map((ct) => (
              <li key={ct.id} className="flex items-start gap-2 rounded-xl border border-crm-linha bg-white p-3 text-sm">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-crm-folha" aria-hidden />
                <span>
                  <strong>{ct.concedido ? "Concedido" : "Não concedido"}</strong> em {formatarDataHora(ct.registrado_em)} via {ct.origem} (versão {ct.versao ?? "—"}): “{ct.texto}”
                </span>
              </li>
            ))}
          </ul>
        )}
      </SecaoFicha>
    </div>
  );
}

