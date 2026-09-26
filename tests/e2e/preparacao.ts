import { chamarFuncao, senhaAleatoria, supabaseComo } from "./apoio";

// Preparação dos testes E2E: exige uma conta administradora do ambiente de
// teste (E2E_ADMIN_EMAIL / E2E_ADMIN_SENHA) e cria dois usuários temporários
// (advogado e atendimento) com senhas aleatórias geradas nesta execução.
// Os usuários são desativados ao final (tests/e2e/encerramento.ts).
// Não execute contra o ambiente de produção.

export default async function preparacao() {
  if (!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_SENHA) {
    throw new Error("Defina E2E_ADMIN_EMAIL e E2E_ADMIN_SENHA (conta administradora do ambiente de teste).");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL ausente.");

  const execucao = `${Date.now().toString(36)}`;
  process.env.E2E_EXECUCAO = execucao;
  const admin = await supabaseComo("admin");
  const criados: string[] = [];
  for (const [perfil, chave] of [
    ["advogado", "ADVOGADO"],
    ["atendimento", "ATENDIMENTO"],
  ] as const) {
    const email = `e2e-${perfil}-${execucao}@teste.local`;
    const senha = senhaAleatoria();
    const r = await chamarFuncao<{ id: string }>(admin, "crm-admin", {
      acao: "criar_usuario",
      nome: `E2E ${perfil === "advogado" ? "Advogada" : "Atendimento"} ${execucao}`,
      email,
      senha,
      perfil_id: perfil,
      cargo: perfil === "advogado" ? "Advogada (teste)" : "Atendimento (teste)",
    });
    process.env[`E2E_${chave}_EMAIL`] = email;
    process.env[`E2E_${chave}_SENHA`] = senha;
    process.env[`E2E_${chave}_ID`] = r.id;
    criados.push(r.id);
  }
  process.env.E2E_USUARIOS_TEMPORARIOS = criados.join(",");
}
