import { NextRequest, NextResponse } from "next/server";

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

async function sendToMonday(data: Record<string, unknown>) {
  if (!MONDAY_API_KEY || !MONDAY_BOARD_ID) return;

  const temp = (data.temperatura as string) ?? "cold";
  const columnValues = JSON.stringify({
    lead_phone: { phone: String(data.whatsapp ?? ""), countryShortName: "BR" },
    lead_email: { email: data.email, text: data.email },
    color_mm3zyy6b: { label: simNao(data.consultaMedica) },
    color_mm3zm5hf: { label: simNao(data.cultiva) },
    text_mm3ztqp7: data.profissao,
    color_mm3vgndh: { label: "SITE" },
    text_mm4gty3h: data.municipio,
    text_mm4g4jgx: data.estado,
    long_text_mm4gnqgq: { text: String(data.motivacao ?? "") },
    text_mm4gj9hk: data.horarioReuniao || "Não agendou",
    numeric_mm4gpvsr: String(data.score ?? 0),
    color_mm4g9k7z: { label: TEMP_LABEL[temp] ?? "Frio" },
    long_text_mm4gegbq: { text: String(data.observacoes ?? "") },
    text_mm4gg8hq: data.utmSource ?? "",
    text_mm4gaw1s: data.utmMedium ?? "",
    text_mm4gvtdt: data.utmCampaign ?? "",
    boolean_mm4g3cf0: { checked: data.lgpd ? "true" : "false" },
  });

  const mutation = `
    mutation {
      create_item(
        board_id: ${MONDAY_BOARD_ID},
        item_name: "${(data.nome as string).replace(/"/g, "'")}",
        column_values: ${JSON.stringify(columnValues)},
        create_labels_if_missing: true
      ) { id }
    }
  `;

  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: MONDAY_API_KEY,
    },
    body: JSON.stringify({ query: mutation }),
  });

  const json = await res.json();
  if (json.errors || json.error_message) {
    console.error("Monday API error:", JSON.stringify(json.errors ?? json));
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await sendToMonday(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("quiz-lead error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
