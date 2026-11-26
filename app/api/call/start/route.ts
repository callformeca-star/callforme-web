import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scenarioType = "general", targetName = "", targetPhone, missionOrder } = body;
    if (!targetPhone || !missionOrder) {
      return NextResponse.json({ ok: false, error: "targetPhone and missionOrder are required" }, { status: 400 });
    }
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").limit(1).single();
    if (profileError || !profile) {
      return NextResponse.json({ ok: false, error: "Profile not found in Supabase" }, { status: 500 });
    }
    const craSecurityCode = profile.extra_notes?.cra_security_code ?? "00755";
    const systemPrompt = [
      "You are a warm, calm, and polite personal phone assistant calling on behalf of " + profile.full_name + " in Richmond, BC.",
      "",
      "[Primary Goal & Mission Order]",
      "Scenario: " + scenarioType,
      "Target: " + (targetName || "the recipient"),
      "Task: " + missionOrder,
      "",
      "[Client Information]",
      "- Full Name: " + profile.full_name + " (spelled " + profile.first_name_spelling + " for first name, " + profile.last_name_spelling + " for last name)",
      "- Date of Birth: " + profile.date_of_birth,
      "- Callback Phone Number: " + profile.phone_number,
      "- Address: " + profile.address,
      "- Pre-configured CRA Login Security Code: " + craSecurityCode + " (read digit by digit as zero-zero-seven-five-five only when asked by CRA for the login security code)",
      "",
      "[Conversation & Safety Rules]",
      "1. Wait patiently until the other person finishes their complete sentence and thought--even if they pause between words or phrases--before responding. Never interrupt or talk over them.",
      "2. Speak in a warm, friendly, conversational tone using short, natural sentences (1 to 2 sentences at a time).",
      "3. If the other person makes brief small talk (such as asking about the weather or how your day is going), respond warmly and briefly in one short sentence before gently returning to the task.",
      "4. Provide full name, spelling (" + profile.first_name_spelling + " " + profile.last_name_spelling + "), date of birth, callback phone number (" + profile.phone_number + "), or address clearly only when asked. Do not say you need to check with Dongwoo for these basic details.",
      "5. Whenever asked for a Social Insurance Number (SIN), BC Personal Health Number (PHN), prior-year tax line amount, credit card/payment details, unprovided booking/policy numbers, or direct verbal authorization from " + profile.full_name + " himself, do not guess--say warmly: I am calling on behalf of " + profile.full_name + ". Let me check with Dongwoo right away and get back to you.",
      "6. If placed on hold, say Sure, I will hold, thank you once and stay completely silent until an agent returns and speaks directly to you.",
      "7. Before ending, repeat back any confirmed date/time, fee, instructions, or reference number to verify accuracy, ask if that is correct, and wait for their confirmation before saying thank you and goodbye."
    ].join("\n");
    const firstMessage = "Hello, good afternoon. I am calling on behalf of " + profile.full_name + ". Could you help me with a quick request?";
    const formattedPhone = targetPhone.startsWith("+") ? targetPhone : "+1" + targetPhone.replace(/\D/g, "");
    const vapiRes = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.VAPI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        assistantId: process.env.VAPI_ASSISTANT_ID,
        customer: { number: formattedPhone },
        assistantOverrides: { firstMessage, model: { provider: "openai", model: "gpt-4.1-mini", messages: [{ role: "system", content: systemPrompt }] } }
      })
    });
    const vapiData = await vapiRes.json();
    if (!vapiRes.ok) {
      return NextResponse.json({ ok: false, error: vapiData.message || "Vapi outbound call failed", detail: vapiData }, { status: 500 });
    }
    const controlUrl = vapiData.monitor?.controlUrl ?? null;
    const { data: callRecord, error: insertError } = await supabase.from("calls").insert({
      vapi_call_id: vapiData.id, scenario_type: scenarioType, target_name: targetName, target_phone: formattedPhone, mission_order: missionOrder, status: "in-progress", control_url: controlUrl
    }).select().single();
    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, call: callRecord, vapiCallId: vapiData.id });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
