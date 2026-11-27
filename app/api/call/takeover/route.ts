import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function postControl(controlUrl: string, body: Record<string, unknown>) {
  const res = await fetch(controlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Vapi control failed (${res.status}): ${text}`);
  }
  return text;
}

export async function POST(req: Request) {
  try {
    const { callId, action = "takeover" } = await req.json();
    if (!callId) {
      return NextResponse.json({ ok: false, error: "callId is required" }, { status: 400 });
    }

    const { data: callRow, error: dbError } = await supabase
      .from("calls")
      .select("vapi_call_id")
      .eq("id", callId)
      .single();

    if (dbError || !callRow?.vapi_call_id) {
      return NextResponse.json({ ok: false, error: "Vapi call ID not found" }, { status: 404 });
    }

    const vapiRes = await fetch(`https://api.vapi.ai/call/${callRow.vapi_call_id}`, {
      headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` },
    });
    const vapiData = await vapiRes.json();
    const controlUrl = vapiData?.monitor?.controlUrl;

    if (!controlUrl) {
      return NextResponse.json({ ok: false, error: "Control URL unavailable" }, { status: 400 });
    }

    const isTakeover = action === "takeover";
    await postControl(controlUrl, {
      type: "control",
      control: isTakeover ? "mute-assistant" : "unmute-assistant",
    });

    if (!isTakeover) {
      await new Promise((r) => setTimeout(r, 350));
      await postControl(controlUrl, {
        type: "add-message",
        triggerResponseEnabled: true,
        message: {
          role: "user",
          content:
            "[System notice: Dongwoo has finished speaking directly and handed the call back to you. Briefly say you are back on the line for Dongwoo Go and respond to the agent's latest instructions or continue the request.]",
        },
      });
    }

    return NextResponse.json({ ok: true, muted: isTakeover });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Takeover error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}