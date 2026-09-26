#!/usr/bin/env node
// Cria o PRIMEIRO administrador do CRM (só funciona enquanto não houver outro).
// Os demais usuários devem ser criados pela tela Administração → Usuários.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/criar-admin.mjs --email pessoa@escritorio.com.br --nome "Nome Sobrenome"
// A senha é pedida no terminal (não aparece na tela e não é gravada em arquivo).
// Para automação, pode ser passada pela variável CRM_ADMIN_SENHA.

import { createClient } from "@supabase/supabase-js";

function argumento(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Lê a senha em modo raw: nada é ecoado, o prompt continua visível e Ctrl+C/Ctrl+D cancelam.
function perguntarSenha(pergunta) {
  return new Promise((resolve, reject) => {
    const entrada = process.stdin;
    if (!entrada.isTTY) {
      reject(new Error("Terminal não interativo: defina a senha pela variável CRM_ADMIN_SENHA."));
      return;
    }
    process.stdout.write(pergunta);
    entrada.setRawMode(true);
    entrada.setEncoding("utf8");
    entrada.resume();
    let senha = "";
    const encerrar = () => {
      entrada.off("data", aoDigitar);
      entrada.setRawMode(false);
      entrada.pause();
      process.stdout.write("\n");
    };
    function aoDigitar(dados) {
      for (const c of dados) {
        if (c === "\r" || c === "\n") {
          encerrar();
          resolve(senha);
          return;
        }
        if (c === "\u0003" || c === "\u0004") {
          encerrar();
          reject(new Error("Cancelado."));
          return;
        }
        if (c === "\u007f" || c === "\b") senha = senha.slice(0, -1);
        else if (c >= " ") senha += c;
      }
    }
    entrada.on("data", aoDigitar);
  });
}

async function principal() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = argumento("email")?.trim().toLowerCase();
  const nome = argumento("nome")?.trim();

  if (!url || !chave) {
    console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (Supabase → Project Settings → API).");
    return 1;
  }
  if (!email || !nome) {
    console.error('Informe --email e --nome. Ex.: --email ana@escritorio.com.br --nome "Ana Souza"');
    return 1;
  }

  let senha = process.env.CRM_ADMIN_SENHA;
  if (!senha) {
    senha = await perguntarSenha("Senha do administrador (mín. 10 caracteres, letras e números): ");
    const confirmacao = await perguntarSenha("Confirme a senha: ");
    if (senha !== confirmacao) {
      console.error("As senhas não coincidem.");
      return 1;
    }
  }
  if (senha.length < 10 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    console.error("Senha fraca: use ao menos 10 caracteres, com letras e números.");
    return 1;
  }

  const supabase = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

  let usuarioId;
  let criadoAgora = false;
  const criado = await supabase.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
  if (criado.error) {
    if (!/already|registered|exists/i.test(criado.error.message)) {
      console.error("Não foi possível criar a conta:", criado.error.message);
      return 1;
    }
    // Conta já existe no Auth: localiza e atualiza a senha.
    for (let pagina = 1; pagina <= 50 && !usuarioId; pagina++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 });
      if (error) break;
      usuarioId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (data.users.length < 200) break;
    }
    if (!usuarioId) {
      console.error("A conta já existe, mas não foi possível localizá-la.");
      return 1;
    }
    await supabase.auth.admin.updateUserById(usuarioId, { password: senha });
  } else {
    usuarioId = criado.data.user.id;
    criadoAgora = true;
  }

  const { error } = await supabase.rpc("admin_bootstrap", { p_usuario: usuarioId, p_nome: nome, p_email: email });
  if (error) {
    // Não deixa conta de acesso órfã (sem cadastro no CRM).
    if (criadoAgora) await supabase.auth.admin.deleteUser(usuarioId);
    console.error("Não foi possível definir o administrador:", error.message);
    return 1;
  }
  console.log(`Administrador criado: ${email}. Entre em /crm/login e crie os demais usuários em Administração → Usuários.`);
  return 0;
}

// Encerra pelo código de saída (sem process.exit, que interrompe conexões pendentes).
process.exitCode = await principal().catch((erro) => {
  console.error(erro.message);
  return 1;
});
