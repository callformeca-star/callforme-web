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
          content: "Translate the phone line into natural, polite Korean. Output only the translation.",
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
          content: "Summarize this English call transcript in Korean in 3-4 concise lines with confirmed date/time, fee/cost, reference number, and next steps for Dongwoo.",
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
