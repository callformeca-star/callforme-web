import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function translateToKorean(text: string): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes("...")) {
      return "";
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Translate the following phone conversation line into natural, polite Korean. Output only the Korean translation.",
        },
        { role: "user", content: text },
      ],
      temperature: 0.2,
    });
    return completion.choices[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  }
}

async function summarizeCallKorean(transcript: string): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes("...")) {
      return "통화 종료 (OpenAI 요약 키 확인 필요)";
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "다음 영문 전화 통화 기록을 바탕으로 한국어로 핵심 결과를 3~4줄로 간결하게 요약하세요. 확정된 날짜/시간, 비용/수수료, 접수번호(Reference Number), 그리고 동우 님이 추가로 확인해야 할 사항이 있다면 명확히 적으세요.",
        },
        { role: "user", content: transcript },
      ],
      temperature: 0.3,
    });
    return completion.choices[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const message = payload.message ?? payload;
    const type = message.type;
    const vapiCallId = message.call?.id;

    if (!vapiCallId) {
      return NextResponse.json({ ok: true, ignored: "No call id" });
    }

    const { data: callRow } = await supabase
      .from("calls")
      .select("id")
      .eq("vapi_call_id", vapiCallId)
      .single();

    if (!callRow) {
      return NextResponse.json({ ok: true, ignored: "Call not tracked in DB" });
    }

    if (type === "transcript" && message.transcriptType === "final") {
      const speaker = message.role === "assistant" ? "ai" : "remote";
      const transcriptEn = message.transcript ?? "";
      if (transcriptEn.trim()) {
        const translationKo = await translateToKorean(transcriptEn);
        await supabase.from("call_messages").insert({
          call_id: callRow.id,
          speaker,
          transcript_en: transcriptEn,
          translation_ko: translationKo,
        });
      }
    }

    if (type === "end-of-call-report") {
      const fullTranscript =
        message.transcript || message.artifact?.transcript || "";
      const summaryKo = fullTranscript
        ? await summarizeCallKorean(fullTranscript)
        : "대화 기록 없음";

      await supabase
        .from("calls")
        .update({
          status: "completed",
          summary_ko: summaryKo,
          duration_seconds: Math.round(message.durationSeconds ?? 0),
          cost_usd: message.cost ?? null,
          recording_url:
            message.recordingUrl || message.artifact?.recordingUrl || null,
          ended_at: new Date().toISOString(),
        })
        .eq("id", callRow.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Webhook error";
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}