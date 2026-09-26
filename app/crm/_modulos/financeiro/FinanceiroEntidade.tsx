"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, Download, FilePlus2, HandCoins, Lock, MoreHorizontal, Paperclip, Pencil, Plus, Receipt, RotateCcw, Undo2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useAuth } from "../../_lib/auth";
import { aviso } from "../../_lib/avisos";
import { useConfig } from "../../_lib/config";
import { formatarData, formatarDataHora } from "../../_lib/datas";
import { executar, mensagemErro } from "../../_lib/dados";
import { exportarPlanilha } from "../../_lib/exportar";
import { formatarMoeda } from "../../_lib/formatos";
import { supabase } from "../../_lib/supabase";
import type { CobrancaSituacao, Contrato, Despesa, Pagamento, Reembolso } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { Menu } from "../../_ui/Sobreposicoes";
import { Carregando, ErroCarga, Selo, Vazio } from "../../_ui/Visuais";
import { abrirArquivo } from "../../_componentes/Arquivos";
import { CATEGORIAS_COBRANCA, PilulaSituacao } from "./comum";
import { FormContrato, FormDespesa, FormEditarCobranca, FormNovaCobranca, FormPagamento, FormReembolso, useAcoesFinanceiras } from "./Formularios";

interface Props {
  cliente: { id: string; nome: string };
  casoId?: string | null;
  casos: { id: string; titulo: string }[];
}

export function useFinanceiroEntidade(clienteId: string, casoId?: string | null, ativo = true) {
  return useQuery({
    queryKey: ["financeiro", "entidade", clienteId, casoId ?? null],
    enabled: ativo,
    queryFn: async () => {
      const s = supabase();
      const filtro = <T extends { eq: (c: string, v: string) => T }>(q: T) => (casoId ? q.eq("caso_id", casoId) : q);
      const [cobrancas, contratos, pagamentos, reembolsos, despesas] = await Promise.all([
        executar(filtro(s.from("v_cobrancas").select("*").eq("cliente_id", clienteId)).order("vencimento")),
        executar(filtro(s.from("contratos").select("*").eq("cliente_id", clienteId)).order("created_at", { ascending: false })),
        executar(filtro(s.from("pagamentos").select("*, comprovante:arquivos(id, bucket, caminho, nome)").eq("cliente_id", clienteId)).order("data_pagamento", { ascending: false })),
        executar(filtro(s.from("reembolsos").select("*").eq("cliente_id", clienteId)).order("data", { ascending: false })),
        executar(filtro(s.from("despesas").select("*, comprovante:arquivos(id, bucket, caminho, nome)").eq("cliente_id", clienteId)).order("data", { ascending: false })),
      ]);
      return {
        cobrancas: (cobrancas ?? []) as CobrancaSituacao[],
        contratos: (contratos ?? []) as Contrato[],
        pagamentos: (pagamentos ?? []) as unknown as (Pagamento & { comprovante: { id: string; bucket: string; caminho: string; nome: string } | null })[],
        reembolsos: (reembolsos ?? []) as Reembolso[],
        despesas: (despesas ?? []) as unknown as (Despesa & { comprovante: { id: string; bucket: string; caminho: string; nome: string } | null })[],
      };
    },
  });
}

export function resumoFinanceiro(cobrancas: CobrancaSituacao[], despesas: Despesa[], reembolsos: Reembolso[]) {
  const validas = cobrancas.filter((c) => c.situacao !== "cancelado");
  const hon = validas.filter((c) => c.categoria === "honorarios");
  const reemb = validas.filter((c) => c.categoria === "reembolso_despesas");
  const soma = (l: CobrancaSituacao[], k: "valor_devido" | "valor_pago" | "saldo") => l.reduce((t, c) => t + Number(c[k] ?? 0), 0);
  const despesasValidas = despesas.filter((d) => !d.cancelada_em);
  return {
    contratado: soma(hon, "valor_devido"),
    recebido: soma(hon, "valor_pago"),
    emAberto: soma(hon.filter((c) => c.situacao !== "reembolsado"), "saldo"),
    vencido: soma(hon.filter((c) => c.situacao === "vencido"), "saldo"),
    reembolsosAReceber: soma(reemb, "saldo"),
    adiantadoEscritorio: despesasValidas.filter((d) => d.pago_por === "escritorio").reduce((t, d) => t + Number(d.valor), 0),
    pagoPeloCliente: despesasValidas.filter((d) => d.pago_por === "cliente").reduce((t, d) => t + Number(d.valor), 0),
    devolvido: reembolsos.reduce((t, r) => t + Number(r.valor), 0),
  };
}

