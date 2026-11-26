import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { callId, mode = "takeover" } = await req.json();
    if (!callId) return NextResponse.json({ ok: false, error: "callId is required" }, { status: 400 });
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: callRow, error } = await supabase.from("calls").select("id, control_url, status").eq("id", callId).single();
    if (error || !callRow) return NextResponse.json({ ok: false, error: "Call not found" }, { status: 404 });
    if (!callRow.control_url) return NextResponse.json({ ok: false, error: "실시간 제어 URL 연결 안됨었습니다." }, { status: 400 });
    const handoffMessage = mode === "resume"
      ? "Thank you. Dongwoo has finished speaking, so I will continue assisting from here."
      : "One moment please. Dongwoo is right here with me and will speak with you directly now.";
    const controlRes = await fetch(callRow.control_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "say", content: handoffMessage, endCallAfterSpoken: false })
    });
    if (!controlRes.ok) {
      const detail = await controlRes.text();
      return NextResponse.json({ ok: false, error: "Vapi 제어 명령 전송 실패", detail }, { status: 500 });
    }
    return NextResponse.json({ ok: true, mode, spoken: handoffMessage });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Takeover error" }, { status: 500 });
  }
}
