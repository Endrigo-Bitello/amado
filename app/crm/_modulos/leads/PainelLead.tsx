"use client";

import { useQuery } from "@tanstack/react-query";
import { Archive, ArchiveRestore, CheckCircle2, Phone, ShieldCheck, Trash2, UserCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../_lib/auth";
import { useConfig } from "../../_lib/config";
import { formatarDataHora } from "../../_lib/datas";
import { executar, useGravacao } from "../../_lib/dados";
import { formatarTelefone, linkWhatsApp } from "../../_lib/formatos";
import { Link } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import type { Consentimento, Lead, QuizResposta, QuizSubmissao } from "../../_lib/tipos";
import type { ColunaQuadro } from "../../_quadro/tipos";
import { Botao } from "../../_ui/Botao";
import { confirmarSimples } from "../../_ui/Dialogos";
import { Carregando, Pilula, Selo, Vazio } from "../../_ui/Visuais";
import { ListaArquivos } from "../../_componentes/Arquivos";
import { Atividade } from "../../_componentes/Atividade";
import { ChecklistDocumentos } from "../../_componentes/ChecklistDocumentos";
import { AvisoDuplicados } from "../../_componentes/Duplicados";
import { PainelItem } from "../../_componentes/PainelItem";
import { CamposPersonalizadosFicha, ListaPropriedades, SecaoFicha } from "../../_componentes/Propriedades";
import { RegistrarContato } from "../../_componentes/RegistrarContato";
import { CompromissosRelacionados, TarefasRelacionadas } from "../../_componentes/Relacionados";
import { TEMPERATURAS } from "./colunasLeads";

interface Props {
  lead: Lead;
  colunas: ColunaQuadro<Lead>[];
  aoFechar: () => void;
  aoConverter: (l: Lead) => void;
  aoExcluido: () => void;
}

export function PainelLead({ lead, colunas, aoFechar, aoConverter, aoExcluido }: Props) {
  const { pode } = useAuth();
  const config = useConfig();
  const { atualizar, excluir } = useGravacao();
  const [aba, setAba] = useState("dados");
  const [contato, setContato] = useState(false);
  const etapa = config.etapa(lead.etapa_id);
  const temp = TEMPERATURAS.find((t) => t.valor === lead.temperatura);
  const col = (id: string) => colunas.find((c) => c.id === id)!;
  const whats = linkWhatsApp(lead.whatsapp, `Olá, ${lead.nome.split(" ")[0]}! Aqui é do escritório Amado & Amado Jr. Advogados.`);

  const arquivar = async () => {
    const arquivado = Boolean(lead.arquivado_em);
    if (!arquivado && !(await confirmarSimples({ titulo: "Arquivar lead?", mensagem: "O lead sai dos quadros, mas continua disponível em “Arquivados” e na busca. Nada é apagado.", confirmar: "Arquivar" }))) return;
    await atualizar("leads", lead.id, { arquivado_em: arquivado ? null : new Date().toISOString() }, { chaves: ["leads", "painel"], mensagemSucesso: arquivado ? "Lead restaurado." : "Lead arquivado." });
  };

  const excluirDefinitivo = async () => {
    if (!(await confirmarSimples({ titulo: "Excluir lead definitivamente?", mensagem: "Respostas do quiz ficam registradas sem vínculo, mas contatos, tarefas e comentários do lead serão apagados. Prefira arquivar. Esta ação não pode ser desfeita.", confirmar: "Excluir definitivamente", perigo: true }))) return;
    await excluir("leads", lead.id, { chaves: ["leads", "painel"], mensagemSucesso: "Lead excluído." });
    aoExcluido();
  };

  const vinculo = { lead: { id: lead.id, titulo: lead.nome } };

  return (
    <PainelItem
      rotulo={lead.nome}
      titulo={lead.nome}
      subtitulo={`${config.nome("lead")} ${lead.codigo} · entrou ${formatarDataHora(lead.created_at)} via ${config.rotulo("origem", lead.origem)}`}
      aoFechar={aoFechar}
      selos={
        <>
          <Pilula cor={etapa?.cor}>{etapa?.nome ?? "Sem etapa"}</Pilula>
          {temp && (
            <Pilula cor={temp.cor} preenchida={false} icone={temp.icone}>
              {temp.rotulo}
            </Pilula>
          )}
          {lead.cliente_id && (
            <Link href={`/crm/clientes/${lead.cliente_id}`}>
              <Selo tom="verde" icone={<CheckCircle2 size={11} />}>
                Convertido — ver cliente
              </Selo>
            </Link>
          )}
          {lead.arquivado_em && <Selo tom="neutro">Arquivado</Selo>}
          {lead.total_submissoes > 1 && <Selo tom="info">{lead.total_submissoes} envios do quiz</Selo>}
        </>
      }
      acoes={
        <>
          {!lead.cliente_id && pode("leads.editar") && pode("clientes.editar") && (
            <Botao variante="primario" tamanho="sm" icone={<UserCheck size={15} />} onClick={() => aoConverter(lead)}>
              Converter em cliente
            </Botao>
          )}
          {pode("leads.editar") && (
            <Botao variante="secundario" tamanho="sm" icone={<Phone size={14} />} onClick={() => setContato(true)}>
              Registrar contato
            </Botao>
          )}
          {whats && (
            <a href={whats} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-crm-linha-forte bg-white px-3 text-[13px] font-semibold hover:bg-crm-suave">
              WhatsApp {formatarTelefone(lead.whatsapp)}
            </a>
          )}
        </>
      }
      menu={[
        ...(pode("leads.editar")
          ? [{ rotulo: lead.arquivado_em ? "Restaurar lead" : "Arquivar lead", icone: lead.arquivado_em ? <ArchiveRestore size={15} /> : <Archive size={15} />, aoSelecionar: arquivar }]
          : []),
        ...(pode("leads.excluir") ? [{ rotulo: "Excluir definitivamente", icone: <Trash2 size={15} />, aoSelecionar: excluirDefinitivo, perigo: true, separadorAntes: true }] : []),
      ]}
      abas={[
        { id: "dados", rotulo: "Dados" },
        { id: "quiz", rotulo: "Quiz", contador: lead.total_submissoes || null },
        { id: "atividade", rotulo: "Atividade" },
        { id: "tarefas", rotulo: "Tarefas e agenda" },
        ...(pode("documentos.ver") ? [{ id: "documentos", rotulo: "Documentos" }] : []),
        ...(pode("documentos.ver") ? [{ id: "arquivos", rotulo: "Arquivos" }] : []),
      ]}
      abaAtiva={aba}
      aoTrocarAba={setAba}
    >
      {aba === "dados" && (
        <div className="flex flex-col gap-5">
          <AvisoDuplicados dados={{ telefone: lead.whatsapp, email: lead.email, cpf: lead.cpf, ignorar: lead.id }} leadAtualId={lead.id} />
          {etapa?.categoria === "perdida" && lead.motivo_perda && (
            <div className="rounded-xl border border-crm-linha bg-white p-3 text-sm">
              <strong>Motivo da perda:</strong> {config.rotulo("motivo_perda", lead.motivo_perda)}
              {lead.motivo_perda_detalhe && <p className="mt-1 text-crm-tinta-2">{lead.motivo_perda_detalhe}</p>}
            </div>
          )}
          <SecaoFicha titulo="Atendimento">
            <ListaPropriedades item={lead} rotuloItem={lead.nome} colunas={["etapa_id", "responsavel_id", "temperatura", "prioridade", "proxima_acao", "proxima_acao_em", "tipo_demanda_id", "origem", "etiquetas"].map(col)} />
          </SecaoFicha>
          <SecaoFicha titulo="Contato">
            <ListaPropriedades
              item={lead}
              rotuloItem={lead.nome}
              colunas={[
                col("nome"),
                col("whatsapp"),
                col("email"),
                {
                  id: "cpf",
                  titulo: "CPF",
                  tipo: "texto",
                  valor: (l: Lead) => l.cpf,
                  editar: pode("leads.editar") ? (l: Lead, v: unknown) => atualizar("leads", l.id, { cpf: v }, { chaves: ["leads"] }) : undefined,
                } as ColunaQuadro<Lead>,
                col("estado"),
                col("municipio"),
                col("profissao"),
              ]}
            />
          </SecaoFicha>
          <SecaoFicha titulo="Observações">
            <ListaPropriedades
              item={lead}
              rotuloItem={lead.nome}
              colunas={[
                {
                  id: "observacoes",
                  titulo: "Observações",
                  tipo: "texto_longo",
                  valor: (l: Lead) => l.observacoes,
                  exibir: (l: Lead) => <span className="line-clamp-3 whitespace-pre-wrap">{l.observacoes || "—"}</span>,
                  editar: pode("leads.editar") ? (l: Lead, v: unknown) => atualizar("leads", l.id, { observacoes: v }, { chaves: ["leads"] }) : undefined,
                } as ColunaQuadro<Lead>,
              ]}
            />
          </SecaoFicha>
          <CamposPersonalizadosFicha entidade="lead" item={lead} rotuloItem={lead.nome} />
          {(lead.utm_source || lead.utm_campaign || lead.utm_medium) && (
            <SecaoFicha titulo="Origem da campanha (UTM)">
              <p className="rounded-xl border border-crm-linha bg-white p-3 text-sm text-crm-tinta-2">
                {[lead.utm_source && `origem: ${lead.utm_source}`, lead.utm_medium && `mídia: ${lead.utm_medium}`, lead.utm_campaign && `campanha: ${lead.utm_campaign}`, lead.utm_content && `conteúdo: ${lead.utm_content}`, lead.utm_term && `termo: ${lead.utm_term}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </SecaoFicha>
          )}
        </div>
      )}
      {aba === "quiz" && <RespostasQuiz leadId={lead.id} />}
      {aba === "atividade" && (
        <Atividade
          entidade="lead"
          registroId={lead.id}
          eventosPor={{ coluna: "lead_id", id: lead.id }}
          acoesExtras={
            pode("leads.editar") && (
              <Botao tamanho="sm" variante="secundario" icone={<Phone size={14} />} onClick={() => setContato(true)}>
                Registrar contato
              </Botao>
            )
          }
        />
      )}
      {aba === "tarefas" && (
        <div className="flex flex-col gap-6">
          <TarefasRelacionadas coluna="lead_id" id={lead.id} vinculo={vinculo} />
          <CompromissosRelacionados coluna="lead_id" id={lead.id} vinculo={vinculo} />
        </div>
      )}
      {aba === "documentos" &&
        (lead.cliente_id ? (
          <Vazio compacto titulo="Este lead já é cliente" descricao="Os documentos do atendimento foram vinculados à ficha do cliente." acao={<Link href={`/crm/clientes/${lead.cliente_id}?aba=documentos`} className="text-sm font-semibold text-crm-folha underline">Abrir documentos do cliente</Link>} />
        ) : (
          <ChecklistDocumentos escopo={{ lead_id: lead.id }} contato={{ nome: lead.nome, whatsapp: lead.whatsapp }} tipoDemandaId={lead.tipo_demanda_id} />
        ))}
      {aba === "arquivos" && <ListaArquivos escopo={{ lead_id: lead.id }} filtroColuna="lead_id" />}
      <RegistrarContato aberto={contato} aoFechar={() => setContato(false)} vinculo={{ lead_id: lead.id, cliente_id: lead.cliente_id }} proximaAcao />
    </PainelItem>
  );
}

function RespostasQuiz({ leadId }: { leadId: string }) {
  const consulta = useQuery({
    queryKey: ["leads", "quiz", leadId],
    queryFn: async () => {
      const s = supabase();
      const [subs, respostas, consentimentos] = await Promise.all([
        executar(s.from("quiz_submissoes").select("*").eq("lead_id", leadId).order("recebido_em", { ascending: false })),
        executar(s.from("quiz_respostas").select("*").eq("lead_id", leadId).order("ordem")),
        executar(s.from("consentimentos").select("*").eq("lead_id", leadId).order("registrado_em", { ascending: false })),
      ]);
      return { subs: (subs ?? []) as QuizSubmissao[], respostas: (respostas ?? []) as QuizResposta[], consentimentos: (consentimentos ?? []) as Consentimento[] };
    },
  });
  if (consulta.isLoading) return <Carregando />;
  const dados = consulta.data;
  if (!dados || dados.subs.length === 0) return <Vazio compacto titulo="Este lead não veio do quiz" descricao="Leads cadastrados manualmente ou importados não têm respostas do quiz." />;
  return (
    <div className="flex flex-col gap-5">
      {dados.subs.map((s, i) => {
        const respostas = dados.respostas.filter((r) => r.submissao_id === s.id);
        const consentimento = dados.consentimentos.find((c) => c.submissao_id === s.id);
        return (
          <section key={s.id} className="rounded-2xl border border-crm-linha bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-crm-linha px-4 py-3">
              <h3 className="text-sm font-bold">
                {i === 0 ? "Envio mais recente" : "Envio anterior"} — {formatarDataHora(s.recebido_em)}
              </h3>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-crm-tinta-2">
                Pontuação {s.score_calculado ?? "—"} · {s.temperatura ?? "—"}
                {s.duracao_segundos !== null && s.duracao_segundos < 3600 && <span>· respondido em {Math.max(1, Math.round((s.duracao_segundos ?? 0) / 60))} min</span>}
              </span>
            </header>
            <dl className="divide-y divide-crm-linha">
              {respostas.map((r) => (
                <div key={r.id} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[1fr_1.2fr] sm:gap-4">
                  <dt className="text-xs font-semibold text-crm-tinta-2">{r.pergunta}</dt>
                  <dd className="text-sm text-crm-tinta">
                    {r.resposta}
                    {r.pontuacao !== null && <span className="ml-2 text-xs text-crm-tinta-3">(+{r.pontuacao})</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <footer className="flex flex-col gap-1 border-t border-crm-linha bg-crm-fundo px-4 py-3 text-xs text-crm-tinta-2">
              {consentimento && (
                <p className="flex items-start gap-1.5">
                  <ShieldCheck size={13} className="mt-0.5 shrink-0 text-crm-folha" aria-hidden />
                  <span>
                    <strong>Consentimento LGPD {consentimento.concedido ? "concedido" : "não concedido"}</strong> em {formatarDataHora(consentimento.registrado_em)} (versão {consentimento.versao ?? "—"}): “{consentimento.texto}”
                  </span>
                </p>
              )}
              <p>
                Página: {s.pagina || "—"}
                {s.utm_source && ` · UTM: ${[s.utm_source, s.utm_medium, s.utm_campaign].filter(Boolean).join(" / ")}`}
                {s.observacoes && ` · ${s.observacoes}`}
              </p>
            </footer>
          </section>
        );
      })}
    </div>
  );
}
