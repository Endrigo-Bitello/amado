"use client";

import {
  ClipboardCheck,
  Columns3,
  FileClock,
  Gauge,
  Gavel,
  GitBranch,
  LayoutList,
  ListChecks,
  Palette,
  PlugZap,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../../_lib/auth";
import { Link, navegar, useRota } from "../../_lib/rotas";
import { Selecao } from "../../_ui/Campos";
import { CabecalhoPagina, Vazio } from "../../_ui/Visuais";
import { AdminAuditoria } from "./Auditoria";
import { AdminAutomacoes } from "./Automacoes";
import { AdminCampos } from "./Campos";
import { AdminChecklists } from "./Checklists";
import { AdminFunis, AdminListas, AdminTiposDemanda } from "./Funis";
import { AdminIntegracoes, AdminPainel, AdminPrazos, AdminTextos, AdminVisualizacoes } from "./Geral";
import { AdminModelosTarefas } from "./ModelosTarefas";
import { AdminPerfis, AdminUsuarios } from "./Usuarios";

interface Secao {
  id: string;
  rotulo: string;
  grupo: string;
  icone: LucideIcon;
  permissoes: string[];
  componente: () => ReactNode;
}

const SECOES: Secao[] = [
  { id: "usuarios", rotulo: "Usuários", grupo: "Equipe e acesso", icone: Users, permissoes: ["admin.usuarios"], componente: () => <AdminUsuarios /> },
  { id: "perfis", rotulo: "Perfis e permissões", grupo: "Equipe e acesso", icone: ShieldCheck, permissoes: ["admin.usuarios"], componente: () => <AdminPerfis /> },
  { id: "funis", rotulo: "Funis e fases", grupo: "Estrutura", icone: GitBranch, permissoes: ["admin.configuracoes"], componente: () => <AdminFunis /> },
  { id: "campos", rotulo: "Campos personalizados", grupo: "Estrutura", icone: Columns3, permissoes: ["admin.configuracoes"], componente: () => <AdminCampos /> },
  { id: "listas", rotulo: "Listas, prioridades e etiquetas", grupo: "Estrutura", icone: Tags, permissoes: ["admin.configuracoes"], componente: () => <AdminListas /> },
  { id: "demandas", rotulo: "Tipos de demanda", grupo: "Estrutura", icone: LayoutList, permissoes: ["admin.configuracoes"], componente: () => <AdminTiposDemanda /> },
  { id: "checklists", rotulo: "Documentos e checklists", grupo: "Modelos", icone: ClipboardCheck, permissoes: ["admin.configuracoes"], componente: () => <AdminChecklists /> },
  { id: "tarefas", rotulo: "Modelos de tarefas", grupo: "Modelos", icone: ListChecks, permissoes: ["admin.configuracoes"], componente: () => <AdminModelosTarefas /> },
  { id: "automacoes", rotulo: "Automações", grupo: "Modelos", icone: Zap, permissoes: ["admin.automacoes"], componente: () => <AdminAutomacoes /> },
  { id: "painel", rotulo: "Painel Hoje", grupo: "Aparência e textos", icone: Gauge, permissoes: ["admin.configuracoes"], componente: () => <AdminPainel /> },
  { id: "textos", rotulo: "Textos, nomes e aparência", grupo: "Aparência e textos", icone: Palette, permissoes: ["admin.configuracoes"], componente: () => <AdminTextos /> },
  { id: "visualizacoes", rotulo: "Visualizações compartilhadas", grupo: "Aparência e textos", icone: Workflow, permissoes: ["admin.configuracoes"], componente: () => <AdminVisualizacoes /> },
  { id: "prazos", rotulo: "Prazos e feriados", grupo: "Jurídico", icone: Gavel, permissoes: ["admin.configuracoes", "prazos.conferir"], componente: () => <AdminPrazos /> },
  { id: "integracoes", rotulo: "Integrações", grupo: "Sistema", icone: PlugZap, permissoes: ["admin.usuarios", "admin.configuracoes", "admin.automacoes", "admin.auditoria"], componente: () => <AdminIntegracoes /> },
  { id: "auditoria", rotulo: "Auditoria", grupo: "Sistema", icone: FileClock, permissoes: ["admin.auditoria"], componente: () => <AdminAuditoria /> },
];

export default function Admin() {
  const { pode } = useAuth();
  const { segmentos } = useRota();
  const permitidas = SECOES.filter((s) => s.permissoes.some(pode));
  if (permitidas.length === 0) {
    return (
      <div className="p-6">
        <Vazio icone={<Settings size={24} />} titulo="Acesso restrito" descricao="Seu perfil não tem acesso à Administração." />
      </div>
    );
  }
  const atual = permitidas.find((s) => s.id === segmentos[1]) ?? permitidas[0];
  const grupos = [...new Set(permitidas.map((s) => s.grupo))];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <CabecalhoPagina icone={<Settings size={20} />} titulo="Administração" subtitulo="Configure o CRM sem programação. As mudanças valem imediatamente para toda a equipe e ficam registradas na auditoria." />
      <label className="flex flex-col gap-1 text-xs font-semibold text-crm-tinta-2 lg:hidden">
        Seção
        <Selecao value={atual.id} onChange={(e) => navegar(`/crm/admin/${e.target.value}`)}>
          {grupos.map((g) => (
            <optgroup key={g} label={g}>
              {permitidas
                .filter((s) => s.grupo === g)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.rotulo}
                  </option>
                ))}
            </optgroup>
          ))}
        </Selecao>
      </label>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Seções da Administração" className="hidden lg:block">
          <div className="sticky top-4 flex flex-col gap-4">
            {grupos.map((g) => (
              <div key={g}>
                <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider text-crm-tinta-3">{g}</p>
                <ul className="flex flex-col gap-0.5">
                  {permitidas
                    .filter((s) => s.grupo === g)
                    .map((s) => {
                      const Icone = s.icone;
                      const ativo = s.id === atual.id;
                      return (
                        <li key={s.id}>
                          <Link
                            href={`/crm/admin/${s.id}`}
                            aria-current={ativo ? "page" : undefined}
                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors ${ativo ? "bg-crm-verde text-white" : "text-crm-tinta-2 hover:bg-crm-suave hover:text-crm-tinta"}`}
                          >
                            <Icone size={15} aria-hidden className={ativo ? "text-crm-ouro-claro" : ""} />
                            {s.rotulo}
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        <div className="min-w-0">{atual.componente()}</div>
      </div>
    </div>
  );
}
