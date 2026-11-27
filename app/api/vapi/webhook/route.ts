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

async function translateLine(text: string, lang: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY || lang === "None") return "";
  try {
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: `Translate to natural, polite ${lang}. Output only the translation.` },
        { role: "user", content: text },
      ],
    });
    return r.choices[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  }
}

async function summarizeCall(transcript: string, lang: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return "통화 종료 (OpenAI 키 확인 필요)";
  const target = lang === "None" ? "Korean" : lang;
  try {
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `Summarize in ${target} in 3-4 concise bullet points: confirmed date/time, fee/cost, reference number, and follow-up actions for Dongwoo.`,
        },
        { role: "user", content: transcript },
      ],
    });
    return r.choices[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const message = payload.message ?? payload;
    const vapiCallId = message.call?.id;
    if (!vapiCallId) return NextResponse.json({ ok: true, ignored: "No call id" });

    const { data: callRow } = await supabase
      .from("calls")
      .select("id, structured_result")
      .eq("vapi_call_id", vapiCallId)
      .single();
    if (!callRow) return NextResponse.json({ ok: true, ignored: "Call not tracked" });

    const targetLang: string = callRow.structured_result?.target_lang || "Korean";

    if (message.type === "transcript" && message.transcriptType === "final") {
      const transcriptEn: string = message.transcript ?? "";
      if (transcriptEn.trim()) {
        const translationKo = await translateLine(transcriptEn, targetLang);
        await supabase.from("call_messages").insert({
          call_id: callRow.id,
          speaker: message.role === "assistant" ? "ai" : "remote",
          transcript_en: transcriptEn,
          translation_ko: translationKo,
        });
      }
    }

    if (message.type === "end-of-call-report") {
      const fullTranscript: string = message.transcript || message.artifact?.transcript || "";
      const summaryKo = fullTranscript ? await summarizeCall(fullTranscript, targetLang) : "대화 기록 없음";
      await supabase
        .from("calls")
        .update({
          status: "completed",
          summary_ko: summaryKo,
          duration_seconds: Math.round(message.durationSeconds ?? 0),
          cost_usd: message.cost ?? null,
          recording_url: message.recordingUrl || message.artifact?.recordingUrl || null,
          ended_at: new Date().toISOString(),
        })
        .eq("id", callRow.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Webhook error" },
      { status: 500 }
    );
  }
}