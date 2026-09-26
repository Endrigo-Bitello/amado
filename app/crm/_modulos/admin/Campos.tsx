"use client";

import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfig } from "../../_lib/config";
import { idCurto } from "../../_lib/formatos";
import type { CampoPersonalizado, Entidade } from "../../_lib/tipos";
import { Abas } from "../../_ui/Abas";
import { Botao } from "../../_ui/Botao";
import { Alternador, CaixaSelecao, Entrada, GrupoCampo, Selecao } from "../../_ui/Campos";
import { confirmarSimples } from "../../_ui/Dialogos";
import { Modal } from "../../_ui/Sobreposicoes";
import { Pilula, Selo, Vazio } from "../../_ui/Visuais";
import { Aviso, BotoesOrdem, mover, SecaoAdmin, useAdmin } from "./comum";
import { BotaoCor } from "./Funis";

export const TIPOS_CAMPO: { valor: CampoPersonalizado["tipo"]; rotulo: string }[] = [
  { valor: "texto", rotulo: "Texto curto" },
  { valor: "texto_longo", rotulo: "Texto longo" },
  { valor: "numero", rotulo: "Número" },
  { valor: "moeda", rotulo: "Valor em reais" },
  { valor: "data", rotulo: "Data" },
  { valor: "selecao", rotulo: "Seleção (uma opção)" },
  { valor: "multipla", rotulo: "Seleção múltipla" },
  { valor: "checkbox", rotulo: "Caixa de marcação (sim/não)" },
  { valor: "link", rotulo: "Link (https://)" },
];

const VISIBILIDADES = [
  { valor: "todos", rotulo: "Todos que acessam o registro" },
  { valor: "saude", rotulo: "Somente quem pode ver dados de saúde" },
  { valor: "financeiro", rotulo: "Somente quem pode ver o financeiro" },
  { valor: "admin", rotulo: "Somente administradores" },
];

const ENTIDADES: { id: Entidade; rotulo: string }[] = [
  { id: "lead", rotulo: "Leads" },
  { id: "cliente", rotulo: "Clientes" },
  { id: "caso", rotulo: "Casos" },
];

type OpcaoCampo = { id: string; rotulo: string; cor?: string | null; arquivado?: boolean };

