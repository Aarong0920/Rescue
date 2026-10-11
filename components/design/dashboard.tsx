"use client";

import { ArrowRight, BookOpen, BrainCircuit, Flame, Play, Sparkles, Target, TrendingUp } from "lucide-react";

export type ActivityItem = {
  title: string;
  detail: string;
  when: string;
  score: string;
};

export function LiveDashboard({
  firstName,
  onLibrary,
  onContinue,
  continueTitle,
  continueDetail,
  continuePercent,
  continueNote,
  metrics,
  activity,
  week,
  weakTopic,
  onReviewWeak,
  onProgress,
}: {
  firstName: string;
  onLibrary: () => void;
  onContinue: () => void;
  continueTitle: string;
  continueDetail: string;
  continuePercent: number | null;
  continueNote: string;
  metrics: { label: string; value: string; detail: string; accent: "coral" | "blue" | "mint" | "violet" }[];
  activity: ActivityItem[];
  week: { label: string; total: number }[];
  weakTopic: string | null;
  onReviewWeak: () => void;
  onProgress: () => void;
}) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const peak = Math.max(1, ...week.map((day) => day.total));
  const icons = [<Flame size={16} key="f" />, <Target size={16} key="t" />, <TrendingUp size={16} key="r" />, <BrainCircuit size={16} key="b" />];
  const accent: Record<string, string> = {
    coral: "bg-[#f15b66]/10 text-[#f47c84]",
    blue: "bg-[#719cf3]/10 text-[#8baafa]",
    mint: "bg-[#53b995]/10 text-[#6ec6a5]",
    violet: "bg-[#9b83ea]/10 text-[#b19cf5]",
  };
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8493a8]">{today}</p>
          <h1 className="text-[30px] font-semibold tracking-[-0.045em] text-[#f3f6fa] sm:text-[34px]">Welcome back, {firstName}.</h1>
          <p className="mt-2 text-sm text-[#91a0b4]">You&apos;re building the kind of confidence that matters.</p>
        </div>
        <button onClick={onLibrary} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#f15b66] px-4 text-[13px] font-semibold text-white">
          <BookOpen size={15} /> Browse library
        </button>
      </div>
      <section className="relative overflow-hidden rounded-2xl border border-[#273649] bg-[#152235] p-6 sm:p-7">
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
          <div className="max-w-[420px]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#f15b66]/20 bg-[#f15b66]/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ff9299]">Pick up where you left off</div>
            <h2 className="text-[23px] font-semibold tracking-[-0.04em] text-[#f3f6fa]">{continueTitle}</h2>
            <p className="mt-1.5 text-[13px] text-[#8e9eb2]">{continueDetail}</p>
            {continuePercent !== null && (
              <div className="mt-5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#29394d]"><div className="h-full rounded-full bg-[#f15b66]" style={{ width: `${continuePercent}%` }} /></div>
                <span className="text-xs font-medium text-[#acb8c7]">{continuePercent}%</span>
              </div>
            )}
            <div className="mt-2 text-[11px] text-[#728299]">{continueNote}</div>
            <button onClick={onContinue} className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-[#f15b66] px-4 text-[13px] font-semibold text-white">
              <Play size={14} fill="currentColor" /> Continue studying
            </button>
          </div>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map((metric, index) => (
          <div key={metric.label} className="rounded-xl border border-[#26364a] bg-[#111d2c] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#8796aa]">{metric.label}</span>
              <span className={`flex size-8 items-center justify-center rounded-lg ${accent[metric.accent]}`}>{icons[index]}</span>
            </div>
            <p className="mt-4 text-[25px] font-semibold tracking-tight text-[#eff3f7]">{metric.value}</p>
            <p className="mt-1 text-[10px] text-[#718198]">{metric.detail}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-8 xl:grid-cols-[1.55fr_1fr]">
        <div>
          <div className="flex items-center justify-between border-b border-[#243348] py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-[#e8edf4]">Recent activity</h2>
              <p className="mt-0.5 text-xs text-[#8190a4]">Your latest study sessions</p>
            </div>
            <button onClick={onProgress} className="text-xs font-medium text-[#adbac9]">View all <ArrowRight className="ml-1 inline" size={13} /></button>
          </div>
          {activity.length === 0 && <p className="py-6 text-sm text-[#91a0b4]">Finish a quiz or flashcard session to see it here.</p>}
          {activity.map((item) => (
            <div key={`${item.title}:${item.when}`} className="flex items-center gap-3 border-b border-[#243348] py-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#f15b66]/10 text-[#fa7982]"><Target size={17} /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[#e3e9f1]">{item.title}</p>
                <p className="mt-1 text-[11px] text-[#8190a4]">{item.detail} · {item.when}</p>
              </div>
              <span className="text-xs font-semibold text-[#c1ccd9]">{item.score}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-[15px] font-semibold text-[#e8edf4]">This week</h2>
            <p className="mt-1 text-xs text-[#8190a4]">Questions answered, last 7 days</p>
            <div className="mt-6 flex h-[96px] items-end justify-between gap-2">
              {week.map((day) => (
                <div key={day.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div className="w-full max-w-[24px] rounded-t-[4px] bg-[#31435a]" style={{ height: `${Math.max(8, Math.round((day.total / peak) * 100))}%` }} />
                  <span className="text-[10px] text-[#718198]">{day.label}</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onReviewWeak} className="border-t border-[#243348] py-5 text-left">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#f15b66]/10 text-[#fb7b84]"><Sparkles size={17} /></div>
              <div>
                <div className="text-[13px] font-semibold text-[#e8edf4]">A smarter next step</div>
                <p className="mt-1 text-xs leading-relaxed text-[#91a0b4]">
                  {weakTopic
                    ? `Your scores are lowest in ${weakTopic}. A focused quiz can show what to review.`
                    : "Complete a quiz to see which topic needs another look."}
                </p>
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}
