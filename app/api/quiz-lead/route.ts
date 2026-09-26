import { NextRequest, NextResponse } from "next/server";

// Encaminhamento legado do quiz para o Monday (destino secundário).
// O registro principal do lead é feito pelo CRM (Edge Function quiz-lead).
// Sem MONDAY_API_KEY/MONDAY_BOARD_ID configurados, nada é enviado.

const MONDAY_API_KEY = process.env.MONDAY_API_KEY ?? "";
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID ?? "";

const TEMP_LABEL: Record<string, string> = {
  hot: "Quente",
  warm: "Morno",
  cold: "Frio",
};

// Quiz envia label completo ("Sim, já cultivo"); board usa SIM/NÃO.
const simNao = (v: unknown): string =>
  /^sim/i.test(String(v ?? "")) ? "SIM" : "NÃO";

const txt = (v: unknown, max = 300): string => String(v ?? "").slice(0, max);

async function sendToMonday(data: Record<string, unknown>) {
  if (!MONDAY_API_KEY || !/^\d+$/.test(MONDAY_BOARD_ID)) return;

  const temp = txt(data.temperatura, 10) || "cold";
  const columnValues = JSON.stringify({
    lead_phone: { phone: txt(data.whatsapp, 30), countryShortName: "BR" },
    lead_email: { email: txt(data.email, 160), text: txt(data.email, 160) },
    color_mm3zyy6b: { label: simNao(data.consultaMedica) },
    color_mm3zm5hf: { label: simNao(data.cultiva) },
    text_mm3ztqp7: txt(data.profissao, 120),
    color_mm3vgndh: { label: "SITE" },
    text_mm4gty3h: txt(data.municipio, 120),
    text_mm4g4jgx: txt(data.estado, 2),
    long_text_mm4gnqgq: { text: txt(data.motivacao) },
    text_mm4gj9hk: txt(data.horarioReuniao) || "Não agendou",
    numeric_mm4gpvsr: String(Number(data.score) || 0),
    color_mm4g9k7z: { label: TEMP_LABEL[temp] ?? "Frio" },
    long_text_mm4gegbq: { text: txt(data.observacoes, 1000) },
    text_mm4gg8hq: txt(data.utmSource, 150),
    text_mm4gaw1s: txt(data.utmMedium, 150),
    text_mm4gvtdt: txt(data.utmCampaign, 150),
    boolean_mm4g3cf0: { checked: data.lgpd ? "true" : "false" },
  });

  // Variáveis GraphQL: nenhum texto do visitante é interpolado na consulta.
  const query = `mutation ($board: ID!, $nome: String!, $colunas: JSON!) {
    create_item(board_id: $board, item_name: $nome, column_values: $colunas, create_labels_if_missing: true) { id }
  }`;

  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: MONDAY_API_KEY,
    },
    body: JSON.stringify({ query, variables: { board: MONDAY_BOARD_ID, nome: txt(data.nome, 120) || "Lead do site", colunas: columnValues } }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.errors || json?.error_message) {
    // Sem dados pessoais no log.
    console.error("[quiz-lead legado] Monday recusou o item (status %s).", res.status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const bruto = await req.text();
    if (bruto.length > 16 * 1024) return NextResponse.json({ ok: false }, { status: 413 });
    const body = JSON.parse(bruto) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false }, { status: 400 });
    await sendToMonday(body as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[quiz-lead legado] falha ao encaminhar.");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
