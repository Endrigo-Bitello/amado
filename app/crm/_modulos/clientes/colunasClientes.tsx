"use client";

import { useMemo } from "react";
import { useAuth } from "../../_lib/auth";
import { colunasPersonalizadas, useSalvarValorPersonalizado, useValoresPersonalizados } from "../../_lib/campos";
import { colunaEtiquetas, colunaResponsavel, opcoesLista } from "../../_lib/colunas";
import { useConfig } from "../../_lib/config";
import { formatarDocumento } from "../../_lib/formatos";
import type { Cliente } from "../../_lib/tipos";
import type { ColunaQuadro } from "../../_quadro/tipos";

export type ClienteQuadro = Cliente & { casos: { count: number }[] };

export function useColunasClientes(salvar: (c: ClienteQuadro, alt: Record<string, unknown>) => Promise<void>): ColunaQuadro<ClienteQuadro>[] {
  const config = useConfig();
  const { pode } = useAuth();
  const podeEditar = pode("clientes.editar");
  const valores = useValoresPersonalizados("cliente");
  const salvarValor = useSalvarValorPersonalizado("cliente");
  const ed = podeEditar ? salvar : undefined;
  return useMemo<ColunaQuadro<ClienteQuadro>[]>(() => {
    const cols: ColunaQuadro<ClienteQuadro>[] = [
      {
        id: "nome",
        titulo: "Cliente",
        tipo: "texto",
        valor: (c) => c.nome,
        texto: (c) => `${c.nome} ${c.codigo ?? ""} ${c.cpf_cnpj ?? ""}`,
        exibir: (c) => (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{c.nome}</span>
            <span className="shrink-0 font-mono text-[10px] font-semibold text-crm-tinta-3">{c.codigo}</span>
          </span>
        ),
        editar: ed ? (c, v) => salvar(c, { nome: v }) : undefined,
        largura: 280,
        obrigatoria: true,
      },
      {
        id: "casos",
        titulo: "Casos",
        tipo: "numero",
        valor: (c) => c.casos?.[0]?.count ?? 0,
        alinhamento: "direita",
        largura: 90,
        descricao: "Quantidade de casos e processos do cliente",
      },
      colunaResponsavel<ClienteQuadro>(config, ed),
      { id: "whatsapp", titulo: "WhatsApp", tipo: "telefone", valor: (c) => c.whatsapp, editar: ed ? (c, v) => salvar(c, { whatsapp: v }) : undefined, largura: 170 },
      { id: "email", titulo: "E-mail", tipo: "email", valor: (c) => c.email, editar: ed ? (c, v) => salvar(c, { email: v }) : undefined, largura: 210 },
      {
        id: "cpf_cnpj",
        titulo: "CPF/CNPJ",
        tipo: "texto",
        valor: (c) => c.cpf_cnpj,
        texto: (c) => formatarDocumento(c.cpf_cnpj),
        exibir: (c) => <span className="tabular-nums">{formatarDocumento(c.cpf_cnpj) || "—"}</span>,
        largura: 160,
      },
      { id: "cidade", titulo: "Cidade", tipo: "texto", valor: (c) => c.cidade, editar: ed ? (c, v) => salvar(c, { cidade: v }) : undefined, largura: 150, agrupavel: true },
      { id: "uf", titulo: "UF", tipo: "texto", valor: (c) => c.uf, editar: ed ? (c, v) => salvar(c, { uf: typeof v === "string" ? v.toUpperCase().slice(0, 2) : v }) : undefined, largura: 70, agrupavel: true },
      { id: "origem", titulo: "Origem", tipo: "selecao", valor: (c) => c.origem, opcoes: opcoesLista(config, "origem"), editar: ed ? (c, v) => salvar(c, { origem: v ?? "manual" }) : undefined, largura: 150, agrupavel: true },
      {
        id: "status",
        titulo: "Situação",
        tipo: "status",
        valor: (c) => c.status,
        opcoes: [
          { valor: "ativo", rotulo: "Ativo", cor: "#3D7B3E" },
          { valor: "inativo", rotulo: "Inativo", cor: "#A1A1AA" },
        ],
        editar: ed ? (c, v) => salvar(c, { status: v ?? "ativo" }) : undefined,
        agrupavel: true,
        largura: 110,
      },
      {
        id: "possui_representante",
        titulo: "Representante legal",
        tipo: "checkbox",
        valor: (c) => c.possui_representante,
        largura: 110,
        oculta: true,
        agrupavel: true,
      },
      { id: "created_at", titulo: "Cliente desde", tipo: "data", valor: (c) => c.created_at.slice(0, 10), largura: 130 },
      { id: "profissao", titulo: "Profissão", tipo: "texto", valor: (c) => c.profissao, largura: 150, oculta: true },
      colunaEtiquetas<ClienteQuadro>(config, "cliente", ed),
    ];
    return [...cols, ...colunasPersonalizadas<ClienteQuadro>(config.camposDe("cliente"), valores.data, salvarValor, podeEditar)];
  }, [config, ed, salvar, valores.data, salvarValor, podeEditar]);
}
