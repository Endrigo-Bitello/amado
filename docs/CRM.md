# CRM jurídico — Amado & Amado Jr.

Guia técnico e operacional do CRM em `/crm`: arquitetura, segurança, mapeamento do quiz, implantação, testes e manutenção.

---

## 1. Visão geral

| Camada | Tecnologia | Onde |
|---|---|---|
| Interface | Next.js 16 (App Router), React 19, Tailwind v4 | `app/crm/**`, `app/enviar-documentos/**` |
| Proteção de rota | `proxy.ts` (verificação otimista de sessão + cabeçalhos de privacidade) | raiz |
| Dados | Supabase Postgres 17 com RLS em todas as tabelas | `supabase/migrations/*.sql` |
| Login | Supabase Auth (e-mail e senha; cadastro público desativado) | `app/crm/login` |
| Arquivos | Supabase Storage privado (`crm-documentos`, `crm-financeiro`) com URLs assinadas | migration 15 |
| Tempo real | Supabase Realtime (`postgres_changes`) — quadros e configuração atualizam sozinhos | `app/crm/_lib/dados.tsx` |
| Operações sensíveis | Edge Functions (Deno) com a chave de serviço **só no servidor** | `supabase/functions/**` |
| Rotinas | `pg_cron` a cada 15 min (automações) | migration 16 |

O site público continua igual. As únicas mudanças no site são: o quiz passou a enviar os leads ao CRM (com o encaminhamento ao Monday mantido como destino secundário), a captura de origem/UTM (`components/Atribuicao.tsx`) e o `robots.txt` bloqueando `/crm` e `/enviar-documentos`.

### Estrutura do CRM

```
app/crm/
  [[...rota]]/page.tsx   → rota única (acesso direto e recarregamento em qualquer endereço /crm/*)
  login/, redefinir-senha/
  _lib/        → cliente Supabase, sessão/permissões, consultas, datas (fuso America/Sao_Paulo), presets do painel
  _ui/         → componentes base (botões, campos, modais, menus) com acessibilidade
  _quadro/     → quadros estilo planilha: tabela, Kanban, calendário, resumo, filtros, visualizações, exportação
  _componentes/→ shell, busca global, notificações, checklist, arquivos, atividade, agenda
  _modulos/    → hoje, leads, clientes (ficha, importação), casos (processos, andamentos, prazos),
                 tarefas, agenda, documentos, financeiro, relatórios, admin
app/enviar-documentos/ → página pública do link seguro de envio de documentos
supabase/
  migrations/  → 17 migrations versionadas (esquema, regras, RLS, storage, tempo real, dados iniciais)
  functions/   → quiz-lead, portal-cliente, crm-documentos, crm-admin, crm-financeiro, crm-importacao
tests/backend/ → testes de integração do banco e das funções (node:test)
tests/e2e/     → 10 fluxos de ponta a ponta (Playwright)
scripts/       → criar-admin, ambiente-local, verificar-quiz
```

---

## 2. Segurança e privacidade

