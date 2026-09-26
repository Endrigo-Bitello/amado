"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Merge } from "lucide-react";
import { useAuth } from "../_lib/auth";
import { executar, useGravacao } from "../_lib/dados";
import { Link } from "../_lib/rotas";
import { supabase } from "../_lib/supabase";
import { confirmarSimples } from "../_ui/Dialogos";
import { Botao } from "../_ui/Botao";

interface Duplicado {
  id: string;
  codigo: string;
  nome: string;
  arquivado: boolean;
  cliente_id?: string | null;
  motivos: string[];
}

export function useDuplicados(dados: { telefone?: string | null; email?: string | null; cpf?: string | null; ignorar?: string | null }, ativo = true) {
  const chave = [dados.telefone ?? "", dados.email ?? "", dados.cpf ?? "", dados.ignorar ?? ""];
  const temDado = Boolean((dados.telefone && dados.telefone.replace(/\D/g, "").length >= 8) || (dados.email && dados.email.includes("@")) || (dados.cpf && dados.cpf.replace(/\W/g, "").length >= 11));
  return useQuery({
    queryKey: ["duplicados", ...chave],
    enabled: ativo && temDado,
    staleTime: 15_000,
    queryFn: async () =>
      (await executar(
        supabase().rpc("buscar_duplicados", { p_telefone: dados.telefone ?? "", p_email: dados.email ?? "", p_cpf: dados.cpf ?? "", p_ignorar: dados.ignorar ?? undefined }),
      )) as unknown as { leads: Duplicado[]; clientes: Duplicado[] },
  });
}

/** Aviso de possíveis duplicidades com links e opção de mesclar leads. */
export function AvisoDuplicados({
  dados,
  leadAtualId,
  aoMesclado,
}: {
  dados: { telefone?: string | null; email?: string | null; cpf?: string | null; ignorar?: string | null };
  leadAtualId?: string;
  aoMesclado?: () => void;
}) {
  const { pode } = useAuth();
  const { rpc } = useGravacao();
  const consulta = useDuplicados(dados);
  const leads = (consulta.data?.leads ?? []).filter((l) => !l.arquivado);
  const clientes = consulta.data?.clientes ?? [];
  if (leads.length === 0 && clientes.length === 0) return null;

  const mesclar = async (origem: Duplicado) => {
    if (!leadAtualId) return;
    const ok = await confirmarSimples({
      titulo: "Mesclar leads?",
      mensagem: (
        <>
          O lead <strong>{origem.codigo} — {origem.nome}</strong> será incorporado a este registro: respostas do quiz, contatos, tarefas, documentos e comentários passam para cá.
          Dados já preenchidos aqui não são substituídos; apenas campos vazios são completados. O lead de origem fica arquivado.
        </>
      ),
      confirmar: "Mesclar",
    });
    if (!ok) return;
    await rpc("mesclar_leads", { p_origem: origem.id, p_destino: leadAtualId }, { chaves: ["leads", "eventos", "tarefas", "documentos"], mensagemSucesso: "Leads mesclados." });
    aoMesclado?.();
  };

  return (
    <div role="alert" className="rounded-xl border-2 border-[#F3D19A] bg-crm-alerta-claro p-3 text-sm">
      <p className="flex items-center gap-2 font-bold text-crm-alerta">
        <AlertTriangle size={16} aria-hidden /> Possível duplicidade
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {clientes.map((c) => (
          <li key={`c-${c.id}`} className="flex flex-wrap items-center gap-x-2">
            <span className="font-semibold">Cliente</span>
            <Link href={`/crm/clientes/${c.id}`} className="font-semibold text-crm-info underline">
              {c.codigo} — {c.nome}
            </Link>
            <span className="text-xs text-crm-tinta-2">(mesmo {c.motivos.join(", ")})</span>
          </li>
        ))}
        {leads.map((l) => (
          <li key={`l-${l.id}`} className="flex flex-wrap items-center gap-x-2">
            <span className="font-semibold">Lead</span>
            <Link href={`/crm/leads?item=${l.id}`} className="font-semibold text-crm-info underline">
              {l.codigo} — {l.nome}
            </Link>
            <span className="text-xs text-crm-tinta-2">(mesmo {l.motivos.join(", ")})</span>
            {leadAtualId && pode("leads.editar") && !l.cliente_id && (
              <Botao tamanho="sm" variante="fantasma" icone={<Merge size={13} />} onClick={() => mesclar(l)} className="h-7">
                Mesclar aqui
              </Botao>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
