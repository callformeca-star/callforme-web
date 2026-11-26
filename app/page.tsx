"use client";

import { useEffect, useState } from "react";

interface CallRecord {
  id: string;
  vapi_call_id: string | null;
  scenario_type: string | null;
  target_name: string | null;
  target_phone: string;
  mission_order: string;
  status: string;
  summary_ko: string | null;
  duration_seconds: number | null;
  cost_usd: number | null;
  control_url?: string | null;
  created_at: string;
}

interface CallMessage {
  id: string;
  call_id: string;
  speaker: "ai" | "remote";
  transcript_en: string;
  translation_ko: string | null;
  created_at: string;
}

interface FeedbackRecord {
  id: string;
  call_id: string | null;
  tester_name: string;
  outcome: string;
  issue_tags: string[];
  comment: string;
  created_at: string;
}

const PRESETS: Record<string, { label: string; target: string; order: string; tip?: string }> = {
  medical_booking: {
    label: "1. 병원·클리닉 예약",
    target: "Richmond Family Clinic",
    order: "다음 주 화요일 오전 가정의 일반 건강검진 예약을 잡고 싶습니다. 화요일 오전이 어렵다면 다음 주 평일 오전 시간대 중 가장 빠른 시간으로 예약해 주세요. 진료 시 혈액검사 의뢰서(Blood test referral)도 함께 요청합니다.",
  },
  reschedule_cancel: {
    label: "2. 예약 일정 변경·취소",
    target: "Dental / Medical Office",
    order: "기존에 잡혀 있는 예약을 다른 평일 오전 시간대로 변경하고 싶습니다. 당일 취소 수수료가 있는지 확인하고, 가능한 가장 빠른 대체 일정을 안내받아 확정해 주세요.",
  },
  telecom_support: {
    label: "3. 통신사 요금제·인터넷 수리 (Telus/Rogers/Bell)",
    target: "Telus / Rogers Customer Support",
    order: "현재 사용 중인 홈 인터넷 연결이 불안정하여 점검 및 테크니션 방문 예약을 문의합니다. 방문 가능한 날짜와 시간대, 출장비 발생 여부를 확인해 주세요.",
  },
  insurance_inquiry: {
    label: "4. 자동차·집·여행자 보험 (ICBC/사설 보험)",
    target: "ICBC / Insurance Broker",
    order: "현재 가입된 보험의 보장 범위와 갱신 조건을 확인하고 싶습니다. 필요한 서류나 본인 확인 절차가 있다면 안내받아 정리해 주세요.",
  },
  bank_card_support: {
    label: "5. 은행·신용카드 고객센터",
    target: "TD / RBC / BMO Card Services",
    order: "카드 승인 차단 해제 절차 및 최근 결제 내역 확인 방법을 문의합니다. 본인 인증이 필요한 단계가 오면 바로 동우 님께 연결하겠습니다.",
  },
  strata_property: {
    label: "6. 콘도·렌트 관리사무소 (Strata/Property)",
    target: "Strata Management Office",
    order: "주방 싱크대 아래 누수 점검 및 수리 요청을 접수하고 싶습니다. 관리인 또는 수리 기사 방문 가능 일정과 출입 절차를 확인해 주세요.",
  },
  restaurant_booking: {
    label: "7. 식당 예약·좌석·단체 조건 문의",
    target: "Richmond Restaurant",
    order: "이번 주 금요일 저녁 6시 30분 성인 2명 테이블 예약을 원합니다. 창가 자리(window seat)를 우선 요청하되 없으면 일반 테이블도 괜찮습니다. 6시 30분이 불가하면 가능한 시간대를 확인하고, 주차 가능 여부와 추후 1명 추가(총 3명) 가능 여부도 함께 물어봐 주세요.",
  },
  airline_travel: {
    label: "8. 항공사·여행 일정 변경 및 수하물 문의",
    target: "Air Canada / Airline Reservations",
    order: "예약된 항공편의 날짜 변경 가능 여부와 변경 수수료, 위탁 수하물 규정을 확인하고 싶습니다. 변경 가능한 대체 항공편 시간과 차액을 안내받아 주세요.",
  },
  courier_delivery: {
    label: "9. 택배·화물 재배달·픽업 조율",
    target: "Canada Post / UPS / FedEx",
    order: "부재중으로 반송 보류된 택배의 재배달 일정 지정 또는 가까운 픽업 지점 주소를 확인하고 싶습니다. 수령 시 필요한 신분증이나 트래킹 번호 안내도 함께 확인해 주세요.",
  },
  gov_cra_hold: {
    label: "10. 정부·행정 기관 대기 돌파 (CRA/Service Canada)",
    target: "CRA / Service Canada",
    order: "상담원 연결 대기 후 계정 로그인 오류 해결 절차 및 처리 상태를 문의합니다. 로그인 보안코드는 요청 시 한 자리씩 읽어주고, SIN이나 세금 신고액(Line 15000) 요구 시 바로 동우 님께 확인 후 회신하겠다고 안내하세요.",
    tip: "CRA는 월·금 오후 대기가 길며 화~목 오전 연결이 수월합니다.",
  },
  auto_repair_tire: {
    label: "11. 자동차 정비소·타이어 교체 견적 예약",
    target: "Richmond Auto Service",
    order: "엔진오일 교환 및 타이어 점검 예약을 잡고 싶습니다. 대략적인 예상 비용과 작업 소요 시간, 이번 주 평일 오전 예약 가능 시간을 확인해 주세요.",
  },
  salon_fitness: {
    label: "12. 미용실·마사지·피트니스·학원 일정 조율",
    target: "Local Studio / Salon",
    order: "이번 주 토요일 오후 예약 가능 시간을 확인하고 싶습니다. 1순위 희망 시간과 대안 시간을 안내받고 취소 규정까지 함께 확인해 주세요.",
  },
  hold_callback: {
    label: "13. 긴 대기(Hold) 및 콜백 접수 요청",
    target: "Customer Service Desk",
    order: "담당자 연결을 위해 대기한 뒤, 통화가 길어지거나 담당자가 부재중이면 Dongwoo Go(778-231-2322) 앞으로 오늘 중 회신 전화를 남기도록 요청해 주세요.",
  },
  general_inquiry: {
    label: "14. 일반 문의 및 영업시간·위치 확인",
    target: "Service Desk",
    order: "오늘 영업시간, 방문 예약 필요 여부, 주차 안내 및 준비물을 간단히 확인해 주세요.",
  },
};

