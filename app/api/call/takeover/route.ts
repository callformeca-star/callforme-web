import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { callId, action = "takeover" } = await req.json();
    if (!callId) {
      return NextResponse.json({ ok: false, error: "callId is required" }, { status: 400 });
    }

    const { data: callRow } = await supabase
      .from("calls")
      .select("vapi_call_id")
      .eq("id", callId)
      .single();

    if (!callRow?.vapi_call_id) {
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
    await fetch(controlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "control",
        control: isTakeover ? "mute-assistant" : "unmute-assistant",
      }),
    });

    if (!isTakeover) {
      await new Promise((r) => setTimeout(r, 400));
      await fetch(controlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "say",
          message: "Thank you for waiting. I am back on the line to help with Dongwoo Go's request.",
          endCallAfterSpoken: false,
        }),
      });

      await new Promise((r) => setTimeout(r, 500));
      await fetch(controlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "add-message",
          triggerResponseEnabled: true,
          message: {
            role: "user",
            content: "Please go ahead and continue assisting with the call.",
          },
        }),
      });
    }

    return NextResponse.json({ ok: true, muted: isTakeover });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Takeover error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}