import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

async function translateToKorean(text: string): Promise<string> {
  if (!text.trim()) return "";
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "Translate the following English phone conversation line into natural, concise Korean. Output only the Korean translation.",
        },
        { role: "user", content: text },
      ],
    });
    return res.choices[0]?.message?.content?.trim() || text;
  } catch {
    return text;
  }
}

async function summarizeCallInKorean(transcript: string): Promise<string> {
  if (!transcript.trim()) return "통화 대화 내용이 기록되지 않았습니다.";
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "Summarize the following English phone call transcript in clear Korean bullet points: 1) 통화 결과, 2) 확인된 주요 내용(일정·규정·안내), 3) 추가 필요 조치(콜백·확인 사항).",
        },
        { role: "user", content: transcript },
      ],
    });
    return res.choices[0]?.message?.content?.trim() || "요약을 생성하지 못했습니다.";
  } catch {
    return "요약 생성 중 오류가 발생했습니다.";
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const message = payload?.message || payload;
    const type = message?.type;
    const vapiCallId =
      message?.call?.id || payload?.call?.id || message?.calbase
      .from("calls")
      .select("id")
      .eq("vapi_call_id", vapiCallId)
      .single();

    if (!callRow) {
      return NextResponse.json({ ok: true, ignored: "call_not_found" });
    }

    if (type === "transcript" && message?.transcriptType === "final") {
      const role = message?.role === "assistant" ? "assistant" : "user";
      const contentEn = message?.transcript || "";
      if (contentEn.trim()) {
        const contentKo = await translateToKorean(contentEn);
        await supabase.from("call_messages").insert({
          call_id: callRow.id,
          role,
          content_en: contentEn,
          content_ko: contentKo,
        });
      }
    }

    if (type === "status-update" && message?.status === "ended") {
      await supabase
        .from("calls")
        .update({ status: "completed" })
        .eq("id", callRow.id);
    }

    if (type === "end-of-call-report") {
      const fullTranscript =
        message?.transcript || message?.artifact?.transcript || "";
      const summaryKo = await summarizeCallInKorean(fullTranscript);
      const durationSec = Math.round(
        message?.durationSeconds || message?.call?.duration || 0
      );
      const costUsd = message?.cost || message?.call?.cost || 0;

      await supabase
        .from("calls")
        .update({
          status: "completed",
          summary_ko: summaryKo,
          duration_seconds: durationSec,
          cost_usd: costUsd,
        })
        .eq("id", callRow.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Webhook error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
