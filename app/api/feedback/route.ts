import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  const { data, error } = await supabase.from("call_feedbacks").select("*").order("created_at", { ascending: false }).limit(20);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, feedbacks: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const { callId, testerName, outcome, issueTags, comment } = await req.json();
    if (!outcome) return NextResponse.json({ ok: false, error: "목표 달성 여부를 선택해 주세요." }, { status: 400 });
    const { data, error } = await supabase.from("call_feedbacks").insert({
      call_id: callId || null,
      tester_name: testerName?.trim() || "Dongwoo Go",
      outcome,
      issue_tags: Array.isArray(issueTags) ? issueTags : [],
      comment: comment?.trim() || ""
    }).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, feedback: data });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Feedback error" }, { status: 500 });
  }
}