const TAGS = [
  { id: "TIMING_INTERRUPT", label: "말 끊김·끼어들기" },
  { id: "INFO_ACCURACY", label: "이름·철자·날짜 오류" },
  { id: "GUARDRAIL_ESCALATION", label: "본인 확인·개입 필요" },
  { id: "STT_TTS_QUALITY", label: "음성 인식·억양 지연" },
  { id: "SCENARIO_FLOW", label: "대화 흐름·마무리 아쉬움" },
];

export default function HomePage() {
  const [scenarioType, setScenarioType] = useState("medical_booking");
  const [targetName, setTargetName] = useState(PRESETS.medical_booking.target);
  const [targetPhone, setTargetPhone] = useState("");
  const [missionOrder, setMissionOrder] = useState(PRESETS.medical_booking.order);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [takeoverActive, setTakeoverActive] = useState(false);
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const [takeoverNotice, setTakeoverNotice] = useState("");
  const [testerName, setTesterName] = useState("Dongwoo Go");
  const [outcome, setOutcome] = useState("성공");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackDoneMsg, setFeedbackDoneMsg] = useState("");
  const [recentFeedbacks, setRecentFeedbacks] = useState<FeedbackRecord[]>([]);

  function handleScenarioChange(k: string) {
    setScenarioType(k);
    const p = PRESETS[k];
    if (p) {
      setTargetName(p.target);
      setMissionOrder(p.order);
    }
  }

  async function loadCalls() {
    try {
      const r = await fetch("/api/calls");
      const d = await r.json();
      if (d.ok && Array.isArray(d.calls)) {
        setCalls(d.calls);
        if (d.calls.length > 0) setSelectedCallId((prev) => prev ?? d.calls[0].id);
      }
    } catch {}
  }

  async function loadMessages(id: string) {
    try {
      const r = await fetch("/api/calls?callId=" + encodeURIComponent(id));
      const d = await r.json();
      if (d.ok && Array.isArray(d.messages)) setMessages(d.messages);
    } catch {}
  }

  async function loadFeedbacks() {
    try {
      const r = await fetch("/api/feedback");
      const d = await r.json();
      if (d.ok && Array.isArray(d.feedbacks)) setRecentFeedbacks(d.feedbacks);
    } catch {}
  }

  useEffect(() => {
    loadCalls();
    loadFeedbacks();
    const t = setInterval(loadCalls, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selectedCallId) return;
    loadMessages(selectedCallId);
    const t = setInterval(() => loadMessages(selectedCallId), 3000);
    return () => clearInterval(t);
  }, [selectedCallId]);

  async function handleStartCall(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (!targetPhone.trim() || !missionOrder.trim()) {
      setErrorMsg("수신 전화번호와 요청 내용을 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    setTakeoverActive(false);
    setTakeoverNotice("");
    try {
      const r = await fetch("/api/call/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioType,
          targetName: targetName.trim(),
          targetPhone: targetPhone.trim(),
          missionOrder: missionOrder.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) setErrorMsg(d.error || "발신 요청에 실패했습니다.");
      else {
        if (d.call?.id) setSelectedCallId(d.call.id);
        await loadCalls();
      }
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTakeover(mode: "takeover" | "resume") {
    if (!selectedCallId) return;
    setTakeoverLoading(true);
    setTakeoverNotice("");
    try {
      const r = await fetch("/api/call/takeover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: selectedCallId, mode }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) setTakeoverNotice(d.error || "연결 안내 전송에 실패했습니다.");
      else {
        setTakeoverActive(mode === "takeover");
        setTakeoverNotice(
          mode === "takeover"
            ? "AI가 상대방에게 동우 님 연결 안내 멘트를 전달했습니다."
            : "AI가 다시 대화를 이어받도록 안내했습니다."
        );
      }
    } catch {
      setTakeoverNotice("네트워크 오류가 발생했습니다.");
    } finally {
      setTakeoverLoading(false);
    }
  }

  function toggleTag(id: string) {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedbackDoneMsg("");
    setFeedbackSaving(true);
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: selectedCallId,
          testerName,
          outcome,
          issueTags: selectedTags,
          comment: feedbackComment,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setFeedbackDoneMsg("피드백이 저장되었습니다.");
        setFeedbackComment("");
        setSelectedTags([]);
        await loadFeedbacks();
      } else setFeedbackDoneMsg(d.error || "저장 실패");
    } catch {
      setFeedbackDoneMsg("네트워크 오류");
    } finally {
      setFeedbackSaving(false);
    }
  }

  const selectedCall = calls.find((c) => c.id === selectedCallId) ?? null;
  const activePreset = PRESETS[scenarioType];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold">CallForMe 대시보드</h1>
            <p className="text-sm text-slate-400">
              사전 오더지 발신 · 실시간 영한 자막 · 대화 참여 · 베타 피드백
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Dongwoo Go 프로필 연동됨
          </span>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-lg font-semibold">새 통화 미션 발신</h2>
            <form onSubmit={handleStartCall} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  시나리오별 오더지 템플릿 (14종)
                </label>
                <select
                  value={scenarioType}
                  onChange={(e) => handleScenarioChange(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                >
                  {Object.entries(PRESETS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
                {activePreset?.tip && (
                  <p className="mt-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                    {activePreset.tip}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">상대 기관 및 업체명</label>
                <input
                  type="text"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">수신 전화번호</label>
                <input
                  type="text"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  placeholder="+17782312322"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  요청 내용 (사전 오더지)
                </label>
                <textarea
                  rows={5}
                  value={missionOrder}
                  onChange={(e) => setMissionOrder(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
                />
              </div>
              {errorMsg && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5">
                  {errorMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium text-sm"
              >
                {submitting ? "발신 요청 중..." : "전화 걸기 시작"}
              </button>
            </form>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <h3 className="text-xs font-semibold text-slate-400">최근 통화 목록</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {calls.length === 0 ? (
                  <p className="text-xs text-slate-500">아직 기록된 통화가 없습니다.</p>
                ) : (
                  calls.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCallId(c.id);
                        setTakeoverActive(false);
                        setTakeoverNotice("");
                      }}
                      className={
                        "w-full text-left p-3 rounded-xl border text-xs " +
                        (c.id === selectedCallId
                          ? "bg-slate-800 border-indigo-500"
                          : "bg-slate-950 border-slate-800")
                      }
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-200">
                          {c.target_name || c.target_phone}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {c.status}
                        </span>
                      </div>
                      <p className="text-slate-400 truncate mt-1">{c.mission_order}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">실시간 영문·한글 자막</h2>
                  <span className="text-xs text-slate-400">
                    {selectedCall ? "상태: " + selectedCall.status : "통화를 선택하세요"}
                  </span>
                </div>
                {selectedCall &&
                  (!takeoverActive ? (
                    <button
                      type="button"
                      disabled={takeoverLoading}
                      onClick={() => handleTakeover("takeover")}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white"
                    >
                      {takeoverLoading ? "연결 중..." : "대화 참여하기 (직접 말하기)"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={takeoverLoading}
                      onClick={() => handleTakeover("resume")}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-semibold text-white"
                    >
                      AI에게 다시 넘기기
                    </button>
                  ))}
              </div>
              {takeoverNotice && (
                <div className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 rounded-xl p-3 space-y-1">
                  <p className="font-semibold">{takeoverNotice}</p>
                  {takeoverActive && (
                    <p className="text-slate-300">
                      참고 영어 멘트: Yes, I am Dongwoo Go and I authorize this.
                    </p>
                  )}
                </div>
              )}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-72 overflow-y-auto space-y-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    통화가 연결되면 실시간 대화 자막이 이곳에 표시됩니다.
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        "p-3 rounded-xl text-sm space-y-1 " +
                        (m.speaker === "ai"
                          ? "bg-indigo-950/50 border border-indigo-800/50"
                          : "bg-slate-900 border border-slate-800")
                      }
                    >
                      <div className="text-xs font-semibold text-slate-400">
                        {m.speaker === "ai" ? "AI 비서" : "상대방"}
                      </div>
                      <div className="text-slate-100">{m.transcript_en}</div>
                      {m.translation_ko && (
                        <div className="text-emerald-300 text-xs">{m.translation_ko}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-lg font-semibold">통화 결과 요약</h2>
              {selectedCall ? (
                <div className="space-y-3 text-sm">
                  <div className="text-xs text-slate-400 flex flex-wrap gap-4">
                    <span>수신 번호: {selectedCall.target_phone}</span>
                    <span>
                      통화 시간:{" "}
                      {selectedCall.duration_seconds != null
                        ? selectedCall.duration_seconds + "초"
                        : "-"}
                    </span>
                    <span>
                      예상 비용:{" "}
                      {selectedCall.cost_usd != null
                        ? "$" + Number(selectedCall.cost_usd).toFixed(4) + " USD"
                        : "-"}
                    </span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 whitespace-pre-line text-slate-200">
                    {selectedCall.summary_ko ||
                      "통화 종료 후 한국어 요약이 자동으로 생성됩니다."}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">선택된 통화가 없습니다.</p>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">피드백 남기기</h2>
                <span className="text-xs text-slate-400">
                  {selectedCall
                    ? "대상: " + (selectedCall.target_name || selectedCall.target_phone)
                    : "일반 피드백"}
                </span>
              </div>
              <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">테스터 이름</label>
                    <input
                      type="text"
                      value={testerName}
                      onChange={(e) => setTesterName(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">목표 달성 여부</label>
                    <div className="flex gap-2">
                      {["성공", "부분 성공", "실패"].map((it) => (
                        <button
                          key={it}
                          type="button"
                          onClick={() => setOutcome(it)}
                          className={
                            "flex-1 py-2 rounded-xl border text-xs font-medium " +
                            (outcome === it
                              ? "bg-indigo-600 border-indigo-500 text-white"
                              : "bg-slate-950 border-slate-700 text-slate-300")
                          }
                        >
                          {it}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">발견된 이슈 태그</label>
                  <div className="flex flex-wrap gap-2">
                    {TAGS.map((tg) => {
                      const act = selectedTags.includes(tg.id);
                      return (
                        <button
                          key={tg.id}
                          type="button"
                          onClick={() => toggleTag(tg.id)}
                          className={
                            "px-2.5 py-1.5 rounded-lg border text-xs " +
                            (act
                              ? "bg-rose-500/20 border-rose-500/50 text-rose-200"
                              : "bg-slate-950 border-slate-800 text-slate-400")
                          }
                        >
                          {tg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">개선 의견 및 특이사항</label>
                  <textarea
                    rows={2}
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-emerald-400">{feedbackDoneMsg}</span>
                  <button
                    type="submit"
                    disabled={feedbackSaving}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold"
                  >
                    {feedbackSaving ? "저장 중..." : "피드백 저장"}
                  </button>
                </div>
              </form>
              {recentFeedbacks.length > 0 && (
                <div className="pt-3 border-t border-slate-800 space-y-2 max-h-40 overflow-y-auto">
                  {recentFeedbacks.slice(0, 5).map((fb) => (
                    <div
                      key={fb.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs space-y-1"
                    >
                      <div className="flex justify-between text-slate-400">
                        <span>
                          {fb.tester_name} · <strong className="text-slate-200">{fb.outcome}</strong>
                        </span>
                        <span>{new Date(fb.created_at).toLocaleDateString()}</span>
                      </div>
                      {fb.comment && <p className="text-slate-300">{fb.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}