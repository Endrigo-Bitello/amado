"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { opcoesLista, opcoesUsuarios } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { useGravacao } from "../../_lib/dados";
import { documentoValido } from "../../_lib/formatos";
import { navegar } from "../../_lib/rotas";
import { Botao } from "../../_ui/Botao";
import { AreaTexto, CaixaSelecao, Entrada, GrupoCampo, Selecao } from "../../_ui/Campos";
import { SeletorCampo } from "../../_ui/Seletores";
import { Modal } from "../../_ui/Sobreposicoes";
import { AvisoDuplicados, useDuplicados } from "../../_componentes/Duplicados";

const VAZIO = {
  tipo_pessoa: "PF",
  nome: "",
  cpf_cnpj: "",
  data_nascimento: "",
  whatsapp: "",
  email: "",
  cidade: "",
  uf: "",
  profissao: "",
  estado_civil: "",
  origem: "manual",
  responsavel_id: null as string | null,
  observacoes: "",
  representante_nome: "",
  representante_cpf: "",
  representante_parentesco: "",
};

export function FormCliente({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const config = useConfig();
  const { perfil } = useAuth();
  const { inserir } = useGravacao();
  const [d, setD] = useState(VAZIO);
  const [representante, setRepresentante] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const dup = useDuplicados({ telefone: d.whatsapp, email: d.email, cpf: d.cpf_cnpj }, aberto);

  useEffect(() => {
    if (aberto) {
      setD({ ...VAZIO, responsavel_id: perfil?.id ?? null });
      setRepresentante(false);
      setErros({});
    }
  }, [aberto, perfil?.id]);

  const set = (k: keyof typeof VAZIO) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));

  const salvar = async () => {
    const e: Record<string, string> = {};
    if (d.nome.trim().length < 2) e.nome = "Informe o nome.";
    if (d.cpf_cnpj.trim() && !documentoValido(d.cpf_cnpj)) e.cpf_cnpj = "CPF/CNPJ inválido. Confira os dígitos.";
    if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = "E-mail inválido.";
    setErros(e);
    if (Object.keys(e).length) return;
    setSalvando(true);
    try {
      const criado = await inserir<{ id: string }>(
        "clientes",
        {
          tipo_pessoa: d.tipo_pessoa,
          nome: d.nome.trim(),
          cpf_cnpj: d.cpf_cnpj.trim() || null,
          data_nascimento: d.data_nascimento || null,
          whatsapp: d.whatsapp.trim() || null,
          email: d.email.trim() || null,
          cidade: d.cidade.trim() || null,
          uf: d.uf.trim().toUpperCase() || null,
          profissao: d.profissao.trim() || null,
          estado_civil: d.estado_civil || null,
          origem: d.origem,
          responsavel_id: d.responsavel_id,
          observacoes: d.observacoes.trim() || null,
          possui_representante: representante,
          representante_nome: representante ? d.representante_nome.trim() || null : null,
          representante_cpf: representante ? d.representante_cpf.trim() || null : null,
          representante_parentesco: representante ? d.representante_parentesco.trim() || null : null,
        },
        { chaves: ["clientes"], mensagemSucesso: "Cliente cadastrado." },
      );
      aoFechar();
      navegar(`/crm/clientes/${criado.id}`);
    } catch {
      /* aviso exibido (ex.: CPF já cadastrado) */
    } finally {
      setSalvando(false);
    }
  };

  const clientesDuplicados = dup.data?.clientes ?? [];
  const cpfDuplicado = clientesDuplicados.some((c) => c.motivos.includes("CPF/CNPJ") && !c.arquivado);

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      largura="lg"
      titulo="Novo cliente"
      descricao="Para quem veio pelo quiz, prefira converter o lead (mantém o histórico do atendimento)."
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={salvar} carregando={salvando} disabled={cpfDuplicado}>
            Cadastrar cliente
          </Botao>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <GrupoCampo rotulo="Tipo de pessoa">
          {(p) => (
            <Selecao {...p} value={d.tipo_pessoa} onChange={set("tipo_pessoa")}>
              <option value="PF">Pessoa física</option>
              <option value="PJ">Pessoa jurídica (associação, empresa)</option>
            </Selecao>
          )}
        </GrupoCampo>
        <div />
        <GrupoCampo rotulo={d.tipo_pessoa === "PJ" ? "Razão social" : "Nome completo"} obrigatorio erro={erros.nome} className="sm:col-span-2">
          {(p) => <Entrada {...p} data-autofoco value={d.nome} onChange={set("nome")} />}
        </GrupoCampo>
        <GrupoCampo rotulo={d.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"} erro={erros.cpf_cnpj} ajuda="Evita cadastros duplicados. Aceita CNPJ alfanumérico.">
          {(p) => <Entrada {...p} value={d.cpf_cnpj} onChange={set("cpf_cnpj")} />}
        </GrupoCampo>
        {d.tipo_pessoa === "PF" ? (
          <GrupoCampo rotulo="Data de nascimento">{(p) => <Entrada {...p} type="date" value={d.data_nascimento} onChange={set("data_nascimento")} />}</GrupoCampo>
        ) : (
          <div />
        )}
        <GrupoCampo rotulo="WhatsApp">{(p) => <Entrada {...p} type="tel" value={d.whatsapp} onChange={set("whatsapp")} />}</GrupoCampo>
        <GrupoCampo rotulo="E-mail" erro={erros.email}>{(p) => <Entrada {...p} type="email" value={d.email} onChange={set("email")} />}</GrupoCampo>
        {(clientesDuplicados.length > 0 || (dup.data?.leads.length ?? 0) > 0) && (
          <div className="sm:col-span-2">
            <AvisoDuplicados dados={{ telefone: d.whatsapp, email: d.email, cpf: d.cpf_cnpj }} />
            {cpfDuplicado && <p className="mt-2 text-xs font-semibold text-crm-perigo">Já existe cliente ativo com este CPF/CNPJ — abra a ficha existente em vez de criar outra.</p>}
          </div>
        )}
        <GrupoCampo rotulo="Cidade">{(p) => <Entrada {...p} value={d.cidade} onChange={set("cidade")} />}</GrupoCampo>
        <GrupoCampo rotulo="UF">{(p) => <Entrada {...p} maxLength={2} value={d.uf} onChange={set("uf")} />}</GrupoCampo>
        <GrupoCampo rotulo="Origem">{(p) => <SeletorCampo {...p} rotulo="Origem" valor={d.origem} opcoes={opcoesLista(config, "origem").filter((o) => !o.desabilitada)} aoAlterar={(v) => setD((x) => ({ ...x, origem: v ?? "manual" }))} permitirVazio={false} />}</GrupoCampo>
        <GrupoCampo rotulo="Responsável">{(p) => <SeletorCampo {...p} rotulo="Responsável" valor={d.responsavel_id} estilo="pessoa" opcoes={opcoesUsuarios(config, false)} aoAlterar={(v) => setD((x) => ({ ...x, responsavel_id: v }))} />}</GrupoCampo>
        <div className="sm:col-span-2">
          <CaixaSelecao marcado={representante} aoAlterar={setRepresentante} rotulo="Possui representante legal" descricao="Paciente menor de idade ou representado." />
        </div>
        {representante && (
          <>
            <GrupoCampo rotulo="Nome do representante">{(p) => <Entrada {...p} value={d.representante_nome} onChange={set("representante_nome")} />}</GrupoCampo>
            <GrupoCampo rotulo="CPF do representante">{(p) => <Entrada {...p} value={d.representante_cpf} onChange={set("representante_cpf")} />}</GrupoCampo>
            <GrupoCampo rotulo="Parentesco / vínculo">{(p) => <Entrada {...p} value={d.representante_parentesco} onChange={set("representante_parentesco")} />}</GrupoCampo>
          </>
        )}
        <GrupoCampo rotulo="Observações" className="sm:col-span-2">{(p) => <AreaTexto {...p} value={d.observacoes} onChange={set("observacoes")} />}</GrupoCampo>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
