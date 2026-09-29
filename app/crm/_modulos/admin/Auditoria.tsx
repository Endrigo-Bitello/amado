"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../_lib/auth";
import { useConfig } from "../../_lib/config";
import { formatarDataHora, hojeSP, inicioDiaSP, somarDias } from "../../_lib/datas";
import { executar, mensagemErro, useGravacao } from "../../_lib/dados";
import { supabase } from "../../_lib/supabase";
import type { Auditoria } from "../../_lib/tipos";
import { Botao } from "../../_ui/Botao";
import { Selecao } from "../../_ui/Campos";
import { confirmarSimples } from "../../_ui/Dialogos";
import { Carregando, ErroCarga, Selo, Vazio } from "../../_ui/Visuais";
import { SecaoAdmin } from "./comum";

const TABELAS: Record<string, string> = {
  leads: "Leads",
  clientes: "Clientes",
  dados_clinicos: "Dados clínicos",
  casos: "Casos",
  processos: "Processos",
  prazos: "Prazos",
  documentos: "Documentos",
  arquivos: "Arquivos",
  solicitacoes_documentos: "Links de documentos",
  contratos: "Contratos",
  cobrancas: "Cobranças",
  pagamentos: "Pagamentos",
  reembolsos: "Reembolsos",
  despesas: "Custas e despesas",
  usuarios: "Usuários",
  perfis: "Perfis e permissões",
  configuracoes: "Configurações",
  campos_personalizados: "Campos personalizados",
  etapas: "Etapas e fases",
  automacoes: "Automações",
  consentimentos: "Consentimentos (LGPD)",
  importacoes: "Importações",
};

const ACOES: Record<string, { rotulo: string; tom: "sucesso" | "info" | "perigo" | "alerta" | "neutro" }> = {
  INSERT: { rotulo: "Criação", tom: "sucesso" },
  UPDATE: { rotulo: "Alteração", tom: "info" },
  DELETE: { rotulo: "Exclusão", tom: "perigo" },
  EXPORT: { rotulo: "Exportação", tom: "alerta" },
  LOGIN: { rotulo: "Acesso", tom: "neutro" },
  ACAO: { rotulo: "Ação", tom: "neutro" },
};

const PAGINA = 100;

