"use client";

import type { ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  HeartPulse,
  Home,
  Layers3,
  LogOut,
  Menu,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";
import type { Page } from "@/lib/pages";
import { RescueMark } from "./mark";

const primary: { id: Page; label: string; icon: typeof Home }[] = [
  { id: "Dashboard", label: "Dashboard", icon: Home },
  { id: "My library", label: "My Library", icon: BookOpen },
  { id: "Practice quizzes", label: "Practice tests", icon: Target },
  { id: "Flashcards", label: "Flashcards", icon: Layers3 },
  { id: "AI tutor", label: "Ask RESCUE", icon: Sparkles },
];

const titles: Record<Page, string> = {
  Dashboard: "Overview",
  "My library": "My Library",
  "Class library": "Class library",
  Flashcards: "Flashcards",
  "Practice quizzes": "Practice tests",
  "AI tutor": "Ask RESCUE",
  "My progress": "Progress",
  Profile: "Settings",
  Admin: "Admin",
};

export function WorkspaceFrame({
  page,
  firstName,
  lastName,
  subtitle,
  initials,
  admin,
  mobile,
  setMobile,
  onNavigate,
  onSignOut,
  children,
}: {
  page: Page;
  firstName: string;
  lastName: string;
  subtitle: string;
  initials: string;
  admin: boolean;
  mobile: boolean;
  setMobile: (open: boolean) => void;
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const itemClass = (id: Page) =>
    `group flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[12px] transition ${
      page === id
        ? "bg-[#1a293c] font-semibold text-[#f4f6f8]"
        : "text-[#94a2b4] hover:bg-[#152337] hover:text-[#edf2f7]"
    }`;
  return (
    <div className="rescue-app rescue-workspace relative isolate min-h-screen bg-[#080e1a] text-[#edf2f7]">
      {mobile && (
        <button aria-label="Close navigation" onClick={() => setMobile(false)} className="fixed inset-0 z-30 bg-black/65 backdrop-blur-sm lg:hidden" />
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r border-[#1d2a3b] bg-[#0e1827] transition-transform duration-300 lg:translate-x-0 ${mobile ? "translate-x-0" : "-translate-x-full"}`}>
        <button onClick={() => onNavigate("Dashboard")} className="flex h-[72px] items-center gap-3 border-b border-[#1d2a3b] px-6 text-left">
          <RescueMark size={31} />
          <div>
            <div className="text-[15px] font-bold tracking-[.15em] text-[#f0f3f7]">RESCUE</div>
            <div className="mt-0.5 text-[9px] font-medium tracking-[.13em] text-[#75859b]">EMS LEARNING, REIMAGINED</div>
          </div>
        </button>
        <div className="px-3 pt-6">
          <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[#67778d]">Workspace</p>
          <nav aria-label="Main navigation" className="flex flex-col gap-1">
            {primary.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => onNavigate(id)} className={itemClass(id)}>
                <Icon size={16} className={page === id ? "text-[#f3757d]" : "text-[#788aa1]"} />
                {label}
                {id === "AI tutor" && <span className="ml-auto rounded-full bg-[#f15b66]/15 px-1.5 py-0.5 text-[8px] font-semibold text-[#f58a91]">AI</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-8 px-3">
          <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[#67778d]">Insights</p>
          <nav className="flex flex-col gap-1">
            <button onClick={() => onNavigate("My progress")} className={itemClass("My progress")}><Activity size={16} />Progress</button>
            <button onClick={() => onNavigate("Class library")} className={itemClass("Class library")}><Users size={16} />Class library</button>
            {admin && <button onClick={() => onNavigate("Admin")} className={itemClass("Admin")}>Admin</button>}
          </nav>
        </div>
        <div className="mt-auto p-3">
          <div className="relative overflow-hidden rounded-xl border border-[#29394d] bg-[#142235] p-3.5">
            <div className="relative flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-[#f15b66]/10 text-[#f17a83]"><HeartPulse size={15} /></span>
              <span className="text-[11px] font-semibold text-[#d9e1eb]">Your next shift starts here</span>
            </div>
            <p className="relative mt-2 text-[10px] leading-relaxed text-[#8392a6]">Stay sharp. One focused session at a time.</p>
            <button onClick={() => onNavigate("Practice quizzes")} className="relative mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#f48a92]">Start a quick quiz <ArrowRight size={12} /></button>
          </div>
          <button onClick={() => onNavigate("Profile")} className={`mt-3 flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-left transition hover:bg-[#172538] ${page === "Profile" ? "bg-[#172538]" : ""}`}>
            <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#f2787f] to-[#a25370] text-[10px] font-semibold text-white">{initials}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold text-[#dce4ed]">{firstName} {lastName}</span>
              <span className="mt-0.5 block truncate text-[9px] text-[#77879c]">{subtitle}</span>
            </span>
            <ChevronDown size={14} className="text-[#77879c]" />
          </button>
          <button onClick={onSignOut} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-[#94a2b4] hover:bg-[#172538] hover:text-white">
            <LogOut size={14} /> {subtitle === "Explore RESCUE" ? "Leave demo" : "Sign out"}
          </button>
        </div>
      </aside>
      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-20 flex h-[62px] items-center justify-between border-b border-[#1d2a3b]/90 bg-[#0b1220]/95 px-4 backdrop-blur-xl sm:px-7 xl:px-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobile(true)} aria-label="Open navigation" className="rounded-lg p-2 text-[#a4b1c0] hover:bg-[#172538] lg:hidden"><Menu size={19} /></button>
            <button onClick={() => setMobile(false)} aria-label="Close navigation" className={`rounded-lg p-2 text-[#a4b1c0] lg:hidden ${mobile ? "" : "hidden"}`}><X size={19} /></button>
            <div className="hidden items-center gap-2 text-[11px] sm:flex">
              <span className="text-[#708097]">Workspace</span>
              <ChevronRight size={12} className="text-[#4d5d72]" />
              <span className="font-medium text-[#c7d1dc]">{titles[page]}</span>
            </div>
            <span className="text-[12px] font-semibold text-[#c7d1dc] sm:hidden">{titles[page]}</span>
          </div>
          <button onClick={() => onNavigate("Profile")} className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#f2787f] to-[#a25370] text-[10px] font-semibold text-white" aria-label="Open profile settings">{initials}</button>
        </header>
        <main className="mx-auto max-w-[1460px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">{children}</main>
        <footer className="mx-auto flex max-w-[1460px] flex-wrap items-center justify-between gap-2 border-t border-[#1b293a] px-4 py-5 text-[9px] text-[#65758b] sm:px-7 xl:px-10">
          <span>RESCUE · Learn with purpose. Respond with confidence.</span>
          <span>Educational use only · Follow local protocols</span>
        </footer>
      </div>
    </div>
  );
}
