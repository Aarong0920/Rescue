import type { Page } from "@/lib/pages";

export type NoticeTone = "success" | "error" | "info" | "warning";

export type StudyDraft = {
  userId: string;
  selected?: string;
  resourceId?: string;
  cardIndex?: number;
  flipped?: boolean;
  answers?: number[];
  submitted?: boolean;
  quizMode?: "practice" | "exam";
  note?: { title: string; topic: string; content: string };
};

export type SavedPlace = {
  setId?: string;
  cardIndex?: number;
  answers?: number[];
  submitted?: boolean;
  quizMode?: "practice" | "exam";
};

const screens: Record<Page, string> = {
  Dashboard: "dashboard",
  "My library": "library",
  "Class library": "class",
  Flashcards: "flashcards",
  "Practice quizzes": "quizzes",
  "AI tutor": "tutor",
  "My progress": "progress",
  Profile: "profile",
  Admin: "admin",
};

const pages = Object.fromEntries(
  Object.entries(screens).map(([page, screen]) => [screen, page]),
) as Record<string, Page>;

export function pageToScreen(page: Page) {
  return screens[page];
}

export function readPlace(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const page = pages[params.get("screen") ?? ""] ?? "Dashboard";
  const chapter = params.get("chapter") ?? "";
  return {
    page,
    chapter: /^[A-Za-z0-9-]{1,80}$/.test(chapter) ? chapter : null,
  };
}

export function placeHref(page: Page, chapter?: string | null) {
  const params = new URLSearchParams();
  params.set("screen", pageToScreen(page));
  if (chapter && /^[A-Za-z0-9-]{1,80}$/.test(chapter)) params.set("chapter", chapter);
  return `/?${params.toString()}`;
}

/** Same-user tab focus must not reload the workspace. A real sign-out still does. */
export function shouldLoadAccount(
  event: string,
  currentUserId: string | null,
  nextUserId: string | null,
) {
  if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return "ignore" as const;
  if (event === "SIGNED_OUT") return "signout" as const;
  if (!nextUserId) return currentUserId ? ("ignore" as const) : ("signout" as const);
  if (currentUserId === nextUserId) return "ignore" as const;
  return "load" as const;
}

export function chapterWork(resource: {
  processing?: string;
  nextPage?: number;
  totalPages?: number;
  pages?: number;
}) {
  const total = resource.totalPages || resource.pages;
  if (!total || total < 1) return null;
  if (resource.processing === "ready" || (!resource.processing && resource.pages))
    return { done: total, total };
  if (resource.processing !== "processing" && resource.processing !== "uploaded")
    return null;
  const done = Math.min(total, Math.max(0, (resource.nextPage ?? 1) - 1));
  return { done, total };
}

export function chapterStage(resource: {
  processing?: string;
  stage?: string;
  pages?: number;
  file_path?: string | null;
}) {
  if (resource.stage === "uploading") return "Uploading";
  if (resource.stage === "ocr") return "Reading scanned pages";
  if (resource.stage === "extracting") return "Extracting text";
  if (resource.stage === "quiz") return "Creating the initial quiz";
  if (resource.processing === "failed" || resource.stage === "failed") return "Failed";
  if (resource.processing === "processing" || resource.processing === "uploaded")
    return "Processing";
  if (resource.processing === "ready" || resource.pages) return "Ready";
  if (resource.file_path?.toLowerCase().endsWith(".pdf")) return "Uploaded";
  return "Saved";
}

export function initialQuizStatus(input: {
  autoQuiz: boolean;
  hasSavedQuiz: boolean;
  processing?: string;
  activity?: "generating" | "failed";
  isChapter: boolean;
}) {
  if (!input.isChapter) return null;
  if (input.hasSavedQuiz) return "ready" as const;
  if (input.activity === "generating") return "generating" as const;
  if (input.activity === "failed") return "failed" as const;
  if (!input.autoQuiz) return "off" as const;
  if (input.processing === "ready") return "pending" as const;
  if (input.processing === "processing" || input.processing === "uploaded")
    return "pending" as const;
  return null;
}

export function parseDraft(raw: string | null, userId: string): StudyDraft | null {
  try {
    const data = JSON.parse(raw ?? "null") as Record<string, unknown> | null;
    if (!data || data.userId !== userId) return null;
    const note = data.note as { title?: unknown; topic?: unknown; content?: unknown } | undefined;
    const answers = Array.isArray(data.answers)
      ? data.answers.filter((answer) => typeof answer === "number").slice(0, 40)
      : undefined;
    return {
      userId,
      selected: typeof data.selected === "string" ? data.selected : undefined,
      resourceId: typeof data.resourceId === "string" ? data.resourceId : undefined,
      cardIndex: typeof data.cardIndex === "number" ? data.cardIndex : undefined,
      flipped: data.flipped === true,
      answers,
      submitted: data.submitted === true,
      quizMode: data.quizMode === "exam" ? "exam" : data.quizMode === "practice" ? "practice" : undefined,
      note: note
        ? {
            title: String(note.title ?? "").slice(0, 200),
            topic: String(note.topic ?? "").slice(0, 80),
            content: String(note.content ?? "").slice(0, 30000),
          }
        : undefined,
    };
  } catch {
    return null;
  }
}

export function mergeDraft(
  local: StudyDraft | null,
  saved: SavedPlace | undefined,
  userId: string,
): StudyDraft | null {
  if (!local && !saved) return null;
  const localAnswers = local?.answers?.length ? local.answers : undefined;
  return {
    userId,
    selected: local?.selected || saved?.setId,
    resourceId: local?.resourceId,
    cardIndex: local?.cardIndex ?? saved?.cardIndex,
    flipped: local?.flipped,
    answers: localAnswers ?? saved?.answers,
    submitted: localAnswers ? local?.submitted : saved?.submitted,
    quizMode: local?.quizMode || saved?.quizMode,
    note: local?.note,
  };
}

export function draftRestoredMessage(draft: StudyDraft | null) {
  if (!draft) return null;
  const notes = Boolean(draft.note?.content?.trim() || draft.note?.title?.trim());
  const quiz = Boolean(draft.answers?.some((answer) => answer >= 0));
  const cards = Boolean(draft.cardIndex && draft.cardIndex > 0);
  if (!notes && !quiz && !cards) return null;
  return "Restored your unsaved study draft.";
}

export function noticeClass(tone: NoticeTone) {
  return `notice ${tone}`;
}