- **Nenhuma credencial privilegiada no navegador.** O navegador recebe apenas a URL e a chave pública do Supabase. A `service_role` existe somente nas Edge Functions (fornecida pela própria plataforma).
- **RLS em todas as tabelas.** As permissões dos perfis valem no banco (não só na tela). Funções `SECURITY DEFINER` de serviço só podem ser executadas pela `service_role`.
- **Dados de saúde por necessidade de saber.** Documentos, arquivos e dados clínicos só aparecem para quem tem `saude.ver_todos`, ou `saude.ver_atribuidos` e é responsável/equipe do caso ou cliente.
- **Financeiro restrito.** Valores exigem `financeiro.ver`; lançar pagamentos, conceder descontos e alterar contratos são permissões separadas. Toda escrita financeira passa pela função `crm-financeiro`.
- **Auditoria.** Criações, alterações, exclusões e exportações ficam em `auditoria` (prazos, documentos, financeiro, permissões, usuários, configurações…). Senhas e tokens nunca são registrados.
- **LGPD.** O consentimento do quiz é gravado em `consentimentos` com texto, versão, data e origem. Logs e mensagens de erro não expõem dados pessoais.
- **Links de documentos.** Token aleatório no fragmento `#` da URL (não vai a servidores/logs), apenas o hash fica no banco, validade limitada, revogação e limite de uso.
- **Cadastro público desativado.** Contas só são criadas por administradores (`crm-admin`). O primeiro administrador é criado pelo script `scripts/criar-admin.mjs`.
- **Cabeçalhos.** `/crm` e `/enviar-documentos`: `X-Robots-Tag: noindex`, `Cache-Control: no-store`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`.

### Perfis iniciais (editáveis em Administração → Perfis e permissões)

| Permissão | Administrador | Advogado | Atendimento |
|---|:-:|:-:|:-:|
| Leads e clientes (ver/editar) | ✓ | ✓ | ✓ |
| Casos (ver) / (editar) | ✓ | ✓ / ✓ | ✓ / — |
| Prazos (ver / cadastrar / **conferir**) | ✓ | ✓ / ✓ / ✓ | ✓ / — / — |
| Documentos (ver / editar / **revisar** / solicitar ao cliente) | ✓ | ✓ | ✓ / ✓ / — / ✓ |
| Dados de saúde | todos | atribuídos | atribuídos |
| Financeiro (ver / lançar / desconto / contratos) | ✓ | ver | — |
| Relatórios e exportação | ✓ | ✓ | — |
| Importação de planilhas | ✓ | — | — |
| Administração (usuários, configurações, automações, auditoria) | ✓ | — | — |

Exceções por pessoa (conceder ou negar permissões específicas) ficam na ficha do usuário.

**Modo simplificado** (opção na ficha do usuário, em Administração → Usuários): menu só com Hoje, Clientes, Casos e processos, Tarefas, Agenda e Financeiro; painel Hoje só com os oito indicadores principais de todo o escritório (tarefas de hoje e atrasadas, prazos próximos, vencidos e a conferir, compromissos de hoje, casos ativos e pagamentos vencidos), em letras maiores; e nenhuma exclusão, nem para administradores — as ações de excluir somem da tela e o banco recusa exclusões dessa conta. Criar, editar, concluir, arquivar e remarcar continuam valendo pelo perfil. É usado pela conta `eduardoamado@amadoeamadojr.com.br`: se ela for criada depois da migração `20260928000100_modo_simplificado.sql`, marque a opção ao criá-la.

**Conta de desenvolvimento** (`dev@amadoeamadojr.com.br`): sem travas, para manutenção e correção de dados. Tem todas as permissões, qualquer que seja o perfil; pode excluir tudo, inclusive em cascata (cliente com casos e lançamentos, contrato com parcelas e pagamentos), além de lançamentos financeiros, prazos, compromissos, documentos do checklist, itens da linha do tempo e registros da auditoria; e não passa pelas regras de negócio (motivos obrigatórios, cobrança cancelada, pagamento acima do saldo ou com data futura, dependência de tarefas etc.). Também reabre cobranças canceladas, desfaz estornos e reativa despesas. Validações de integridade (valores negativos, vínculos inválidos) continuam valendo. As ações exclusivas só aparecem para essa conta. A lista de contas de desenvolvimento fica na tabela `desenvolvedores` e só muda por SQL, nunca pela interface — para incluir outra: `insert into public.desenvolvedores (email) values ('pessoa@dominio.com.br');`. Migração: `20260928000200_conta_desenvolvedor.sql`.

---

## 3. Quiz do site → banco de dados

Fluxo: `components/Quiz/Quiz.tsx` → `POST {SUPABASE_URL}/functions/v1/quiz-lead` → função `quiz_registrar` (transação única).

- **Envio seguro e idempotente:** cada envio tem um `submissao_id` (UUID) guardado na sessão do navegador; novas tentativas reutilizam o mesmo identificador e o servidor não duplica o lead.
- **Falhas:** o visitante vê uma mensagem clara, mantém as respostas e pode tentar de novo (há também link para o WhatsApp).
- **Anti-abuso:** campo-armadilha (`website`), tempo mínimo de preenchimento, limites por IP (anonimizado com `CRM_SAL_HASH`) e por telefone, e checagem de origem (`CRM_ORIGENS_PERMITIDAS`).
- **Deduplicação:** o mesmo telefone/e-mail atualiza o lead em aberto (novo registro em `quiz_submissoes`), preservando o histórico.
- **Pontuação** recalculada no servidor (`_shared/quiz.ts`) com as mesmas regras do site; o valor enviado pelo navegador fica guardado só para conferência.

| Etapa do quiz (`steps.ts`) | Coluna do lead | Respostas completas |
|---|---|---|
| `welcome` | `quiz_interesse` | `quiz_respostas` (uma linha por pergunta, com texto exibido e pontos) |
| `location` (estado, cidade) | `estado`, `municipio` | idem |
| `cultiva` | `quiz_cultiva` | idem |
| `consulta` | `quiz_consulta_medica` | idem |
| `renda` (profissão) | `profissao` | idem |
| `faixaRenda` | `faixa_renda` | idem |
| `motivacao` | `quiz_motivacao` | idem |
| `agenda` | `quiz_agenda` | idem |
| `datetime` (só se agendou) | `quiz_horario` | idem |
| `contact` (nome, WhatsApp, e-mail) | `nome`, `whatsapp`, `email` | idem |
| pontuação / classificação | `score`, `temperatura` (quente/morno/frio) | `quiz_submissoes.score_calculado` |
| página, referência, UTMs, gclid/fbclid, início e duração | `utm_*` no lead | `quiz_submissoes` |
| consentimento LGPD (texto + versão) | — | `consentimentos` |

Ao chegar, a automação “primeiro contato” cria uma tarefa (e pode atribuir responsável fixo ou por rodízio).

**Ao alterar perguntas ou opções do quiz:** atualize também `supabase/functions/_shared/quiz.ts` (e `VERSAO_QUIZ`), rode `npm run verificar:quiz` e publique a função `quiz-lead`.

---

## 4. Variáveis de ambiente

| Variável | Onde | Obrigatória | Para quê |
|---|---|:-:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (e `.env.local`) | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Vercel | sim | chave pública |
| `MONDAY_API_KEY`, `MONDAY_BOARD_ID` | Vercel (somente servidor) | não | encaminhamento legado do quiz ao Monday |
| `CRM_ORIGENS_PERMITIDAS` | segredo das Edge Functions | sim (produção) | origens aceitas pelo quiz e pelo portal, ex.: `https://amadoeamadojr.com.br,https://www.amadoeamadojr.com.br` |
| `CRM_SITE_URL` | segredo das Edge Functions | sim (produção) | base dos links de envio de documentos |
| `CRM_SAL_HASH` | segredo das Edge Functions | sim (produção) | sal para anonimizar IPs (gere com `openssl rand -hex 32`) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | automáticas nas Edge Functions; no terminal só para `crm:admin` | — | nunca na Vercel nem no navegador |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_SENHA`, `E2E_BASE_URL` | terminal | só para testes | testes E2E em ambiente de teste |

O modelo está em `.env.example` (sem valores).

---

## 5. Implantação em produção (passo a passo)

Pré-requisitos: acesso ao painel do Supabase (organização do escritório) e ao projeto na Vercel.

1. **Criar o projeto no Supabase** (região São Paulo, `sa-east-1`) e guardar a senha do banco em local seguro.
2. **Vincular e aplicar as migrations**
   ```bash
   npx supabase login
   npx supabase link --project-ref <REF_DO_PROJETO>
   npx supabase db push
   ```
   A migration 16 ativa o `pg_cron`; se o plano não permitir, ative “pg_cron” em Database → Extensions e rode `npx supabase db push` de novo (ou execute o bloco da migration no SQL Editor).
3. **Publicar as Edge Functions**
   ```bash
   npx supabase functions deploy quiz-lead portal-cliente crm-documentos crm-admin crm-financeiro crm-importacao --no-verify-jwt
   ```
   (As funções validam o token do usuário internamente; o `verify_jwt` desligado está em `supabase/config.toml`.)
4. **Cadastrar os segredos das funções**
   ```bash
   npx supabase secrets set CRM_ORIGENS_PERMITIDAS="https://amadoeamadojr.com.br,https://www.amadoeamadojr.com.br" CRM_SITE_URL="https://amadoeamadojr.com.br" CRM_SAL_HASH="<valor aleatório>"
   ```
5. **Configurar a autenticação** (Authentication → Sign In / Providers e URL Configuration), ou `npx supabase config push`:
   - desativar “Allow new users to sign up” (manter o provedor de e-mail ativo);
   - Site URL: `https://amadoeamadojr.com.br`; Redirect URLs: `https://amadoeamadojr.com.br/crm/redefinir-senha`;
   - senha mínima de 10 caracteres com letras e números; recomendada a proteção contra senhas vazadas;
   - para e-mails de redefinição de senha, configurar SMTP próprio (sem SMTP, o administrador redefine senhas em Administração → Usuários).
