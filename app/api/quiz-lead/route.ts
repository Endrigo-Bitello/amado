import { NextRequest, NextResponse } from "next/server";

const MONDAY_API_KEY = process.env.MONDAY_API_KEY ?? "";
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID ?? "";

const TEMP_LABEL: Record<string, string> = {
  hot: "Quente",
  warm: "Morno",
  cold: "Frio",
};

const STATUS_LABEL: Record<string, string> = {
  hot: "Agendado",
  warm: "Em qualificação",
  cold: "Nutrição",
};

const PRIORITY_LABEL: Record<string, string> = {
  hot: "Alta",
  warm: "Média",
  cold: "Baixa",
};

async function sendToMonday(data: Record<string, unknown>) {
  if (!MONDAY_API_KEY || !MONDAY_BOARD_ID) return;

  const temp = (data.temperatura as string) ?? "cold";
  const columnValues = JSON.stringify({
    text: data.whatsapp,
    email: { email: data.email, text: data.email },
    location: `${data.municipio}, ${data.estado}`,
    status: { label: STATUS_LABEL[temp] ?? "Nutrição" },
    priority: { label: PRIORITY_LABEL[temp] ?? "Baixa" },
    numbers: String(data.score ?? 0),
    text1: data.profissao,
    text2: data.faixaRenda,
    text3: data.motivacao,
    text4: data.horarioReuniao || "Não agendou",
    text5: TEMP_LABEL[temp] ?? "Frio",
    text6: data.observacoes,
    text7: "Site Quiz",
    text8: data.utmSource ?? "",
    text9: data.utmMedium ?? "",
    text10: data.utmCampaign ?? "",
    checkbox: data.lgpd ? "true" : "false",
  });

  const mutation = `
    mutation {
      create_item(
        board_id: ${MONDAY_BOARD_ID},
        item_name: "${(data.nome as string).replace(/"/g, "'")}",
        column_values: ${JSON.stringify(columnValues)}
      ) { id }
    }
  `;

  await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: MONDAY_API_KEY,
    },
    body: JSON.stringify({ query: mutation }),
  });
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
