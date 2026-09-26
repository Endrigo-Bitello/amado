"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, FolderPlus, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { aviso, comSalvamento } from "../../_lib/avisos";
import { opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { useRota } from "../../_lib/rotas";
import { supabase } from "../../_lib/supabase";
import type { ModeloChecklist, ModeloChecklistGrupo, ModeloChecklistItem } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { Alternador, AreaTexto, CaixaSelecao, Entrada, GrupoCampo, Selecao } from "../../_ui/Campos";
import { confirmarSimples } from "../../_ui/Dialogos";
import { SeletorCampo } from "../../_ui/Seletores";
import { Modal } from "../../_ui/Sobreposicoes";
import { Carregando, ErroCarga, Pilula, Selo, Vazio } from "../../_ui/Visuais";
import { BotoesOrdem, mover, SecaoAdmin, useAdmin } from "./comum";
import { BotaoCor, TextoInline } from "./Funis";

// ---------------------------------------------------------------------------
// Categorias de documentos
// ---------------------------------------------------------------------------

function AdminCategorias() {
  const config = useConfig();
  const { salvar, reordenar } = useAdmin();
  const [nova, setNova] = useState("");
  const categorias = config.categorias.slice().sort((a, b) => a.ordem - b.ordem);
  return (
    <SecaoAdmin titulo="Categorias de documentos" descricao="Agrupam documentos e definem o acesso: categorias marcadas como dados de saúde ou financeiras ficam restritas a quem tem essas permissões.">
      <ol className="flex flex-col divide-y divide-crm-linha rounded-2xl border border-crm-linha bg-white">
        {categorias.map((c, i) => (
          <li key={c.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 ${c.ativo ? "" : "bg-crm-fundo opacity-70"}`}>
            <BotoesOrdem
              rotulo={c.nome}
              primeiro={i === 0}
              ultimo={i === categorias.length - 1}
              aoSubir={() => reordenar("categorias_documento", mover(categorias, i, i - 1).map((x) => ({ id: x.id })))}
              aoDescer={() => reordenar("categorias_documento", mover(categorias, i, i + 1).map((x) => ({ id: x.id })))}
            />
            <BotaoCor cor={c.cor} rotulo={c.nome} aoAlterar={(cor) => salvar("categorias_documento", { cor }, { id: c.id })} />
            <TextoInline valor={c.nome} rotulo={`Nome da categoria ${c.nome}`} aoSalvar={(v) => v && salvar("categorias_documento", { nome: v }, { id: c.id }, "Categoria renomeada.")} className="min-w-56 flex-1 font-semibold" />
            <CaixaSelecao
              marcado={c.clinico}
              rotulo={<span className="inline-flex items-center gap-1"><Lock size={12} className="text-crm-perigo" aria-hidden /> Dados de saúde</span>}
              aoAlterar={async (v) => {
                if (!v && !(await confirmarSimples({ titulo: "Remover a proteção de dados de saúde?", mensagem: "Novos documentos desta categoria ficarão visíveis para quem vê documentos em geral. Documentos já criados mantêm a marcação atual.", confirmar: "Remover proteção", perigo: true }))) return;
                salvar("categorias_documento", { clinico: v }, { id: c.id }, "Categoria atualizada.");
              }}
            />
            <CaixaSelecao marcado={c.financeiro} rotulo="Financeira" aoAlterar={(v) => salvar("categorias_documento", { financeiro: v }, { id: c.id }, "Categoria atualizada.")} />
            <Alternador ativo={c.ativo} aoAlterar={(v) => salvar("categorias_documento", { ativo: v }, { id: c.id })} rotulo={`${c.ativo ? "Ativa" : "Arquivada"}: ${c.nome}`} />
          </li>
        ))}
      </ol>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (nova.trim() && (await salvar("categorias_documento", { nome: nova.trim(), ordem: (categorias.length + 1) * 10 }, undefined, "Categoria criada."))) setNova("");
        }}
      >
        <Entrada aria-label="Nova categoria" placeholder="Nome da nova categoria" value={nova} onChange={(e) => setNova(e.target.value)} className="max-w-sm" />
        <Botao type="submit" tamanho="sm" icone={<Plus size={14} />} disabled={!nova.trim()}>
          Adicionar
        </Botao>
      </form>
    </SecaoAdmin>
  );
}

// ---------------------------------------------------------------------------
// Modelos de checklist
// ---------------------------------------------------------------------------

export function AdminChecklists() {
  const { parametro, definirParametros } = useRota();
  const modeloId = parametro("modelo");
  if (modeloId) return <EditorModelo id={modeloId} aoVoltar={() => definirParametros({ modelo: null })} />;
  return (
    <div className="flex flex-col gap-8">
      <ListaModelos aoAbrir={(id) => definirParametros({ modelo: id })} />
      <AdminCategorias />
    </div>
  );
}

function useModelosCompletos() {
  return useQuery({
    queryKey: ["modelos", "checklist", "lista"],
    queryFn: async () => {
      const s = supabase();
      const [modelos, itens] = await Promise.all([
        executar(s.from("modelos_checklist").select("*").order("nome")),
        executar(s.from("modelos_checklist_itens").select("id, modelo_id, obrigatoriedade, ativo")),
      ]);
      return { modelos: (modelos ?? []) as ModeloChecklist[], itens: (itens ?? []) as Pick<ModeloChecklistItem, "id" | "modelo_id" | "obrigatoriedade" | "ativo">[] };
    },
  });
}

function ListaModelos({ aoAbrir }: { aoAbrir: (id: string) => void }) {
  const config = useConfig();
  const { salvar } = useAdmin();
  const { invalidar } = useGravacao();
  const consulta = useModelosCompletos();
  const [duplicando, setDuplicando] = useState<string | null>(null);

  const criar = async () => {
    try {
      const novo = (await comSalvamento(() => executar(supabase().from("modelos_checklist").insert({ nome: "Novo modelo de checklist", aviso: "Modelo revisável: adapte ao caso concreto." }).select("id").single()))) as { id: string };
      invalidar("config", "modelos");
      aoAbrir(novo.id);
    } catch (e) {
      aviso.erro(mensagemErro(e));
    }
  };

  const duplicar = async (m: ModeloChecklist) => {
    setDuplicando(m.id);
    try {
      await comSalvamento(async () => {
        const s = supabase();
        const copia = (await executar(s.from("modelos_checklist").insert({ nome: `${m.nome} (cópia)`.slice(0, 160), descricao: m.descricao, tipo_demanda_id: m.tipo_demanda_id, aviso: m.aviso, ativo: false }).select("id").single())) as { id: string };
        const grupos = (await executar(s.from("modelos_checklist_grupos").select("*").eq("modelo_id", m.id))) as ModeloChecklistGrupo[];
        const mapa = new Map<string, string>();
        for (const g of grupos) {
          const ng = (await executar(s.from("modelos_checklist_grupos").insert({ modelo_id: copia.id, nome: g.nome, descricao: g.descricao, ordem: g.ordem }).select("id").single())) as { id: string };
          mapa.set(g.id, ng.id);
        }
        const itens = (await executar(s.from("modelos_checklist_itens").select("*").eq("modelo_id", m.id))) as ModeloChecklistItem[];
        if (itens.length) {
          await executar(
            s.from("modelos_checklist_itens").insert(
              itens.map((item) => {
                const resto = Object.fromEntries(Object.entries(item).filter(([k]) => !["id", "created_at", "updated_at", "modelo_id", "grupo_id"].includes(k)));
                return { ...resto, modelo_id: copia.id, grupo_id: item.grupo_id ? mapa.get(item.grupo_id) ?? null : null };
              }) as never,
            ),
          );
        }
        return copia.id;
      });
      aviso.sucesso("Modelo duplicado (inativo). Revise e ative quando estiver pronto.");
      invalidar("config", "modelos");
    } catch (e) {
      aviso.erro(mensagemErro(e));
    } finally {
      setDuplicando(null);
    }
  };

  if (consulta.isLoading) return <Carregando />;
  if (consulta.error) return <ErroCarga mensagem={mensagemErro(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />;
  const { modelos, itens } = consulta.data!;
  return (
    <SecaoAdmin
      titulo="Modelos de checklist de documentos"
      descricao="Modelos por tipo de demanda: grupos, documentos exigidos, o que pedir ao cliente, instruções internas, prazos, revisores e regras condicionais. O advogado adapta o checklist em cada caso."
      acoes={
        <Botao variante="primario" tamanho="sm" icone={<Plus size={14} />} onClick={criar}>
          Novo modelo
        </Botao>
      }
    >
      {modelos.length === 0 ? (
        <Vazio compacto titulo="Nenhum modelo" />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {modelos.map((m) => {
            const doModelo = itens.filter((i) => i.modelo_id === m.id && i.ativo);
            return (
              <li key={m.id} className={`flex flex-col gap-2 rounded-2xl border border-crm-linha bg-white p-4 ${m.ativo ? "" : "opacity-75"}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.nome}</p>
                    <p className="text-xs text-crm-tinta-3">
                      {config.tipo(m.tipo_demanda_id)?.nome ?? "Sem tipo de demanda vinculado"} · {doModelo.length} documento(s) · {doModelo.filter((i) => i.obrigatoriedade === "obrigatorio").length} obrigatório(s) · {doModelo.filter((i) => i.obrigatoriedade === "condicional").length} condicional(is)
                    </p>
                  </div>
                  {m.ativo ? <Selo tom="sucesso">Ativo</Selo> : <Selo>Inativo</Selo>}
                </div>
                {m.descricao && <p className="text-sm text-crm-tinta-2">{m.descricao}</p>}
                <div className="flex flex-wrap gap-2">
                  <Botao tamanho="sm" icone={<Pencil size={13} />} onClick={() => aoAbrir(m.id)}>
                    Editar
                  </Botao>
                  <Botao tamanho="sm" variante="fantasma" icone={<Copy size={13} />} carregando={duplicando === m.id} onClick={() => duplicar(m)}>
                    Duplicar
                  </Botao>
                  <Alternador ativo={m.ativo} mostrarRotulo rotulo={m.ativo ? "Disponível para aplicar" : "Indisponível"} aoAlterar={(v) => salvar("modelos_checklist", { ativo: v }, { id: m.id }, v ? "Modelo ativado." : "Modelo desativado (checklists já aplicados não mudam).", ["config", "modelos"])} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SecaoAdmin>
  );
}

function EditorModelo({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const config = useConfig();
  const { salvar, excluir, reordenar } = useAdmin();
  const [item, setItem] = useState<{ item: ModeloChecklistItem | null; grupoId: string | null } | null>(null);
  const [novoGrupo, setNovoGrupo] = useState("");
  const consulta = useQuery({
    queryKey: ["modelos", "checklist", id],
    queryFn: async () => {
      const s = supabase();
      const [modelo, grupos, itens] = await Promise.all([
        executar(s.from("modelos_checklist").select("*").eq("id", id).maybeSingle()),
        executar(s.from("modelos_checklist_grupos").select("*").eq("modelo_id", id).order("ordem")),
        executar(s.from("modelos_checklist_itens").select("*").eq("modelo_id", id).order("ordem")),
      ]);
      return { modelo: modelo as ModeloChecklist | null, grupos: (grupos ?? []) as ModeloChecklistGrupo[], itens: (itens ?? []) as ModeloChecklistItem[] };
    },
  });
  const chaves = ["modelos", "config"];
  if (consulta.isLoading) return <Carregando />;
  if (consulta.error) return <ErroCarga mensagem={mensagemErro(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />;
  const { modelo: m, grupos, itens } = consulta.data!;
  if (!m) return <Vazio titulo="Modelo não encontrado" acao={<Botao onClick={aoVoltar}>Voltar</Botao>} />;

  const secoes: { grupo: ModeloChecklistGrupo | null; itens: ModeloChecklistItem[] }[] = [
    ...grupos.map((g) => ({ grupo: g, itens: itens.filter((i) => i.grupo_id === g.id) })),
    ...(itens.some((i) => !i.grupo_id || !grupos.some((g) => g.id === i.grupo_id)) ? [{ grupo: null, itens: itens.filter((i) => !i.grupo_id || !grupos.some((g) => g.id === i.grupo_id)) }] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={aoVoltar} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-crm-tinta-2 hover:text-crm-tinta">
        <ArrowLeft size={15} aria-hidden /> Modelos de checklist
      </button>
      <SecaoAdmin titulo="Dados do modelo" descricao="Alterações valem para as próximas aplicações; checklists já aplicados em casos não mudam.">
        <div className="grid gap-4 rounded-2xl border border-crm-linha bg-white p-4 sm:grid-cols-2">
          <GrupoCampo rotulo="Nome" className="sm:col-span-2">{(p) => <Entrada {...p} defaultValue={m.nome} key={m.nome} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== m.nome && salvar("modelos_checklist", { nome: e.target.value.trim() }, { id: m.id }, "Nome salvo.", chaves)} />}</GrupoCampo>
          <GrupoCampo rotulo="Tipo de demanda sugerido">
            {(p) => (
              <Selecao {...p} value={m.tipo_demanda_id ?? ""} onChange={(e) => salvar("modelos_checklist", { tipo_demanda_id: e.target.value || null }, { id: m.id }, "Tipo vinculado.", chaves)}>
                <option value="">Nenhum</option>
                {config.tiposDemanda.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </GrupoCampo>
          <div className="flex items-end">
            <Alternador ativo={m.ativo} mostrarRotulo rotulo={m.ativo ? "Disponível para aplicar nos casos" : "Indisponível (rascunho)"} aoAlterar={(v) => salvar("modelos_checklist", { ativo: v }, { id: m.id }, v ? "Modelo ativado." : "Modelo desativado.", chaves)} />
          </div>
          <GrupoCampo rotulo="Descrição" className="sm:col-span-2">{(p) => <AreaTexto {...p} rows={2} defaultValue={m.descricao ?? ""} key={`d${m.descricao}`} onBlur={(e) => e.target.value !== (m.descricao ?? "") && salvar("modelos_checklist", { descricao: e.target.value || null }, { id: m.id }, "Descrição salva.", chaves)} />}</GrupoCampo>
          <GrupoCampo rotulo="Aviso exibido ao aplicar" ajuda="Ex.: lembrar que os itens não são requisitos jurídicos universais." className="sm:col-span-2">
            {(p) => <AreaTexto {...p} rows={2} defaultValue={m.aviso ?? ""} key={`a${m.aviso}`} onBlur={(e) => e.target.value !== (m.aviso ?? "") && salvar("modelos_checklist", { aviso: e.target.value || null }, { id: m.id }, "Aviso salvo.", chaves)} />}
          </GrupoCampo>
        </div>
      </SecaoAdmin>

      <SecaoAdmin
        titulo={`Documentos do modelo (${itens.filter((i) => i.ativo).length})`}
        descricao="Organize em grupos. Itens condicionais usam regras seguras (campo, operador e valor) — nenhuma fórmula ou código é executado."
        acoes={
          <Botao variante="primario" tamanho="sm" icone={<Plus size={14} />} onClick={() => setItem({ item: null, grupoId: grupos[0]?.id ?? null })}>
            Novo documento
          </Botao>
        }
      >
        {secoes.map(({ grupo, itens: lista }) => {
          const gi = grupo ? grupos.findIndex((g) => g.id === grupo.id) : -1;
          return (
            <section key={grupo?.id ?? "sem"} className="rounded-2xl border border-crm-linha bg-white">
              <header className="flex flex-wrap items-center gap-2 border-b border-crm-linha px-3 py-2">
                {grupo ? (
                  <>
                    <BotoesOrdem
                      rotulo={grupo.nome}
                      primeiro={gi === 0}
                      ultimo={gi === grupos.length - 1}
                      aoSubir={() => reordenar("modelos_checklist_grupos", mover(grupos, gi, gi - 1).map((x) => ({ id: x.id })), chaves)}
                      aoDescer={() => reordenar("modelos_checklist_grupos", mover(grupos, gi, gi + 1).map((x) => ({ id: x.id })), chaves)}
                    />
                    <TextoInline valor={grupo.nome} rotulo={`Nome do grupo ${grupo.nome}`} aoSalvar={(v) => v && salvar("modelos_checklist_grupos", { nome: v }, { id: grupo.id }, "Grupo renomeado.", chaves)} className="min-w-56 flex-1 font-bold" />
                    <Botao tamanho="sm" variante="fantasma" icone={<Plus size={13} />} onClick={() => setItem({ item: null, grupoId: grupo.id })}>
                      Documento
                    </Botao>
                    <button
                      type="button"
                      className="rounded p-1 text-crm-tinta-3 hover:bg-crm-perigo-claro hover:text-crm-perigo"
                      aria-label={`Excluir grupo ${grupo.nome}`}
                      onClick={async () => {
                        if (await confirmarSimples({ titulo: `Excluir o grupo “${grupo.nome}”?`, mensagem: "Os documentos do grupo continuam no modelo, sem grupo.", confirmar: "Excluir grupo", perigo: true }))
                          excluir("modelos_checklist_grupos", { id: grupo.id }, "Grupo excluído.", chaves);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <p className="px-1 text-sm font-bold text-crm-tinta-2">Sem grupo</p>
                )}
              </header>
              {lista.length === 0 ? (
                <p className="px-4 py-3 text-sm text-crm-tinta-3">Nenhum documento neste grupo.</p>
              ) : (
                <ol className="flex flex-col divide-y divide-crm-linha">
                  {lista.map((it, ii) => (
                    <li key={it.id} className={`flex flex-wrap items-center gap-2 px-3 py-2 ${it.ativo ? "" : "bg-crm-fundo opacity-70"}`}>
                      <BotoesOrdem
                        rotulo={it.nome}
                        primeiro={ii === 0}
                        ultimo={ii === lista.length - 1}
                        aoSubir={() => reordenar("modelos_checklist_itens", mover(lista, ii, ii - 1).map((x) => ({ id: x.id })), chaves)}
                        aoDescer={() => reordenar("modelos_checklist_itens", mover(lista, ii, ii + 1).map((x) => ({ id: x.id })), chaves)}
                      />
                      <button type="button" onClick={() => setItem({ item: it, grupoId: it.grupo_id })} className="min-w-0 flex-1 text-left">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold hover:underline">
                          {config.categoria(it.categoria_id)?.clinico && <Lock size={12} className="text-crm-perigo" aria-label="Dado de saúde" />}
                          {it.nome}
                        </span>
                        <span className="block text-xs text-crm-tinta-3">
                          {config.categoria(it.categoria_id)?.nome ?? "Sem categoria"}
                          {it.prazo_dias !== null ? ` · prazo ${it.prazo_dias} dia(s)` : ""}
                          {it.validade_dias ? ` · validade ${it.validade_dias} dia(s)` : ""}
                          {it.condicao_descricao ? ` · regra: ${it.condicao_descricao}` : ""}
                          {!it.cliente_pode_enviar ? " · interno (não vai no link)" : ""}
                        </span>
                      </button>
                      <Pilula cor={it.obrigatoriedade === "obrigatorio" ? "#8E2C3D" : it.obrigatoriedade === "condicional" ? "#C9822B" : "#A1A1AA"}>
                        {it.obrigatoriedade === "obrigatorio" ? "Obrigatório" : it.obrigatoriedade === "condicional" ? "Condicional" : "Opcional"}
                      </Pilula>
                      <Alternador ativo={it.ativo} aoAlterar={(v) => salvar("modelos_checklist_itens", { ativo: v }, { id: it.id }, undefined, chaves)} rotulo={`${it.ativo ? "Ativo" : "Inativo"}: ${it.nome}`} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (novoGrupo.trim() && (await salvar("modelos_checklist_grupos", { modelo_id: m.id, nome: novoGrupo.trim(), ordem: (grupos.length + 1) * 10 }, undefined, "Grupo criado.", chaves))) setNovoGrupo("");
          }}
        >
          <Entrada aria-label="Novo grupo" placeholder="Nome do novo grupo" value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value)} className="max-w-sm" />
          <Botao type="submit" tamanho="sm" icone={<FolderPlus size={14} />} disabled={!novoGrupo.trim()}>
            Adicionar grupo
          </Botao>
        </form>
      </SecaoAdmin>
      <FormItem pedido={item} modeloId={m.id} grupos={grupos} totalItens={itens.length} aoFechar={() => setItem(null)} />
    </div>
  );
}

// Campos permitidos nas regras condicionais (lista fixa, validada também no banco).
const CAMPOS_CONDICAO: { valor: string; rotulo: string; opcoes?: { valor: string; rotulo: string }[]; booleano?: boolean }[] = [
  { valor: "cliente.possui_representante", rotulo: "Cliente — possui representante legal", booleano: true },
  { valor: "cliente.tipo_pessoa", rotulo: "Cliente — tipo de pessoa", opcoes: [{ valor: "PF", rotulo: "Pessoa física" }, { valor: "PJ", rotulo: "Pessoa jurídica" }] },
  { valor: "cliente.uf", rotulo: "Cliente — UF" },
  { valor: "cliente.estado_civil", rotulo: "Cliente — estado civil" },
  { valor: "caso.natureza", rotulo: "Caso — natureza", opcoes: [{ valor: "interno", rotulo: "Caso interno" }, { valor: "judicial", rotulo: "Processo judicial" }] },
  { valor: "caso.tipo_demanda_id", rotulo: "Caso — tipo de demanda" },
  { valor: "caso.segredo_justica", rotulo: "Caso — segredo de justiça", booleano: true },
  { valor: "lead.quiz_cultiva", rotulo: "Quiz — já cultiva?" },
  { valor: "lead.quiz_consulta_medica", rotulo: "Quiz — acompanhamento médico" },
  { valor: "lead.quiz_motivacao", rotulo: "Quiz — motivação" },
  { valor: "lead.faixa_renda", rotulo: "Quiz — faixa de renda" },
  { valor: "lead.estado", rotulo: "Quiz — estado (UF)" },
];

const OPERADORES = [
  { valor: "igual", rotulo: "é igual a" },
  { valor: "diferente", rotulo: "é diferente de" },
  { valor: "contem", rotulo: "contém" },
  { valor: "preenchido", rotulo: "está preenchido" },
  { valor: "vazio", rotulo: "está vazio" },
];

type Condicao = { campo: string; operador: string; valor?: unknown };

function FormItem({ pedido, modeloId, grupos, totalItens, aoFechar }: { pedido: { item: ModeloChecklistItem | null; grupoId: string | null } | null; modeloId: string; grupos: ModeloChecklistGrupo[]; totalItens: number; aoFechar: () => void }) {
  const config = useConfig();
  const { salvar, excluir } = useAdmin();
  const it = pedido?.item ?? null;
  const [f, setF] = useState({
    nome: "",
    grupo_id: "",
    categoria_id: "",
    descricao_cliente: "",
    instrucao_equipe: "",
    obrigatoriedade: "obrigatorio",
    condicao_descricao: "",
    prazo_dias: "",
    revisor_tipo: "responsavel_caso",
    revisor_usuario_id: "",
    revisor_perfil_id: "",
    etapa: "",
    validade_dias: "",
    cliente_pode_enviar: true,
  });
  const [cond, setCond] = useState<Condicao>({ campo: "cliente.possui_representante", operador: "igual", valor: true });
  const [salvando, setSalvando] = useState(false);

  const camposPersonalizados = useMemo(
    () => (["cliente", "caso", "lead"] as const).flatMap((e) => config.camposDe(e).map((c) => ({ valor: `campo:${c.id}`, rotulo: `Campo personalizado (${e}) — ${c.rotulo}` }))),
    [config],
  );

  useEffect(() => {
    if (!pedido) return;
    setF({
      nome: it?.nome ?? "",
      grupo_id: it?.grupo_id ?? pedido.grupoId ?? "",
      categoria_id: it?.categoria_id ?? "",
      descricao_cliente: it?.descricao_cliente ?? "",
      instrucao_equipe: it?.instrucao_equipe ?? "",
      obrigatoriedade: it?.obrigatoriedade ?? "obrigatorio",
      condicao_descricao: it?.condicao_descricao ?? "",
      prazo_dias: it?.prazo_dias?.toString() ?? "",
      revisor_tipo: it?.revisor_tipo ?? "responsavel_caso",
      revisor_usuario_id: it?.revisor_usuario_id ?? "",
      revisor_perfil_id: it?.revisor_perfil_id ?? "",
      etapa: it?.etapa ?? "",
      validade_dias: it?.validade_dias?.toString() ?? "",
      cliente_pode_enviar: it?.cliente_pode_enviar ?? true,
    });
    const c = it?.condicao as Condicao | null;
    setCond(c && typeof c === "object" && c.campo ? c : { campo: "cliente.possui_representante", operador: "igual", valor: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  const defCampo = CAMPOS_CONDICAO.find((c) => c.valor === cond.campo);
  const precisaValor = cond.operador !== "preenchido" && cond.operador !== "vazio";

  const enviar = async () => {
    if (!f.nome.trim()) return;
    setSalvando(true);
    const condicional = f.obrigatoriedade === "condicional";
    const dados = {
      nome: f.nome.trim(),
      grupo_id: f.grupo_id || null,
      categoria_id: f.categoria_id || null,
      descricao_cliente: f.descricao_cliente.trim() || null,
      instrucao_equipe: f.instrucao_equipe.trim() || null,
      obrigatoriedade: f.obrigatoriedade,
      condicao: condicional ? { campo: cond.campo, operador: cond.operador, ...(precisaValor ? { valor: cond.valor ?? "" } : {}) } : null,
      condicao_descricao: condicional ? f.condicao_descricao.trim() || descreverCondicao(cond, config) : null,
      prazo_dias: f.prazo_dias === "" ? null : Math.max(0, Math.min(365, Number(f.prazo_dias))),
      revisor_tipo: f.revisor_tipo,
      revisor_usuario_id: f.revisor_tipo === "usuario" ? f.revisor_usuario_id || null : null,
      revisor_perfil_id: f.revisor_tipo === "perfil" ? f.revisor_perfil_id || null : null,
      etapa: f.etapa.trim() || null,
      validade_dias: f.validade_dias === "" ? null : Math.max(1, Math.min(3650, Number(f.validade_dias))),
      cliente_pode_enviar: f.cliente_pode_enviar,
    };
    const ok = it
      ? await salvar("modelos_checklist_itens", dados, { id: it.id }, "Documento do modelo atualizado.", ["modelos", "config"])
      : await salvar("modelos_checklist_itens", { ...dados, modelo_id: modeloId, ordem: (totalItens + 1) * 10 }, undefined, "Documento adicionado ao modelo.", ["modelos", "config"]);
    setSalvando(false);
    if (ok) aoFechar();
  };

  return (
    <Modal
      aberto={Boolean(pedido)}
      aoFechar={aoFechar}
      largura="lg"
      titulo={it ? "Editar documento do modelo" : "Novo documento no modelo"}
      rodape={
        <>
          {it && (
            <Botao
              variante="fantasma"
              className="mr-auto text-crm-perigo"
              icone={<Trash2 size={14} />}
              onClick={async () => {
                if (await confirmarSimples({ titulo: "Excluir documento do modelo?", mensagem: "Checklists já aplicados em casos não são alterados. Para apenas deixar de usar, desative o item.", confirmar: "Excluir", perigo: true })) {
                  if (await excluir("modelos_checklist_itens", { id: it.id }, "Documento removido do modelo.", ["modelos", "config"])) aoFechar();
                }
              }}
            >
              Excluir
            </Botao>
          )}
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" carregando={salvando} onClick={enviar} disabled={!f.nome.trim()}>
            Salvar
          </Botao>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
        <GrupoCampo rotulo="Nome do documento" obrigatorio className="sm:col-span-2">{(p) => <Entrada {...p} data-autofoco value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Relatório médico com CID e justificativa" />}</GrupoCampo>
        <GrupoCampo rotulo="Grupo">
          {(p) => (
            <Selecao {...p} value={f.grupo_id} onChange={(e) => setF({ ...f, grupo_id: e.target.value })}>
              <option value="">Sem grupo</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </Selecao>
          )}
        </GrupoCampo>
        <GrupoCampo rotulo="Categoria" ajuda="Categorias de saúde e financeiras restringem o acesso.">
          {(p) => (
            <Selecao {...p} value={f.categoria_id} onChange={(e) => setF({ ...f, categoria_id: e.target.value })}>
              <option value="">Sem categoria</option>
              {config.categorias.filter((c) => c.ativo || c.id === f.categoria_id).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.clinico ? " (saúde)" : c.financeiro ? " (financeiro)" : ""}
                </option>
              ))}
            </Selecao>
          )}
        </GrupoCampo>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1 text-[13px] font-semibold text-crm-tinta-2">Exigência</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["obrigatorio", "Obrigatório", "Conta como exigido."],
              ["opcional", "Opcional", "Aparece, mas não é exigido."],
              ["condicional", "Condicional", "Exigido se a regra for atendida."],
            ].map(([v, r, d]) => (
              <label key={v} className={`flex cursor-pointer items-start gap-2 rounded-xl border-2 p-2.5 ${f.obrigatoriedade === v ? "border-crm-verde bg-crm-verde-claro" : "border-crm-linha bg-white"}`}>
                <input type="radio" name="obrigatoriedade" checked={f.obrigatoriedade === v} onChange={() => setF({ ...f, obrigatoriedade: v })} className="mt-1 accent-[#263A2D]" />
                <span>
                  <span className="block text-sm font-semibold">{r}</span>
                  <span className="text-xs text-crm-tinta-2">{d}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {f.obrigatoriedade === "condicional" && (
          <div className="flex flex-col gap-3 rounded-xl border border-crm-linha bg-crm-fundo p-3 sm:col-span-2">
            <p className="text-xs text-crm-tinta-2">
              Ao aplicar o modelo, o CRM avalia a regra com os dados do cliente, do caso ou do quiz. Se não houver dado suficiente, o documento entra como pendente de conferência pela equipe.
            </p>
            <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr]">
              <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
                Campo
                <Selecao value={cond.campo} onChange={(e) => setCond({ campo: e.target.value, operador: "igual", valor: CAMPOS_CONDICAO.find((c) => c.valor === e.target.value)?.booleano ? true : "" })}>
                  <optgroup label="Dados do cadastro">
                    {CAMPOS_CONDICAO.map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {c.rotulo}
                      </option>
                    ))}
                  </optgroup>
                  {camposPersonalizados.length > 0 && (
                    <optgroup label="Campos personalizados">
                      {camposPersonalizados.map((c) => (
                        <option key={c.valor} value={c.valor}>
                          {c.rotulo}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Selecao>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
                Condição
                <Selecao value={cond.operador} onChange={(e) => setCond({ ...cond, operador: e.target.value })}>
                  {OPERADORES.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </Selecao>
              </label>
              {precisaValor && (
                <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
                  Valor
                  {defCampo?.booleano ? (
                    <Selecao value={String(cond.valor ?? true)} onChange={(e) => setCond({ ...cond, valor: e.target.value === "true" })}>
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </Selecao>
                  ) : defCampo?.opcoes ? (
                    <Selecao value={String(cond.valor ?? "")} onChange={(e) => setCond({ ...cond, valor: e.target.value })}>
                      <option value="">Selecione…</option>
                      {defCampo.opcoes.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.rotulo}
                        </option>
                      ))}
                    </Selecao>
                  ) : cond.campo === "caso.tipo_demanda_id" ? (
                    <Selecao value={String(cond.valor ?? "")} onChange={(e) => setCond({ ...cond, valor: e.target.value })}>
                      <option value="">Selecione…</option>
                      {config.tiposDemanda.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                    </Selecao>
                  ) : (
                    <Entrada value={String(cond.valor ?? "")} onChange={(e) => setCond({ ...cond, valor: e.target.value })} />
                  )}
                </label>
              )}
            </div>
            <GrupoCampo rotulo="Descrição da regra (para a equipe)" ajuda={`Se vazio: “${descreverCondicao(cond, config)}”.`}>
              {(p) => <Entrada {...p} value={f.condicao_descricao} onChange={(e) => setF({ ...f, condicao_descricao: e.target.value })} placeholder="Ex.: Apenas quando houver representante legal" />}
            </GrupoCampo>
          </div>
        )}
        <GrupoCampo rotulo="O que pedir ao cliente" ajuda="Aparece no link seguro de envio." className="sm:col-span-2">{(p) => <AreaTexto {...p} rows={2} value={f.descricao_cliente} onChange={(e) => setF({ ...f, descricao_cliente: e.target.value })} placeholder="Explique em linguagem simples, com exemplos." />}</GrupoCampo>
        <GrupoCampo rotulo="Instrução interna para a equipe" ajuda="Não aparece para o cliente." className="sm:col-span-2">{(p) => <AreaTexto {...p} rows={2} value={f.instrucao_equipe} onChange={(e) => setF({ ...f, instrucao_equipe: e.target.value })} />}</GrupoCampo>
        <GrupoCampo rotulo="Prazo interno (dias após aplicar)">{(p) => <Entrada {...p} type="number" min={0} max={365} value={f.prazo_dias} onChange={(e) => setF({ ...f, prazo_dias: e.target.value })} />}</GrupoCampo>
        <GrupoCampo rotulo="Validade do documento (dias)" ajuda="Para laudos e prescrições.">{(p) => <Entrada {...p} type="number" min={1} max={3650} value={f.validade_dias} onChange={(e) => setF({ ...f, validade_dias: e.target.value })} />}</GrupoCampo>
        <GrupoCampo rotulo="Quem revisa">
          {(p) => (
            <Selecao {...p} value={f.revisor_tipo} onChange={(e) => setF({ ...f, revisor_tipo: e.target.value })}>
              <option value="responsavel_caso">Responsável pelo caso</option>
              <option value="usuario">Pessoa específica</option>
              <option value="perfil">Alguém de um perfil</option>
            </Selecao>
          )}
        </GrupoCampo>
        {f.revisor_tipo === "usuario" && (
          <GrupoCampo rotulo="Pessoa revisora">{(p) => <SeletorCampo {...p} rotulo="Pessoa revisora" valor={f.revisor_usuario_id || null} estilo="pessoa" opcoes={opcoesUsuarios(config, false)} aoAlterar={(v) => setF({ ...f, revisor_usuario_id: v ?? "" })} />}</GrupoCampo>
        )}
        {f.revisor_tipo === "perfil" && (
          <GrupoCampo rotulo="Perfil revisor">
            {(p) => (
              <Selecao {...p} value={f.revisor_perfil_id} onChange={(e) => setF({ ...f, revisor_perfil_id: e.target.value })}>
                <option value="">Selecione…</option>
                {config.perfis.map((pf) => (
                  <option key={pf.id} value={pf.id}>
                    {pf.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </GrupoCampo>
        )}
        <GrupoCampo rotulo="Etapa em que é necessário">{(p) => <Entrada {...p} value={f.etapa} onChange={(e) => setF({ ...f, etapa: e.target.value })} placeholder="Ex.: Antes do protocolo" />}</GrupoCampo>
        <div className="sm:col-span-2">
          <CaixaSelecao marcado={f.cliente_pode_enviar} aoAlterar={(v) => setF({ ...f, cliente_pode_enviar: v })} rotulo="O cliente pode enviar pelo link seguro" descricao="Desmarque para documentos produzidos internamente (minutas, peças)." />
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

function descreverCondicao(c: Condicao, config: ReturnType<typeof useConfig>): string {
  const campo = CAMPOS_CONDICAO.find((x) => x.valor === c.campo);
  const nomeCampo = campo?.rotulo ?? (c.campo.startsWith("campo:") ? config.campos.find((x) => `campo:${x.id}` === c.campo)?.rotulo ?? "campo personalizado" : c.campo);
  const op = OPERADORES.find((o) => o.valor === c.operador)?.rotulo ?? c.operador;
  if (c.operador === "preenchido" || c.operador === "vazio") return `${nomeCampo} ${op}`;
  let valor = String(c.valor ?? "");
  if (campo?.booleano) valor = c.valor ? "Sim" : "Não";
  else if (campo?.opcoes) valor = campo.opcoes.find((o) => o.valor === c.valor)?.rotulo ?? valor;
  else if (c.campo === "caso.tipo_demanda_id") valor = config.tipo(String(c.valor))?.nome ?? valor;
  return `${nomeCampo} ${op} ${valor}`;
}
