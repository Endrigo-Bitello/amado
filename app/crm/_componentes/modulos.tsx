"use client";

import {
  BarChart3,
  CalendarDays,
  FileText,
  ListChecks,
  Magnet,
  Scale,
  Settings,
  Sun,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface DefinicaoModulo {
  id: string;
  chaveNome: string;
  icone: LucideIcon;
  /** Permissões que liberam o módulo (qualquer uma). Vazio = todos os usuários ativos. */
  permissoes: string[];
  movel?: boolean;
}

export const MODULOS: DefinicaoModulo[] = [
  { id: "hoje", chaveNome: "hoje", icone: Sun, permissoes: [], movel: true },
  { id: "leads", chaveNome: "leads", icone: Magnet, permissoes: ["leads.ver"], movel: true },
  { id: "clientes", chaveNome: "clientes", icone: Users, permissoes: ["clientes.ver"] },
  { id: "casos", chaveNome: "casos", icone: Scale, permissoes: ["casos.ver"], movel: true },
  { id: "tarefas", chaveNome: "tarefas", icone: ListChecks, permissoes: [], movel: true },
  { id: "agenda", chaveNome: "agenda", icone: CalendarDays, permissoes: [] },
  { id: "documentos", chaveNome: "documentos", icone: FileText, permissoes: ["documentos.ver"] },
  { id: "financeiro", chaveNome: "financeiro", icone: Wallet, permissoes: ["financeiro.ver"] },
  { id: "relatorios", chaveNome: "relatorios", icone: BarChart3, permissoes: ["relatorios.ver"] },
  {
    id: "admin",
    chaveNome: "admin",
    icone: Settings,
    permissoes: ["admin.usuarios", "admin.configuracoes", "admin.automacoes", "admin.auditoria"],
  },
];

export function moduloPermitido(m: DefinicaoModulo, pode: (p: string) => boolean): boolean {
  return m.permissoes.length === 0 || m.permissoes.some(pode);
}
