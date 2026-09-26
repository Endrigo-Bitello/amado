"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Archive, ArchiveRestore, ArrowLeft, Check, ExternalLink, FileWarning, Gavel, Link2, MessageCircle, MoreHorizontal, Plus, Scale, ShieldAlert, Trash2, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso } from "../../_lib/avisos";
import { useConfig } from "../../_lib/config";
import { formatarData, formatarDataHora, formatarRelativo, situacaoVencimento } from "../../_lib/datas";
import { executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { linkWhatsApp } from "../../_lib/formatos";
import { Link, navegar, useRota } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import type { Cliente, Prazo } from "../../_lib/tipos";
import type { ColunaQuadro } from "../../_quadro/tipos";
import { Abas } from "../../_ui/Abas";
import { Botao } from "../../_ui/Botao";
import { Entrada } from "../../_ui/Campos";
import { confirmarSimples } from "../../_ui/Dialogos";
import { Menu } from "../../_ui/Sobreposicoes";
import { BarraProgresso, Carregando, ErroCarga, Pilula, Selo, Vazio } from "../../_ui/Visuais";
import { ListaArquivos } from "../../_componentes/Arquivos";
import { Atividade } from "../../_componentes/Atividade";
import { ChecklistDocumentos, useDocumentos } from "../../_componentes/ChecklistDocumentos";
import { Midias } from "../../_componentes/Midias";
import { CamposPersonalizadosFicha, ListaPropriedades, SecaoFicha } from "../../_componentes/Propriedades";
import { CompromissosRelacionados, TarefasRelacionadas } from "../../_componentes/Relacionados";
import { contarDocumentos } from "../../_componentes/statusDocumento";
import { FinanceiroEntidade } from "../financeiro/FinanceiroEntidade";
import { NATUREZAS, useColunasCasos, type CasoQuadro, type PendenciasCaso } from "./colunasCasos";
import { STATUS_CASO } from "./constantes";
import { FormPrazo, ListaPrazosCaso, type SugestaoPrazoForm } from "./Prazos";
import { FormAndamento, ListaAndamentos, ListaPartes, ListaProcessos, useProcessosCaso } from "./Processos";

type CasoFicha = CasoQuadro & { cliente: (Pick<Cliente, "id" | "nome" | "codigo" | "whatsapp">) | null };
type LinkExterno = { titulo: string; url: string };

const SEM_PENDENCIAS = new Map<string, PendenciasCaso>();

export default function FichaCaso({ id }: { id: string }) {
  const { pode } = useAuth();
  const config = useConfig();
  const { parametro, definirParametros } = useRota();
  const { atualizar, excluir } = useGravacao();
  const aba = parametro("aba") ?? "visao";
  const [novoPrazo, setNovoPrazo] = useState<SugestaoPrazoForm | null>(null);
  const [andamento, setAndamento] = useState(false);

  const consulta = useQuery({
    queryKey: ["casos", "ficha", id],
    queryFn: async () =>
      (await executar(
        supabase().from("casos").select("*, cliente:clientes(id, nome, codigo, whatsapp), processos(id, numero, tribunal, principal, orgao, classe, situacao)").eq("id", id).maybeSingle(),
      )) as unknown as CasoFicha | null,
  });
  const processos = useProcessosCaso(id);
  const prazos = useQuery({
    queryKey: ["prazos", "caso", id, "pendentes"],
    enabled: pode("prazos.ver"),
    queryFn: async () => (await executar(supabase().from("prazos").select("id, titulo, vencimento, conferido, status").eq("caso_id", id).eq("status", "pendente").order("vencimento"))) as Pick<Prazo, "id" | "titulo" | "vencimento" | "conferido" | "status">[],
  });
  const documentos = useDocumentos({ caso_id: id });

  const salvar = useCallback(async (_c: CasoQuadro, alt: Record<string, unknown>) => {
    await atualizar("casos", id, alt, { chaves: ["casos"] });
  }, [atualizar, id]);
  const colunas = useColunasCasos(salvar, SEM_PENDENCIAS);
  const ed = pode("casos.editar");

  const grupos = useMemo(() => {
    const por = new Map(colunas.map((c) => [c.id, c]));
    const pegar = (ids: string[]) => ids.map((i) => por.get(i)).filter(Boolean) as ColunaQuadro<CasoQuadro>[];
    const longo = (idc: "objeto" | "resultado" | "observacoes", titulo: string): ColunaQuadro<CasoQuadro> => ({
      id: idc,
      titulo,
      tipo: "texto_longo",
      valor: (c) => c[idc],
      exibir: (c) => <span className="line-clamp-6 whitespace-pre-wrap">{c[idc] || "—"}</span>,
      editar: ed ? (c, v) => salvar(c, { [idc]: v }) : undefined,
    });
    return {
      principais: pegar(["titulo", "natureza", "tipo_demanda_id", "status", "responsavel_id", "equipe", "prioridade", "etiquetas"]),
      datas: pegar(["data_abertura", "data_protocolo", "data_encerramento", "valor_causa", "segredo_justica"]),
      descricao: [longo("objeto", "Objeto / resumo"), longo("resultado", "Resultado"), longo("observacoes", "Observações")],
    };
  }, [colunas, ed, salvar]);

  const c = consulta.data;
  if (consulta.isLoading) return <Carregando />;
  if (consulta.error) return <ErroCarga mensagem={mensagemErro(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />;
  if (!c) {
    return (
      <Vazio
        titulo="Caso não encontrado"
        descricao="O caso pode ter sido excluído ou você não tem permissão de acesso."
        acao={<Link href="/crm/casos" className="font-semibold text-crm-folha underline">Voltar para casos</Link>}
      />
    );
  }

  const fases = config.etapasDe("caso");
  const faseAtual = config.etapa(c.fase_id);
  const pendentes = prazos.data ?? [];
  const vencidos = pendentes.filter((p) => situacaoVencimento(p.vencimento) === "vencido").length;
  const aConferir = pendentes.filter((p) => !p.conferido).length;
  const docs = contarDocumentos(documentos.data ?? []);
  const semNumero = c.natureza === "judicial" && !(processos.data ?? c.processos).some((p) => p.numero);
  const whats = c.cliente ? linkWhatsApp(c.cliente.whatsapp, `Olá, ${c.cliente.nome.split(" ")[0]}! Aqui é do escritório Amado & Amado Jr. Advogados.`) : null;
  const trocarAba = (a: string) => definirParametros({ aba: a === "visao" ? null : a, prazo: null }, { substituir: true });

  const arquivar = async () => {
    const arquivado = Boolean(c.arquivado_em);
    if (!arquivado && !(await confirmarSimples({ titulo: "Arquivar caso?", mensagem: "O caso sai dos quadros, mas continua acessível pela busca, pela ficha do cliente e em “Arquivados”. Nada é apagado.", confirmar: "Arquivar" }))) return;
    await atualizar("casos", c.id, { arquivado_em: arquivado ? null : new Date().toISOString() }, { chaves: ["casos"], mensagemSucesso: arquivado ? "Caso restaurado." : "Caso arquivado." }).catch(() => undefined);
  };
  const excluirDefinitivo = async () => {
    if (!(await confirmarSimples({ titulo: "Excluir caso definitivamente?", mensagem: "Processos, andamentos, prazos, checklist e tarefas deste caso serão apagados. Casos com lançamentos financeiros não podem ser excluídos. Prefira arquivar. Esta ação não pode ser desfeita.", confirmar: "Excluir definitivamente", perigo: true }))) return;
    try {
      await excluir("casos", c.id, { chaves: ["casos", "painel"], mensagemSucesso: "Caso excluído." });
      navegar(c.cliente ? `/crm/clientes/${c.cliente.id}?aba=casos` : "/crm/casos");
    } catch {
      /* aviso já exibido */
    }
  };
  const mudarFase = async (faseId: string) => {
    if (!ed || faseId === c.fase_id) return;
    await atualizar("casos", c.id, { fase_id: faseId }, { chaves: ["casos"], mensagemSucesso: `Fase alterada para “${config.etapa(faseId)?.nome}”.` }).catch(() => undefined);
  };

  const abas = [
    { id: "visao", rotulo: "Visão geral" },
    { id: "processos", rotulo: "Processos", contador: (processos.data ?? c.processos).length, alerta: semNumero },
    { id: "andamentos", rotulo: "Andamentos" },
    ...(pode("prazos.ver") ? [{ id: "prazos", rotulo: "Prazos", contador: pendentes.length, alerta: vencidos > 0 }] : []),
    ...(pode("documentos.ver") ? [{ id: "documentos", rotulo: "Documentos", contador: docs.faltantes || null, alerta: docs.faltantes > 0 }, { id: "midias", rotulo: "Vídeos" }] : []),
    ...(pode("financeiro.ver") && c.cliente ? [{ id: "financeiro", rotulo: "Financeiro" }] : []),
    { id: "tarefas", rotulo: "Tarefas e agenda" },
    { id: "atividade", rotulo: "Linha do tempo" },
    ...(pode("documentos.ver") ? [{ id: "arquivos", rotulo: "Arquivos" }] : []),
  ];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <nav aria-label="Navegação" className="flex flex-wrap items-center gap-1 text-sm font-semibold text-crm-tinta-2">
        <Link href="/crm/casos" className="inline-flex items-center gap-1 hover:text-crm-tinta">
          <ArrowLeft size={15} aria-hidden /> {config.nome("casos")}
        </Link>
        {c.cliente && (
          <>
            <span aria-hidden className="text-crm-tinta-3">/</span>
            <Link href={`/crm/clientes/${c.cliente.id}?aba=casos`} className="hover:text-crm-tinta">
              {c.cliente.nome}
            </Link>
          </>
        )}
      </nav>

      <header className="flex flex-col gap-4 rounded-2xl border-2 border-crm-tinta bg-white p-5 shadow-crm-bruto-verde">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-crm-verde text-crm-ouro-claro">
              {c.natureza === "judicial" ? <Gavel size={22} aria-hidden /> : <Scale size={22} aria-hidden />}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-crm-tinta-3">
                {config.nome("caso")} {c.codigo} · aberto em {formatarData(c.data_abertura)}
              </p>
              <h1 className="font-serif text-2xl font-semibold leading-tight">{c.titulo}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Selo tom={c.natureza === "judicial" ? "info" : "neutro"}>{NATUREZAS.find((n) => n.valor === c.natureza)?.rotulo}</Selo>
                <Pilula cor={STATUS_CASO[c.status]?.cor}>{STATUS_CASO[c.status]?.rotulo}</Pilula>
                {config.tipo(c.tipo_demanda_id) && <Pilula cor={config.tipo(c.tipo_demanda_id)?.cor} preenchida={false}>{config.tipo(c.tipo_demanda_id)?.nome}</Pilula>}
                {c.segredo_justica && <Selo>Segredo de justiça</Selo>}
                {c.arquivado_em && <Selo tom="alerta">Arquivado</Selo>}
                {semNumero && (
                  <Selo tom="alerta" icone={<AlertTriangle size={11} aria-hidden />}>
                    Sem nº do processo
                  </Selo>
                )}
                <span className="text-xs text-crm-tinta-2">· {config.usuario(c.responsavel_id)?.nome ?? "sem responsável"}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pode("prazos.editar") && (
              <Botao variante="primario" tamanho="sm" icone={<Gavel size={14} />} onClick={() => setNovoPrazo({})}>
                Novo prazo
              </Botao>
            )}
            {ed && (
              <Botao tamanho="sm" icone={<Plus size={14} />} onClick={() => setAndamento(true)}>
                Registrar andamento
              </Botao>
            )}
            {whats && (
              <a href={whats} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-crm-linha-forte bg-white px-3 text-[13px] font-semibold hover:bg-crm-suave">
                <MessageCircle size={14} aria-hidden /> WhatsApp
              </a>
            )}
            <Menu
              rotulo="Mais ações do caso"
              itens={[
                ...(ed ? [{ rotulo: c.arquivado_em ? "Restaurar caso" : "Arquivar caso", icone: c.arquivado_em ? <ArchiveRestore size={15} /> : <Archive size={15} />, aoSelecionar: arquivar }] : []),
                ...(pode("casos.excluir") ? [{ rotulo: "Excluir definitivamente", icone: <Trash2 size={15} />, aoSelecionar: excluirDefinitivo, perigo: true, separadorAntes: true }] : []),
              ]}
              gatilho={(p) => (
                <button {...p} type="button" className="rounded-full border border-crm-linha-forte bg-white p-1.5 text-crm-tinta-2 hover:bg-crm-suave" aria-label="Mais ações">
                  <MoreHorizontal size={16} />
                </button>
              )}
            />
          </div>
        </div>

        {fases.length > 0 && (
          <div>
            <p id="rotulo-fases" className="mb-1.5 text-xs font-bold uppercase tracking-wider text-crm-tinta-3">
              Fase {faseAtual ? `— ${faseAtual.nome}` : ""} {c.fase_alterada_em && <span className="font-normal normal-case tracking-normal">(desde {formatarRelativo(c.fase_alterada_em)})</span>}
            </p>
            <ol aria-labelledby="rotulo-fases" className="flex gap-1 overflow-x-auto pb-1">
              {fases.map((f, i) => {
                const atualIdx = fases.findIndex((x) => x.id === c.fase_id);
                const atual = f.id === c.fase_id;
                const passada = atualIdx >= 0 && i < atualIdx;
                return (
                  <li key={f.id} className="min-w-[120px] flex-1">
                    <button
                      type="button"
                      disabled={!ed}
                      aria-current={atual ? "step" : undefined}
                      onClick={() => mudarFase(f.id)}
                      title={ed ? `Mover para “${f.nome}”` : f.nome}
                      className={`flex h-full w-full items-center gap-1.5 rounded-lg border-2 px-2 py-1.5 text-left text-xs font-semibold transition-colors disabled:cursor-default ${
                        atual ? "border-crm-tinta text-white shadow-crm-bruto" : passada ? "border-transparent bg-crm-verde-claro text-crm-verde" : "border-crm-linha bg-white text-crm-tinta-2 hover:border-crm-linha-forte"
                      }`}
                      style={atual ? { backgroundColor: f.cor } : undefined}
                    >
                      {passada ? <Check size={12} className="shrink-0" aria-hidden /> : <span className="shrink-0 tabular-nums opacity-70">{i + 1}</span>}
                      <span className="line-clamp-2">{f.nome}</span>
                      {atual && <span className="sr-only">(fase atual)</span>}
                      {passada && <span className="sr-only">(concluída)</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </header>

      <Abas abas={abas} ativa={aba} aoTrocar={trocarAba} rotulo="Seções da ficha do caso" />

      <div role="tabpanel">
        {aba === "visao" && (
          <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <div className="flex flex-col gap-5">
              <SecaoFicha titulo="Dados do caso"><ListaPropriedades item={c} rotuloItem={c.titulo} colunas={grupos.principais} /></SecaoFicha>
              <SecaoFicha titulo="Descrição"><ListaPropriedades item={c} rotuloItem={c.titulo} colunas={grupos.descricao} /></SecaoFicha>
              <SecaoFicha titulo="Datas e valores"><ListaPropriedades item={c} rotuloItem={c.titulo} colunas={grupos.datas} /></SecaoFicha>
              <CamposPersonalizadosFicha entidade="caso" item={c} rotuloItem={c.titulo} />
            </div>
            <aside className="flex flex-col gap-5">
              <SecaoFicha titulo="Pendências">
                <ul className="flex flex-col gap-2 rounded-xl border border-crm-linha bg-white p-3 text-sm">
                  {pode("prazos.ver") && (
                    <li className="flex items-center gap-2">
                      <Gavel size={15} className="shrink-0 text-crm-tinta-3" aria-hidden />
                      <button type="button" onClick={() => trocarAba("prazos")} className="flex-1 text-left hover:underline">
                        {pendentes.length === 0 ? "Nenhum prazo pendente" : `${pendentes.length} prazo(s) pendente(s)`}
                      </button>
                      {vencidos > 0 && <Selo tom="perigo" icone={<AlertTriangle size={11} aria-hidden />}>{vencidos} vencido(s)</Selo>}
                      {aConferir > 0 && <Selo tom="alerta" icone={<ShieldAlert size={11} aria-hidden />}>{aConferir} a conferir</Selo>}
                    </li>
                  )}
                  {pendentes[0] && (
                    <li className="ml-6 text-xs text-crm-tinta-2">
                      Próximo: <strong>{pendentes[0].titulo}</strong> — {formatarDataHora(pendentes[0].vencimento)}
                    </li>
                  )}
                  {pode("documentos.ver") && (
                    <li className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-2">
                        <FileWarning size={15} className="shrink-0 text-crm-tinta-3" aria-hidden />
                        <button type="button" onClick={() => trocarAba("documentos")} className="flex-1 text-left hover:underline">
                          {docs.total === 0 ? "Checklist de documentos não aplicado" : `${docs.aprovadosExigidos} de ${docs.exigidos} documentos exigidos aprovados`}
                        </button>
                        {docs.faltantes > 0 && <Selo tom="alerta">{docs.faltantes} faltante(s)</Selo>}
                      </span>
                      {docs.exigidos > 0 && <BarraProgresso valor={docs.aprovadosExigidos} total={docs.exigidos} rotulo="Documentos exigidos aprovados" />}
                    </li>
                  )}
                </ul>
              </SecaoFicha>
              <SecaoFicha titulo="Partes">
                <ListaPartes casoId={c.id} compacto />
              </SecaoFicha>
              <SecaoFicha titulo="Links externos" descricao="Pastas, peças no drive, consultas públicas etc.">
                <EditorLinks casoId={c.id} links={(c.links as LinkExterno[] | null) ?? []} podeEditar={ed} />
              </SecaoFicha>
            </aside>
          </div>
        )}
        {aba === "processos" && <ListaProcessos casoId={c.id} casoTitulo={c.titulo} natureza={c.natureza} />}
        {aba === "andamentos" && <ListaAndamentos casoId={c.id} aoSugerirPrazo={(s) => setNovoPrazo({ processoId: s.processoId, ciencia: s.ciencia, referencia: s.referencia })} />}
        {aba === "prazos" && <ListaPrazosCaso casoId={c.id} casoTitulo={c.titulo} destaque={parametro("prazo")} />}
        {aba === "documentos" && <ChecklistDocumentos escopo={{ caso_id: c.id }} contato={c.cliente ? { nome: c.cliente.nome, whatsapp: c.cliente.whatsapp } : null} tipoDemandaId={c.tipo_demanda_id} />}
        {aba === "midias" && <Midias clienteId={c.cliente_id} casoId={c.id} />}
        {aba === "financeiro" && c.cliente && <FinanceiroEntidade cliente={{ id: c.cliente.id, nome: c.cliente.nome }} casoId={c.id} casos={[{ id: c.id, titulo: `${c.codigo} · ${c.titulo}` }]} />}
        {aba === "tarefas" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <TarefasRelacionadas coluna="caso_id" id={c.id} vinculo={{ caso: { id: c.id, titulo: c.titulo } }} />
            <CompromissosRelacionados coluna="caso_id" id={c.id} vinculo={{ caso: { id: c.id, titulo: c.titulo } }} />
          </div>
        )}
        {aba === "atividade" && <Atividade entidade="caso" registroId={c.id} eventosPor={{ coluna: "caso_id", id: c.id }} />}
        {aba === "arquivos" && <ListaArquivos escopo={{ caso_id: c.id, cliente_id: c.cliente_id }} filtroColuna="caso_id" />}
      </div>

      <FormPrazo aberto={Boolean(novoPrazo)} aoFechar={() => setNovoPrazo(null)} caso={{ id: c.id, titulo: c.titulo }} sugestao={novoPrazo} />
      <FormAndamento
        aberto={andamento}
        aoFechar={() => setAndamento(false)}
        casoId={c.id}
        processos={processos.data ?? c.processos}
        aoSugerirPrazo={(s) => setNovoPrazo({ processoId: s.processoId, ciencia: s.ciencia, referencia: s.referencia })}
      />
    </div>
  );
}

function EditorLinks({ casoId, links, podeEditar }: { casoId: string; links: LinkExterno[]; podeEditar: boolean }) {
  const { atualizar } = useGravacao();
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const salvar = async (novos: LinkExterno[], mensagem: string) => {
    await atualizar("casos", casoId, { links: novos }, { chaves: ["casos"], mensagemSucesso: mensagem }).catch(() => undefined);
  };
  const adicionar = async () => {
    const u = url.trim();
    if (!/^https:\/\/[^\s]+$/i.test(u)) {
      aviso.erro("Informe um endereço completo começando com https://");
      return;
    }
    await salvar([...links, { titulo: titulo.trim() || u.replace(/^https:\/\//i, "").slice(0, 60), url: u }], "Link adicionado.");
    setTitulo("");
    setUrl("");
    setAdicionando(false);
  };
  return (
    <div className="flex flex-col gap-2">
      {links.length === 0 && !adicionando && <p className="rounded-xl border border-dashed border-crm-linha-forte bg-white px-3 py-3 text-sm text-crm-tinta-3">Nenhum link.</p>}
      {links.length > 0 && (
        <ul className="flex flex-col divide-y divide-crm-linha rounded-xl border border-crm-linha bg-white">
          {links.map((l, i) => (
            <li key={`${l.url}-${i}`} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Link2 size={14} className="shrink-0 text-crm-tinta-3" aria-hidden />
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-semibold text-crm-info hover:underline">
                {l.titulo} <ExternalLink size={11} className="inline" aria-hidden />
              </a>
              {podeEditar && (
                <button
                  type="button"
                  className="rounded p-1 text-crm-tinta-3 hover:bg-crm-perigo-claro hover:text-crm-perigo"
                  aria-label={`Remover link ${l.titulo}`}
                  onClick={async () => {
                    if (await confirmarSimples({ titulo: "Remover link?", mensagem: l.titulo, confirmar: "Remover", perigo: true })) salvar(links.filter((_, j) => j !== i), "Link removido.");
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {podeEditar &&
        (adicionando ? (
          <form className="flex flex-col gap-2 rounded-xl border border-crm-linha bg-white p-3" onSubmit={(e) => { e.preventDefault(); adicionar(); }}>
            <Entrada aria-label="Título do link" placeholder="Título (ex.: Pasta do caso)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            <Entrada aria-label="Endereço do link" placeholder="https://" type="url" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
            <div className="flex justify-end gap-2">
              <Botao tamanho="sm" onClick={() => setAdicionando(false)}>Cancelar</Botao>
              <Botao tamanho="sm" variante="primario" type="submit">Adicionar</Botao>
            </div>
          </form>
        ) : (
          <Botao tamanho="sm" variante="fantasma" icone={<Plus size={14} />} onClick={() => setAdicionando(true)} className="self-start">
            Adicionar link
          </Botao>
        ))}
    </div>
  );
}