6. **Vercel → Settings → Environment Variables** (Production e Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e, se desejado, `MONDAY_API_KEY`/`MONDAY_BOARD_ID`. Fazer novo deploy.
7. **Criar o primeiro administrador** (no seu computador; a senha é pedida no terminal e não é gravada):
   ```bash
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role> npm run crm:admin -- --email pessoa@escritorio.com.br --nome "Nome Sobrenome"
   ```
   O script só funciona enquanto não houver administrador ativo. Depois, crie os demais usuários em **Administração → Usuários**.
8. **Conferência pós-implantação:** abrir `/crm/login`, entrar, criar usuários de cada perfil, enviar um quiz de teste no site e vê-lo em Leads, gerar e testar um link de documentos, conferir `Administração → Integrações` e `Automações → Executar agora`.

> Previews da Vercel: para testar o quiz e o portal em um endereço de preview, inclua a origem do preview em `CRM_ORIGENS_PERMITIDAS`.

---

## 6. Desenvolvimento local

```bash
npm install
npm run supabase:iniciar          # Docker necessário
npm run crm:ambiente-local        # gera .env.local apontando para o Supabase local
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<da saída do supabase status> npm run crm:admin -- --email admin@exemplo.local --nome "Administrador Local"
npm run dev                       # http://localhost:3005/crm
```

Após mudar o esquema: crie nova migration em `supabase/migrations/`, rode `npm run supabase:resetar` e `npm run supabase:tipos`.

---

## 7. Testes

| Comando | O que verifica |
|---|---|
| `npm run typecheck` / `npm run lint` | tipos e regras de código |
| `npm run verificar:quiz` | paridade entre o quiz do site e o mapeamento do CRM |
| `npm run test:backend` | 17 testes de integração (RLS por perfil, quiz, conversão, portal, prazos, financeiro, importação, campos, automações, auditoria, modo simplificado, conta de desenvolvimento). Exige banco local recém-criado: `npm run supabase:resetar` |
| `npm run test:e2e` | 10 fluxos de ponta a ponta no navegador (abaixo). Exige `E2E_ADMIN_EMAIL`/`E2E_ADMIN_SENHA` de um ambiente de **teste**; cria usuários temporários e os desativa ao final |

Fluxos E2E: (1) quiz → lead com respostas, UTMs e deduplicação; (2) login, persistência, logout e bloqueio por perfil; (3) etapas na tabela e no Kanban; (4) conversão em cliente e dois casos na carteira; (5) checklist: solicitar, receber pelo link, revisar, aprovar e rejeitar; (6) tarefa, prazo e reunião na agenda e no painel; (7) contrato, parcela, pagamento parcial, quitação e saldo; (8) importação com prévia e duplicados; (9) campo personalizado e modelo de checklist criados pelo administrador e usados pela equipe em tempo real; (10) rotas profundas do `/crm` em acesso direto e permissões por perfil. Para validar o build de produção: `npm run build && npx next start -p 3006` e `E2E_BASE_URL=http://localhost:3006 npm run test:e2e`.

---

## 8. Operação e manutenção

- **O que NÃO está ativo** (e não é simulado): consulta automática a tribunais, envio automático de WhatsApp/e-mail/SMS, integração bancária/boletos/Pix automático e emissão fiscal. Os pontos de integração estão preparados (fonte e identificador externo em processos/andamentos, `id_externo` em cobranças). O CRM apenas abre o WhatsApp de quem clicou, com mensagem pronta.
- **Prazos processuais:** o auxílio de contagem é só uma sugestão com parâmetros visíveis; todo prazo fica “a conferir” até um profissional com `prazos.conferir` confirmar. Correções de vencimento exigem motivo e desfazem a conferência anterior. A lista de feriados deve ser conferida com o calendário de cada tribunal (Administração → Prazos e feriados).
- **Checklists:** os modelos iniciais são sugestões revisáveis, não requisitos jurídicos universais.
- **Configuração sem código:** funis, fases, campos, listas, etiquetas, tipos de demanda, modelos, automações, painel e textos ficam em Administração; dados antigos são preservados (arquivar em vez de excluir).
- **Backups:** dependem do plano do Supabase (backups diários e, se contratado, PITR). Recomenda-se exportações periódicas (quadros → Exportar) e revisar a retenção de arquivos no Storage.
- **Funções de serviço:** funções `SECURITY DEFINER` novas devem revogar `EXECUTE` de `public`/`anon`/`authenticated` quando forem de uso exclusivo das Edge Functions (padrão da migration 14).
- **Tipos do banco:** após migrations, regenere `app/crm/_lib/database.types.ts` (`npm run supabase:tipos`, ou `supabase gen types typescript --project-id <ref>`).
