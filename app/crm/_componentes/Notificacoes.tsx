"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Zap } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "../_lib/auth";
import { formatarRelativo } from "../_lib/datas";
import { executar } from "../_lib/dados";
import { navegar } from "../_lib/rotas";
import { supabase } from "../_lib/supabase";
import type { Notificacao } from "../_lib/tipos";
import { Popover } from "../_ui/Sobreposicoes";
import { Carregando, Vazio } from "../_ui/Visuais";

export function Notificacoes() {
  const { perfil } = useAuth();
  const consultas = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const consulta = useQuery({
    queryKey: ["notificacoes", perfil?.id],
    enabled: Boolean(perfil),
    queryFn: async () =>
      (await executar(
        supabase().from("notificacoes").select("*").order("created_at", { ascending: false }).limit(60),
      )) as Notificacao[],
    refetchInterval: 60_000,
  });
  const lista = consulta.data ?? [];
  const naoLidas = lista.filter((n) => !n.lida_em).length;

  const marcarLidas = async (ids: string[]) => {
    if (ids.length === 0) return;
    await supabase().from("notificacoes").update({ lida_em: new Date().toISOString() }).in("id", ids);
    consultas.invalidateQueries({ queryKey: ["notificacoes"] });
  };

  const abrir = async (n: Notificacao) => {
    setAberto(false);
    if (!n.lida_em) await marcarLidas([n.id]);
    if (n.link) navegar(n.link);
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-label={naoLidas > 0 ? `Notificações: ${naoLidas} não lidas` : "Notificações"}
        className="relative rounded-full p-2 text-crm-tinta-2 hover:bg-crm-suave hover:text-crm-tinta"
      >
        <Bell size={19} />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-crm-perigo px-1 text-[10px] font-bold text-white">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>
      <Popover aberto={aberto} aoFechar={() => setAberto(false)} ancora={ref} alinhamento="fim" largura={380} rotulo="Notificações">
        <div className="flex items-center justify-between border-b border-crm-linha px-4 py-3">
          <h2 className="text-sm font-bold">Notificações</h2>
          {naoLidas > 0 && (
            <button
              type="button"
              onClick={() => marcarLidas(lista.filter((n) => !n.lida_em).map((n) => n.id))}
              className="inline-flex items-center gap-1 text-xs font-semibold text-crm-folha hover:underline"
            >
              <CheckCheck size={14} aria-hidden /> Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {consulta.isLoading ? (
            <Carregando />
          ) : lista.length === 0 ? (
            <Vazio compacto titulo="Nenhuma notificação" descricao="Avisos de atribuições, prazos e documentos aparecerão aqui." />
          ) : (
            <ul>
              {lista.map((n) => (
                <li key={n.id} className="border-b border-crm-linha last:border-0">
                  <button type="button" onClick={() => abrir(n)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-crm-suave ${n.lida_em ? "" : "bg-crm-verde-claro/60"}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lida_em ? "bg-transparent" : "bg-crm-folha"}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-snug text-crm-tinta">
                        {!n.lida_em && <span className="sr-only">Não lida: </span>}
                        {n.titulo}
                      </span>
                      {n.mensagem && <span className="mt-0.5 block text-xs leading-snug text-crm-tinta-2">{n.mensagem}</span>}
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-crm-tinta-3">
                        {n.automacao_id && (
                          <span className="inline-flex items-center gap-0.5 font-semibold text-crm-ouro-escuro">
                            <Zap size={11} aria-hidden /> Automação ·
                          </span>
                        )}
                        {formatarRelativo(n.created_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Popover>
    </>
  );
}