export function AdminCampos() {
  const config = useConfig();
  const { salvar, excluir, reordenar } = useAdmin();
  const [entidade, setEntidade] = useState<Entidade>("cliente");
  const [form, setForm] = useState<{ campo: CampoPersonalizado | null } | null>(null);
  const campos = config.camposDe(entidade, true).slice().sort((a, b) => a.ordem - b.ordem);

  return (
    <SecaoAdmin
      titulo="Campos personalizados"
      descricao="Crie campos sem programação. Eles aparecem na ficha (na seção escolhida), podem virar colunas dos quadros e entram nos filtros e na exportação."
      acoes={
        <Botao variante="primario" tamanho="sm" icone={<Plus size={14} />} onClick={() => setForm({ campo: null })}>
          Novo campo
        </Botao>
      }
    >
      <Abas abas={ENTIDADES.map((e) => ({ id: e.id, rotulo: e.rotulo, contador: config.camposDe(e.id, true).length }))} ativa={entidade} aoTrocar={(v) => setEntidade(v as Entidade)} rotulo="Tipo de registro" />
      <Aviso>Campos com valores preenchidos não podem trocar de tipo nem ser excluídos — arquive-os para preservar os dados antigos.</Aviso>
      {campos.length === 0 ? (
        <Vazio compacto titulo="Nenhum campo personalizado" descricao="Crie o primeiro campo para este tipo de registro." />
      ) : (
        <ol className="flex flex-col divide-y divide-crm-linha rounded-2xl border border-crm-linha bg-white">
          {campos.map((c, i) => (
            <li key={c.id} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${c.ativo ? "" : "bg-crm-fundo opacity-70"}`}>
              <BotoesOrdem
                rotulo={c.rotulo}
                primeiro={i === 0}
                ultimo={i === campos.length - 1}
                aoSubir={() => reordenar("campos_personalizados", mover(campos, i, i - 1).map((x) => ({ id: x.id })))}
                aoDescer={() => reordenar("campos_personalizados", mover(campos, i, i + 1).map((x) => ({ id: x.id })))}
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {c.rotulo}
                  {c.obrigatorio && <Selo tom="alerta">Obrigatório</Selo>}
                  {c.visibilidade !== "todos" && <Selo tom="info">{VISIBILIDADES.find((v) => v.valor === c.visibilidade)?.rotulo.replace("Somente ", "Só ")}</Selo>}
                  {!c.ativo && <Selo>Arquivado</Selo>}
                </p>
                <p className="text-xs text-crm-tinta-3">
                  {TIPOS_CAMPO.find((t) => t.valor === c.tipo)?.rotulo} · seção “{c.secao}”{c.mostrar_no_quadro ? " · coluna visível no quadro" : " · coluna oculta no quadro"}
                </p>
              </div>
              <Botao tamanho="sm" variante="fantasma" icone={<Pencil size={13} />} onClick={() => setForm({ campo: c })}>
                Editar
              </Botao>
              <Botao
                tamanho="sm"
                variante="fantasma"
                icone={c.ativo ? <Archive size={13} /> : <ArchiveRestore size={13} />}
                onClick={() => salvar("campos_personalizados", { ativo: !c.ativo }, { id: c.id }, c.ativo ? "Campo arquivado (os valores foram preservados)." : "Campo reativado.")}
              >
                {c.ativo ? "Arquivar" : "Reativar"}
              </Botao>
              <button
                type="button"
                className="rounded p-1 text-crm-tinta-3 hover:bg-crm-perigo-claro hover:text-crm-perigo"
                aria-label={`Excluir campo ${c.rotulo}`}
                onClick={async () => {
                  if (await confirmarSimples({ titulo: `Excluir o campo “${c.rotulo}”?`, mensagem: "Só é possível excluir campos sem valores preenchidos. Caso contrário, arquive.", confirmar: "Excluir", perigo: true }))
                    excluir("campos_personalizados", { id: c.id }, "Campo excluído.", ["config", "valores"]);
                }}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <FormCampo pedido={form} entidade={entidade} aoFechar={() => setForm(null)} totalCampos={campos.length} />
    </SecaoAdmin>
  );
}

function FormCampo({ pedido, entidade, aoFechar, totalCampos }: { pedido: { campo: CampoPersonalizado | null } | null; entidade: Entidade; aoFechar: () => void; totalCampos: number }) {
  const config = useConfig();
  const { salvar } = useAdmin();
  const c = pedido?.campo ?? null;
  const [rotulo, setRotulo] = useState("");
  const [tipo, setTipo] = useState<CampoPersonalizado["tipo"]>("texto");
  const [secao, setSecao] = useState("Informações adicionais");
  const [ajuda, setAjuda] = useState("");
  const [obrigatorio, setObrigatorio] = useState(false);
  const [visibilidade, setVisibilidade] = useState("todos");
  const [noQuadro, setNoQuadro] = useState(true);
  const [opcoes, setOpcoes] = useState<OpcaoCampo[]>([]);
  const [novaOpcao, setNovaOpcao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!pedido) return;
    setRotulo(c?.rotulo ?? "");
    setTipo(c?.tipo ?? "texto");
    setSecao(c?.secao ?? "Informações adicionais");
    setAjuda(c?.ajuda ?? "");
    setObrigatorio(c?.obrigatorio ?? false);
    setVisibilidade(c?.visibilidade ?? "todos");
    setNoQuadro(c?.mostrar_no_quadro ?? true);
    setOpcoes(Array.isArray(c?.opcoes) ? (c!.opcoes as OpcaoCampo[]) : []);
    setNovaOpcao("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  const secoes = [...new Set(config.camposDe(entidade, true).map((x) => x.secao))];
  const comOpcoes = tipo === "selecao" || tipo === "multipla";

  const enviar = async () => {
    if (!rotulo.trim()) return;
    if (comOpcoes && opcoes.filter((o) => !o.arquivado).length === 0) return;
    setSalvando(true);
    const dados = {
      rotulo: rotulo.trim(),
      tipo,
      secao: secao.trim() || "Informações adicionais",
      ajuda: ajuda.trim() || null,
      obrigatorio,
      visibilidade,
      mostrar_no_quadro: noQuadro,
      opcoes: comOpcoes ? opcoes : [],
    };
    const ok = c
      ? await salvar("campos_personalizados", dados, { id: c.id }, "Campo atualizado. A equipe já vê a mudança.", ["config", "valores"])
      : await salvar("campos_personalizados", { ...dados, entidade, ordem: (totalCampos + 1) * 10 }, undefined, "Campo criado. A equipe já vê o novo campo.", ["config", "valores"]);
    setSalvando(false);
    if (ok) aoFechar();
  };

  return (
    <Modal
      aberto={Boolean(pedido)}
      aoFechar={aoFechar}
      largura="lg"
      titulo={c ? `Editar campo: ${c.rotulo}` : `Novo campo em ${ENTIDADES.find((e) => e.id === entidade)?.rotulo}`}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" carregando={salvando} onClick={enviar} disabled={!rotulo.trim() || (comOpcoes && opcoes.filter((o) => !o.arquivado).length === 0)}>
            Salvar campo
          </Botao>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
        <GrupoCampo rotulo="Nome do campo" obrigatorio className="sm:col-span-2">{(p) => <Entrada {...p} data-autofoco value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="Ex.: Médico prescritor" />}</GrupoCampo>
        <GrupoCampo rotulo="Tipo" ajuda={c ? "Só é possível trocar o tipo enquanto o campo não tiver valores." : undefined}>
          {(p) => (
            <Selecao {...p} value={tipo} onChange={(e) => setTipo(e.target.value as CampoPersonalizado["tipo"])}>
              {TIPOS_CAMPO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </Selecao>
          )}
        </GrupoCampo>
        <GrupoCampo rotulo="Seção da ficha">
          {(p) => (
            <>
              <Entrada {...p} list="secoes-campos" value={secao} onChange={(e) => setSecao(e.target.value)} />
              <datalist id="secoes-campos">
                {secoes.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </>
          )}
        </GrupoCampo>
        <GrupoCampo rotulo="Texto de ajuda" className="sm:col-span-2">{(p) => <Entrada {...p} value={ajuda} onChange={(e) => setAjuda(e.target.value)} placeholder="Aparece ao passar o mouse no nome do campo" />}</GrupoCampo>
        <GrupoCampo rotulo="Quem pode ver" className="sm:col-span-2">
          {(p) => (
            <Selecao {...p} value={visibilidade} onChange={(e) => setVisibilidade(e.target.value)}>
              {VISIBILIDADES.map((v) => (
                <option key={v.valor} value={v.valor}>
                  {v.rotulo}
                </option>
              ))}
            </Selecao>
          )}
        </GrupoCampo>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <CaixaSelecao marcado={obrigatorio} aoAlterar={setObrigatorio} rotulo="Preenchimento obrigatório" descricao="A ficha destaca o campo enquanto estiver vazio." />
          <CaixaSelecao marcado={noQuadro} aoAlterar={setNoQuadro} rotulo="Mostrar como coluna no quadro" descricao="Cada pessoa ainda pode ocultar a coluna na própria visualização." />
        </div>
        {comOpcoes && (
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="mb-1 text-[13px] font-semibold text-crm-tinta-2">Opções</legend>
            {opcoes.length === 0 && <p className="text-xs text-crm-alerta">Adicione pelo menos uma opção.</p>}
            <ul className="flex flex-col gap-1.5">
              {opcoes.map((o, i) => (
                <li key={o.id} className={`flex items-center gap-2 ${o.arquivado ? "opacity-60" : ""}`}>
                  <BotaoCor cor={o.cor ?? "#C5A880"} rotulo={o.rotulo} aoAlterar={(cor) => setOpcoes((x) => x.map((y, j) => (j === i ? { ...y, cor } : y)))} />
                  <Entrada aria-label={`Opção ${i + 1}`} value={o.rotulo} onChange={(e) => setOpcoes((x) => x.map((y, j) => (j === i ? { ...y, rotulo: e.target.value } : y)))} className="max-w-xs" />
                  <Pilula cor={o.cor ?? "#C5A880"} preenchida={false}>
                    {o.rotulo || "…"}
                  </Pilula>
                  <Alternador ativo={!o.arquivado} aoAlterar={(v) => setOpcoes((x) => x.map((y, j) => (j === i ? { ...y, arquivado: !v } : y)))} rotulo={`${o.arquivado ? "Arquivada" : "Ativa"}: ${o.rotulo}`} />
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Entrada aria-label="Nova opção" placeholder="Nova opção" value={novaOpcao} onChange={(e) => setNovaOpcao(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (novaOpcao.trim()) { setOpcoes((x) => [...x, { id: idCurto(), rotulo: novaOpcao.trim(), cor: "#C5A880", arquivado: false }]); setNovaOpcao(""); } } }} className="max-w-xs" />
              <Botao
                tamanho="sm"
                icone={<Plus size={14} />}
                disabled={!novaOpcao.trim()}
                onClick={() => {
                  setOpcoes((x) => [...x, { id: idCurto(), rotulo: novaOpcao.trim(), cor: "#C5A880", arquivado: false }]);
                  setNovaOpcao("");
                }}
              >
                Adicionar opção
              </Botao>
            </div>
            <p className="text-xs text-crm-tinta-3">Opções não são excluídas, apenas arquivadas, para que os registros antigos continuem legíveis.</p>
          </fieldset>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
