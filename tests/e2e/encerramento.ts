import { chamarFuncao, supabaseComo } from "./apoio";

// Desativa os usuários temporários criados na preparação (o histórico é mantido).
export default async function encerramento() {
  const ids = (process.env.E2E_USUARIOS_TEMPORARIOS ?? "").split(",").filter(Boolean);
  if (!ids.length) return;
  const admin = await supabaseComo("admin");
  for (const id of ids) {
    await chamarFuncao(admin, "crm-admin", { acao: "atualizar_usuario", id, ativo: false }).catch(() => undefined);
  }
}