export function FinanceiroEntidade({ cliente, casoId, casos }: Props) {
  const { pode } = useAuth();
  const config = useConfig();
  const consulta = useFinanceiroEntidade(cliente.id, casoId, pode("financeiro.ver"));
  const acoes = useAcoesFinanceiras();
  const [contrato, setContrato] = useState(false);
  const [novaCobranca, setNovaCobranca] = useState(false);
  const [despesa, setDespesa] = useState(false);
  const [pagar, setPagar] = useState<CobrancaSituacao | null>(null);
  const [editar, setEditar] = useState<CobrancaSituacao | null>(null);
  const [reembolsar, setReembolsar] = useState<CobrancaSituacao | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);

  const dados = consulta.data;
  const resumo = useMemo(() => (dados ? resumoFinanceiro(dados.cobrancas, dados.despesas, dados.reembolsos) : null), [dados]);

  if (!pode("financeiro.ver")) {
    return <Vazio icone={<Lock size={22} />} titulo="Acesso restrito" descricao="Seu perfil não tem permissão para ver valores financeiros." />;
  }
  if (consulta.isLoading) return <Carregando />;
  if (consulta.error || !dados || !resumo) return <ErroCarga mensagem={mensagemErro(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />;

  const exportar = async () => {
    try {
      await exportarPlanilha(
        `financeiro-${cliente.nome.split(" ")[0].toLowerCase()}`,
        [
          { titulo: "Descrição", texto: (c: CobrancaSituacao) => c.descricao },
          { titulo: "Categoria", texto: (c) => CATEGORIAS_COBRANCA[c.categoria ?? ""] ?? c.categoria },
          { titulo: "Caso", texto: (c) => casos.find((x) => x.id === c.caso_id)?.titulo ?? "" },
          { titulo: "Vencimento", texto: (c) => formatarData(c.vencimento) },
          { titulo: "Valor", texto: (c) => Number(c.valor) },
          { titulo: "Desconto", texto: (c) => Number(c.desconto) },
          { titulo: "Acréscimo", texto: (c) => Number(c.acrescimo) },
          { titulo: "Valor devido", texto: (c) => Number(c.valor_devido) },
          { titulo: "Pago", texto: (c) => Number(c.valor_pago) },
          { titulo: "Reembolsado", texto: (c) => Number(c.valor_reembolsado) },
          { titulo: "Saldo", texto: (c) => Number(c.saldo) },
          { titulo: "Situação", texto: (c) => c.situacao ?? "" },
        ],
        dados.cobrancas,
        "xlsx",
        "financeiro",
      );
      aviso.sucesso("Histórico financeiro exportado.");
    } catch (e) {
      aviso.erro(mensagemErro(e));
    }
  };

  const podeContratos = pode("financeiro.contratos");
  const podeLancar = pode("financeiro.lancar");
  const avulsas = dados.cobrancas.filter((c) => !c.contrato_id);

  const linhaCobranca = (c: CobrancaSituacao) => {
    const pagamentos = dados.pagamentos.filter((p) => p.cobranca_id === c.id);
    const reembolsos = dados.reembolsos.filter((r) => r.cobranca_id === c.id);
    const aberta = expandida === c.id;
    const itensMenu = [
      ...(podeLancar && c.situacao !== "cancelado" && Number(c.saldo) > 0 ? [{ rotulo: "Registrar pagamento", icone: <HandCoins size={15} />, aoSelecionar: () => setPagar(c) }] : []),
      ...((podeContratos || pode("financeiro.desconto")) && c.situacao !== "cancelado" ? [{ rotulo: "Editar / conceder desconto", icone: <Pencil size={15} />, aoSelecionar: () => setEditar(c) }] : []),
      ...(podeContratos && Number(c.valor_pago) - Number(c.valor_reembolsado) > 0 ? [{ rotulo: "Registrar reembolso ao cliente", icone: <RotateCcw size={15} />, aoSelecionar: () => setReembolsar(c) }] : []),
      ...(podeContratos && c.situacao !== "cancelado" ? [{ rotulo: "Cancelar cobrança", icone: <Ban size={15} />, aoSelecionar: () => acoes.cancelarCobranca(c), perigo: true, separadorAntes: true }] : []),
    ];
    return (
      <Fragment key={c.id}>
        <tr className={`border-t border-crm-linha ${c.situacao === "vencido" ? "bg-crm-perigo-claro/50" : ""}`}>
          <td className="px-3 py-2">
            <button type="button" onClick={() => setExpandida(aberta ? null : c.id)} className="text-left text-sm font-semibold hover:underline" aria-expanded={aberta}>
              {c.descricao}
            </button>
            <span className="block text-xs text-crm-tinta-3">
              {CATEGORIAS_COBRANCA[c.categoria ?? ""]}
              {c.caso_id && !casoId ? ` · ${casos.find((x) => x.id === c.caso_id)?.titulo ?? "caso"}` : ""}
              {Number(c.desconto) > 0 && ` · desconto ${formatarMoeda(c.desconto)}`}
            </span>
          </td>
          <td className="px-3 py-2 text-sm tabular-nums">{formatarData(c.vencimento)}</td>
          <td className="px-3 py-2 text-right text-sm tabular-nums">{formatarMoeda(c.valor_devido)}</td>
          <td className="px-3 py-2 text-right text-sm tabular-nums">{formatarMoeda(c.valor_pago)}</td>
          <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums">{formatarMoeda(c.saldo)}</td>
          <td className="px-3 py-2">
            <PilulaSituacao situacao={c.situacao} parcial={c.parcialmente_pago} />
          </td>
          <td className="px-2 py-2 text-right">
            {itensMenu.length > 0 && (
              <Menu
                rotulo={`Ações — ${c.descricao}`}
                itens={itensMenu}
                gatilho={(p) => (
                  <button {...p} type="button" className="rounded-lg p-1.5 text-crm-tinta-2 hover:bg-crm-suave" aria-label={`Ações de ${c.descricao}`}>
                    <MoreHorizontal size={16} />
                  </button>
                )}
              />
            )}
          </td>
        </tr>
        {aberta && (
          <tr className="bg-crm-fundo">
            <td colSpan={7} className="px-4 py-3">
              {pagamentos.length === 0 && reembolsos.length === 0 ? (
                <p className="text-xs text-crm-tinta-3">Nenhum pagamento registrado.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-xs">
                  {pagamentos.map((p) => (
                    <li key={p.id} className={`flex flex-wrap items-center gap-2 ${p.estornado_em ? "text-crm-tinta-3 line-through" : ""}`}>
                      <Receipt size={12} aria-hidden />
                      <strong className="tabular-nums">{formatarMoeda(p.valor)}</strong> em {formatarData(p.data_pagamento)} via {config.rotulo("forma_pagamento", p.forma)} · registrado por {config.usuario(p.registrado_por)?.nome ?? "—"} em {formatarDataHora(p.registrado_em)}
                      {p.comprovante && (
                        <button type="button" onClick={() => abrirArquivo(p.comprovante!)} className="inline-flex items-center gap-0.5 font-semibold text-crm-info no-underline hover:underline">
                          <Paperclip size={11} /> comprovante
                        </button>
                      )}
                      {p.estornado_em ? (
                        <Selo tom="neutro">Estornado: {p.motivo_estorno}</Selo>
                      ) : (
                        podeLancar && (
                          <button type="button" onClick={() => acoes.estornarPagamento(p.id)} className="inline-flex items-center gap-0.5 font-semibold text-crm-perigo hover:underline">
                            <Undo2 size={11} /> estornar
                          </button>
                        )
                      )}
                    </li>
                  ))}
                  {reembolsos.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 text-[#6D5BA6]">
                      <RotateCcw size={12} aria-hidden /> Reembolso de <strong className="tabular-nums">{formatarMoeda(r.valor)}</strong> em {formatarData(r.data)} — {r.motivo}
                    </li>
                  ))}
                </ul>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const tabelaCobrancas = (lista: CobrancaSituacao[]) => (
    <div className="overflow-x-auto rounded-xl border border-crm-linha bg-white">
      <table className="w-full min-w-[720px] text-left">
        <thead className="bg-crm-suave text-xs font-bold text-crm-tinta-2">
          <tr>
            <th className="px-3 py-2">Cobrança</th>
            <th className="px-3 py-2">Vencimento</th>
            <th className="px-3 py-2 text-right">Devido</th>
            <th className="px-3 py-2 text-right">Pago</th>
            <th className="px-3 py-2 text-right">Saldo</th>
            <th className="px-3 py-2">Situação</th>
            <th className="px-2 py-2"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {lista.map((c) => linhaCobranca(c))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {podeContratos && (
          <Botao tamanho="sm" variante="primario" icone={<FilePlus2 size={14} />} onClick={() => setContrato(true)}>
            Novo contrato
          </Botao>
        )}
        {podeContratos && (
          <Botao tamanho="sm" variante="secundario" icone={<Plus size={14} />} onClick={() => setNovaCobranca(true)}>
            Cobrança avulsa
          </Botao>
        )}
        {podeLancar && (
          <Botao tamanho="sm" variante="secundario" icone={<Receipt size={14} />} onClick={() => setDespesa(true)}>
            Custas / despesa
          </Botao>
        )}
        {pode("dados.exportar") && dados.cobrancas.length > 0 && (
          <Botao tamanho="sm" variante="fantasma" icone={<Download size={14} />} onClick={exportar} className="ml-auto">
            Exportar histórico
          </Botao>
        )}
      </div>

      <section aria-label="Resumo de honorários">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-crm-tinta-3">Honorários</h3>
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ["Contratado", resumo.contratado, "text-crm-tinta"],
            ["Recebido", resumo.recebido, "text-crm-sucesso"],
            ["Em aberto", resumo.emAberto, "text-crm-info"],
            ["Vencido", resumo.vencido, resumo.vencido > 0 ? "text-crm-perigo" : "text-crm-tinta-3"],
          ].map(([r, v, cor]) => (
            <div key={r as string} className="rounded-xl border border-crm-linha bg-white px-3 py-2">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-crm-tinta-3">{r}</dt>
              <dd className={`text-lg font-semibold ${cor}`}>{formatarMoeda(v as number)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label="Custas e despesas">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-crm-tinta-3">Custas e despesas em nome do cliente (não são receita)</h3>
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ["Adiantado pelo escritório", resumo.adiantadoEscritorio],
            ["Reembolsos a receber", resumo.reembolsosAReceber],
            ["Pago pelo cliente", resumo.pagoPeloCliente],
            ["Devolvido ao cliente", resumo.devolvido],
          ].map(([r, v]) => (
            <div key={r as string} className="rounded-xl border border-dashed border-crm-linha-forte bg-crm-fundo px-3 py-2">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-crm-tinta-3">{r}</dt>
              <dd className="text-base font-semibold text-crm-tinta">{formatarMoeda(v as number)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {dados.contratos.length === 0 && dados.cobrancas.length === 0 && dados.despesas.length === 0 ? (
        <Vazio compacto titulo="Nenhum lançamento financeiro" descricao="Registre o contrato de honorários para gerar as parcelas." />
      ) : (
        <>
          {dados.contratos.map((ct) => {
            const lista = dados.cobrancas.filter((c) => c.contrato_id === ct.id);
            return (
              <section key={ct.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold">{ct.descricao}</h3>
                  <Selo tom={ct.status === "ativo" ? "verde" : "neutro"}>{ct.status === "ativo" ? "Ativo" : ct.status === "encerrado" ? "Encerrado" : "Cancelado"}</Selo>
                  <span className="text-xs text-crm-tinta-2">
                    {config.rotulo("forma_contratacao", ct.forma_contratacao)} · {formatarMoeda(ct.valor_total)}
                    {Number(ct.desconto) > 0 && ` (desconto ${formatarMoeda(ct.desconto)})`}
                    {ct.percentual_exito ? ` · êxito ${ct.percentual_exito}%` : ""}
                    {ct.data_assinatura ? ` · assinado em ${formatarData(ct.data_assinatura)}` : ""}
                  </span>
                </div>
                {lista.length > 0 ? tabelaCobrancas(lista) : <p className="text-xs text-crm-tinta-3">Sem parcelas (ex.: somente êxito).</p>}
              </section>
            );
          })}
          {avulsas.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">Cobranças avulsas</h3>
              {tabelaCobrancas(avulsas)}
            </section>
          )}
          {dados.despesas.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">Custas e despesas</h3>
              <ul className="flex flex-col divide-y divide-crm-linha rounded-xl border border-crm-linha bg-white">
                {dados.despesas.map((d) => (
                  <li key={d.id} className={`flex flex-wrap items-center gap-2 px-3 py-2 text-sm ${d.cancelada_em ? "text-crm-tinta-3 line-through" : ""}`}>
                    <Selo tom={d.categoria === "custas" ? "info" : "neutro"}>{d.categoria === "custas" ? "Custas" : "Despesa"}</Selo>
                    <span className="min-w-0 flex-1 truncate">{d.descricao}</span>
                    <span className="tabular-nums">{formatarMoeda(d.valor)}</span>
                    <span className="text-xs text-crm-tinta-3">
                      {formatarData(d.data)} · {d.pago_por === "escritorio" ? "adiantado pelo escritório" : "pago pelo cliente"}
                      {d.cobranca_reembolso_id ? " · reembolso cobrado" : ""}
                    </span>
                    {d.comprovante && (
                      <button type="button" onClick={() => abrirArquivo(d.comprovante!)} className="text-xs font-semibold text-crm-info hover:underline">
                        comprovante
                      </button>
                    )}
                    {!d.cancelada_em && podeLancar && (
                      <button type="button" onClick={() => acoes.cancelarDespesa(d.id)} className="text-xs font-semibold text-crm-perigo hover:underline">
                        cancelar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <p className="text-xs text-crm-tinta-3">Integrações bancárias, emissão de boletos/notas fiscais e cobrança automática não estão ativas — os lançamentos são registrados manualmente pela equipe.</p>

      <FormContrato aberto={contrato} aoFechar={() => setContrato(false)} cliente={cliente} casos={casos} casoInicial={casoId} />
      <FormNovaCobranca aberto={novaCobranca} aoFechar={() => setNovaCobranca(false)} cliente={cliente} casos={casos} />
      <FormDespesa aberto={despesa} aoFechar={() => setDespesa(false)} cliente={cliente} casos={casos} casoInicial={casoId} />
      <FormPagamento cobranca={pagar} aoFechar={() => setPagar(null)} />
      <FormEditarCobranca cobranca={editar} aoFechar={() => setEditar(null)} />
      <FormReembolso cobranca={reembolsar} aoFechar={() => setReembolsar(null)} />
    </div>
  );
}