export function AdminAuditoria() {
  const config = useConfig();
  const { desenvolvedor } = useAuth();
  const { excluir } = useGravacao();
  const [tabela, setTabela] = useState("");
  const [acao, setAcao] = useState("");
  const [usuario, setUsuario] = useState("");
  const [dias, setDias] = useState(30);
  const [aberto, setAberto] = useState<number | null>(null);
  const consulta = useInfiniteQuery({
    queryKey: ["auditoria", { tabela, acao, usuario, dias }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase().from("auditoria").select("*").gte("created_at", inicioDiaSP(somarDias(hojeSP(), -dias + 1)));
      if (tabela) q = q.eq("tabela", tabela);
      if (acao) q = q.eq("acao", acao);
      if (usuario) q = q.eq("usuario_id", usuario);
      return (await executar(q.order("created_at", { ascending: false }).range(pageParam, pageParam + PAGINA - 1))) as Auditoria[];
    },
    getNextPageParam: (ultima, todas) => (ultima.length === PAGINA ? todas.length * PAGINA : undefined),
  });
  const linhas = consulta.data?.pages.flat() ?? [];
  const excluirRegistro = async (id: number) => {
    if (!(await confirmarSimples({ titulo: "Excluir registro da auditoria?", mensagem: "O registro deixa de existir. Esta ação não pode ser desfeita.", confirmar: "Excluir", perigo: true }))) return;
    await excluir("auditoria", String(id), { chaves: ["auditoria"], mensagemSucesso: "Registro excluído." }).catch(() => undefined);
  };

  return (
    <SecaoAdmin
      titulo="Auditoria"
      descricao="Registro imutável de criações, alterações, exclusões, exportações e ações sensíveis (prazos, documentos, financeiro, permissões). Senhas e tokens nunca são registrados."
    >
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-crm-linha bg-white p-3" role="group" aria-label="Filtros da auditoria">
        <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
          Período
          <Selecao value={dias} onChange={(e) => setDias(Number(e.target.value))} className="min-w-40 max-w-40">
            <option value={1}>Hoje</option>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </Selecao>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
          Área
          <Selecao value={tabela} onChange={(e) => setTabela(e.target.value)} className="min-w-40 max-w-52">
            <option value="">Todas</option>
            {Object.entries(TABELAS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selecao>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
          Ação
          <Selecao value={acao} onChange={(e) => setAcao(e.target.value)} className="min-w-40 max-w-40">
            <option value="">Todas</option>
            {Object.entries(ACOES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.rotulo}
              </option>
            ))}
          </Selecao>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2">
          Pessoa
          <Selecao value={usuario} onChange={(e) => setUsuario(e.target.value)} className="min-w-40 max-w-52">
            <option value="">Todas</option>
            {config.usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Selecao>
        </label>
      </div>
      {consulta.isLoading ? (
        <Carregando />
      ) : consulta.error ? (
        <ErroCarga mensagem={mensagemErro(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />
      ) : linhas.length === 0 ? (
        <Vazio compacto icone={<ShieldCheck size={18} />} titulo="Nenhum registro com estes filtros" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-crm-linha bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-crm-suave text-xs font-bold text-crm-tinta-2">
              <tr>
                <th className="px-3 py-2">Quando</th>
                <th className="px-3 py-2">Pessoa</th>
                <th className="px-3 py-2">Ação</th>
                <th className="px-3 py-2">Área</th>
                <th className="px-3 py-2">Detalhes</th>
                {desenvolvedor && (
                  <th className="px-2 py-2">
                    <span className="sr-only">Excluir</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const expandido = aberto === l.id;
                const campos = Object.keys((l.alteracoes as Record<string, unknown>) ?? {});
                return (
                  <tr key={l.id} className="border-t border-crm-linha align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-crm-tinta-2">{formatarDataHora(l.created_at)}</td>
                    <td className="px-3 py-2">{l.usuario_id ? config.usuario(l.usuario_id)?.nome ?? "Usuário removido" : <span className="text-crm-tinta-3">Sistema{l.contexto ? ` (${l.contexto})` : ""}</span>}</td>
                    <td className="px-3 py-2">
                      <Selo tom={ACOES[l.acao]?.tom ?? "neutro"}>{ACOES[l.acao]?.rotulo ?? l.acao}</Selo>
                    </td>
                    <td className="px-3 py-2">{TABELAS[l.tabela] ?? l.tabela}</td>
                    <td className="px-3 py-2">
                      {campos.length === 0 ? (
                        <span className="text-xs text-crm-tinta-3">—</span>
                      ) : (
                        <>
                          <button type="button" onClick={() => setAberto(expandido ? null : l.id)} aria-expanded={expandido} className="inline-flex items-center gap-1 text-xs font-semibold text-crm-info hover:underline">
                            {expandido ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
                            {campos.length <= 3 ? campos.join(", ") : `${campos.slice(0, 3).join(", ")} +${campos.length - 3}`}
                          </button>
                          {expandido && (
                            <pre className="mt-1 max-h-64 max-w-[520px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-crm-fundo p-2 text-[11px] leading-snug text-crm-tinta-2">
                              {JSON.stringify(l.alteracoes, null, 2)}
                            </pre>
                          )}
                        </>
                      )}
                    </td>
                    {desenvolvedor && (
                      <td className="px-2 py-2 text-right">
                        <button type="button" onClick={() => excluirRegistro(l.id)} className="rounded p-1 text-crm-tinta-3 hover:bg-crm-perigo-claro hover:text-crm-perigo" aria-label="Excluir registro da auditoria">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {consulta.hasNextPage && (
        <Botao tamanho="sm" className="self-center" carregando={consulta.isFetchingNextPage} onClick={() => consulta.fetchNextPage()}>
          Carregar mais
        </Botao>
      )}
    </SecaoAdmin>
  );
}
