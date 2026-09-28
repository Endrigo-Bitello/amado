// Administração de usuários, perfis e permissões (requer admin.usuarios).
// Contas são criadas somente aqui; o cadastro público do Supabase Auth fica
// desativado. Senhas nunca são armazenadas pelo CRM nem registradas em log.

import {
  cabecalhosCors,
  erro,
  ErroValidacao,
  json,
  lerJson,
  respostaErroBanco,
  texto,
} from "../_shared/http.ts";
import { clienteServico, temPermissao, usuarioAutenticado } from "../_shared/supabase.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validarSenha(senha: string) {
  if (senha.length < 10) throw new ErroValidacao("A senha deve ter pelo menos 10 caracteres.");
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    throw new ErroValidacao("A senha deve conter letras e números.");
  }
}

interface Pedido {
  acao?: string;
  id?: string;
  nome?: string;
  email?: string;
  senha?: string;
  perfil_id?: string;
  cargo?: string;
  oab?: string;
  telefone?: string;
  cor?: string;
  ativo?: boolean;
  permissoes_extra?: string[];
  permissoes_negadas?: string[];
  modo_simplificado?: boolean;
  descricao?: string;
  permissoes?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cabecalhosCors(req) });
  if (req.method !== "POST") return erro(req, "Método não permitido.", 405);

  const servico = clienteServico();
  const usuario = await usuarioAutenticado(req, servico);
  if (!usuario) return erro(req, "Sessão expirada. Entre novamente.", 401);
  if (!(await temPermissao(servico, usuario.id, "admin.usuarios"))) {
    return erro(req, "Você não tem permissão para administrar usuários.", 403);
  }

  let p: Pedido;
  try {
    p = await lerJson<Pedido>(req, 16 * 1024);
  } catch (e) {
    if (e instanceof ErroValidacao) return erro(req, e.message, e.status);
    return erro(req, "Dados inválidos.", 400);
  }

  try {
    switch (p.acao) {
      case "listar_usuarios": {
        const { data: perfis, error } = await servico
          .from("usuarios")
          .select("id, nome, email, perfil_id, cargo, oab, telefone, cor, ativo, permissoes_extra, permissoes_negadas, modo_simplificado, ultimo_acesso_em, created_at")
          .order("nome");
        if (error) return respostaErroBanco(req, error, "crm-admin:listar");
        const contas = new Map<string, { last_sign_in_at?: string | null; banned_until?: string | null }>();
        for (let pagina = 1; pagina <= 20; pagina++) {
          const { data, error: erroLista } = await servico.auth.admin.listUsers({ page: pagina, perPage: 200 });
          if (erroLista) break;
          for (const u of data.users) {
            contas.set(u.id, {
              last_sign_in_at: u.last_sign_in_at ?? null,
              banned_until: (u as { banned_until?: string | null }).banned_until ?? null,
            });
          }
          if (data.users.length < 200) break;
        }
        return json(req, {
          ok: true,
          usuarios: (perfis ?? []).map((u) => ({
            ...u,
            ultimo_login: contas.get(u.id)?.last_sign_in_at ?? null,
            bloqueado: Boolean(contas.get(u.id)?.banned_until),
          })),
        });
      }

      case "criar_usuario": {
        const nome = texto(p.nome, 120);
        const email = texto(p.email, 160).toLowerCase();
        const senha = String(p.senha ?? "");
        if (nome.length < 2) throw new ErroValidacao("Informe o nome.");
        if (!EMAIL.test(email)) throw new ErroValidacao("Informe um e-mail válido.");
        validarSenha(senha);
        const perfil = texto(p.perfil_id, 40);
        const { data: existePerfil } = await servico.from("perfis").select("id").eq("id", perfil).maybeSingle();
        if (!existePerfil) throw new ErroValidacao("Selecione um perfil válido.");

        const { data: criado, error: erroCriacao } = await servico.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true,
          user_metadata: { nome },
        });
        if (erroCriacao || !criado?.user) {
          const jaExiste = /already|registered|exists/i.test(erroCriacao?.message ?? "");
          return erro(
            req,
            jaExiste ? "Já existe uma conta com este e-mail." : "Não foi possível criar a conta. Verifique os dados.",
            jaExiste ? 409 : 400,
          );
        }
        const { error } = await servico.rpc("admin_salvar_usuario", {
          p_ator: usuario.id,
          p: {
            id: criado.user.id,
            nome,
            email,
            perfil_id: perfil,
            cargo: texto(p.cargo, 80),
            oab: texto(p.oab, 40),
            telefone: texto(p.telefone, 30),
            cor: texto(p.cor, 7),
            permissoes_extra: p.permissoes_extra ?? [],
            permissoes_negadas: p.permissoes_negadas ?? [],
            modo_simplificado: Boolean(p.modo_simplificado),
            ativo: true,
          },
        });
        if (error) {
          await servico.auth.admin.deleteUser(criado.user.id);
          return respostaErroBanco(req, error, "crm-admin:criar");
        }
        return json(req, { ok: true, id: criado.user.id });
      }

      case "atualizar_usuario": {
        const id = texto(p.id, 40);
        if (!UUID.test(id)) throw new ErroValidacao("Usuário inválido.");
        const { data: atual } = await servico.from("usuarios").select("*").eq("id", id).maybeSingle();
        if (!atual) throw new ErroValidacao("Usuário não encontrado.", 404);
        const email = p.email !== undefined ? texto(p.email, 160).toLowerCase() : atual.email;
        if (!EMAIL.test(email)) throw new ErroValidacao("Informe um e-mail válido.");
        const ativo = p.ativo !== undefined ? Boolean(p.ativo) : atual.ativo;

        const { error } = await servico.rpc("admin_salvar_usuario", {
          p_ator: usuario.id,
          p: {
            id,
            nome: p.nome !== undefined ? texto(p.nome, 120) : atual.nome,
            email,
            perfil_id: p.perfil_id !== undefined ? texto(p.perfil_id, 40) : atual.perfil_id,
            cargo: p.cargo !== undefined ? texto(p.cargo, 80) : atual.cargo,
            oab: p.oab !== undefined ? texto(p.oab, 40) : atual.oab,
            telefone: p.telefone !== undefined ? texto(p.telefone, 30) : atual.telefone,
            cor: p.cor !== undefined ? texto(p.cor, 7) : atual.cor,
            permissoes_extra: p.permissoes_extra ?? atual.permissoes_extra,
            permissoes_negadas: p.permissoes_negadas ?? atual.permissoes_negadas,
            modo_simplificado: p.modo_simplificado !== undefined ? Boolean(p.modo_simplificado) : atual.modo_simplificado,
            ativo,
          },
        });
        if (error) return respostaErroBanco(req, error, "crm-admin:atualizar");

        const alteracoesConta: Record<string, unknown> = {};
        if (email !== atual.email) {
          alteracoesConta.email = email;
          alteracoesConta.email_confirm = true;
        }
        if (ativo !== atual.ativo) alteracoesConta.ban_duration = ativo ? "none" : "876000h";
        if (Object.keys(alteracoesConta).length > 0) {
          const { error: erroConta } = await servico.auth.admin.updateUserById(id, alteracoesConta);
          if (erroConta) {
            console.error("[crm-admin] falha ao atualizar conta de acesso");
            return erro(req, "Os dados foram salvos, mas a conta de acesso não pôde ser atualizada. Tente novamente.", 500);
          }
        }
        return json(req, { ok: true });
      }

      case "redefinir_senha": {
        const id = texto(p.id, 40);
        if (!UUID.test(id)) throw new ErroValidacao("Usuário inválido.");
        const senha = String(p.senha ?? "");
        validarSenha(senha);
        const { error } = await servico.auth.admin.updateUserById(id, { password: senha });
        if (error) return erro(req, "Não foi possível redefinir a senha.", 400);
        await servico.from("auditoria").insert({
          tabela: "usuarios",
          registro_id: id,
          acao: "ACAO",
          usuario_id: usuario.id,
          alteracoes: { senha: "redefinida pelo administrador" },
          contexto: "edge:crm-admin",
        });
        return json(req, { ok: true });
      }

      case "salvar_perfil": {
        const { error } = await servico.rpc("admin_salvar_perfil", {
          p_ator: usuario.id,
          p: {
            id: texto(p.id, 40),
            nome: texto(p.nome, 60),
            descricao: texto(p.descricao, 300),
            permissoes: Array.isArray(p.permissoes) ? p.permissoes : [],
          },
        });
        if (error) return respostaErroBanco(req, error, "crm-admin:salvar_perfil");
        return json(req, { ok: true });
      }

      case "excluir_perfil": {
        const { error } = await servico.rpc("admin_excluir_perfil", { p_ator: usuario.id, p_id: texto(p.id, 40) });
        if (error) return respostaErroBanco(req, error, "crm-admin:excluir_perfil");
        return json(req, { ok: true });
      }

      default:
        return erro(req, "Ação inválida.", 400);
    }
  } catch (e) {
    if (e instanceof ErroValidacao) return erro(req, e.message, e.status);
    console.error("[crm-admin] erro inesperado");
    return erro(req, "Não foi possível concluir a operação.", 500);
  }
});
