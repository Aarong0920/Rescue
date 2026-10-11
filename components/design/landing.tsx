"use client";

import { useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  ChevronRight,
  FileText,
  HeartPulse,
  Layers3,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { RescueMark } from "./mark";

export function LandingPage({
  onDemo,
  auth,
}: {
  onDemo: () => void;
  auth: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rescue-app rescue-landing relative isolate min-h-screen overflow-hidden bg-[#080e1a] text-[#f1f4f7]">
      <header className="rescue-landing-nav relative z-10 mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5" aria-label="RESCUE home">
          <RescueMark size={35} />
          <span className="text-[15px] font-bold tracking-[.16em]">RESCUE</span>
        </a>
        <nav className="hidden items-center gap-8 text-[12px] text-[#9aa8ba] md:flex">
          <a className="transition hover:text-white" href="#features">Features</a>
          <a className="transition hover:text-white" href="#how-it-works">How it works</a>
          <a className="transition hover:text-white" href="#why-rescue">Why RESCUE</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => setOpen(true)} className="hidden rounded-lg px-3 py-2 text-xs font-medium text-[#b2becc] transition hover:text-white sm:block">Sign in</button>
          <button onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#f15b66] px-3.5 text-[11px] font-semibold text-white shadow-[0_8px_22px_-12px_rgba(241,91,102,.8)] transition hover:-translate-y-0.5 hover:bg-[#ff737c] sm:px-4 sm:text-xs">Get started <ArrowRight size={14} /></button>
        </div>
      </header>
      <main id="top">
        <section className="rescue-hero relative mx-auto grid max-w-[1240px] items-center gap-10 px-5 pb-20 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[.92fr_1.08fr] lg:gap-7 lg:pt-[94px]">
          <div className="relative z-10 max-w-[525px]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#536177]/50 bg-[#162235]/80 px-3 py-1.5 text-[10px] font-medium text-[#c0cbd7]">
              <span className="flex size-4 items-center justify-center rounded-full bg-[#f15b66]/15 text-[#f5868e]"><Sparkles size={10} /></span>
              A clearer path to confident care
            </div>
            <h1 className="text-[42px] font-semibold leading-[1.04] tracking-[-.065em] text-[#f3f5f7] sm:text-[58px]">
              Train smarter.<br />
              <span className="relative inline-block">Respond stronger<span className="absolute -bottom-1 left-0 h-[2px] w-[76%] bg-gradient-to-r from-[#f15b66] to-transparent" /></span>
            </h1>
            <p className="mt-6 max-w-[460px] text-[14px] leading-[1.85] text-[#99a8ba] sm:text-[15px]">Turn your EMT coursework into a study plan that actually works. Practice with personalized quizzes, master the details with flashcards, and build clinical confidence—one session at a time.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#f15b66] px-5 text-[12px] font-semibold text-white shadow-[0_12px_28px_-14px_rgba(241,91,102,.75)] transition hover:-translate-y-0.5 hover:bg-[#ff737c]">Start learning free <ArrowRight size={15} /></button>
              <a href="#how-it-works" className="inline-flex items-center gap-1.5 px-1 text-[11px] font-medium text-[#b5c1ce] transition hover:text-white">See how it works <ChevronRight size={14} /></a>
            </div>
          </div>
          <div className="rescue-preview-shell relative mx-auto w-full max-w-[610px] lg:ml-auto" aria-hidden="true">
            <div className="relative overflow-hidden rounded-[15px] border border-[#33435a] bg-[#101b2a] shadow-[0_30px_110px_-42px_rgba(0,0,0,.9)]">
              <div className="flex h-10 items-center gap-2 border-b border-[#27364a] bg-[#111e2f] px-3.5">
                <span className="flex gap-1"><i className="size-1.5 rounded-full bg-[#ef777e]/75" /><i className="size-1.5 rounded-full bg-[#dfb46b]/70" /><i className="size-1.5 rounded-full bg-[#62b897]/70" /></span>
                <div className="mx-auto text-[8px] text-[#6e7e94]">Your private study workspace</div>
              </div>
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {["Your chapters", "Practice quizzes", "Flashcards", "Ask RESCUE"].map((item) => (
                  <div key={item} className="rounded-lg border border-[#2b3a4e] bg-[#152337] p-3 text-[11px] text-[#d5dee8]">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section id="why-rescue" className="border-y border-[#1d2a3b] bg-[#0f1928] px-5 py-7 sm:px-8">
          <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[10px] text-[#8e9db0] sm:justify-between">
            <span className="font-medium text-[#cbd4df]">Built for the moments that matter.</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck size={14} className="text-[#80a6cf]" />Evidence-led learning</span>
            <span className="inline-flex items-center gap-2"><BookOpen size={14} className="text-[#80a6cf]" />Your materials, your pace</span>
            <span className="inline-flex items-center gap-2"><HeartPulse size={14} className="text-[#f17b83]" />Confidence through practice</span>
          </div>
        </section>
        <section id="features" className="mx-auto max-w-[1120px] px-5 py-[76px] sm:px-8">
          <div className="mx-auto max-w-[570px] text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#f17b83]">A better way to prepare</span>
            <h2 className="mt-4 text-[31px] font-semibold leading-tight tracking-[-.05em] text-[#eef2f6] sm:text-[39px]">More than studying.<br /><span className="text-[#8898ad]">Training for the real thing.</span></h2>
          </div>
          <div className="mt-11 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Target size={19} />, title: "Practice that adapts", text: "Create focused quizzes from your own course material, then understand every answer." },
              { icon: <Activity size={19} />, title: "Think in scenarios", text: "Build clinical judgment by working through realistic patient situations." },
              { icon: <Layers3 size={19} />, title: "Recall what matters", text: "Turn dense chapters into clear, memorable flashcards you can master." },
              { icon: <ArrowUpRight size={19} />, title: "See your progress", text: "Know what’s clicking, where to focus, and how far you’ve come." },
            ].map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-[#253449] bg-[#111d2c] p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#f15b66]/10 text-[#f17b83]">{feature.icon}</span>
                <h3 className="mt-5 text-[13px] font-semibold text-[#e5ebf2]">{feature.title}</h3>
                <p className="mt-2 text-[11px] leading-[1.8] text-[#8796aa]">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="border-y border-[#1d2a3b] bg-[#0f1928] px-5 py-[72px] sm:px-8">
          <div className="mx-auto grid max-w-[1120px] gap-8 md:grid-cols-3">
            {[
              { num: "01", icon: <FileText size={17} />, title: "Bring your material", text: "Add the chapters, photos, and class notes you’re already studying." },
              { num: "02", icon: <BrainCircuit size={17} />, title: "Learn your way", text: "Practice with chapter-based quizzes, flashcards, and an AI study partner." },
              { num: "03", icon: <ArrowUpRight size={17} />, title: "Get stronger", text: "See your progress, target what needs work, and keep showing up." },
            ].map((step) => (
              <div key={step.num}>
                <div className="flex size-9 items-center justify-center rounded-xl border border-[#34445a] bg-[#172538] text-[#f37b83]">{step.icon}</div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-[9px] font-semibold tracking-[.16em] text-[#f17b83]">{step.num}</span>
                  <h3 className="text-sm font-semibold text-[#e6ecf3]">{step.title}</h3>
                </div>
                <p className="mt-2 text-[11px] leading-[1.8] text-[#8898ad]">{step.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-[1120px] px-5 py-[76px] sm:px-8">
          <div className="rounded-[22px] border border-[#3b3d4a] bg-gradient-to-br from-[#242333] to-[#142236] px-6 py-10 text-center sm:px-12 sm:py-14">
            <h2 className="text-[28px] font-semibold tracking-[-.05em] text-[#f1f4f7] sm:text-[38px]">You&apos;re learning to be someone&apos;s first call.</h2>
            <button onClick={() => setOpen(true)} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-[#f15b66] px-5 text-xs font-semibold text-white">Get started with RESCUE <ArrowRight size={14} /></button>
            <button onClick={onDemo} className="mt-4 block w-full text-[11px] text-[#9aa8ba] hover:text-white">Explore the demo</button>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#202d40] px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4">
          <span className="flex items-center gap-2"><RescueMark size={24} /><span className="text-[11px] font-bold tracking-[.15em]">RESCUE</span></span>
          <p className="text-[9px] text-[#748399]">Purpose-built for future EMTs. Educational use only.</p>
        </div>
      </footer>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a11]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="sign-in-title">
          <div className="relative w-full max-w-md rounded-2xl border border-[#34445a] bg-[#142134] p-6 shadow-2xl">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 text-[#8796aa] hover:bg-[#203149] hover:text-white" aria-label="Close sign in"><X size={17} /></button>
            <div id="sign-in-title">{auth}</div>
          </div>
        </div>
      )}
    </div>
  );
}
