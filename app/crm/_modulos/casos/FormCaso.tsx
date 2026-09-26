"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { opcoesEtapas, opcoesLista, opcoesTiposDemanda, opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { useGravacao } from "../../_lib/dados";
import { navegar } from "../../_lib/rotas";
import { Botao } from "../../_ui/Botao";
import { AreaTexto, CaixaSelecao, Entrada, GrupoCampo } from "../../_ui/Campos";
import { SeletorCampo, SeletorMultiplo } from "../../_ui/Seletores";
import { Modal } from "../../_ui/Sobreposicoes";
import { SeletorRegistro, type RegistroSelecionado } from "../../_componentes/SeletorRegistro";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  cliente?: { id: string; nome: string } | null;
}

export function FormCaso({ aberto, aoFechar, cliente }: Props) {
  const config = useConfig();
  const { perfil, pode } = useAuth();
  const { rpc } = useGravacao();
  const [registro, setRegistro] = useState<RegistroSelecionado | null>(null);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<string | null>(null);
  const [natureza, setNatureza] = useState<"interno" | "judicial">("interno");
  const [numero, setNumero] = useState("");
  const [tribunal, setTribunal] = useState("");
  const [orgao, setOrgao] = useState("");
  const [classe, setClasse] = useState("");
  const [responsavel, setResponsavel] = useState<string | null>(null);
  const [equipe, setEquipe] = useState<string[]>([]);
  const [fase, setFase] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState<string | null>("media");
  const [objeto, setObjeto] = useState("");
  const [checklist, setChecklist] = useState(true);
  const [tarefas, setTarefas] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setRegistro(cliente ? { tipo: "cliente", id: cliente.id, titulo: cliente.nome } : null);
    setTitulo("");
    setTipo(null);
    setNatureza("interno");
    setNumero("");
    setTribunal("");
    setOrgao("");
    setClasse("");
    setResponsavel(perfil?.id ?? null);
    setEquipe([]);
    setFase(null);
    setPrioridade("media");
    setObjeto("");
    setChecklist(true);
    setTarefas(true);
    setErro(null);
  }, [aberto, cliente, perfil?.id]);

  const tipoSel = config.tipo(tipo);

  const salvar = async () => {
    if (!registro) return setErro("Selecione o cliente.");
    if (!titulo.trim() && !tipoSel) return setErro("Informe o título ou o tipo de demanda.");
    setSalvando(true);
    setErro(null);
    try {
      const id = await rpc<string>(
        "criar_caso",
        {
          p: {
            cliente_id: registro.id,
            titulo: titulo.trim() || tipoSel?.nome,
            tipo_demanda_id: tipo,
            natureza,
            numero_processo: natureza === "judicial" ? numero.trim() : "",
            tribunal: natureza === "judicial" ? tribunal.trim() : "",
            orgao: natureza === "judicial" ? orgao.trim() : "",
            classe: natureza === "judicial" ? classe.trim() : "",
            responsavel_id: responsavel,
            equipe,
            fase_id: fase,
            prioridade,
            objeto: objeto.trim(),
            aplicar_checklist: checklist && Boolean(tipoSel?.modelo_checklist_id),
            aplicar_tarefas: tarefas && Boolean(tipoSel?.modelo_tarefas_id),
          },
        },
        { chaves: ["casos", "clientes", "documentos", "tarefas", "eventos", "painel"], silencioso: true },
      );
      aoFechar();
      navegar(`/crm/casos/${id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o caso.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      largura="lg"
      titulo="Novo caso"
      descricao="Um cliente pode ter vários casos. Casos internos podem virar processo judicial quando o número do processo for cadastrado."
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={salvar} carregando={salvando}>
            Criar caso
          </Botao>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        {erro && (
          <p role="alert" className="rounded-xl border-2 border-crm-perigo bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo sm:col-span-2">
            {erro}
          </p>
        )}
        <GrupoCampo rotulo="Cliente" obrigatorio className="sm:col-span-2">
          {(p) => <SeletorRegistro {...p} tipos={["cliente"]} valor={registro} aoAlterar={setRegistro} desabilitado={Boolean(cliente)} placeholder="Buscar cliente por nome, CPF ou código…" />}
        </GrupoCampo>
        <GrupoCampo rotulo="Tipo de demanda">
          {(p) => <SeletorCampo {...p} rotulo="Tipo de demanda" valor={tipo} opcoes={opcoesTiposDemanda(config).filter((o) => !o.desabilitada)} aoAlterar={setTipo} />}
        </GrupoCampo>
        <GrupoCampo rotulo="Título do caso" ajuda="Se vazio, usa o nome do tipo de demanda.">
          {(p) => <Entrada {...p} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipoSel?.nome ?? "Ex.: HC preventivo — cultivo"} />}
        </GrupoCampo>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1 text-[13px] font-semibold text-crm-tinta-2">Natureza</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["interno", "Caso interno", "Preparação, consultoria ou demanda ainda sem processo."],
                ["judicial", "Processo judicial", "Já existe (ou será cadastrado) um processo no tribunal."],
              ] as const
            ).map(([v, r, dsc]) => (
              <label key={v} className={`flex cursor-pointer items-start gap-2 rounded-xl border-2 p-3 ${natureza === v ? "border-crm-verde bg-crm-verde-claro" : "border-crm-linha bg-white"}`}>
                <input type="radio" name="natureza" checked={natureza === v} onChange={() => setNatureza(v)} className="mt-1 accent-[#263A2D]" />
                <span>
                  <span className="block text-sm font-semibold">{r}</span>
                  <span className="text-xs text-crm-tinta-2">{dsc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {natureza === "judicial" && (
          <>
            <GrupoCampo rotulo="Número do processo" ajuda="Pode ser cadastrado depois, no protocolo.">{(p) => <Entrada {...p} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="0000000-00.0000.0.00.0000" />}</GrupoCampo>
            <GrupoCampo rotulo="Tribunal">{(p) => <Entrada {...p} value={tribunal} onChange={(e) => setTribunal(e.target.value)} placeholder="Ex.: TJSC, TRF4" />}</GrupoCampo>
            <GrupoCampo rotulo="Órgão / vara">{(p) => <Entrada {...p} value={orgao} onChange={(e) => setOrgao(e.target.value)} />}</GrupoCampo>
            <GrupoCampo rotulo="Classe processual">{(p) => <Entrada {...p} value={classe} onChange={(e) => setClasse(e.target.value)} placeholder="Ex.: Mandado de Segurança Cível" />}</GrupoCampo>
          </>
        )}
        <GrupoCampo rotulo="Responsável">{(p) => <SeletorCampo {...p} rotulo="Responsável" valor={responsavel} estilo="pessoa" opcoes={opcoesUsuarios(config, false)} aoAlterar={setResponsavel} />}</GrupoCampo>
        <GrupoCampo rotulo="Equipe" ajuda="Pessoas com acesso por necessidade (inclusive dados de saúde, se permitido no perfil).">
          {(p) => <SeletorMultiplo id={p.id} rotulo="Equipe" estilo="pessoa" valores={equipe} opcoes={opcoesUsuarios(config, false).filter((u) => u.valor !== responsavel)} aoAlterar={setEquipe} />}
        </GrupoCampo>
        <GrupoCampo rotulo="Fase inicial">{(p) => <SeletorCampo {...p} rotulo="Fase" valor={fase} estilo="pilula" opcoes={opcoesEtapas(config, "caso").filter((o) => !o.desabilitada)} aoAlterar={setFase} rotuloVazio="Primeira fase do fluxo" />}</GrupoCampo>
        <GrupoCampo rotulo="Prioridade">{(p) => <SeletorCampo {...p} rotulo="Prioridade" valor={prioridade} estilo="pilula" opcoes={opcoesLista(config, "prioridade")} aoAlterar={setPrioridade} permitirVazio={false} />}</GrupoCampo>
        <GrupoCampo rotulo="Objeto / resumo do caso" className="sm:col-span-2">{(p) => <AreaTexto {...p} value={objeto} onChange={(e) => setObjeto(e.target.value)} />}</GrupoCampo>
        {(pode("documentos.editar") || pode("tarefas.editar")) && (
          <div className="flex flex-col gap-2 rounded-xl bg-crm-fundo p-3 sm:col-span-2">
            {pode("documentos.editar") && (
              <CaixaSelecao
                marcado={checklist && Boolean(tipoSel?.modelo_checklist_id)}
                desabilitado={!tipoSel?.modelo_checklist_id}
                aoAlterar={setChecklist}
                rotulo="Aplicar o checklist de documentos do tipo de demanda"
                descricao={tipoSel?.modelo_checklist_id ? config.modelosChecklist.find((m) => m.id === tipoSel.modelo_checklist_id)?.nome : "Escolha um tipo de demanda com modelo vinculado."}
              />
            )}
            {pode("tarefas.editar") && (
              <CaixaSelecao
                marcado={tarefas && Boolean(tipoSel?.modelo_tarefas_id)}
                desabilitado={!tipoSel?.modelo_tarefas_id}
                aoAlterar={setTarefas}
                rotulo="Criar as tarefas de preparação da ação"
                descricao={tipoSel?.modelo_tarefas_id ? config.modelosTarefas.find((m) => m.id === tipoSel.modelo_tarefas_id)?.nome : "Sem modelo de tarefas vinculado a este tipo."}
              />
            )}
          </div>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
