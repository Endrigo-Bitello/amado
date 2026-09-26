#!/usr/bin/env node
// Confere se as perguntas e opções do quiz do site (components/Quiz/steps.ts)
// batem com o mapeamento usado pelo CRM (supabase/functions/_shared/quiz.ts).
// Rode após qualquer mudança no quiz:  npm run verificar:quiz

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = readFileSync(join(raiz, "components/Quiz/steps.ts"), "utf8");
const crm = readFileSync(join(raiz, "supabase/functions/_shared/quiz.ts"), "utf8");

function blocos(fonte) {
  const partes = fonte.split(/\bid:\s*"/).slice(1);
  return partes.map((p) => {
    const id = p.slice(0, p.indexOf('"'));
    return { id, corpo: p };
  });
}

function opcoesSite(corpo) {
  return [...corpo.matchAll(/label:\s*"([^"]+)",\s*score:\s*(\d+)/g)].map((m) => ({ rotulo: m[1], pontos: Number(m[2]) }));
}

function opcoesCrm(corpo) {
  return [...corpo.matchAll(/rotulo:\s*"([^"]+)",\s*pontos:\s*(\d+)/g)].map((m) => ({ rotulo: m[1], pontos: Number(m[2]) }));
}

function pergunta(corpo, chave) {
  const m = corpo.match(new RegExp(`${chave}:\\s*"([^"]+)"`));
  return m ? m[1] : null;
}

const doSite = new Map(blocos(site).map((b) => [b.id, { pergunta: pergunta(b.corpo, "question"), opcoes: opcoesSite(b.corpo) }]));
const doCrm = new Map(blocos(crm).map((b) => [b.id, { pergunta: pergunta(b.corpo, "pergunta"), opcoes: opcoesCrm(b.corpo) }]));

const problemas = [];
for (const [id, s] of doSite) {
  if (s.opcoes.length === 0) continue; // etapas de texto (local, profissão, contato)
  const c = doCrm.get(id);
  if (!c) {
    problemas.push(`Etapa "${id}" existe no site, mas não no mapeamento do CRM.`);
    continue;
  }
  if (s.pergunta !== c.pergunta) problemas.push(`Etapa "${id}": texto da pergunta difere.\n   site: ${s.pergunta}\n   crm:  ${c.pergunta}`);
  const rotulosSite = s.opcoes.map((o) => `${o.rotulo} (${o.pontos})`);
  const rotulosCrm = c.opcoes.map((o) => `${o.rotulo} (${o.pontos})`);
  if (rotulosSite.join("|") !== rotulosCrm.join("|")) {
    problemas.push(`Etapa "${id}": opções ou pontuações diferem.\n   site: ${rotulosSite.join("; ")}\n   crm:  ${rotulosCrm.join("; ")}`);
  }
}
for (const [id, c] of doCrm) {
  if (c.opcoes.length > 0 && !doSite.has(id)) problemas.push(`Etapa "${id}" está no mapeamento do CRM, mas não existe mais no site.`);
}

if (problemas.length) {
  console.error(`✗ Quiz e CRM divergem (${problemas.length}):\n- ${problemas.join("\n- ")}`);
  console.error("\nAtualize supabase/functions/_shared/quiz.ts (e a versão VERSAO_QUIZ) e publique a função quiz-lead.");
  process.exit(1);
}
const etapas = [...doSite.values()].filter((s) => s.opcoes.length > 0).length;
console.log(`✓ Quiz e CRM em paridade: ${etapas} etapas de escolha conferidas (perguntas, opções e pontuações).`);
