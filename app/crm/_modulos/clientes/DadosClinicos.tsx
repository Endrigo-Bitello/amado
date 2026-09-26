"use client";

import { useQuery } from "@tanstack/react-query";
import { Lock, Stethoscope } from "lucide-react";
import { useAuth } from "../../_lib/auth";
import { useConfig } from "../../_lib/config";
import { formatarDataHora } from "../../_lib/datas";
import { executar, useGravacao } from "../../_lib/dados";
import { supabase } from "../../_lib/supabase";
import type { DadosClinicos as TDados } from "../../_lib/tipos";
import type { ColunaQuadro } from "../../_quadro/tipos";
import { Carregando, Vazio } from "../../_ui/Visuais";
import { ListaPropriedades } from "../../_componentes/Propriedades";

const CAMPOS: { id: keyof TDados; titulo: string; longo?: boolean }[] = [
  { id: "diagnostico", titulo: "Diagnóstico / condição", longo: true },
  { id: "cid", titulo: "CID (se informado)" },
  { id: "medico_nome", titulo: "Médico(a) responsável" },
  { id: "medico_registro", titulo: "Registro profissional (CRM)" },
  { id: "medico_especialidade", titulo: "Especialidade" },
  { id: "produto_prescrito", titulo: "Produto prescrito" },
  { id: "posologia", titulo: "Posologia" },
  { id: "tratamento_atual", titulo: "Tratamento atual", longo: true },
  { id: "tratamentos_anteriores", titulo: "Tratamentos anteriores", longo: true },
  { id: "observacoes", titulo: "Observações clínicas", longo: true },
];

/** Dados de saúde do cliente: acesso restrito pela RLS (necessidade de saber). */
export function DadosClinicos({ clienteId }: { clienteId: string }) {
  const { pode } = useAuth();
  const config = useConfig();
  const { inserir, atualizar } = useGravacao();
  const temPermissao = pode("saude.ver_todos") || pode("saude.ver_atribuidos");
  const consulta = useQuery({
    queryKey: ["dados_clinicos", clienteId],
    enabled: temPermissao,
    queryFn: async () => (await executar(supabase().from("dados_clinicos").select("*").eq("cliente_id", clienteId).maybeSingle())) as TDados | null,
  });

  if (!temPermissao) {
    return <Vazio icone={<Lock size={22} />} titulo="Acesso restrito" descricao="Seu perfil não tem acesso a dados de saúde. Peça ao administrador, se for necessário para o seu trabalho." />;
  }
  if (consulta.isLoading) return <Carregando />;
  const dados = consulta.data;

  // Sem registro: pode ser ausência de dados OU falta de vínculo (ver_atribuidos).
  const podeEditar = pode("clientes.editar");
  const registro: TDados = dados ?? ({ cliente_id: clienteId } as TDados);
  const salvar = async (campo: keyof TDados, valor: unknown) => {
    if (dados) await atualizar("dados_clinicos", clienteId, { [campo]: valor }, { chaves: ["dados_clinicos"], colunaChave: "cliente_id" }).catch(() => undefined);
    else await inserir("dados_clinicos", { cliente_id: clienteId, [campo]: valor }, { chaves: ["dados_clinicos"] }).catch(() => undefined);
  };
  const colunas: ColunaQuadro<TDados>[] = CAMPOS.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.longo ? "texto_longo" : "texto",
    valor: (d) => d[c.id] as string | null,
    exibir: c.longo ? (d) => <span className="line-clamp-3 whitespace-pre-wrap">{(d[c.id] as string) || "—"}</span> : undefined,
    editar: podeEditar ? (_d, v) => salvar(c.id, v) : undefined,
  }));

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 rounded-xl border border-[#F5C2BD] bg-crm-perigo-claro px-3 py-2 text-xs text-crm-perigo">
        <Stethoscope size={14} className="mt-0.5 shrink-0" aria-hidden />
        Dados pessoais sensíveis (saúde). Registre apenas o necessário para a atuação jurídica. O acesso e as alterações são auditados.
      </p>
      <ListaPropriedades item={registro} colunas={colunas} rotuloItem="dados clínicos" />
      {dados?.updated_at && (
        <p className="text-xs text-crm-tinta-3">
          Última atualização em {formatarDataHora(dados.updated_at)} por {config.usuario(dados.updated_by)?.nome ?? "—"}.
        </p>
      )}
      {!dados && !pode("saude.ver_todos") && (
        <p className="text-xs text-crm-tinta-3">Se já houver dados clínicos e você não os vê, é porque você não está atribuído a este cliente ou a um caso dele.</p>
      )}
    </div>
  );
}
