"use client";

import { Paperclip } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso } from "../../_lib/avisos";
import { opcoesLista } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { formatarData, hojeSP, somarDias, somarMeses } from "../../_lib/datas";
import { executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { excluirComoDev, type TipoExclusaoDev } from "../../_lib/dev";
import { formatarMoeda } from "../../_lib/formatos";
import { supabase } from "../../_lib/supabase";
import type { CobrancaSituacao } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { AreaTexto, CaixaSelecao, Entrada, EntradaMoeda, GrupoCampo, Selecao } from "../../_ui/Campos";
import { confirmar, confirmarSimples } from "../../_ui/Dialogos";
import { SeletorCampo } from "../../_ui/Seletores";
import { Modal } from "../../_ui/Sobreposicoes";
import { acaoFinanceira, CATEGORIAS_COBRANCA, enviarComprovante } from "./comum";

const CHAVES = ["financeiro", "painel", "eventos"];

function useInvalidarFinanceiro() {
  const { invalidar } = useGravacao();
  return () => invalidar(...CHAVES);
}

function CampoArquivo({ arquivo, aoAlterar, rotulo = "Comprovante (opcional)" }: { arquivo: File | null; aoAlterar: (f: File | null) => void; rotulo?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-crm-tinta-2">{rotulo}</span>
      <div className="flex items-center gap-2">
        <input ref={ref} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={(e) => aoAlterar(e.target.files?.[0] ?? null)} aria-label={rotulo} />
        <Botao tamanho="sm" variante="secundario" icone={<Paperclip size={14} />} onClick={() => ref.current?.click()}>
          Escolher arquivo
        </Botao>
        <span className="truncate text-xs text-crm-tinta-2">{arquivo?.name ?? "PDF ou imagem, até 20 MB"}</span>
        {arquivo && (
          <button type="button" className="text-xs font-semibold text-crm-perigo" onClick={() => aoAlterar(null)}>
            Remover
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contrato de honorários com geração de parcelas
// ---------------------------------------------------------------------------

export function calcularParcelas(total: number, desconto: number, acrescimo: number, entrada: number, dataEntrada: string, n: number, primeiro: string) {
  const liquido = Math.round((total - desconto + acrescimo) * 100) / 100;
  const restante = Math.round((liquido - entrada) * 100) / 100;
  const qtd = restante > 0 ? Math.max(n, 1) : 0;
  const lista: { descricao: string; valor: number; vencimento: string }[] = [];
  if (entrada > 0) lista.push({ descricao: "Entrada", valor: entrada, vencimento: dataEntrada });
  if (qtd > 0) {
    const base = Math.trunc((restante / qtd) * 100) / 100;
    for (let i = 1; i <= qtd; i++) {
      lista.push({
        descricao: qtd === 1 ? "Pagamento" : `Parcela ${i}/${qtd}`,
        valor: i === qtd ? Math.round((restante - base * (qtd - 1)) * 100) / 100 : base,
        vencimento: primeiro ? somarMeses(primeiro, i - 1) : "",
      });
    }
  }
  return { liquido, restante, lista };
}

export function FormContrato({ aberto, aoFechar, cliente, casos, casoInicial }: { aberto: boolean; aoFechar: () => void; cliente: { id: string; nome: string }; casos: { id: string; titulo: string }[]; casoInicial?: string | null }) {
  const config = useConfig();
  const { pode } = useAuth();
  const invalidar = useInvalidarFinanceiro();
  const [caso, setCaso] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("Honorários advocatícios");
  const [forma, setForma] = useState<string | null>("parcelado");
  const [total, setTotal] = useState<number | null>(null);
  const [desconto, setDesconto] = useState<number | null>(null);
  const [acrescimo, setAcrescimo] = useState<number | null>(null);
  const [entrada, setEntrada] = useState<number | null>(null);
  const [dataEntrada, setDataEntrada] = useState(hojeSP());
  const [parcelas, setParcelas] = useState(3);
  const [primeiro, setPrimeiro] = useState(somarDias(hojeSP(), 30));
  const [exito, setExito] = useState("");
  const [assinatura, setAssinatura] = useState(hojeSP());
  const [observacoes, setObservacoes] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setCaso(casoInicial ?? null);
    setDescricao("Honorários advocatícios");
    setForma("parcelado");
    setTotal(null);
    setDesconto(null);
    setAcrescimo(null);
    setEntrada(null);
    setDataEntrada(hojeSP());
    setParcelas(3);
    setPrimeiro(somarDias(hojeSP(), 30));
    setExito("");
    setAssinatura(hojeSP());
    setObservacoes("");
    setArquivo(null);
    setErro(null);
  }, [aberto, casoInicial]);

  const previa = useMemo(() => calcularParcelas(total ?? 0, desconto ?? 0, acrescimo ?? 0, entrada ?? 0, dataEntrada, forma === "a_vista" ? 1 : parcelas, primeiro), [total, desconto, acrescimo, entrada, dataEntrada, parcelas, primeiro, forma]);

  const salvar = async () => {
    if (total === null || total < 0) return setErro("Informe o valor contratado (use 0 para contrato somente de êxito).");
    if ((desconto ?? 0) > total + (acrescimo ?? 0)) return setErro("O desconto não pode ser maior que o valor.");
    if ((entrada ?? 0) > previa.liquido) return setErro("A entrada não pode ser maior que o valor total.");
    setSalvando(true);
    setErro(null);
    try {
      let arquivoId: string | null = null;
      if (arquivo) arquivoId = await enviarComprovante(arquivo, cliente.id, caso, "contrato");
      await acaoFinanceira("criar_contrato", {
        cliente_id: cliente.id,
        caso_id: caso,
        descricao: descricao.trim(),
        forma_contratacao: forma,
        valor_total: total,
        desconto: desconto ?? 0,
        acrescimo: acrescimo ?? 0,
        entrada: { valor: entrada ?? 0, data: entrada ? dataEntrada : null },
        parcelas: { quantidade: forma === "a_vista" ? 1 : parcelas, primeiro_vencimento: primeiro },
        percentual_exito: exito ? Number(exito.replace(",", ".")) : null,
        data_assinatura: assinatura || null,
        observacoes,
        arquivo_id: arquivoId,
      });
      aviso.sucesso("Contrato registrado e parcelas geradas.");
      invalidar();
      aoFechar();
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
      largura="xl"
      titulo={`Novo contrato de honorários — ${cliente.nome}`}
      descricao="As parcelas são geradas a partir do valor líquido (valor − desconto + acréscimos − entrada). Não há cobrança automática nem emissão fiscal."
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={salvar} carregando={salvando}>
            Registrar contrato
          </Botao>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
          {erro && <p role="alert" className="rounded-xl border-2 border-crm-perigo bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo sm:col-span-2">{erro}</p>}
          <GrupoCampo rotulo="Descrição" className="sm:col-span-2">{(p) => <Entrada {...p} value={descricao} onChange={(e) => setDescricao(e.target.value)} />}</GrupoCampo>
          <GrupoCampo rotulo="Caso vinculado">
            {(p) => <SeletorCampo {...p} rotulo="Caso" valor={caso} opcoes={casos.map((c) => ({ valor: c.id, rotulo: c.titulo }))} aoAlterar={setCaso} rotuloVazio="Contrato geral do cliente" />}
          </GrupoCampo>
          <GrupoCampo rotulo="Forma de contratação">
            {(p) => <SeletorCampo {...p} rotulo="Forma" valor={forma} opcoes={opcoesLista(config, "forma_contratacao").filter((o) => !o.desabilitada)} aoAlterar={setForma} permitirVazio={false} />}
          </GrupoCampo>
          <GrupoCampo rotulo="Valor contratado" obrigatorio>{(p) => <EntradaMoeda {...p} valor={total} aoAlterar={setTotal} />}</GrupoCampo>
          <GrupoCampo rotulo="Desconto" ajuda={pode("financeiro.desconto") ? undefined : "Seu perfil não pode conceder descontos."}>
            {(p) => <EntradaMoeda {...p} valor={desconto} aoAlterar={setDesconto} disabled={!pode("financeiro.desconto")} />}
          </GrupoCampo>
          <GrupoCampo rotulo="Acréscimos">{(p) => <EntradaMoeda {...p} valor={acrescimo} aoAlterar={setAcrescimo} />}</GrupoCampo>
          <GrupoCampo rotulo="Honorários de êxito (%)" ajuda="Informativo; lance a cobrança quando houver êxito.">
            {(p) => <Entrada {...p} inputMode="decimal" value={exito} onChange={(e) => setExito(e.target.value)} placeholder="Ex.: 20" />}
          </GrupoCampo>
          <GrupoCampo rotulo="Entrada">{(p) => <EntradaMoeda {...p} valor={entrada} aoAlterar={setEntrada} />}</GrupoCampo>
          <GrupoCampo rotulo="Vencimento da entrada">{(p) => <Entrada {...p} type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} disabled={!entrada} />}</GrupoCampo>
          {forma !== "a_vista" && (
            <GrupoCampo rotulo="Número de parcelas">{(p) => <Entrada {...p} type="number" min={1} max={120} value={parcelas} onChange={(e) => setParcelas(Math.min(120, Math.max(1, Number(e.target.value) || 1)))} />}</GrupoCampo>
          )}
          <GrupoCampo rotulo={forma === "a_vista" ? "Vencimento" : "1º vencimento"}>{(p) => <Entrada {...p} type="date" value={primeiro} onChange={(e) => setPrimeiro(e.target.value)} />}</GrupoCampo>
          <GrupoCampo rotulo="Data de assinatura">{(p) => <Entrada {...p} type="date" value={assinatura} onChange={(e) => setAssinatura(e.target.value)} />}</GrupoCampo>
          <div className="sm:col-span-2">
            <CampoArquivo arquivo={arquivo} aoAlterar={setArquivo} rotulo="Contrato assinado (opcional)" />
          </div>
          <GrupoCampo rotulo="Observações" className="sm:col-span-2">{(p) => <AreaTexto {...p} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />}</GrupoCampo>
          <button type="submit" className="hidden" />
        </form>
        <aside className="flex flex-col gap-3 rounded-2xl border border-crm-linha bg-crm-fundo p-4">
          <h3 className="text-sm font-bold">Prévia das cobranças</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-crm-tinta-2">Valor líquido</dt>
            <dd className="text-right font-semibold tabular-nums">{formatarMoeda(previa.liquido)}</dd>
            <dt className="text-crm-tinta-2">Entrada</dt>
            <dd className="text-right tabular-nums">{formatarMoeda(entrada ?? 0)}</dd>
            <dt className="text-crm-tinta-2">A parcelar</dt>
            <dd className="text-right tabular-nums">{formatarMoeda(previa.restante)}</dd>
          </dl>
          {previa.lista.length === 0 ? (
            <p className="text-xs text-crm-tinta-3">Nenhuma cobrança será gerada (ex.: contrato somente de êxito).</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-crm-tinta-3">
                  <th className="py-1 font-semibold">Cobrança</th>
                  <th className="py-1 font-semibold">Vencimento</th>
                  <th className="py-1 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {previa.lista.slice(0, 24).map((l, i) => (
                  <tr key={i} className="border-t border-crm-linha">
                    <td className="py-1">{l.descricao}</td>
                    <td className="py-1 tabular-nums">{formatarData(l.vencimento)}</td>
                    <td className="py-1 text-right tabular-nums">{formatarMoeda(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {previa.lista.length > 24 && <p className="text-xs text-crm-tinta-3">… e mais {previa.lista.length - 24} parcelas.</p>}
        </aside>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Pagamento (total ou parcial)
// ---------------------------------------------------------------------------

export function FormPagamento({ cobranca, aoFechar }: { cobranca: CobrancaSituacao | null; aoFechar: () => void }) {
  const { desenvolvedor } = useAuth();
  const config = useConfig();
  const invalidar = useInvalidarFinanceiro();
  const [valor, setValor] = useState<number | null>(null);
  const [data, setData] = useState(hojeSP());
  const [forma, setForma] = useState<string | null>("pix");
  const [observacao, setObservacao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (cobranca) {
      setValor(Number(cobranca.saldo));
      setData(hojeSP());
      setForma("pix");
      setObservacao("");
      setArquivo(null);
      setErro(null);
    }
  }, [cobranca]);
  if (!cobranca) return null;
  const saldo = Number(cobranca.saldo);
  const salvar = async () => {
    if (!valor || valor <= 0) return setErro("Informe um valor maior que zero.");
    if (valor > saldo + 0.001 && !desenvolvedor) return setErro(`O valor excede o saldo em aberto (${formatarMoeda(saldo)}).`);
    setSalvando(true);
    setErro(null);
    try {
      let arquivoId: string | null = null;
      if (arquivo) arquivoId = await enviarComprovante(arquivo, cobranca.cliente_id!, cobranca.caso_id);
      const r = await acaoFinanceira<{ situacao: string; saldo: number }>("registrar_pagamento", {
        cobranca_id: cobranca.id,
        valor,
        data_pagamento: data,
        forma,
        observacao,
        comprovante_arquivo_id: arquivoId,
      });
      aviso.sucesso(r.situacao === "pago" ? "Pagamento registrado — cobrança quitada." : `Pagamento parcial registrado. Saldo: ${formatarMoeda(r.saldo)}.`);
      invalidar();
      aoFechar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Registrar pagamento"
      descricao={`${cobranca.descricao} · vencimento ${formatarData(cobranca.vencimento)} · saldo ${formatarMoeda(saldo)}`}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={salvar} carregando={salvando}>
            Registrar
          </Botao>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        {erro && <p role="alert" className="rounded-xl bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo sm:col-span-2">{erro}</p>}
        <GrupoCampo rotulo="Valor recebido" obrigatorio ajuda="Valor menor que o saldo registra pagamento parcial.">
          {(p) => <EntradaMoeda {...p} valor={valor} aoAlterar={setValor} data-autofoco />}
        </GrupoCampo>
        <GrupoCampo rotulo="Data do pagamento" obrigatorio>{(p) => <Entrada {...p} type="date" max={desenvolvedor ? undefined : hojeSP()} value={data} onChange={(e) => setData(e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Forma de pagamento">
          {(p) => <SeletorCampo {...p} rotulo="Forma" valor={forma} opcoes={opcoesLista(config, "forma_pagamento").filter((o) => !o.desabilitada)} aoAlterar={setForma} permitirVazio={false} />}
        </GrupoCampo>
        <div />
        <div className="sm:col-span-2">
          <CampoArquivo arquivo={arquivo} aoAlterar={setArquivo} />
        </div>
        <GrupoCampo rotulo="Observação" className="sm:col-span-2">{(p) => <Entrada {...p} value={observacao} onChange={(e) => setObservacao(e.target.value)} />}</GrupoCampo>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Editar cobrança (valor, vencimento, desconto, acréscimo)
// ---------------------------------------------------------------------------

export function FormEditarCobranca({ cobranca, aoFechar }: { cobranca: CobrancaSituacao | null; aoFechar: () => void }) {
  const { pode } = useAuth();
  const invalidar = useInvalidarFinanceiro();
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const [desconto, setDesconto] = useState<number | null>(null);
  const [acrescimo, setAcrescimo] = useState<number | null>(null);
  const [vencimento, setVencimento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (cobranca) {
      setDescricao(cobranca.descricao ?? "");
      setValor(Number(cobranca.valor));
      setDesconto(Number(cobranca.desconto));
      setAcrescimo(Number(cobranca.acrescimo));
      setVencimento(cobranca.vencimento ?? "");
      setErro(null);
    }
  }, [cobranca]);
  if (!cobranca) return null;
  const podeContrato = pode("financeiro.contratos");
  const podeDesconto = pode("financeiro.desconto");
  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const dados: Record<string, unknown> = { id: cobranca.id };
      if (podeContrato) Object.assign(dados, { descricao, valor, acrescimo: acrescimo ?? 0, vencimento });
      if (podeDesconto) dados.desconto = desconto ?? 0;
      await acaoFinanceira("editar_cobranca", dados);
      aviso.sucesso("Cobrança atualizada.");
      invalidar();
      aoFechar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };
  const devido = (valor ?? 0) - (desconto ?? 0) + (acrescimo ?? 0);
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Editar cobrança" descricao="Alterações ficam registradas na auditoria." rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" onClick={salvar} carregando={salvando}>Salvar</Botao></>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        {erro && <p role="alert" className="rounded-xl bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo sm:col-span-2">{erro}</p>}
        <GrupoCampo rotulo="Descrição" className="sm:col-span-2">{(p) => <Entrada {...p} value={descricao} disabled={!podeContrato} onChange={(e) => setDescricao(e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Valor">{(p) => <EntradaMoeda {...p} valor={valor} aoAlterar={setValor} disabled={!podeContrato} />}</GrupoCampo>
        <GrupoCampo rotulo="Vencimento">{(p) => <Entrada {...p} type="date" value={vencimento} disabled={!podeContrato} onChange={(e) => setVencimento(e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Desconto" ajuda={podeDesconto ? undefined : "Sem permissão para conceder desconto."}>{(p) => <EntradaMoeda {...p} valor={desconto} aoAlterar={setDesconto} disabled={!podeDesconto} />}</GrupoCampo>
        <GrupoCampo rotulo="Acréscimo (juros/multa)">{(p) => <EntradaMoeda {...p} valor={acrescimo} aoAlterar={setAcrescimo} disabled={!podeContrato} />}</GrupoCampo>
        <p className="text-sm sm:col-span-2">
          Valor devido após ajustes: <strong className="tabular-nums">{formatarMoeda(devido)}</strong> · já pago: <span className="tabular-nums">{formatarMoeda(cobranca.valor_pago)}</span>
        </p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Nova cobrança avulsa
// ---------------------------------------------------------------------------

export function FormNovaCobranca({ aberto, aoFechar, cliente, casos, contratoId }: { aberto: boolean; aoFechar: () => void; cliente: { id: string; nome: string }; casos: { id: string; titulo: string }[]; contratoId?: string | null }) {
  const invalidar = useInvalidarFinanceiro();
  const [caso, setCaso] = useState<string | null>(null);
  const [categoria, setCategoria] = useState("honorarios");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const [vencimento, setVencimento] = useState(hojeSP());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (aberto) {
      setCaso(null);
      setCategoria("honorarios");
      setDescricao("");
      setValor(null);
      setVencimento(hojeSP());
      setErro(null);
    }
  }, [aberto]);
  const salvar = async () => {
    if (!descricao.trim()) return setErro("Informe a descrição.");
    if (valor === null || valor < 0) return setErro("Informe o valor.");
    setSalvando(true);
    try {
      await acaoFinanceira("adicionar_cobranca", { cliente_id: cliente.id, caso_id: caso, contrato_id: contratoId ?? null, categoria, descricao: descricao.trim(), valor, vencimento });
      aviso.sucesso("Cobrança adicionada.");
      invalidar();
      aoFechar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Nova cobrança" descricao={`Cliente: ${cliente.nome}`} rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" onClick={salvar} carregando={salvando}>Adicionar</Botao></>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        {erro && <p role="alert" className="rounded-xl bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo sm:col-span-2">{erro}</p>}
        <GrupoCampo rotulo="Categoria">
          {(p) => (
            <Selecao {...p} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {Object.entries(CATEGORIAS_COBRANCA).map(([v, r]) => (
                <option key={v} value={v}>{r}</option>
              ))}
            </Selecao>
          )}
        </GrupoCampo>
        <GrupoCampo rotulo="Caso">{(p) => <SeletorCampo {...p} rotulo="Caso" valor={caso} opcoes={casos.map((c) => ({ valor: c.id, rotulo: c.titulo }))} aoAlterar={setCaso} rotuloVazio="Sem caso específico" />}</GrupoCampo>
        <GrupoCampo rotulo="Descrição" obrigatorio className="sm:col-span-2">{(p) => <Entrada {...p} data-autofoco value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Honorários de êxito" />}</GrupoCampo>
        <GrupoCampo rotulo="Valor" obrigatorio>{(p) => <EntradaMoeda {...p} valor={valor} aoAlterar={setValor} />}</GrupoCampo>
        <GrupoCampo rotulo="Vencimento" obrigatorio>{(p) => <Entrada {...p} type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />}</GrupoCampo>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Reembolso ao cliente (devolução de valores pagos)
// ---------------------------------------------------------------------------

export function FormReembolso({ cobranca, aoFechar }: { cobranca: CobrancaSituacao | null; aoFechar: () => void }) {
  const { desenvolvedor } = useAuth();
  const config = useConfig();
  const invalidar = useInvalidarFinanceiro();
  const [valor, setValor] = useState<number | null>(null);
  const [data, setData] = useState(hojeSP());
  const [forma, setForma] = useState<string | null>("pix");
  const [motivo, setMotivo] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (cobranca) {
      setValor(Number(cobranca.valor_pago) - Number(cobranca.valor_reembolsado));
      setData(hojeSP());
      setMotivo("");
      setArquivo(null);
      setErro(null);
    }
  }, [cobranca]);
  if (!cobranca) return null;
  const disponivel = Number(cobranca.valor_pago) - Number(cobranca.valor_reembolsado);
  const salvar = async () => {
    if (!valor || valor <= 0) return setErro("Informe o valor.");
    if (valor > disponivel + 0.001 && !desenvolvedor) return setErro(`O reembolso não pode superar ${formatarMoeda(disponivel)}.`);
    if (motivo.trim().length < 3 && !desenvolvedor) return setErro("Informe o motivo do reembolso.");
    setSalvando(true);
    try {
      let arquivoId: string | null = null;
      if (arquivo) arquivoId = await enviarComprovante(arquivo, cobranca.cliente_id!, cobranca.caso_id);
      await acaoFinanceira("registrar_reembolso", { cobranca_id: cobranca.id, valor, data, forma, motivo: motivo.trim(), comprovante_arquivo_id: arquivoId });
      aviso.sucesso("Reembolso registrado.");
      invalidar();
      aoFechar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Registrar reembolso ao cliente" descricao={`${cobranca.descricao} · pago ${formatarMoeda(cobranca.valor_pago)} · já reembolsado ${formatarMoeda(cobranca.valor_reembolsado)}`} rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" onClick={salvar} carregando={salvando}>Registrar reembolso</Botao></>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        {erro && <p role="alert" className="rounded-xl bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo sm:col-span-2">{erro}</p>}
        <GrupoCampo rotulo="Valor devolvido" obrigatorio>{(p) => <EntradaMoeda {...p} valor={valor} aoAlterar={setValor} />}</GrupoCampo>
        <GrupoCampo rotulo="Data">{(p) => <Entrada {...p} type="date" value={data} onChange={(e) => setData(e.target.value)} />}</GrupoCampo>
        <GrupoCampo rotulo="Forma">{(p) => <SeletorCampo {...p} rotulo="Forma" valor={forma} opcoes={opcoesLista(config, "forma_pagamento").filter((o) => !o.desabilitada)} aoAlterar={setForma} permitirVazio={false} />}</GrupoCampo>
        <div />
        <GrupoCampo rotulo="Motivo" obrigatorio className="sm:col-span-2">{(p) => <AreaTexto {...p} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}</GrupoCampo>
        <div className="sm:col-span-2"><CampoArquivo arquivo={arquivo} aoAlterar={setArquivo} /></div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Custas e despesas pagas em nome do cliente
// ---------------------------------------------------------------------------

export function FormDespesa({ aberto, aoFechar, cliente, casos, casoInicial }: { aberto: boolean; aoFechar: () => void; cliente: { id: string; nome: string }; casos: { id: string; titulo: string }[]; casoInicial?: string | null }) {
  const invalidar = useInvalidarFinanceiro();
  const [caso, setCaso] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<"custas" | "despesa">("custas");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const [data, setData] = useState(hojeSP());
  const [pagoPor, setPagoPor] = useState<"escritorio" | "cliente">("escritorio");
  const [reembolsavel, setReembolsavel] = useState(true);
  const [gerarCobranca, setGerarCobranca] = useState(true);
  const [vencReembolso, setVencReembolso] = useState(somarDias(hojeSP(), 7));
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (aberto) {
      setCaso(casoInicial ?? null);
      setCategoria("custas");
      setDescricao("");
      setValor(null);
      setData(hojeSP());
      setPagoPor("escritorio");
      setReembolsavel(true);
      setGerarCobranca(true);
      setVencReembolso(somarDias(hojeSP(), 7));
      setArquivo(null);
      setErro(null);
    }
  }, [aberto, casoInicial]);
  const salvar = async () => {
    if (!descricao.trim()) return setErro("Informe a descrição.");
    if (!valor || valor <= 0) return setErro("Informe o valor.");
    setSalvando(true);
    try {
      let arquivoId: string | null = null;
      if (arquivo) arquivoId = await enviarComprovante(arquivo, cliente.id, caso);
      await acaoFinanceira("registrar_despesa", {
        cliente_id: cliente.id,
        caso_id: caso,
        categoria,
        descricao: descricao.trim(),
        valor,
        data,
        pago_por: pagoPor,
        reembolsavel: pagoPor === "escritorio" && reembolsavel,
        gerar_cobranca: pagoPor === "escritorio" && reembolsavel && gerarCobranca,
        vencimento_reembolso: vencReembolso,
        comprovante_arquivo_id: arquivoId,
      });
      aviso.sucesso(categoria === "custas" ? "Custas registradas." : "Despesa registrada.");
      invalidar();
      aoFechar();
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
      titulo="Registrar custas ou despesa"
      descricao="Custas e despesas pagas em nome do cliente ficam separadas dos honorários (não contam como receita do escritório)."
      rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" onClick={salvar} carregando={salvando}>Registrar</Botao></>}
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        {erro && <p role="alert" className="rounded-xl bg-crm-perigo-claro p-3 text-sm font-semibold text-crm-perigo sm:col-span-2">{erro}</p>}
        <GrupoCampo rotulo="Tipo">
          {(p) => (
            <Selecao {...p} value={categoria} onChange={(e) => setCategoria(e.target.value as "custas" | "despesa")}>
              <option value="custas">Custas judiciais</option>
              <option value="despesa">Outra despesa do caso</option>
            </Selecao>
          )}
        </GrupoCampo>
        <GrupoCampo rotulo="Caso">{(p) => <SeletorCampo {...p} rotulo="Caso" valor={caso} opcoes={casos.map((c) => ({ valor: c.id, rotulo: c.titulo }))} aoAlterar={setCaso} rotuloVazio="Sem caso específico" />}</GrupoCampo>
        <GrupoCampo rotulo="Descrição" obrigatorio className="sm:col-span-2">{(p) => <Entrada {...p} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Custas iniciais — guia nº…" />}</GrupoCampo>
        <GrupoCampo rotulo="Valor" obrigatorio>{(p) => <EntradaMoeda {...p} valor={valor} aoAlterar={setValor} />}</GrupoCampo>
        <GrupoCampo rotulo="Data do pagamento">{(p) => <Entrada {...p} type="date" value={data} onChange={(e) => setData(e.target.value)} />}</GrupoCampo>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1 text-[13px] font-semibold text-crm-tinta-2">Quem pagou</legend>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="pago" checked={pagoPor === "escritorio"} onChange={() => setPagoPor("escritorio")} className="accent-[#263A2D]" /> O escritório adiantou</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="pago" checked={pagoPor === "cliente"} onChange={() => setPagoPor("cliente")} className="accent-[#263A2D]" /> O próprio cliente pagou (apenas registro)</label>
        </fieldset>
        {pagoPor === "escritorio" && (
          <div className="flex flex-col gap-2 rounded-xl bg-crm-fundo p-3 sm:col-span-2">
            <CaixaSelecao marcado={reembolsavel} aoAlterar={setReembolsavel} rotulo="O cliente deve reembolsar este valor" />
            {reembolsavel && <CaixaSelecao marcado={gerarCobranca} aoAlterar={setGerarCobranca} rotulo="Gerar cobrança de reembolso" descricao="Cria uma cobrança na categoria “Reembolso de custas/despesas”." />}
            {reembolsavel && gerarCobranca && (
              <GrupoCampo rotulo="Vencimento do reembolso">{(p) => <Entrada {...p} type="date" value={vencReembolso} onChange={(e) => setVencReembolso(e.target.value)} />}</GrupoCampo>
            )}
          </div>
        )}
        <div className="sm:col-span-2"><CampoArquivo arquivo={arquivo} aoAlterar={setArquivo} /></div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Ações com motivo obrigatório
// ---------------------------------------------------------------------------

export function useAcoesFinanceiras() {
  const { desenvolvedor } = useAuth();
  const invalidar = useInvalidarFinanceiro();
  const comMotivo = async (titulo: string, mensagem: string, acao: string, dados: Record<string, unknown>, sucesso: string) => {
    const r = await confirmar({ titulo, mensagem, motivo: { rotulo: "Motivo", obrigatorio: !desenvolvedor }, confirmar: "Confirmar", perigo: true });
    if (!r.confirmado) return;
    try {
      await acaoFinanceira(acao, { ...dados, motivo: r.motivo });
      aviso.sucesso(sucesso);
      invalidar();
    } catch (e) {
      aviso.erro(mensagemErro(e));
    }
  };
  // Conta de desenvolvimento: desfazer cancelamentos e estornos e excluir lançamentos.
  const desfazer = async (tabela: "cobrancas" | "pagamentos" | "despesas", id: string, dados: Record<string, null>, sucesso: string) => {
    try {
      await executar(supabase().from(tabela).update(dados as never).eq("id", id).select("id"));
      aviso.sucesso(sucesso);
      invalidar();
    } catch (e) {
      aviso.erro(mensagemErro(e));
    }
  };
  const excluir = async (tipo: TipoExclusaoDev, id: string, titulo: string, mensagem: string) => {
    if (!(await confirmarSimples({ titulo, mensagem: `${mensagem} Esta ação não pode ser desfeita.`, confirmar: "Excluir definitivamente", perigo: true }))) return;
    try {
      await excluirComoDev(tipo, id);
      aviso.sucesso("Lançamento excluído.");
      invalidar();
    } catch (e) {
      aviso.erro(mensagemErro(e));
    }
  };
  return {
    cancelarCobranca: (c: CobrancaSituacao) => comMotivo("Cancelar cobrança?", `“${c.descricao}” deixará de ser considerada a receber. Cobranças com pagamentos precisam de estorno ou reembolso antes.`, "cancelar_cobranca", { id: c.id }, "Cobrança cancelada."),
    estornarPagamento: (id: string) => comMotivo("Estornar pagamento?", "Use para corrigir um lançamento indevido. O valor deixa de contar como recebido; o registro permanece no histórico.", "estornar_pagamento", { id }, "Pagamento estornado."),
    cancelarDespesa: (id: string) => comMotivo("Cancelar custas/despesa?", "O lançamento fica registrado como cancelado. A cobrança de reembolso vinculada (se houver e sem pagamentos) também é cancelada.", "cancelar_despesa", { id }, "Lançamento cancelado."),
    reabrirCobranca: (id: string) => desfazer("cobrancas", id, { cancelada_em: null, cancelada_por: null, motivo_cancelamento: null }, "Cobrança reaberta."),
    desfazerEstorno: (id: string) => desfazer("pagamentos", id, { estornado_em: null, estornado_por: null, motivo_estorno: null }, "Estorno desfeito."),
    reativarDespesa: (id: string) => desfazer("despesas", id, { cancelada_em: null, cancelada_por: null, motivo_cancelamento: null }, "Lançamento reativado."),
    excluirContrato: (id: string, descricao: string) => excluir("contrato", id, `Excluir o contrato “${descricao}”?`, "O contrato, todas as parcelas e os pagamentos e reembolsos delas serão apagados."),
    excluirCobranca: (c: CobrancaSituacao) => excluir("cobranca", c.id!, `Excluir a cobrança “${c.descricao}”?`, "A cobrança e os pagamentos e reembolsos dela serão apagados."),
    excluirPagamento: (id: string) => excluir("pagamento", id, "Excluir o pagamento?", "O pagamento deixa de existir, inclusive no histórico."),
    excluirReembolso: (id: string) => excluir("reembolso", id, "Excluir o reembolso?", "O reembolso deixa de existir, inclusive no histórico."),
    excluirDespesa: (id: string) => excluir("despesa", id, "Excluir as custas/despesa?", "O lançamento deixa de existir. A cobrança de reembolso vinculada, se houver, continua e pode ser excluída à parte."),
  };
}
