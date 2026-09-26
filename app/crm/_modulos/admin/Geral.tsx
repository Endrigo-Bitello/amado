"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, Eye, EyeOff, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useConfig, NOMENCLATURA_PADRAO } from "../../_lib/config";
import { DESTAQUES } from "../../_lib/cores";
import { formatarData, hojeSP, lerYmd } from "../../_lib/datas";
import { executar, mensagemErro } from "../../_lib/dados";
import { PRESETS } from "../../_lib/presets";
import { supabase } from "../../_lib/supabase";
import type { Feriado, Visualizacao } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { AreaTexto, CaixaSelecao, Entrada, GrupoCampo, Selecao } from "../../_ui/Campos";
import { confirmarSimples } from "../../_ui/Dialogos";
import { Carregando, ErroCarga, Selo, Vazio } from "../../_ui/Visuais";
import { Aviso, BotoesOrdem, mover, SecaoAdmin, useAdmin } from "./comum";

// ---------------------------------------------------------------------------
// Painel "Hoje": indicadores, ordem e limites
// ---------------------------------------------------------------------------

interface CfgPainel {
  indicadores: { id: string; visivel: boolean }[];
  horas_sem_retorno: number;
  dias_prazos_proximos: number;
}

export function AdminPainel() {
  const config = useConfig();
  const { salvar } = useAdmin();
  const atual = config.cfg<CfgPainel>("painel", { indicadores: [], horas_sem_retorno: 24, dias_prazos_proximos: 7 });
  const [cfg, setCfg] = useState<CfgPainel>(atual);
  useEffect(() => setCfg(atual), [atual]);
  // Indicadores novos (ainda não listados) entram no fim, ocultos.
  const lista = useMemo(() => {
    const ids = new Set(cfg.indicadores.map((i) => i.id));
    return [...cfg.indicadores.filter((i) => PRESETS[i.id]), ...Object.keys(PRESETS).filter((id) => !ids.has(id)).map((id) => ({ id, visivel: false }))];
  }, [cfg.indicadores]);
  const gravar = (novo: CfgPainel) => {
    setCfg(novo);
    salvar("configuracoes", { valor: novo }, { chave: "painel" }, "Painel atualizado para toda a equipe.");
  };
  return (
    <SecaoAdmin titulo="Painel Hoje" descricao="Escolha quais indicadores aparecem e em que ordem. Cada indicador abre a lista filtrada correspondente; quem não tem permissão para o módulo não vê o indicador.">
      <ol className="flex flex-col divide-y divide-crm-linha rounded-2xl border border-crm-linha bg-white">
        {lista.map((ind, i) => {
          const p = PRESETS[ind.id];
          return (
            <li key={ind.id} className={`flex items-center gap-3 px-3 py-2 ${ind.visivel ? "" : "bg-crm-fundo"}`}>
              <BotoesOrdem rotulo={p.rotulo} primeiro={i === 0} ultimo={i === lista.length - 1} aoSubir={() => gravar({ ...cfg, indicadores: mover(lista, i, i - 1) })} aoDescer={() => gravar({ ...cfg, indicadores: mover(lista, i, i + 1) })} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${ind.visivel ? "" : "text-crm-tinta-3"}`}>{p.rotulo}</p>
                <p className="text-xs text-crm-tinta-3">
                  {p.descricao({ usuarioId: "", somenteMeus: false, etapaInicialLead: null, etapasLeadAbertas: [], horasSemRetorno: cfg.horas_sem_retorno, diasPrazosProximos: cfg.dias_prazos_proximos })}
                </p>
              </div>
              <Botao
                tamanho="sm"
                variante={ind.visivel ? "secundario" : "fantasma"}
                icone={ind.visivel ? <Eye size={13} /> : <EyeOff size={13} />}
                aria-pressed={ind.visivel}
                onClick={() => gravar({ ...cfg, indicadores: lista.map((x) => (x.id === ind.id ? { ...x, visivel: !x.visivel } : x)) })}
              >
                {ind.visivel ? "Visível" : "Oculto"}
              </Botao>
            </li>
          );
        })}
      </ol>
      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <GrupoCampo rotulo="“Leads sem retorno” após (horas)">
          {(p) => <Entrada {...p} type="number" min={1} max={720} defaultValue={cfg.horas_sem_retorno} key={`h${cfg.horas_sem_retorno}`} onBlur={(e) => { const n = Math.max(1, Math.min(720, Number(e.target.value) || 24)); if (n !== cfg.horas_sem_retorno) gravar({ ...cfg, indicadores: lista, horas_sem_retorno: n }); }} />}
        </GrupoCampo>
        <GrupoCampo rotulo="“Prazos próximos”: próximos (dias)">
          {(p) => <Entrada {...p} type="number" min={1} max={60} defaultValue={cfg.dias_prazos_proximos} key={`d${cfg.dias_prazos_proximos}`} onBlur={(e) => { const n = Math.max(1, Math.min(60, Number(e.target.value) || 7)); if (n !== cfg.dias_prazos_proximos) gravar({ ...cfg, indicadores: lista, dias_prazos_proximos: n }); }} />}
        </GrupoCampo>
      </div>
    </SecaoAdmin>
  );
}

// ---------------------------------------------------------------------------
// Textos operacionais, nomenclatura e aparência
// ---------------------------------------------------------------------------

const TEXTOS: { chave: string; rotulo: string; ajuda: string; longo?: boolean }[] = [
  { chave: "aviso_prazos", rotulo: "Aviso sobre prazos processuais", ajuda: "Exibido no cadastro e nos quadros de prazos.", longo: true },
  { chave: "mensagem_link_documentos", rotulo: "Mensagem pronta do link de documentos (WhatsApp)", ajuda: "Use {nome}, {link} e {validade}. O CRM apenas abre o WhatsApp de quem clicou; nada é enviado automaticamente.", longo: true },
  { chave: "portal_titulo", rotulo: "Título da página de envio de documentos", ajuda: "Página pública acessada pelo cliente com o link seguro." },
  { chave: "portal_instrucoes", rotulo: "Instruções da página de envio", ajuda: "Orientações gerais ao cliente.", longo: true },
  { chave: "portal_rodape", rotulo: "Rodapé da página de envio", ajuda: "Ex.: informação de privacidade.", longo: true },
];

const NOMES: { chave: string; rotulo: string }[] = [
  { chave: "hoje", rotulo: "Painel" },
  { chave: "leads", rotulo: "Leads (plural)" },
  { chave: "lead", rotulo: "Lead (singular)" },
  { chave: "clientes", rotulo: "Clientes (plural)" },
  { chave: "cliente", rotulo: "Cliente (singular)" },
  { chave: "casos", rotulo: "Casos (plural)" },
  { chave: "caso", rotulo: "Caso (singular)" },
  { chave: "tarefas", rotulo: "Tarefas" },
  { chave: "agenda", rotulo: "Agenda" },
  { chave: "documentos", rotulo: "Documentos" },
  { chave: "financeiro", rotulo: "Financeiro" },
  { chave: "relatorios", rotulo: "Relatórios" },
];

export function AdminTextos() {
  const config = useConfig();
  const { salvar } = useAdmin();
  const textos = config.cfg<Record<string, string>>("textos", {});
  const nomes = config.cfg<Record<string, string>>("nomenclaturas", {});
  const aparencia = config.cfg<{ destaque?: string; densidade?: string }>("aparencia", {});
  const portal = config.cfg<{ validade_dias_padrao?: number; tamanho_maximo_mb?: number }>("portal", {});
  return (
    <div className="flex flex-col gap-8">
      <SecaoAdmin titulo="Aparência" descricao="Opções que preservam a identidade visual do site (cores e tipografia da marca).">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <GrupoCampo rotulo="Cor de destaque">
            {(p) => (
              <Selecao {...p} value={aparencia.destaque ?? "floresta"} onChange={(e) => salvar("configuracoes", { valor: { ...aparencia, destaque: e.target.value } }, { chave: "aparencia" }, "Aparência atualizada.")}>
                {Object.entries(DESTAQUES).map(([id, d]) => (
                  <option key={id} value={id}>
                    {d.rotulo}
                  </option>
                ))}
              </Selecao>
            )}
          </GrupoCampo>
          <GrupoCampo rotulo="Densidade dos quadros">
            {(p) => (
              <Selecao {...p} value={aparencia.densidade ?? "confortavel"} onChange={(e) => salvar("configuracoes", { valor: { ...aparencia, densidade: e.target.value } }, { chave: "aparencia" }, "Aparência atualizada.")}>
                <option value="confortavel">Confortável</option>
                <option value="compacta">Compacta (mais linhas na tela)</option>
              </Selecao>
            )}
          </GrupoCampo>
        </div>
      </SecaoAdmin>
      <SecaoAdmin titulo="Nomes exibidos" descricao="Nomenclatura do menu e dos títulos. A estrutura dos dados não muda.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NOMES.map((n) => (
            <GrupoCampo key={n.chave} rotulo={n.rotulo}>
              {(p) => (
                <Entrada
                  {...p}
                  defaultValue={nomes[n.chave] ?? NOMENCLATURA_PADRAO[n.chave]}
                  key={nomes[n.chave] ?? n.chave}
                  onBlur={(e) => {
                    const v = e.target.value.trim() || NOMENCLATURA_PADRAO[n.chave];
                    if (v !== (nomes[n.chave] ?? NOMENCLATURA_PADRAO[n.chave])) salvar("configuracoes", { valor: { ...nomes, [n.chave]: v.slice(0, 40) } }, { chave: "nomenclaturas" }, "Nome atualizado.");
                  }}
                />
              )}
            </GrupoCampo>
          ))}
        </div>
      </SecaoAdmin>
      <SecaoAdmin titulo="Textos operacionais">
        <div className="grid gap-4">
          {TEXTOS.map((t) => (
            <GrupoCampo key={t.chave} rotulo={t.rotulo} ajuda={t.ajuda}>
              {(p) =>
                t.longo ? (
                  <AreaTexto {...p} rows={3} defaultValue={textos[t.chave] ?? ""} key={textos[t.chave] ?? t.chave} onBlur={(e) => e.target.value !== (textos[t.chave] ?? "") && salvar("configuracoes", { valor: { ...textos, [t.chave]: e.target.value.slice(0, 2000) } }, { chave: "textos" }, "Texto salvo.")} />
                ) : (
                  <Entrada {...p} defaultValue={textos[t.chave] ?? ""} key={textos[t.chave] ?? t.chave} onBlur={(e) => e.target.value !== (textos[t.chave] ?? "") && salvar("configuracoes", { valor: { ...textos, [t.chave]: e.target.value.slice(0, 200) } }, { chave: "textos" }, "Texto salvo.")} />
                )
              }
            </GrupoCampo>
          ))}
        </div>
      </SecaoAdmin>
      <SecaoAdmin titulo="Envio de documentos pelo cliente" descricao="Padrões do link seguro individual (expira e pode ser revogado).">
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <GrupoCampo rotulo="Validade padrão do link (dias)">
            {(p) => <Entrada {...p} type="number" min={1} max={30} defaultValue={portal.validade_dias_padrao ?? 7} key={`v${portal.validade_dias_padrao}`} onBlur={(e) => salvar("configuracoes", { valor: { ...portal, validade_dias_padrao: Math.max(1, Math.min(30, Number(e.target.value) || 7)) } }, { chave: "portal" }, "Padrão salvo.")} />}
          </GrupoCampo>
          <GrupoCampo rotulo="Tamanho máximo por arquivo (MB)" ajuda="Limite do armazenamento: até 50 MB.">
            {(p) => <Entrada {...p} type="number" min={1} max={50} defaultValue={portal.tamanho_maximo_mb ?? 25} key={`t${portal.tamanho_maximo_mb}`} onBlur={(e) => salvar("configuracoes", { valor: { ...portal, tamanho_maximo_mb: Math.max(1, Math.min(50, Number(e.target.value) || 25)) } }, { chave: "portal" }, "Padrão salvo.")} />}
          </GrupoCampo>
        </div>
      </SecaoAdmin>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prazos: padrões do cadastro, auxílio de contagem e feriados
// ---------------------------------------------------------------------------

export function AdminPrazos() {
  const config = useConfig();
  const { salvar, excluir } = useAdmin();
  const cfg = config.cfg<{ alertas_padrao?: number[]; hora_padrao?: string; recesso?: { ativo: boolean; inicio: string; fim: string } }>("prazos", {});
  const recesso = cfg.recesso ?? { ativo: true, inicio: "12-20", fim: "01-20" };
  const [ano, setAno] = useState(lerYmd(hojeSP()).ano);
  const [novo, setNovo] = useState({ data: "", descricao: "", abrangencia: "nacional", uf: "", municipio: "", tribunal: "" });
  const feriados = useQuery({
    queryKey: ["feriados", "admin", ano],
    queryFn: async () => (await executar(supabase().from("feriados").select("*").gte("data", `${ano}-01-01`).lte("data", `${ano}-12-31`).order("data"))) as Feriado[],
  });
  const salvarCfg = (alt: Record<string, unknown>) => salvar("configuracoes", { valor: { ...cfg, ...alt } }, { chave: "prazos" }, "Padrões de prazos salvos.");
  const mmdd = (v: string) => (/^\d{2}-\d{2}$/.test(v) ? v : null);

  return (
    <div className="flex flex-col gap-8">
      <SecaoAdmin titulo="Padrões dos prazos processuais" descricao={config.texto("aviso_prazos", "")}>
        <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
          <GrupoCampo rotulo="Alertas padrão (dias antes)" ajuda="Separe por vírgula.">
            {(p) => <Entrada {...p} defaultValue={(cfg.alertas_padrao ?? [5, 2, 1, 0]).join(", ")} key={(cfg.alertas_padrao ?? []).join()} onBlur={(e) => salvarCfg({ alertas_padrao: [...new Set(e.target.value.split(/[,; ]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 60))].sort((a, b) => b - a) })} />}
          </GrupoCampo>
          <GrupoCampo rotulo="Horário limite padrão">
            {(p) => <Entrada {...p} type="time" defaultValue={cfg.hora_padrao ?? "23:59"} key={cfg.hora_padrao} onBlur={(e) => e.target.value && salvarCfg({ hora_padrao: e.target.value })} />}
          </GrupoCampo>
        </div>
        <fieldset className="flex max-w-3xl flex-col gap-3 rounded-2xl border border-crm-linha bg-white p-4">
          <legend className="px-1 text-sm font-bold">Suspensão de prazos no fim do ano (auxílio de contagem)</legend>
          <CaixaSelecao marcado={recesso.ativo} aoAlterar={(v) => salvarCfg({ recesso: { ...recesso, ativo: v } })} rotulo="Sugerir a consideração da suspensão no auxílio de contagem" descricao="Apenas um parâmetro inicial do auxílio — a conferência do prazo continua obrigatória." />
          <div className="grid gap-3 sm:grid-cols-2">
            <GrupoCampo rotulo="Início (MM-DD)">{(p) => <Entrada {...p} defaultValue={recesso.inicio} key={recesso.inicio} onBlur={(e) => mmdd(e.target.value) && salvarCfg({ recesso: { ...recesso, inicio: e.target.value } })} />}</GrupoCampo>
            <GrupoCampo rotulo="Fim (MM-DD)">{(p) => <Entrada {...p} defaultValue={recesso.fim} key={recesso.fim} onBlur={(e) => mmdd(e.target.value) && salvarCfg({ recesso: { ...recesso, fim: e.target.value } })} />}</GrupoCampo>
          </div>
        </fieldset>
      </SecaoAdmin>

      <SecaoAdmin
        titulo="Feriados e suspensões"
        descricao="Usados somente pelo auxílio de contagem. A lista inicial traz datas usuais e deve ser conferida com o calendário oficial de cada tribunal."
        acoes={
          <Selecao aria-label="Ano" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-8 max-w-28 text-xs">
            {[ano - 1, ano, ano + 1, ano + 2].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Selecao>
        }
      >
        {feriados.isLoading ? (
          <Carregando />
        ) : feriados.error ? (
          <ErroCarga mensagem={mensagemErro(feriados.error)} aoTentarNovamente={() => feriados.refetch()} />
        ) : (feriados.data ?? []).length === 0 ? (
          <Vazio compacto titulo={`Nenhum feriado cadastrado em ${ano}`} />
        ) : (
          <ul className="flex flex-col divide-y divide-crm-linha rounded-2xl border border-crm-linha bg-white">
            {(feriados.data ?? []).map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <span className="w-24 font-semibold tabular-nums">{formatarData(f.data)}</span>
                <span className="min-w-0 flex-1">{f.descricao}</span>
                <Selo tom={f.abrangencia === "nacional" ? "verde" : "neutro"}>{f.abrangencia}</Selo>
                {(f.uf || f.municipio || f.tribunal) && <span className="text-xs text-crm-tinta-3">{[f.tribunal, f.municipio, f.uf].filter(Boolean).join(" · ")}</span>}
                <button
                  type="button"
                  className="rounded p-1 text-crm-tinta-3 hover:bg-crm-perigo-claro hover:text-crm-perigo"
                  aria-label={`Excluir feriado de ${formatarData(f.data)}`}
                  onClick={async () => {
                    if (await confirmarSimples({ titulo: "Excluir feriado?", mensagem: `${formatarData(f.data)} — ${f.descricao}`, confirmar: "Excluir", perigo: true })) excluir("feriados", { id: f.id }, "Feriado excluído.", ["feriados"]);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="grid gap-2 rounded-2xl border border-dashed border-crm-linha-forte bg-white p-3 sm:grid-cols-[140px_1fr_140px_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!novo.data || novo.descricao.trim().length < 2) return;
            const ok = await salvar("feriados", { data: novo.data, descricao: novo.descricao.trim(), abrangencia: novo.abrangencia, uf: novo.uf || null, municipio: novo.municipio || null, tribunal: novo.tribunal || null }, undefined, "Feriado cadastrado.", ["feriados"]);
            if (ok) setNovo({ data: "", descricao: "", abrangencia: "nacional", uf: "", municipio: "", tribunal: "" });
          }}
        >
          <Entrada aria-label="Data" type="date" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })} />
          <Entrada aria-label="Descrição" placeholder="Descrição (ex.: Aniversário da cidade)" value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
          <Selecao aria-label="Abrangência" value={novo.abrangencia} onChange={(e) => setNovo({ ...novo, abrangencia: e.target.value })}>
            <option value="nacional">Nacional</option>
            <option value="estadual">Estadual</option>
            <option value="municipal">Municipal</option>
            <option value="forense">Forense / tribunal</option>
          </Selecao>
          <Botao type="submit" tamanho="sm" icone={<Plus size={14} />} disabled={!novo.data || novo.descricao.trim().length < 2}>
            Adicionar
          </Botao>
          {novo.abrangencia !== "nacional" && (
            <div className="grid gap-2 sm:col-span-4 sm:grid-cols-3">
              <Entrada aria-label="UF" placeholder="UF" maxLength={2} value={novo.uf} onChange={(e) => setNovo({ ...novo, uf: e.target.value.toUpperCase() })} />
              <Entrada aria-label="Município" placeholder="Município" value={novo.municipio} onChange={(e) => setNovo({ ...novo, municipio: e.target.value })} />
              <Entrada aria-label="Tribunal" placeholder="Tribunal (ex.: TJSC)" value={novo.tribunal} onChange={(e) => setNovo({ ...novo, tribunal: e.target.value.toUpperCase() })} />
            </div>
          )}
        </form>
      </SecaoAdmin>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visualizações compartilhadas dos quadros
// ---------------------------------------------------------------------------

const NOMES_QUADROS: Record<string, string> = {
  leads: "Leads",
  clientes: "Clientes",
  casos: "Casos",
  tarefas: "Tarefas",
  prazos: "Prazos",
  documentos: "Documentos",
  financeiro: "Financeiro",
  agenda: "Agenda",
};

export function AdminVisualizacoes() {
  const config = useConfig();
  const { salvar, excluir } = useAdmin();
  const consulta = useQuery({
    queryKey: ["visualizacoes", "admin"],
    queryFn: async () => (await executar(supabase().from("visualizacoes").select("*").eq("compartilhada", true).order("quadro").order("ordem"))) as Visualizacao[],
  });
  const lista = consulta.data ?? [];
  return (
    <SecaoAdmin
      titulo="Visualizações compartilhadas"
      descricao="Filtros, colunas e agrupamentos salvos nos quadros e compartilhados com a equipe. Para criar, monte a visualização no quadro e use “Salvar visualização” marcando “Compartilhar”."
    >
      {consulta.isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Vazio compacto titulo="Nenhuma visualização compartilhada" descricao="Elas aparecem aqui depois de salvas em um quadro." />
      ) : (
        <ul className="flex flex-col divide-y divide-crm-linha rounded-2xl border border-crm-linha bg-white">
          {lista.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <Selo>{NOMES_QUADROS[v.quadro] ?? v.quadro}</Selo>
              <span className="min-w-0 flex-1 font-semibold">{v.nome}</span>
              <span className="text-xs text-crm-tinta-3">por {config.usuario(v.dono_id)?.nome ?? "—"} · {v.tipo}</span>
              <Botao
                tamanho="sm"
                variante={v.padrao ? "sutil" : "fantasma"}
                icone={<Star size={13} />}
                aria-pressed={v.padrao}
                onClick={() => salvar("visualizacoes", { padrao: !v.padrao }, { id: v.id }, v.padrao ? "Deixou de ser a visualização padrão." : "Definida como padrão do quadro.", ["visualizacoes"])}
              >
                {v.padrao ? "Padrão do quadro" : "Tornar padrão"}
              </Botao>
              <Botao tamanho="sm" variante="fantasma" onClick={() => salvar("visualizacoes", { compartilhada: false, padrao: false }, { id: v.id }, "Visualização deixou de ser compartilhada.", ["visualizacoes"])}>
                Parar de compartilhar
              </Botao>
              <button
                type="button"
                className="rounded p-1 text-crm-tinta-3 hover:bg-crm-perigo-claro hover:text-crm-perigo"
                aria-label={`Excluir visualização ${v.nome}`}
                onClick={async () => {
                  if (await confirmarSimples({ titulo: `Excluir “${v.nome}”?`, mensagem: "A visualização some para toda a equipe. Os dados não são afetados.", confirmar: "Excluir", perigo: true })) excluir("visualizacoes", { id: v.id }, "Visualização excluída.", ["visualizacoes"]);
                }}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SecaoAdmin>
  );
}

// ---------------------------------------------------------------------------
// Integrações (situação real — nada é declarado ativo sem estar conectado)
// ---------------------------------------------------------------------------

const INTEGRACOES: { nome: string; situacao: "ativa" | "nao"; detalhe: string }[] = [
  { nome: "Banco de dados, autenticação e arquivos (Supabase)", situacao: "ativa", detalhe: "Dados, login, regras de acesso por linha, armazenamento privado e atualizações em tempo real." },
  { nome: "Quiz do site → leads", situacao: "ativa", detalhe: "Respostas do quiz chegam pela função segura quiz-lead, com validação, deduplicação e proteção contra abuso." },
  { nome: "Link seguro de envio de documentos", situacao: "ativa", detalhe: "Links individuais com validade e revogação; arquivos vão para o armazenamento privado." },
  { nome: "Consulta automática de processos nos tribunais", situacao: "nao", detalhe: "Não conectada. Processos, andamentos e prazos são cadastrados manualmente; a estrutura (fonte, identificador externo, sincronização) está preparada." },
  { nome: "Envio automático de WhatsApp, e-mail ou SMS", situacao: "nao", detalhe: "Não configurado. O CRM apenas abre o WhatsApp de quem clicou com a mensagem pronta; automações geram avisos internos." },
  { nome: "Bancos, boletos, Pix automático e notas fiscais", situacao: "nao", detalhe: "Não implementado. Pagamentos são registrados manualmente com comprovante; há campo de identificador externo para futura integração." },
  { nome: "E-mails de redefinição de senha", situacao: "nao", detalhe: "Dependem do servidor de e-mail (SMTP) configurado no Supabase. Sem ele, o administrador define uma nova senha em Usuários." },
];

export function AdminIntegracoes() {
  return (
    <SecaoAdmin titulo="Integrações" descricao="Situação real de cada integração. Integrações não conectadas não são simuladas.">
      <Aviso>Para ativar uma integração futura (ex.: consulta processual ou envio de mensagens), é necessário contratar o serviço, configurar credenciais em variáveis de ambiente seguras e implementar a conexão — nenhuma credencial fica no navegador.</Aviso>
      <ul className="flex flex-col divide-y divide-crm-linha rounded-2xl border border-crm-linha bg-white">
        {INTEGRACOES.map((i) => (
          <li key={i.nome} className="flex items-start gap-3 px-4 py-3">
            {i.situacao === "ativa" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-crm-sucesso" aria-hidden /> : <CircleSlash size={18} className="mt-0.5 shrink-0 text-crm-tinta-3" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {i.nome}
                {i.situacao === "ativa" ? <Selo tom="sucesso">Em uso</Selo> : <Selo>Não conectada</Selo>}
              </p>
              <p className="text-sm text-crm-tinta-2">{i.detalhe}</p>
            </div>
          </li>
        ))}
      </ul>
    </SecaoAdmin>
  );
}
