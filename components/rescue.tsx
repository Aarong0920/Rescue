"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Flame,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Layers,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { MAX_UPLOAD_BYTES } from "@/lib/chapters";
import { MAX_PHOTOS, photoSetProblem } from "@/lib/photos";
import { prepareStudyImage } from "@/lib/photo-file";
import { supabase } from "@/lib/supabase";
import { demoResources, demoSet, initialProgress } from "@/lib/demo";
import { initials } from "@/lib/profile";
import { LandingPage } from "@/components/design/landing";
import { WorkspaceFrame } from "@/components/design/frame";
import { LiveDashboard } from "@/components/design/dashboard";
import type { Page } from "@/lib/pages";
import {
  chapterStage,
  chapterWork,
  draftRestoredMessage,
  initialQuizStatus,
  mergeDraft,
  noticeClass,
  parseDraft,
  placeHref,
  readPlace,
  shouldLoadAccount,
  type NoticeTone,
  type StudyDraft,
} from "@/lib/place";
import { cardKey, cardOrder, questionsAnswered, recordSession, weakTopics } from "@/lib/progress";
import {
  accuracy,
  canSubmit,
  score,
  type Progress,
  type Question,
  type Resource,
  type StudySet,
} from "@/lib/domain";
const nav = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "My library", icon: FolderOpen },
  { name: "Class library", icon: Users },
  { name: "Flashcards", icon: Layers },
  { name: "Practice quizzes", icon: ClipboardCheck },
  { name: "AI tutor", icon: Sparkles },
  { name: "My progress", icon: TrendingUp },
  { name: "Profile", icon: UserRound },
] as const;
const topics = [
  "Patient assessment",
  "Airway & respiration",
  "Cardiology",
  "Trauma",
  "Medical emergencies",
  "EMS operations",
];
const empty: Progress = { sets: [], mastered: [], attempts: [], messages: [] };
const demoKey = "rescue-demo-v1";
const draftKey = "rescue-draft-v1";
export default function Rescue() {
  const [page, setPage] = useState<Page>("Dashboard"),
    [session, setSession] = useState<Session | null>(null),
    [demo, setDemo] = useState(!supabase),
    [ready, setReady] = useState(false),
    [admin, setAdmin] = useState(false),
    [mobile, setMobile] = useState(false);
  const [resources, setResources] = useState<Resource[]>(demoResources),
    [progress, setProgress] = useState<Progress>(initialProgress),
    [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState(""),
    [tone, setTone] = useState<NoticeTone>("info"),
    [busy, setBusy] = useState(false),
    [saveState, setSaveState] = useState(""),
    [search, setSearch] = useState("");
  const [upload, setUpload] = useState(false),
    [detail, setDetail] = useState<Resource | null>(null),
    [share, setShare] = useState(false),
    [classId, setClassId] = useState(""),
    [rights, setRights] = useState<"original" | "authorized">("original");
  const [selected, setSelected] = useState("demo-set"),
    [resourceId, setResourceId] = useState("demo-assessment"),
    [cardIndex, setCardIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [answers, setAnswers] = useState<number[]>([]),
    [submitted, setSubmitted] = useState(false);
  const [question, setQuestion] = useState(""),
    [pageFrom, setPageFrom] = useState(""),
    [pageTo, setPageTo] = useState(""),
    [quizCount, setQuizCount] = useState<5 | 10 | 20 | 30>(10),
    [quizStyle, setQuizStyle] = useState<"terminology" | "scenarios" | "mixed">(
      "mixed",
    ),
    [quizLevel, setQuizLevel] = useState<
      "basic" | "intermediate" | "advanced"
    >("intermediate"),
    [quizTopic, setQuizTopic] = useState(""),
    [quizMode, setQuizMode] = useState<"practice" | "exam">("practice"),
    [quizScope, setQuizScope] = useState<"material" | "expanded">("material"),
    [learning, setLearning] = useState<"material" | "expanded" | "scenario">("material"),
    [quizMinutes, setQuizMinutes] = useState(0),
    [remaining, setRemaining] = useState<number | null>(null),
    [feedback, setFeedback] = useState<
      Record<
        number,
        {
          correct: boolean;
          explanation: string;
          source: string;
          evidence?: string;
          answer: number;
        }
      >
    >({}),
    [chapterText, setChapterText] = useState<
      { pages: string; content: string }[] | null
    >(null),
    [profile, setProfile] = useState({
      firstName: "",
      lastName: "",
      autoQuiz: true,
      email: "",
    }),
    [noteDraft, setNoteDraft] = useState({ title: "", topic: topics[0], content: "" }),
    [photoFiles, setPhotoFiles] = useState<
      { name: string; blob: Blob; type: string; extension: string }[]
    >([]),
    [photoPages, setPhotoPages] = useState<
      { id: string; page_index: number; ocr_text: string; uncertain: boolean }[]
    >([]),
    [photoEdits, setPhotoEdits] = useState<Record<string, string>>({}),
    [quizActivity, setQuizActivity] = useState<
      Record<string, "generating" | "failed">
    >({}),
    [people, setPeople] = useState<
      { id: string; email: string; enabled: boolean }[]
    >([]),
    [review, setReview] = useState<Resource[]>([]),
    [members, setMembers] = useState<{ user_id: string; class_id: string }[]>(
      [],
    );
  const epoch = useRef(0),
    saveQueue = useRef(Promise.resolve()),
    accessToken = useRef<string | null>(null),
    accountUser = useRef<string | null>(null),
    continuing = useRef(new Set<string>()),
    pendingChapter = useRef<string | null>(null),
    progressRef = useRef(progress),
    resourcesRef = useRef(resources),
    draftWarned = useRef(false);
  progressRef.current = progress;
  resourcesRef.current = resources;
  const current =
    progress.sets.find((s) => s.id === selected) ?? progress.sets[0];
  const orderedCards = current
    ? cardOrder(current.cards, progress.cardMisses, current.id)
    : [];
  const shownIndex = orderedCards[cardIndex] ?? 0;
  const shownCard = current?.cards[shownIndex];
  const accountEmail = profile.email || session?.user.email || "";
  const greeting = demo ? "future responder" : profile.firstName.trim();
  function notify(text: string, next: NoticeTone) {
    setStatus(text);
    setTone(next);
  }
  function clearNotice() {
    setStatus("");
    setTone("info");
  }
  function rememberedDraft(userId: string) {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(draftKey);
    } catch {
      raw = null;
    }
    return parseDraft(raw, userId);
  }
  function restoreDraft(userId: string, saved?: Progress["place"]) {
    const draft = mergeDraft(rememberedDraft(userId), saved, userId);
    if (!draft) return;
    if (draft.selected) setSelected(draft.selected);
    if (draft.resourceId) setResourceId(draft.resourceId);
    if (typeof draft.cardIndex === "number") setCardIndex(draft.cardIndex);
    if (draft.flipped) setFlipped(true);
    if (draft.answers) setAnswers(draft.answers);
    if (draft.submitted) setSubmitted(!!draft.submitted);
    if (draft.quizMode) setQuizMode(draft.quizMode);
    if (draft.note?.title || draft.note?.content) setNoteDraft({
      title: draft.note.title,
      topic: draft.note.topic || topics[0],
      content: draft.note.content,
    });
    const message = draftRestoredMessage(draft);
    if (message) notify(message, "info");
  }
  function quizLine(resource: Resource) {
    const status = initialQuizStatus({
      autoQuiz: profile.autoQuiz,
      hasSavedQuiz: progress.sets.some(
        (set) =>
          set.resourceId === resource.id &&
          set.origin === "auto" &&
          set.questions.length > 0,
      ),
      processing: resource.processing,
      activity: quizActivity[resource.id],
      isChapter: Boolean(
        resource.pages ||
          resource.processing ||
          resource.file_path?.toLowerCase().endsWith(".pdf"),
      ),
    });
    if (status === "ready") return "Initial quiz ready";
    if (status === "generating") return "Initial quiz generating";
    if (status === "failed") return "Initial quiz failed";
    if (status === "pending") return "Initial quiz pending";
    return "";
  }
  function pushPlace(next: Page, chapter?: string | null) {
    const href = placeHref(next, chapter);
    if (window.location.pathname + window.location.search === href) return;
    window.history.pushState(
      { screen: next, chapter: chapter ?? null },
      "",
      href,
    );
  }
  async function load(s: Session | null, isDemo: boolean) {
    const version = ++epoch.current;
    setReady(false);
    clearNotice();
    setAdmin(false);
    setDetail(null);
    setClasses([]);
    setSaveState("");
    setSubmitted(false);
    setAnswers([]);
    setCardIndex(0);
    setFlipped(false);
    if (isDemo) {
      let p = initialProgress,
        r = demoResources;
      try {
        const stored = JSON.parse(localStorage.getItem(demoKey) ?? "null");
        if (stored?.progress?.sets && stored?.resources) {
          p = {
            ...stored.progress,
            sets: stored.progress.sets.map((set: StudySet) =>
              set.id === demoSet.id ? demoSet : set,
            ),
          };
          r = stored.resources;
        }
      } catch {}
      setProgress(p);
      setResources(r);
      setSelected(p.sets[0]?.id ?? "");
      setResourceId(r[0]?.id ?? "");
      restoreDraft("demo");
      const place = readPlace(window.location.search);
      setPage(place.page);
      const chapter = r.find((item) => item.id === (pendingChapter.current || place.chapter));
      if (chapter) setDetail(chapter);
      setReady(true);
      return;
    }
    setProgress(empty);
    setResources([]);
    if (!s || !supabase) {
      setReady(true);
      return;
    }
    const [r, p, c, a, active] = await Promise.all([
      supabase
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("study_state")
        .select("data")
        .eq("user_id", s.user.id)
        .maybeSingle(),
      supabase.from("classes").select("*"),
      supabase.rpc("is_admin"),
      supabase.rpc("is_active"),
    ]);
    if (version !== epoch.current) return;
    if (r.error || p.error || c.error || a.error || active.error) {
      notify(
        "Could not load your account. Check your connection, then refresh. This is a data error, not a sign-out.",
        "error",
      );
      setReady(true);
      return;
    }
    if (!active.data) {
      notify("Your account is disabled. Contact your class administrator.", "warning");
      setReady(true);
      return;
    }
    const next = (p.data?.data as Progress) ?? empty;
    const docs = await supabase
      .from("chapter_documents")
      .select("resource_id,page_count");
    const pages = new Map(
      (docs.error ? [] : (docs.data ?? [])).map((doc) => [
        doc.resource_id,
        doc.page_count,
      ]),
    );
    const jobs = await supabase
      .from("chapter_jobs")
      .select("resource_id,status,error,next_page,page_count");
    const jobMap = new Map(
      (jobs.error ? [] : (jobs.data ?? [])).map((job) => [job.resource_id, job]),
    );
    const account = await supabase
      .from("profiles")
      .select("email,first_name,last_name,auto_quiz")
      .eq("id", s.user.id)
      .maybeSingle();
    if (!account.error && account.data) {
      const nextProfile = {
        firstName: account.data.first_name ?? "",
        lastName: account.data.last_name ?? "",
        autoQuiz: account.data.auto_quiz !== false,
        email: account.data.email ?? s.user.email ?? "",
      };
      const meta = s.user.user_metadata as {
        first_name?: string;
        last_name?: string;
      };
      if (!nextProfile.firstName && meta.first_name && meta.last_name) {
        const saved = await supabase.rpc("save_profile", {
          first_name: meta.first_name,
          last_name: meta.last_name,
        });
        if (!saved.error) {
          nextProfile.firstName = meta.first_name;
          nextProfile.lastName = meta.last_name;
        }
      }
      setProfile(nextProfile);
    }
    const listed = await supabase.rpc("list_study_sets");
    const serverSets: StudySet[] = [];
    if (!listed.error) {
      for (const row of (listed.data ?? []).slice(0, 20)) {
        const options = (row.options ?? {}) as {
          origin?: "auto" | "custom";
          style?: StudySet["style"];
          difficulty?: StudySet["difficulty"];
          partial?: boolean;
          pageStart?: number | null;
          pageEnd?: number | null;
        };
        if (row.kind === "cards") {
          const cards = await supabase.rpc("study_cards", { set_id: row.id });
          serverSets.push({
            id: row.id,
            title: row.title,
            topic: row.topic,
            resourceId: row.resource_id,
            cards: cards.data ?? [],
            questions: [],
            stored: true,
            origin: options.origin,
            style: options.style,
            difficulty: options.difficulty,
          });
        } else {
          const prompts = await supabase.rpc("quiz_prompts", { set_id: row.id });
          serverSets.push({
            id: row.id,
            title: row.title,
            topic: row.topic,
            resourceId: row.resource_id,
            cards: [],
            questions: Array.isArray(prompts.data)
              ? (prompts.data as Question[])
              : [],
            stored: true,
            origin: options.origin,
            style: options.style,
            difficulty: options.difficulty,
            coverage:
              options.pageStart || options.pageEnd
                ? {
                    pageStart: options.pageStart ?? null,
                    pageEnd: options.pageEnd ?? null,
                    partial: !!options.partial,
                  }
                : undefined,
          });
        }
      }
    }
    const loaded = (r.data ?? []).map((item) => {
      const job = jobMap.get(item.id);
      return {
        ...item,
        pages: pages.get(item.id),
        totalPages: job?.page_count || pages.get(item.id),
        processing: job?.status,
        processingError: job?.error || undefined,
        nextPage: job?.next_page,
      };
    });
    const mergedSets = [
      ...serverSets,
      ...next.sets.filter((set) => !serverSets.some((saved) => saved.id === set.id)),
    ];
    setProgress({ ...next, sets: mergedSets });
    setResources(loaded);
    setClasses(c.data ?? []);
    setAdmin(!!a.data);
    setSelected(mergedSets[0]?.id ?? "");
    setResourceId(loaded[0]?.id ?? "");
    restoreDraft(s.user.id, next.place);
    const place = readPlace(window.location.search);
    setPage(place.page);
    const chapter = loaded.find(
      (item) => item.id === (pendingChapter.current || place.chapter),
    );
    if (chapter) setDetail(chapter);
    setReady(true);
  }
  useLayoutEffect(() => {
    const place = readPlace(window.location.search);
    pendingChapter.current = place.chapter;
    setPage(place.page);
    const href = placeHref(place.page, place.chapter);
    if (window.location.pathname + window.location.search !== href)
      window.history.replaceState(
        { screen: place.page, chapter: place.chapter },
        "",
        href,
      );
    const onPop = () => {
      const next = readPlace(window.location.search);
      pendingChapter.current = next.chapter;
      setPage(next.page);
      const match = next.chapter
        ? resourcesRef.current.find((item) => item.id === next.chapter)
        : null;
      setDetail(match ?? null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (!supabase) {
      void load(null, true);
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      accessToken.current = s?.access_token ?? null;
      const action = shouldLoadAccount(
        event,
        accountUser.current,
        s?.user.id ?? null,
      );
      if (action === "ignore") {
        if (s) setSession(s);
        return;
      }
      setSession(s);
      if (action === "signout") {
        accountUser.current = null;
        setDemo(false);
        setTimeout(() => void load(null, false), 0);
        return;
      }
      accountUser.current = s!.user.id;
      setDemo(false);
      setTimeout(() => void load(s, false), 0);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!ready) return;
    const userId = demo ? "demo" : session?.user.id;
    if (!userId) return;
    const draft: StudyDraft = {
      userId,
      selected,
      resourceId,
      cardIndex,
      flipped,
      answers,
      submitted,
      quizMode,
      note: noteDraft,
    };
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      if (!draftWarned.current) {
        draftWarned.current = true;
        notify("This browser could not keep the unsaved draft.", "warning");
      }
    }
  }, [
    ready,
    demo,
    session,
    selected,
    resourceId,
    cardIndex,
    flipped,
    answers,
    submitted,
    quizMode,
    noteDraft,
  ]);
  useEffect(() => {
    if (!ready || demo || !session) return;
    const handle = window.setTimeout(() => {
      const current = progressRef.current;
      const place = {
        setId: selected,
        cardIndex,
        answers,
        submitted,
        quizMode,
      };
      if (JSON.stringify(current.place ?? null) === JSON.stringify(place)) return;
      void persist({ ...current, place });
    }, 700);
    return () => window.clearTimeout(handle);
  }, [ready, demo, session, selected, cardIndex, answers, submitted, quizMode]);
  useEffect(() => {
    if (!pendingChapter.current) return;
    const match = resources.find((item) => item.id === pendingChapter.current);
    if (match) setDetail(match);
  }, [resources]);
  async function persist(next: Progress) {
    setProgress(next);
    setSaveState("Saving…");
    if (demo) {
      try {
        localStorage.setItem(
          demoKey,
          JSON.stringify({ progress: next, resources }),
        );
        setSaveState("Saved on this device");
      } catch {
        notify("Device storage is full. Progress could not be saved.", "error");
        setSaveState("Not saved");
      }
      return;
    }
    if (!supabase || !session) return;
    const id = session.user.id,
      version = epoch.current;
    saveQueue.current = saveQueue.current.then(async () => {
      const { error } = await supabase!.from("study_state").upsert({
        user_id: id,
        data: next,
        updated_at: new Date().toISOString(),
      });
      if (version !== epoch.current) return;
      setSaveState(error ? "Not saved" : "Saved to your account");
      if (error)
        notify(
          "Progress could not be saved. Keep this page open and try another study action to retry.",
          "error",
        );
    });
    await saveQueue.current;
  }
  function storeResources(next: Resource[]) {
    setResources(next);
    if (demo)
      try {
        localStorage.setItem(
          demoKey,
          JSON.stringify({ resources: next, progress }),
        );
      } catch {
        notify("Device storage is full. Your notes could not be saved.", "error");
      }
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    clearNotice();
    try {
      await fn();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Something went wrong. Please try again.";
      const auth = /sign in|session could not be verified/i.test(message);
      notify(message, auth ? "warning" : "error");
    } finally {
      setBusy(false);
    }
  }
  async function currentToken() {
    if (accessToken.current) return accessToken.current;
    if (session?.access_token) {
      accessToken.current = session.access_token;
      return session.access_token;
    }
    const { data } = await supabase!.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (token) accessToken.current = token;
    return token;
  }
  async function api(path: string, body?: unknown, retry = true) {
    const token = await currentToken();
    if (!token) throw new Error("Sign in with an active account to continue.");
    let response: Response;
    try {
      response = await fetch(path, {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new Error(
        "The network was interrupted. Saved progress stays in your account. Try again when you are back online.",
      );
    }
    const json = await response.json();
    if (response.status === 401 && retry) {
      const refreshed = await supabase!.auth.refreshSession();
      const next = refreshed.data.session?.access_token;
      if (next && next !== token) {
        accessToken.current = next;
        setSession(refreshed.data.session);
        return api(path, body, false);
      }
    }
    if (!response.ok) throw new Error(json.error ?? "Request failed.");
    return json;
  }
  function go(next: Page) {
    setPage(next);
    setMobile(false);
    setSearch("");
    clearNotice();
    setDetail(null);
    pendingChapter.current = null;
    pushPlace(next, null);
    if (next === "Admin") void loadAdmin();
  }
  async function signOut() {
    accessToken.current = null;
    setSession(null);
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("sb-") && key.includes("auth-token"))
          localStorage.removeItem(key);
      }
    } catch {}
    await supabase?.auth.signOut({ scope: "local" });
  }
  function openStudy(id: string, next: "Flashcards" | "Practice quizzes" | "AI tutor") {
    const match = progress.sets.find(
      (set) =>
        set.resourceId === id &&
        (next === "Flashcards"
          ? set.cards.length > 0
          : next === "Practice quizzes"
            ? set.questions.length > 0
            : true),
    );
    if (match) setSelected(match.id);
    setResourceId(id);
    setCardIndex(0);
    setFlipped(false);
    setAnswers([]);
    setSubmitted(false);
    setFeedback({});
    go(next);
  }
  function openResource(resource: Resource) {
    setDetail(resource);
    setShare(false);
    setChapterText(null);
    pendingChapter.current = resource.id;
    pushPlace(page, resource.id);
  }
  function closeResource() {
    setDetail(null);
    pendingChapter.current = null;
    pushPlace(page, null);
  }
  async function loadAdmin() {
    if (demo) return;
    await run(async () => {
      const data = await api("/api/admin");
      setPeople(data.people);
      setReview(data.resources);
      setMembers(data.memberships);
    });
  }
  function pageBounds() {
    const bounds: { pageStart?: number; pageEnd?: number } = {};
    if (pageFrom.trim()) bounds.pageStart = Number(pageFrom);
    if (pageTo.trim()) bounds.pageEnd = Number(pageTo);
    if (
      (bounds.pageStart !== undefined && !Number.isInteger(bounds.pageStart)) ||
      (bounds.pageEnd !== undefined && !Number.isInteger(bounds.pageEnd))
    )
      throw new Error("Use whole page numbers.");
    if (bounds.pageStart && bounds.pageEnd && bounds.pageStart > bounds.pageEnd)
      throw new Error("The starting page must be before the ending page.");
    return bounds;
  }
  async function createStudy(
    mode: "cards" | "quiz",
    id = resourceId,
    origin: "auto" | "custom" = "custom",
  ) {
    if (demo) {
      throw new Error(
        "AI generation needs a connected account and a server-side OpenAI key. Try the included sample flashcards and quiz.",
      );
    }
    const version = epoch.current;
    const bounds = pageBounds();
    const result = await api("/api/ai", {
      mode,
      resourceId: id,
      origin,
      count: origin === "auto" ? 10 : mode === "quiz" ? quizCount : 8,
      style:
        origin === "auto"
          ? "mixed"
          : quizScope === "expanded" && mode === "quiz"
            ? "scenarios"
            : quizStyle,
      scope: origin === "auto" || mode !== "quiz" ? "material" : quizScope,
      difficulty: origin === "auto" ? "intermediate" : quizLevel,
      topic: quizTopic.trim() || undefined,
      avoid:
        origin === "auto" || mode !== "quiz"
          ? undefined
          : progressRef.current.sets
              .filter((set) => set.resourceId === id)
              .flatMap((set) => set.questions.map((item) => item.question.trim().slice(0, 180)))
              .filter(Boolean)
              .slice(0, 12),
      ...bounds,
    });
    if (result.duplicate || result.skipped) {
      setQuizActivity((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      notify(
        result.skipped
          ? "Automatic quizzes are off, so no quiz was created."
          : "An initial quiz already exists for this chapter.",
        "info",
      );
      return;
    }
    if (version !== epoch.current) return;
    const source = resources.find((item) => item.id === id);
    const set = result.set as StudySet;
    const next: StudySet = {
      ...set,
      id: result.setId ?? crypto.randomUUID(),
      topic: source?.topic ?? set.topic ?? "Study",
      resourceId: id,
      origin,
      stored: Boolean(result.setId),
      style: quizStyle,
      difficulty: quizLevel,
      coverage: result.coverage,
      questions: (result.prompts ?? set.questions ?? []) as Question[],
      cards: mode === "quiz" && result.setId ? [] : set.cards,
    };
    const latest = progressRef.current;
    const savedProgress = recordSession(
      { ...latest, sets: [next, ...latest.sets.filter((item) => item.id !== next.id)] },
      { kind: mode === "cards" ? "cards" : "quiz", topic: next.topic },
    );
    await persist(savedProgress);
    setSelected(next.id);
    setCardIndex(0);
    setFlipped(false);
    setAnswers([]);
    setSubmitted(false);
    setFeedback({});
    setDetail(null);
    pendingChapter.current = null;
    const nextPage = mode === "cards" ? "Flashcards" : "Practice quizzes";
    setPage(nextPage);
    pushPlace(nextPage, null);
    if (mode === "quiz" && quizMode === "exam" && quizMinutes > 0)
      setRemaining(quizMinutes * 60);
    const coverage = result.coverage as StudySet["coverage"];
    setQuizActivity((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    notify(
      coverage?.partial
        ? `Saved. This set covers pages ${coverage.pageStart}–${coverage.pageEnd} only. Choose a later page range for the rest. Review it before you rely on it.`
        : "Saved. Review it against the cited source before you rely on it.",
      coverage?.partial ? "warning" : "success",
    );
  }
  async function generate(
    mode: "cards" | "quiz",
    id = resourceId,
    origin: "auto" | "custom" = "custom",
  ) {
    await run(() => createStudy(mode, id, origin));
  }
  async function readChapter(resource: Resource, retry = false) {
    if (continuing.current.has(resource.id)) return;
    continuing.current.add(resource.id);
    try {
      await readChapterJob(resource, retry);
    } finally {
      continuing.current.delete(resource.id);
    }
  }
  async function readChapterJob(resource: Resource, retry = false) {
    let extracted: {
      status?: string;
      unchanged?: boolean;
      pageCount?: number;
      nextPage?: number;
      ocr?: boolean;
      error?: string;
      title?: string;
    } | null = null;
    for (let step = 0; step < 2000; step += 1) {
      extracted = await api("/api/chapters", {
        resourceId: resource.id,
        retry,
      });
      retry = false;
      const status = extracted?.status ?? "ready";
      const stage: Resource["stage"] =
        status === "ready"
          ? "ready"
          : status === "failed"
            ? "failed"
            : extracted?.ocr
              ? "ocr"
              : "extracting";
      const saved: Resource = {
        ...resource,
        title: extracted?.title || resource.title,
        pages: status === "ready" ? extracted?.pageCount : resource.pages,
        totalPages: extracted?.pageCount || resource.totalPages,
        processing: status as Resource["processing"],
        nextPage: extracted?.nextPage,
        processingError: extracted?.error,
        stage,
      };
      setResources((current) =>
        current.some((item) => item.id === resource.id)
          ? current.map((item) =>
              item.id === resource.id ? { ...item, ...saved, content: item.content } : item,
            )
          : [{ ...saved, content: resource.content }, ...current],
      );
      setDetail((current) =>
        current?.id === resource.id ? { ...current, ...saved, content: current.content } : current,
      );
      if (status === "failed")
        throw new Error(extracted?.error || "The chapter could not be read.");
      if (status === "processing" || status === "uploaded") {
        const work = chapterWork({
          processing: status,
          nextPage: extracted?.nextPage,
          totalPages: extracted?.pageCount,
        });
        notify(
          work
            ? `${extracted?.ocr ? "Reading scanned pages" : "Extracting text"} · ${work.done} of ${work.total} pages complete. You can leave this page and come back.`
            : "Processing this chapter. You can leave this page and come back.",
          "info",
        );
        continue;
      }
      notify(
        extracted?.unchanged
          ? `This chapter is already ready${extracted.pageCount ? `, ${extracted.pageCount} pages` : ""}. It was not processed again.`
          : `Private chapter ready${extracted?.pageCount ? `, ${extracted.pageCount} pages` : ""}. The extracted text stays in your account.`,
        "success",
      );
      break;
    }
    if (
      extracted?.status === "ready" &&
      !extracted.unchanged &&
      profile.autoQuiz &&
      !progressRef.current.sets.some(
        (set) => set.resourceId === resource.id && set.origin === "auto",
      )
    ) {
      setQuizActivity((current) => ({ ...current, [resource.id]: "generating" }));
      notify("Chapter ready. Creating the first 10-question quiz…", "info");
      try {
        await createStudy("quiz", resource.id, "auto");
      } catch (error) {
        setQuizActivity((current) => ({ ...current, [resource.id]: "failed" }));
        throw error;
      }
    }
  }
  async function readPhotoSet(resource: Resource, retry = false) {
    if (continuing.current.has(resource.id)) return;
    continuing.current.add(resource.id);
    try {
      let extracted: {
        status?: string;
        unchanged?: boolean;
        pageCount?: number;
        nextPage?: number;
        title?: string;
      } | null = null;
      for (let step = 0; step < MAX_PHOTOS + 2; step += 1) {
        extracted = await api("/api/photos", { resourceId: resource.id, retry });
        retry = false;
        const status = extracted?.status ?? "ready";
        const saved: Resource = {
          ...resource,
          title: extracted?.title || resource.title,
          pages: status === "ready" ? extracted?.pageCount : resource.pages,
          totalPages: extracted?.pageCount || resource.totalPages,
          processing: status as Resource["processing"],
          nextPage: extracted?.nextPage,
          stage: status === "ready" ? "ready" : "ocr",
        };
        setResources((current) =>
          current.map((item) => (item.id === resource.id ? { ...item, ...saved } : item)),
        );
        setDetail((current) =>
          current?.id === resource.id ? { ...current, ...saved } : current,
        );
        if (status === "failed") throw new Error("A photo could not be read.");
        if (status === "processing" || status === "uploaded") {
          const work = chapterWork(saved);
          notify(
            work
              ? `Reading photo ${work.done + 1} of ${work.total}. You can leave this page and come back.`
              : "Reading your photos. You can leave this page and come back.",
            "info",
          );
          continue;
        }
        notify(
          extracted?.unchanged
            ? "These photos are already ready and were not read again."
            : "Photos ready. Review the recognized text before you study from it.",
          "success",
        );
        break;
      }
      if (
        extracted?.status === "ready" &&
        !extracted.unchanged &&
        profile.autoQuiz &&
        !progressRef.current.sets.some(
          (set) => set.resourceId === resource.id && set.origin === "auto",
        )
      ) {
        setQuizActivity((current) => ({ ...current, [resource.id]: "generating" }));
        notify("Photos ready. Creating the first 10-question quiz…", "info");
        try {
          await createStudy("quiz", resource.id, "auto");
        } catch (error) {
          setQuizActivity((current) => ({ ...current, [resource.id]: "failed" }));
          throw error;
        }
      }
    } finally {
      continuing.current.delete(resource.id);
    }
  }
  useEffect(() => {
    if (!ready || demo || !session) return;
    const active = resources.find(
      (item) =>
        (item.processing === "processing" || item.processing === "uploaded") &&
        !continuing.current.has(item.id),
    );
    if (!active) return;
    if (/\.(jpe?g|png)$/i.test(active.file_path ?? "")) void readPhotoSet(active);
    else if (active.file_path?.toLowerCase().endsWith(".pdf")) void readChapter(active);
  }, [ready, demo, session, resources]);
  useEffect(() => {
    if (!detail || demo || !supabase) {
      setPhotoPages([]);
      return;
    }
    const resourceId = detail.id;
    void supabase
      .from("resource_pages")
      .select("id,page_index,ocr_text,uncertain")
      .eq("resource_id", resourceId)
      .order("page_index")
      .then(({ data }) => {
        const pages = data ?? [];
        setPhotoPages(pages);
        setPhotoEdits(
          Object.fromEntries(pages.map((page) => [page.id, page.ocr_text])),
        );
      });
  }, [detail, demo]);
  async function onPickPhotos(list: FileList | null) {
    if (!list?.length) return;
    try {
      const next = [...photoFiles];
      for (const file of Array.from(list)) {
        if (next.length >= MAX_PHOTOS)
          throw new Error(`A photo set can include up to ${MAX_PHOTOS} photos.`);
        const prepared = await prepareStudyImage(file);
        next.push({
          name: file.name,
          blob: prepared.blob,
          type: prepared.type,
          extension: prepared.extension,
        });
      }
      const problem = photoSetProblem(next.map((item) => ({ size: item.blob.size })));
      if (problem) throw new Error(problem);
      setPhotoFiles(next);
      setUpload(true);
      notify(`${next.length} photo${next.length === 1 ? "" : "s"} ready to save, in the order shown.`, "info");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "That photo could not be added.",
        "error",
      );
    }
  }
  async function savePhotoText(pageId: string) {
    await run(async () => {
      if (demo) throw new Error("Photo corrections are saved after you sign in.");
      const body = photoEdits[pageId]?.trim() ?? "";
      if (!body) throw new Error("Enter the corrected text before saving.");
      const { error } = await supabase!.rpc("save_page_text", {
        page_id: pageId,
        body,
      });
      if (error)
        throw new Error(
          "The correction could not be saved. Run supabase/photos.sql once if photo storage is not set up yet.",
        );
      setPhotoPages((pages) =>
        pages.map((page) =>
          page.id === pageId
            ? {
                ...page,
                ocr_text: body,
                uncertain: /\[unclear\]|uncertain reading/i.test(body),
              }
            : page,
        ),
      );
      notify("Corrected text saved for this photo.", "success");
    });
  }
  async function addResource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      if (!String(form.get("title") ?? "").trim())
        throw new Error("Give your resource a title.");
      let content = String(form.get("content") ?? "").trim();
      const file = form.get("file") as File;
      let file_path: string | null = null;
      if (file?.size) {
        if (file.size > MAX_UPLOAD_BYTES)
          throw new Error("Choose a file smaller than 50 MB.");
        if (!/\.(pdf|txt|md)$/i.test(file.name))
          throw new Error("Use PDF, TXT, or Markdown.");
        if (/\.(txt|md)$/i.test(file.name))
          content = [content, await file.text()].filter(Boolean).join("\n\n");
      }
      if (content.length > 30000)
        throw new Error(
          "Keep notes under 30,000 characters. Split larger notes into separate resources.",
        );
      if (!content && !file?.size && !photoFiles.length)
        throw new Error("Add notes, a file, or photos.");
      if (photoFiles.length && file?.size)
        throw new Error("Add photos or a document, not both, so the page order stays clear.");
      const photoLimit = photoSetProblem(photoFiles.map((item) => ({ size: item.blob.size })));
      if (photoFiles.length && photoLimit) throw new Error(photoLimit);
      if (demo && (photoFiles.length || (file?.size && /\.pdf$/i.test(file.name))))
        throw new Error(
          "Photo and PDF storage require a connected account. Paste text notes to try the demo.",
        );
      const photoPaths: string[] = [];
      if (!demo && photoFiles.length) {
        notify(
          "Uploading your photos. Keep this tab open until the upload finishes. An interrupted upload has to be started again.",
          "info",
        );
        for (const photo of photoFiles) {
          const path = `${session!.user.id}/${crypto.randomUUID()}.${photo.extension}`;
          const { error } = await supabase!.storage
            .from("private-materials")
            .upload(path, photo.blob, { contentType: photo.type, upsert: false });
          if (error) {
            if (photoPaths.length)
              await supabase!.storage.from("private-materials").remove(photoPaths);
            throw error;
          }
          photoPaths.push(path);
        }
        file_path = photoPaths[0];
        if (!content)
          content = "Photo study set. Recognized text stays private with each photo.";
      }
      if (!demo && file?.size) {
        notify(
          "Uploading your file. Keep this tab open until it finishes. An interrupted upload has to be started again.",
          "info",
        );
        file_path = `${session!.user.id}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase()}`;
        const { error } = await supabase!.storage
          .from("private-materials")
          .upload(file_path, file, {
            contentType: /\.pdf$/i.test(file.name)
              ? "application/pdf"
              : /\.md$/i.test(file.name)
                ? "text/markdown"
                : "text/plain",
            upsert: false,
          });
        if (error) throw error;
      }
      const r: Resource = {
        id: crypto.randomUUID(),
        owner_id: demo ? "demo" : session!.user.id,
        title: String(form.get("title")).trim(),
        topic: String(form.get("topic")),
        content,
        file_path,
        visibility: "private",
        rights: "private",
      };
      if (!demo) {
        const { error } = await supabase!.from("resources").insert(r);
        if (error) {
          const paths = photoPaths.length ? photoPaths : file_path ? [file_path] : [];
          if (paths.length)
            await supabase!.storage.from("private-materials").remove(paths);
          throw error;
        }
        if (photoPaths.length) {
          const pages = await supabase!.from("resource_pages").insert(
            photoPaths.map((path, index) => ({
              resource_id: r.id,
              page_index: index,
              storage_path: path,
            })),
          );
          if (pages.error) {
            await supabase!.from("resources").delete().eq("id", r.id);
            await supabase!.storage.from("private-materials").remove(photoPaths);
            throw new Error(
              "Photo storage is not set up yet. Run supabase/photos.sql once in the Supabase SQL editor, then try again.",
            );
          }
        }
      }
      const saved = [r, ...resources];
      storeResources(saved);
      setResourceId(r.id);
      setUpload(false);
      setNoteDraft({ title: "", topic: topics[0], content: "" });
      setPhotoFiles([]);
      setPage("My library");
      pushPlace("My library", null);
      if (!demo && photoPaths.length) await readPhotoSet({ ...r, totalPages: photoPaths.length, processing: "uploaded" });
      else if (!demo && file_path?.toLowerCase().endsWith(".pdf"))
        await readChapter(r);
      else notify("Resource saved privately.", "success");
    });
  }
  async function submitShare() {
    await run(async () => {
      if (demo)
        throw new Error(
          "Class submissions are available after connecting Supabase.",
        );
      if (!detail || !canSubmit(rights, classId))
        throw new Error("Choose a class and confirm sharing rights.");
      if (photoPages.length)
        throw new Error(
          "Photo sets stay private. Share only notes you typed yourself, not photos or recognized textbook text.",
        );
      const { error } = await supabase!.rpc("submit_resource", {
        rid: detail.id,
        cid: classId,
        declared_rights: rights,
      });
      if (error) throw error;
      setDetail(null);
      pendingChapter.current = null;
      setShare(false);
      await load(session, false);
      notify(
        "A separate text copy was submitted for admin review. Your file stays private.",
        "success",
      );
    });
  }
  async function removeResource(r: Resource) {
    await run(async () => {
      if (!demo) {
        const pages = await supabase!
          .from("resource_pages")
          .select("storage_path")
          .eq("resource_id", r.id);
        const paths = [
          ...(r.file_path ? [r.file_path] : []),
          ...((pages.data ?? []).map((page) => page.storage_path) as string[]),
        ];
        if (paths.length) {
          const { error } = await supabase!.storage
            .from("private-materials")
            .remove([...new Set(paths)]);
          if (error) throw error;
        }
        const { error } = await supabase!
          .from("resources")
          .delete()
          .eq("id", r.id);
        if (error) throw error;
      }
      storeResources(resources.filter((x) => x.id !== r.id));
      setDetail(null);
    });
  }
  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    await run(async () => {
      if (demo)
        throw new Error(
          "The live tutor requires Supabase and a server-side OpenAI key. No simulated AI answers are shown.",
        );
      const version = epoch.current;
      const history = progress.messages
        .filter((item) => !item.resourceId || item.resourceId === resourceId)
        .slice(-4)
        .map((item) => ({ role: item.role, text: item.text.slice(0, 800) }));
      const result = await api("/api/ai", {
        mode: "tutor",
        resourceId,
        message: text,
        history,
        learning,
      });
      if (version !== epoch.current) return;
      await persist({
        ...progress,
        messages: [
          ...progress.messages,
          { role: "user" as const, text, resourceId },
          {
            role: "assistant" as const,
            resourceId,
            text: `${result.text}\n\nSource: ${result.source}`,
          },
        ].slice(-40),
      });
      setQuestion("");
    });
  }
  async function finishQuiz() {
    if (!current) return;
    const choices = current.questions.map((_, index) =>
      answers[index] === undefined ? -1 : answers[index],
    );
    let correct = score(current.questions, answers);
    let missed =
      current.questions.flatMap((item, index) =>
        item.answer !== undefined && item.answer !== answers[index]
          ? [
              {
                question: item.question,
                explanation: item.explanation,
                source: item.source,
              },
            ]
          : [],
      );
    if (current.stored) {
      const graded = await api("/api/study", {
        action: "grade",
        setId: current.id,
        choices,
      });
      correct = graded.correct as number;
      missed = (graded.review ?? [])
        .filter((item: { correct?: boolean }) => !item.correct)
        .map(
          (item: {
            question: string;
            explanation: string;
            source: string;
          }) => item,
        );
      setFeedback(
        Object.fromEntries(
          (graded.review ?? []).map(
            (item: {
              index: number;
              correct: boolean;
              explanation: string;
              source: string;
              evidence?: string;
              answer: number;
            }) => [item.index, item],
          ),
        ),
      );
    }
    await persist(
      recordSession(
        {
          ...progress,
          attempts: [
            {
              id: crypto.randomUUID(),
              topic: current.topic,
              resourceTitle: resources.find((item) => item.id === current.resourceId)
                ?.title,
              setId: current.id,
              mode: quizMode,
              correct,
              total: current.questions.length,
              date: new Date().toISOString(),
              missed,
            },
            ...progress.attempts,
          ],
          missed: [
            ...missed.map((item) => ({
              ...item,
              id: crypto.randomUUID(),
              topic: current.topic,
              date: new Date().toISOString(),
            })),
            ...(progress.missed ?? []),
          ].slice(0, 50),
        },
        { kind: "quiz", topic: current.topic },
      ),
    );
    setSubmitted(true);
    setRemaining(null);
  }
  useEffect(() => {
    if (
      page !== "Practice quizzes" ||
      quizMode !== "exam" ||
      submitted ||
      remaining === null
    )
      return;
    if (remaining <= 0) {
      void run(() => finishQuiz());
      return;
    }
    const timer = window.setTimeout(
      () => setRemaining((value) => (value === null ? null : value - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [page, quizMode, submitted, remaining]);
  const privateResources = resources.filter((r) => r.visibility === "private");
  const studyDays = new Set(progress.attempts.map((a) => a.date.slice(0, 10)))
    .size;
  const totalCards = progress.sets.reduce((n, s) => n + s.cards.length, 0);
  const featured =
    privateResources.find((resource) => chapterWork(resource)) ??
    privateResources[0];
  const featuredWork = featured ? chapterWork(featured) : null;
  const featuredPercent = featuredWork
    ? Math.round((featuredWork.done / featuredWork.total) * 100)
    : null;
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const total = progress.attempts
      .filter((attempt) => {
        const parsed = new Date(attempt.date);
        if (Number.isNaN(parsed.getTime())) return attempt.date.slice(0, 10) === key;
        const attemptKey = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
        return attemptKey === key;
      })
      .reduce((sum, attempt) => sum + attempt.total, 0);
    return {
      label: day.toLocaleDateString(undefined, { weekday: "narrow" }),
      total,
    };
  });
  const recentActivity = [...progress.attempts]
    .reverse()
    .slice(0, 4)
    .map((attempt) => ({
      title: attempt.resourceTitle || attempt.topic || "Quiz",
      detail: `${attempt.correct} of ${attempt.total} correct`,
      when: new Date(attempt.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      score: attempt.total
        ? `${Math.round((attempt.correct / attempt.total) * 100)}%`
        : "—",
    }));
  const weakest = weakTopics(progress.attempts)[0]?.topic ?? null;
  function resourceSelector() {
    return (
      <label className="field">
        Study source
        <select
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
        >
          <option value="" disabled>
            Select saved text or a chapter
          </option>
          {resources
            .filter((r) => r.content.length >= 20 || (r.pages ?? 0) > 0)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.pages ? `${r.title} · ${r.pages} pages` : r.title}
              </option>
            ))}
        </select>
      </label>
    );
  }
  function materialLinks(id: string) {
    if (!id) return null;
    return (
      <div className="study-links">
        <button type="button" onClick={() => openStudy(id, "Flashcards")}>
          Flashcards
        </button>
        <button type="button" onClick={() => openStudy(id, "Practice quizzes")}>
          Quiz
        </button>
        <button type="button" onClick={() => openStudy(id, "AI tutor")}>
          Ask RESCUE
        </button>
      </div>
    );
  }
  function setSelector() {
    return (
      <label className="field">
        Your study sets
        <select
          value={current?.id ?? ""}
          onChange={(e) => {
            setSelected(e.target.value);
            setCardIndex(0);
            setFlipped(false);
            setAnswers([]);
            setSubmitted(false);
          }}
        >
          {!progress.sets.length && <option>No study sets yet</option>}
          {progress.sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (ready && !demo && !session)
    return (
      <LandingPage
        onDemo={() => {
          setDemo(true);
          void load(null, true);
        }}
        auth={
          <Auth
            onDemo={() => {
              setDemo(true);
              void load(null, true);
            }}
          />
        }
      />
    );
  return (
    <WorkspaceFrame
      page={page}
      firstName={profile.firstName || "Student"}
      lastName={profile.lastName || ""}
      subtitle={demo ? "Explore RESCUE" : accountEmail || "EMT student"}
      initials={initials(profile)}
      admin={admin}
      mobile={mobile}
      setMobile={setMobile}
      onNavigate={go}
      onSignOut={() => {
        if (demo) {
          setDemo(false);
          void load(null, false);
          return;
        }
        void signOut();
      }}
    >
          <div className="demo-banner">
            {demo ? (
              <>
                <span>
                  <Sparkles size={15} /> DEMO MODE
                </span>{" "}
                Original sample content · Progress stays in this browser
              </>
            ) : (
              <>
                <span>
                  <LockKeyhole size={15} /> YOUR WORKSPACE
                </span>{" "}
                Personal files and study progress are private
              </>
            )}
            <button
              onClick={() =>
                demo
                  ? notify(
                      "To enable accounts and AI, follow README.md in the project folder.",
                      "info",
                    )
                  : go("Class library")
              }
            >
              {demo ? "Setup details" : "Class library"}
              <ArrowRight size={14} />
            </button>
          </div>
          {status && (
            <div className={noticeClass(tone)} role={tone === "error" ? "alert" : "status"}>
              <span>{status}</span>
              <button
                className="icon-button"
                onClick={() => clearNotice()}
                aria-label="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!ready ? (
            <div className="empty">Loading your workspace…</div>
          ) : (
            <>
              {page === "Dashboard" && (
                <LiveDashboard
                  firstName={greeting || "there"}
                  onLibrary={() => go("My library")}
                  onContinue={() => {
                    if (featured) openResource(featured);
                    else setUpload(true);
                  }}
                  continueTitle={featured?.title ?? "Add your first chapter"}
                  continueDetail={
                    featured
                      ? featured.topic || "Private study material"
                      : "Upload a chapter or photos to start a study set."
                  }
                  continuePercent={featuredPercent}
                  continueNote={
                    featuredWork
                      ? `${featuredWork.done} of ${featuredWork.total} pages ready`
                      : featured
                        ? "Open this material to study, quiz, or make flashcards."
                        : "Your library is empty."
                  }
                  metrics={[
                    {
                      label: "Study days",
                      value: String(studyDays),
                      detail: "Days with a completed quiz",
                      accent: "coral",
                    },
                    {
                      label: "Questions",
                      value: String(questionsAnswered(progress.attempts)),
                      detail: "Answered across your quizzes",
                      accent: "blue",
                    },
                    {
                      label: "Accuracy",
                      value: progress.attempts.length
                        ? `${accuracy(progress.attempts)}%`
                        : "—",
                      detail: progress.attempts.length
                        ? "Across completed quizzes"
                        : "Finish a quiz to see accuracy",
                      accent: "mint",
                    },
                    {
                      label: "Cards",
                      value: String(progress.mastered.length),
                      detail: `${totalCards} in your study sets`,
                      accent: "violet",
                    },
                  ]}
                  activity={recentActivity}
                  week={week}
                  weakTopic={weakest}
                  onReviewWeak={() => {
                    if (weakest) setQuizTopic(weakest);
                    go("Practice quizzes");
                  }}
                  onProgress={() => go("My progress")}
                />
              )}
              {(page === "My library" || page === "Class library") && (
                <>
                  <Heading
                    eyebrow={
                      page === "My library"
                        ? "YOUR STUDY MATERIALS"
                        : "LEARN TOGETHER"
                    }
                    title={
                      page === "My library" ? "My Library" : "Class library"
                    }
                    text={
                      page === "My library"
                        ? "Everything you need, organized in one place."
                        : "Original and authorized text resources, reviewed before sharing."
                    }
                    action={
                      page === "My library" ? (
                        <button
                          className="button primary"
                          onClick={() => setUpload(true)}
                        >
                          <Upload size={17} />
                          Add material
                        </button>
                      ) : undefined
                    }
                  />
                  {page === "My library" && (
                    <div className="button-row">
                      <label className="button secondary">
                        <Camera size={16} />
                        Take photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          hidden
                          onChange={(event) => {
                            void onPickPhotos(event.target.files);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <label className="button secondary">
                        <Upload size={16} />
                        Upload photos
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
                          multiple
                          hidden
                          onChange={(event) => {
                            void onPickPhotos(event.target.files);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  )}
                  <div className="library-tools">
                    <label className="search">
                      <Search size={18} />
                      <input
                        aria-label="Search resources"
                        placeholder="Search your resources…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <span className="muted">
                      {page === "My library"
                        ? privateResources.length
                        : resources.filter((r) => r.visibility === "class")
                            .length}{" "}
                      resources
                    </span>
                  </div>
                  <div className="resource-grid">
                    {resources
                      .filter(
                        (r) =>
                          r.visibility ===
                            (page === "My library" ? "private" : "class") &&
                          `${r.title} ${r.topic}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((r) => (
                        <button
                          className="resource-card"
                          key={r.id}
                          onClick={() => openResource(r)}
                        >
                          <div className="resource-top">
                            <span className="topic-icon">
                              <FileText />
                            </span>
                            <span className="badge">
                              {r.visibility === "private" ? (
                                <LockKeyhole size={12} />
                              ) : (
                                <ShieldCheck size={12} />
                              )}{" "}
                              {r.visibility === "private"
                                ? "Private"
                                : "Approved"}
                            </span>
                          </div>
                          <span className="eyebrow">{r.topic}</span>
                          <h3>{r.title}</h3>
                          <p>
                            {r.processing === "failed"
                              ? r.processingError || "Processing failed. Open the chapter to retry."
                              : (r.processing === "processing" || r.processing === "uploaded") &&
                                  chapterWork(r)
                                ? `${chapterWork(r)!.done} of ${chapterWork(r)!.total} pages complete`
                                : r.pages
                                  ? `Private chapter · ${r.pages} pages`
                                  : r.content.slice(0, 120) ||
                                    "Private file · add text notes for AI study"}
                          </p>
                          {(r.processing === "processing" || r.processing === "uploaded") &&
                            chapterWork(r) && (
                            <div
                              className="work-meter"
                              aria-label={`${chapterWork(r)!.done} of ${chapterWork(r)!.total} pages complete`}
                            >
                              <span
                                style={{
                                  width: `${(chapterWork(r)!.done / chapterWork(r)!.total) * 100}%`,
                                }}
                              />
                            </div>
                          )}
                          <div className="resource-footer">
                            <span className={`stage stage-${(r.stage || r.processing || (r.pages ? "ready" : "saved")).replace(/\s/g, "")}`}>
                              {chapterStage(r)}
                              {quizLine(r) ? ` · ${quizLine(r)}` : ""}
                            </span>
                            <ArrowRight size={18} />
                          </div>
                        </button>
                      ))}
                  </div>
                  {!resources.some(
                    (r) =>
                      r.visibility ===
                      (page === "My library" ? "private" : "class"),
                  ) && (
                    <Empty
                      icon={<BookOpen />}
                      title={
                        page === "My library"
                          ? "Your library starts with one note."
                          : "Your class library is getting started."
                      }
                      text={
                        page === "My library"
                          ? "Add notes, a chapter PDF, or photos. Open the item to make a quiz, flashcards, or ask RESCUE about it. Do not upload patient information."
                          : "Ask your administrator to add you to a class. Submit original notes from your private library for review."
                      }
                    />
                  )}
                </>
              )}
              {(page === "Flashcards" || page === "Practice quizzes") && (
                <>
                  <Heading
                    eyebrow={
                      page === "Flashcards"
                        ? "ACTIVE RECALL, MADE EASIER"
                        : "BUILD EXAM CONFIDENCE"
                    }
                    title={
                      page === "Flashcards" ? "Flashcards" : "Practice tests"
                    }
                    text={
                      page === "Flashcards"
                        ? "Turn your chapters into cards you can flip, mark, and revisit."
                        : "Challenge what you know. Learn from every answer."
                    }
                  />
                  <div className="study-toolbar">
                    {setSelector()}
                    {resourceSelector()}
                    {resources.some(
                      (r) => r.id === resourceId && (r.pages ?? 0) > 0,
                    ) && (
                      <>
                        <label className="field">
                          From page
                          <input
                            inputMode="numeric"
                            value={pageFrom}
                            placeholder="1"
                            onChange={(e) => setPageFrom(e.target.value)}
                          />
                        </label>
                        <label className="field">
                          Through page
                          <input
                            inputMode="numeric"
                            value={pageTo}
                            placeholder="All"
                            onChange={(e) => setPageTo(e.target.value)}
                          />
                        </label>
                      </>
                    )}
                    {page === "Practice quizzes" && (
                      <>
                        <label className="field">
                          Questions
                          <select
                            value={quizCount}
                            onChange={(e) =>
                              setQuizCount(Number(e.target.value) as 5 | 10 | 20 | 30)
                            }
                          >
                            {[5, 10, 20, 30].map((count) => (
                              <option key={count} value={count}>
                                {count}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          Type
                          <select
                            value={quizStyle}
                            onChange={(e) =>
                              setQuizStyle(
                                e.target.value as "terminology" | "scenarios" | "mixed",
                              )
                            }
                          >
                            <option value="mixed">Mixed</option>
                            <option value="terminology">Terminology</option>
                            <option value="scenarios">Scenarios</option>
                          </select>
                        </label>
                        <label className="field">
                          Scenario source
                          <select
                            value={quizScope}
                            onChange={(event) =>
                              setQuizScope(event.target.value as "material" | "expanded")
                            }
                          >
                            <option value="material">My material only</option>
                            <option value="expanded">
                              Expanded, with retrieved references
                            </option>
                          </select>
                        </label>
                        <label className="field">
                          Difficulty
                          <select
                            value={quizLevel}
                            onChange={(e) =>
                              setQuizLevel(
                                e.target.value as
                                  | "basic"
                                  | "intermediate"
                                  | "advanced",
                              )
                            }
                          >
                            <option value="basic">Basic</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        </label>
                        <label className="field">
                          Topic
                          <input
                            value={quizTopic}
                            placeholder="Optional"
                            maxLength={80}
                            onChange={(e) => setQuizTopic(e.target.value)}
                          />
                        </label>
                        <label className="field">
                          Mode
                          <select
                            value={quizMode}
                            onChange={(e) => {
                              const mode = e.target.value as "practice" | "exam";
                              setQuizMode(mode);
                              setSubmitted(false);
                              setAnswers([]);
                              setFeedback({});
                              setRemaining(
                                mode === "exam" && quizMinutes > 0
                                  ? quizMinutes * 60
                                  : null,
                              );
                            }}
                          >
                            <option value="practice">Practice</option>
                            <option value="exam">Exam</option>
                          </select>
                        </label>
                        {quizMode === "exam" && (
                          <label className="field">
                            Timer
                            <select
                              value={quizMinutes}
                              onChange={(e) => {
                                const minutes = Number(e.target.value);
                                setQuizMinutes(minutes);
                                setRemaining(minutes > 0 ? minutes * 60 : null);
                              }}
                            >
                              <option value={0}>No timer</option>
                              <option value={10}>10 minutes</option>
                              <option value={20}>20 minutes</option>
                              <option value={30}>30 minutes</option>
                            </select>
                          </label>
                        )}
                      </>
                    )}
                    <button
                      className="button primary"
                      disabled={busy || !resourceId}
                      onClick={() =>
                        void generate(page === "Flashcards" ? "cards" : "quiz")
                      }
                    >
                      <Sparkles size={16} />
                      {busy
                        ? "Reading your source…"
                        : page === "Flashcards"
                          ? "Generate flashcards"
                          : "Generate quiz"}
                    </button>
                  </div>
                  {!current ? (
                    <Empty
                      icon={<Layers />}
                      title="Build your first study set."
                      text="Save text notes in your library, then select them above to generate flashcards and a quiz."
                    />
                  ) : page === "Flashcards" ? (
                    <section className="flashcard-section">
                      <div className="study-meta">
                        <span>{current.title}</span>
                        <span>
                          {cardIndex + 1} / {current.cards.length}
                          {shownCard &&
                          (progress.cardMisses?.[
                            cardKey(current.id, shownCard, shownIndex)
                          ] ?? 0) > 0
                            ? " · Needs practice"
                            : ""}
                        </span>
                      </div>
                      {materialLinks(current.resourceId)}
                      <button
                        className={`flashcard ${flipped ? "flipped" : ""}`}
                        onClick={() => setFlipped(!flipped)}
                        aria-label={flipped ? "Show question" : "Reveal answer"}
                      >
                        <span className="eyebrow">
                          {flipped ? "THE ANSWER" : "THINK IT THROUGH"}
                        </span>
                        <h2>
                          {flipped ? shownCard?.back : shownCard?.front}
                        </h2>
                        <span className="muted">
                          {flipped
                            ? shownCard?.source
                            : "Click, or press space, to reveal the answer"}
                        </span>
                      </button>
                      {flipped && shownCard?.evidence && (
                        <details className="source-evidence">
                          <summary>Supporting passage</summary>
                          <blockquote>{shownCard.evidence}</blockquote>
                          <small>
                            AI-generated. Review this passage before you rely on
                            the card.
                          </small>
                        </details>
                      )}
                      <div className="card-controls">
                        <button
                          className="button secondary"
                          disabled={cardIndex === 0}
                          onClick={() => {
                            setCardIndex(cardIndex - 1);
                            setFlipped(false);
                          }}
                        >
                          <ChevronLeft size={17} />
                          Previous
                        </button>
                        <button
                          className="button secondary"
                          disabled={busy || !shownCard}
                          onClick={() =>
                            void run(async () => {
                              if (!shownCard) return;
                              const key = cardKey(current.id, shownCard, shownIndex);
                              const misses = { ...(progress.cardMisses ?? {}) };
                              misses[key] = (misses[key] ?? 0) + 1;
                              await persist(
                                recordSession(
                                  {
                                    ...progress,
                                    mastered: progress.mastered.filter(
                                      (item) => item !== key,
                                    ),
                                    cardMisses: misses,
                                  },
                                  { kind: "cards", topic: current.topic },
                                ),
                              );
                              setFlipped(false);
                              if (cardIndex < current.cards.length - 1)
                                setCardIndex(cardIndex + 1);
                            })
                          }
                        >
                          Needs practice
                        </button>
                        <button
                          className="button primary"
                          disabled={busy || !shownCard}
                          onClick={() =>
                            void run(async () => {
                              if (!shownCard) return;
                              const key = cardKey(current.id, shownCard, shownIndex);
                              const misses = { ...(progress.cardMisses ?? {}) };
                              delete misses[key];
                              await persist(
                                recordSession(
                                  {
                                    ...progress,
                                    mastered: progress.mastered.includes(key)
                                      ? progress.mastered
                                      : [...progress.mastered, key],
                                    cardMisses: misses,
                                  },
                                  { kind: "cards", topic: current.topic },
                                ),
                              );
                              setFlipped(false);
                              if (cardIndex < current.cards.length - 1)
                                setCardIndex(cardIndex + 1);
                            })
                          }
                        >
                          <Check size={18} />
                          Known
                        </button>
                        <button
                          className="button secondary"
                          disabled={cardIndex === current.cards.length - 1}
                          onClick={() => {
                            setCardIndex(cardIndex + 1);
                            setFlipped(false);
                          }}
                        >
                          Next
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </section>
                  ) : (
                    <section className="quiz-section">
                      {materialLinks(current.resourceId)}
                      {quizMode === "exam" && remaining !== null && !submitted && (
                        <p className="badge">
                          Time left {Math.floor(remaining / 60)}:
                          {String(remaining % 60).padStart(2, "0")}
                        </p>
                      )}
                      {current.coverage?.partial && (
                        <p className="muted">
                          This quiz covers pages {current.coverage.pageStart}–
                          {current.coverage.pageEnd} of the chapter.
                        </p>
                      )}
                      {submitted && (
                        <div className="result-banner">
                          <Target />
                          <div>
                            <h2>
                              {progress.attempts.find((item) => item.setId === current.id)
                                ?.correct ?? score(current.questions, answers)}{" "}
                              / {current.questions.length} correct
                            </h2>
                            <p>Attempt saved. Review the explanations below.</p>
                          </div>
                          <button
                            className="button secondary"
                            onClick={() => {
                              setAnswers([]);
                              setSubmitted(false);
                              setFeedback({});
                              setRemaining(
                                quizMode === "exam" && quizMinutes > 0
                                  ? quizMinutes * 60
                                  : null,
                              );
                            }}
                          >
                            Try again
                          </button>
                        </div>
                      )}
                      {current.questions.map((q, i) => (
                        <div
                          className="panel quiz-question"
                          key={`${current.id}:${i}`}
                        >
                          <span className="eyebrow">
                            QUESTION {i + 1} OF {current.questions.length}
                          </span>
                          <span className="badge question-kind">
                            {q.kind === "scenario"
                              ? "Scenario"
                              : q.kind === "terminology"
                                ? "Terminology"
                                : "Earlier quiz"}
                          </span>
                          <h3>{q.question}</h3>
                          <div className="options">
                            {q.options.map((option, j) => {
                              const correctIndex = feedback[i]?.answer ?? q.answer;
                              const revealed =
                                submitted ||
                                feedback[i] !== undefined ||
                                (quizMode === "practice" &&
                                  answers[i] !== undefined &&
                                  correctIndex !== undefined);
                              return (
                              <button
                                key={j}
                                disabled={submitted || (quizMode === "practice" && !!feedback[i]) || (quizMode === "practice" && revealed)}
                                className={`option ${answers[i] === j && !revealed ? "selected" : ""} ${revealed && correctIndex === j ? "correct" : ""} ${revealed && answers[i] === j && correctIndex !== j ? "incorrect" : ""}`}
                                onClick={() => {
                                  if (quizMode === "exam") {
                                    setAnswers((old) => {
                                      const next = [...old];
                                      next[i] = j;
                                      return next;
                                    });
                                    return;
                                  }
                                  setAnswers((old) => {
                                    const next = [...old];
                                    next[i] = j;
                                    return next;
                                  });
                                  if (q.answer === undefined && current.stored)
                                    void run(async () => {
                                      const result = await api("/api/study", {
                                        action: "practice",
                                        setId: current.id,
                                        index: i,
                                        choice: j,
                                      });
                                      setFeedback((old) => ({ ...old, [i]: result }));
                                    });
                                }}
                              >
                                <span>{String.fromCharCode(65 + j)}</span>
                                {option}
                                {revealed && correctIndex === j && (
                                  <Check size={17} />
                                )}
                              </button>
                              );
                            })}
                          </div>
                          {(submitted || (quizMode === "practice" && (feedback[i] || answers[i] !== undefined && q.answer !== undefined))) && (
                            <div className="explanation">
                              <p>
                                <strong>Why this answer</strong>
                              </p>
                              <p>{feedback[i]?.explanation || q.explanation}</p>
                              <small>Source: {feedback[i]?.source || q.source}</small>
                              {(feedback[i]?.evidence || q.evidence) ? (
                                <details className="source-evidence">
                                  <summary>Read the supporting passage</summary>
                                  <blockquote>{feedback[i]?.evidence || q.evidence}</blockquote>
                                  <small>
                                    This passage was matched to the selected
                                    text. AI-generated — review it before you
                                    rely on it.
                                  </small>
                                </details>
                              ) : (
                                <small>
                                  This older question has no checked source
                                  passage. Generate a new set from your
                                  material.
                                </small>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {!submitted && (
                        <button
                          className="button primary"
                          disabled={
                            busy ||
                            current.questions.some(
                              (_, i) => answers[i] === undefined,
                            )
                          }
                          onClick={() => void run(() => finishQuiz())}
                        >
                          Finish quiz <ArrowRight size={17} />
                        </button>
                      )}
                    </section>
                  )}
                </>
              )}
              {page === "AI tutor" && (
                <>
                  <Heading
                    eyebrow="YOUR STUDY PARTNER"
                    title="Ask RESCUE"
                    text="Choose My material, Expanded learning, or Scenario practice. Expanded answers keep your notes separate from retrieved public sources."
                  />
                  <div className="tutor-layout">
                    <section className="panel tutor-main">
                      <div className="chat-messages">
                        {!progress.messages.length && (
                          <div className="tutor-empty">
                            <span className="tutor-orb">
                              <Sparkles size={34} />
                            </span>
                            <h2>Make the complex click.</h2>
                            <p>
                              Choose your notes, then ask for an explanation,
                              <br />a comparison, or a way to remember a
                              concept.
                            </p>
                            {[
                              "Tell me about this chapter.",
                              "Explain the key ideas in simpler terms.",
                              "What should I focus on in these notes?",
                            ].map((q) => (
                              <button key={q} onClick={() => setQuestion(q)}>
                                {q}
                                <ArrowRight size={14} />
                              </button>
                            ))}
                          </div>
                        )}
                        {progress.messages.map((m, i) => (
                          <div key={i} className={`message ${m.role}`}>
                            <span className="eyebrow">
                              {m.role === "user" ? "YOU" : "RESCUE TUTOR"}
                            </span>
                            <p>{m.text}</p>
                          </div>
                        ))}
                        {busy && (
                          <p className="muted">Looking through your material…</p>
                        )}
                      </div>
                      <form className="chat-form" onSubmit={ask}>
                        <input
                          aria-label="Ask the tutor"
                          placeholder="What would you like to understand?"
                          maxLength={1500}
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                        />
                        <button
                          className="button primary"
                          aria-label="Send question"
                          disabled={busy || !question.trim() || !resourceId}
                        >
                          <Send size={18} />
                        </button>
                      </form>
                    </section>
                    <aside className="panel tutor-context">
                      <BookOpen size={24} />
                      <h3>Grounded in your notes</h3>
                      {resourceSelector()}
                      <label className="field">
                        Learning mode
                        <select
                          value={learning}
                          onChange={(event) =>
                            setLearning(
                              event.target.value as
                                | "material"
                                | "expanded"
                                | "scenario",
                            )
                          }
                        >
                          <option value="material">My material</option>
                          <option value="expanded">Expanded learning</option>
                          <option value="scenario">Scenario practice</option>
                        </select>
                      </label>
                      {materialLinks(resourceId)}
                      <p>
                        My material uses your selected notes and cites their
                        pages. A broad question such as “Tell me about this
                        chapter” summarizes the retrieved pages. If nothing in
                        your material matches, RESCUE says so and answers as
                        general study guidance. Expanded learning and scenario practice also
                        search NREMT, EMS.gov, and the American Heart Association
                        using the topic name only. Your notes are not included in
                        that search. Don’t include patient information.
                      </p>
                      <div className="divider" />
                      <ShieldCheck size={22} />
                      <h3>A learning companion</h3>
                      <p>
                        AI can make mistakes. Check answers with your
                        instructor, course material, and local protocols. Not
                        for patient care.
                      </p>
                    </aside>
                  </div>
                </>
              )}
              {page === "My progress" && (
                <>
                  <Heading
                    eyebrow="YOUR GROWTH, AT A GLANCE"
                    title="Progress"
                    text="Consistency today builds confidence in the field."
                  />
                  <div className="stats">
                    <Stat
                      icon={<Target />}
                      label="Overall accuracy"
                      value={
                        progress.attempts.length
                          ? `${accuracy(progress.attempts)}%`
                          : "—"
                      }
                      detail="All completed quizzes"
                    />
                    <Stat
                      icon={<Layers />}
                      label="Cards mastered"
                      value={String(progress.mastered.length)}
                      detail={`Out of ${totalCards} cards`}
                    />
                    <Stat
                      icon={<ClipboardCheck />}
                      label="Questions answered"
                      value={String(questionsAnswered(progress.attempts))}
                      detail={`${progress.attempts.length} quizzes · ${progress.sessions?.length ?? progress.attempts.length} study sessions`}
                    />
                    <Stat
                      icon={<Flame />}
                      label="Study days"
                      value={String(studyDays)}
                      detail="Days with a quiz attempt"
                    />
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel">
                      <h2>Topic performance</h2>
                      {[
                        ...new Set([
                          ...topics,
                          ...progress.attempts.map((a) => a.topic),
                        ]),
                      ].map((t) => {
                        const a = progress.attempts.filter(
                          (x) => x.topic === t,
                        );
                        return (
                          <div className="topic-progress" key={t}>
                            <div>
                              <span>{t}</span>
                              <small>
                                {a.length
                                  ? `${accuracy(a)}% · ${a.length} attempts`
                                  : "Not started"}
                              </small>
                            </div>
                            <div className="track">
                              <span style={{ width: `${accuracy(a)}%` }} />
                            </div>
                            {a.length > 0 && accuracy(a) < 70 && (
                              <small className="red">Recommended review</small>
                            )}
                          </div>
                        );
                      })}
                    </section>
                    <section className="panel">
                      <h2>Review missed questions</h2>
                      {!(progress.missed ?? []).length && (
                        <p className="muted">
                          Missed questions appear here after you finish a quiz.
                        </p>
                      )}
                      {(progress.missed ?? []).slice(0, 8).map((item) => (
                        <div className="history-row" key={item.id}>
                          <span>
                            <strong>{item.topic}</strong>
                            <small>{item.question}</small>
                            <small>{item.explanation}</small>
                            <small>Source: {item.source}</small>
                          </span>
                        </div>
                      ))}
                      {!!weakTopics(progress.attempts).length && (
                        <div className="study-links">
                          {weakTopics(progress.attempts).map((topic) => (
                            <button
                              type="button"
                              key={topic.topic}
                              onClick={() => {
                                setQuizTopic(topic.topic);
                                go("Practice quizzes");
                              }}
                            >
                              Review {topic.topic} · {topic.accuracy}%
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                    <section className="panel">
                      <h2>Recent practice</h2>
                      {!progress.attempts.length && (
                        <p className="muted">
                          Complete a quiz to start your learning history.
                        </p>
                      )}
                      {progress.attempts.slice(0, 12).map((a) => (
                        <div className="history-row" key={a.id}>
                          <span>
                            <strong>{a.topic}</strong>
                            <small>
                              {new Date(a.date).toLocaleDateString()}
                            </small>
                          </span>
                          <span className="badge">
                            {a.correct}/{a.total}
                          </span>
                        </div>
                      ))}
                    </section>
                  </div>
                </>
              )}
              {page === "Profile" && (
                <>
                  <Heading
                    eyebrow="MAKE RESCUE YOURS"
                    title="Settings"
                    text={
                      demo
                        ? "Your name is visible only on your account. Private chapters stay private."
                        : accountEmail
                          ? `${accountEmail} · Your name is visible only on your account.`
                          : "Your name is visible only on your account. Private chapters stay private."
                    }
                  />
                  <section className="panel">
                    <form
                      key={`${profile.firstName}:${profile.lastName}`}
                      className="stack-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        void run(async () => {
                          if (demo)
                            throw new Error(
                              "Profile names are saved after you sign in.",
                            );
                          const first = String(form.get("first"));
                          const last = String(form.get("last"));
                          const { error } = await supabase!.rpc("save_profile", {
                            first_name: first,
                            last_name: last,
                          });
                          if (error)
                            throw new Error(
                              "Names could not be saved. Run supabase/phase1.sql once in the Supabase SQL editor, then try again.",
                            );
                          setProfile({
                            ...profile,
                            firstName: first.trim(),
                            lastName: last.trim(),
                          });
                          notify("Name saved.", "success");
                        });
                      }}
                    >
                      <label className="field">
                        First name
                        <input
                          name="first"
                          required
                          maxLength={40}
                          defaultValue={profile.firstName}
                        />
                      </label>
                      <label className="field">
                        Last name
                        <input
                          name="last"
                          required
                          maxLength={40}
                          defaultValue={profile.lastName}
                        />
                      </label>
                      <button className="button primary" disabled={busy}>
                        Save name
                      </button>
                    </form>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={profile.autoQuiz}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          setProfile({ ...profile, autoQuiz: enabled });
                          if (demo) return;
                          void run(async () => {
                            const { error } = await supabase!.rpc(
                              "set_auto_quiz",
                              { enabled },
                            );
                            if (error)
                              throw new Error(
                                "That setting could not be saved. Run supabase/phase1.sql once, then try again.",
                              );
                          });
                        }}
                      />
                      Automatically create a quiz after chapter upload
                    </label>
                    <p className="muted">
                      Turn this off to avoid an OpenAI request after each new
                      chapter. You can still generate quizzes yourself.
                    </p>
                  </section>
                </>
              )}
              {page === "Admin" && admin && (
                <>
                  <Heading
                    eyebrow="CLASS ADMINISTRATION"
                    title="Keep your class moving."
                    text="Manage class access and review submitted text. Private files and student progress remain private."
                  />
                  <div className="dashboard-grid">
                    <section className="panel">
                      <h2>Classes & access</h2>
                      <form
                        className="inline-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const name = String(
                            new FormData(form).get("name"),
                          ).trim();
                          void run(async () => {
                            const { data, error } = await supabase!
                              .from("classes")
                              .insert({ name })
                              .select()
                              .single();
                            if (error) throw error;
                            setClasses([...classes, data]);
                            form.reset();
                          });
                        }}
                      >
                        <input
                          name="name"
                          aria-label="Class name"
                          placeholder="New class name"
                          required
                          maxLength={100}
                        />
                        <button disabled={busy} className="button primary">
                          Create
                        </button>
                      </form>
                      <form
                        className="stack-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void run(async () => {
                            const { error } = await supabase!
                              .from("memberships")
                              .insert({
                                user_id: f.get("user"),
                                class_id: f.get("class"),
                              });
                            if (error) throw error;
                            const { data } = await supabase!
                              .from("memberships")
                              .select("*");
                            setMembers(data ?? []);
                          });
                        }}
                      >
                        <label className="field">
                          Class
                          <select name="class" required>
                            <option value="">Choose a class</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          Registered student
                          <select name="user" required>
                            <option value="">Choose a student</option>
                            {people.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.email}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button className="button secondary" disabled={busy}>
                          Add to class
                        </button>
                      </form>
                      {members.map((m) => (
                        <div
                          className="history-row"
                          key={`${m.user_id}${m.class_id}`}
                        >
                          <span>
                            <strong>
                              {people.find((p) => p.id === m.user_id)?.email}
                            </strong>
                            <small>
                              {classes.find((c) => c.id === m.class_id)?.name}
                            </small>
                          </span>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const { error } = await supabase!
                                  .from("memberships")
                                  .delete()
                                  .eq("class_id", m.class_id)
                                  .eq("user_id", m.user_id);
                                if (error) throw error;
                                setMembers(members.filter((x) => x !== m));
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </section>
                    <section className="panel">
                      <h2>Resource review</h2>
                      {!review.length && (
                        <p className="muted">
                          No submissions yet. Students submit text from their
                          private library.
                        </p>
                      )}
                      {review.map((r) => (
                        <div className="review-item" key={r.id}>
                          <span className="badge">
                            {r.visibility} · {r.rights}
                          </span>
                          <h3>{r.title}</h3>
                          <details>
                            <summary>Review submitted text</summary>
                            <p>{r.content}</p>
                          </details>
                          <div className="button-row">
                            {r.visibility === "pending" && (
                              <button
                                className="button primary"
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    const { error } = await supabase!.rpc(
                                      "review_resource",
                                      { rid: r.id, approve: true },
                                    );
                                    if (error) throw error;
                                    setReview(
                                      review.map((x) =>
                                        x.id === r.id
                                          ? { ...x, visibility: "class" }
                                          : x,
                                      ),
                                    );
                                    setResources(
                                      resources.map((x) =>
                                        x.id === r.id
                                          ? { ...x, visibility: "class" }
                                          : x,
                                      ),
                                    );
                                  })
                                }
                              >
                                Approve
                              </button>
                            )}
                            <button
                              className="button secondary"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  const { error } = await supabase!.rpc(
                                    "review_resource",
                                    { rid: r.id, approve: false },
                                  );
                                  if (error) throw error;
                                  setReview(
                                    review.filter((x) => x.id !== r.id),
                                  );
                                  setResources(
                                    resources.filter((x) => x.id !== r.id),
                                  );
                                })
                              }
                            >
                              {r.visibility === "pending"
                                ? "Reject"
                                : "Unpublish"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </section>
                  </div>
                  <section className="panel">
                    <h2>Registered students</h2>
                    {people.map((p) => (
                      <div className="history-row" key={p.id}>
                        <span>
                          {p.email}
                          <small>{p.enabled ? "Active" : "Disabled"}</small>
                        </span>
                        <button
                          disabled={busy || p.id === session?.user.id}
                          className="button secondary"
                          onClick={() =>
                            void run(async () => {
                              const { error } = await supabase!.rpc(
                                "set_member_enabled",
                                { uid: p.id, active: !p.enabled },
                              );
                              if (error) throw error;
                              setPeople(
                                people.map((x) =>
                                  x.id === p.id
                                    ? { ...x, enabled: !p.enabled }
                                    : x,
                                ),
                              );
                            })
                          }
                        >
                          {p.enabled ? "Disable access" : "Enable access"}
                        </button>
                      </div>
                    ))}
                  </section>
                </>
              )}
            </>
          )}
          <p
            className={
              saveState.startsWith("Saved")
                ? "save-ok"
                : saveState === "Not saved" || saveState.startsWith("Not saved")
                  ? "save-bad"
                  : "muted"
            }
          >
            {saveState || "For education. Not for patient care."}
          </p>
      {upload && (
        <Modal
          title="Add study material"
          onClose={() => !busy && setUpload(false)}
        >
          <p className="muted">
            Everything starts private. Add your own notes or material you have
            permission to upload.
          </p>
          <form className="stack-form" onSubmit={addResource}>
            <label className="field">
              Title
              <input
                name="title"
                required
                maxLength={120}
                placeholder="e.g. Patient assessment — week 1"
                value={noteDraft.title}
                onChange={(event) =>
                  setNoteDraft({ ...noteDraft, title: event.target.value })
                }
              />
            </label>
            <label className="field">
              Topic
              <select
                name="topic"
                value={noteDraft.topic}
                onChange={(event) =>
                  setNoteDraft({ ...noteDraft, topic: event.target.value })
                }
              >
                {topics.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Text notes for AI study
              <textarea
                name="content"
                rows={7}
                maxLength={30000}
                placeholder="Paste your own notes here. A PDF is read into a private chapter after you save it. Scanned pages are read one batch at a time."
                value={noteDraft.content}
                onChange={(event) =>
                  setNoteDraft({ ...noteDraft, content: event.target.value })
                }
              />
            </label>
            <label className="file-input">
              <Upload size={22} />
              <strong>Add a private file</strong>
              <span>PDF, TXT, or Markdown · Up to 50 MB</span>
              <input type="file" name="file" accept=".pdf,.txt,.md" />
            </label>
            <div className="button-row">
              <label className="button secondary">
                <Camera size={16} />
                Take photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(event) => {
                    void onPickPhotos(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
              <label className="button secondary">
                <Upload size={16} />
                Upload photos
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
                  multiple
                  hidden
                  onChange={(event) => {
                    void onPickPhotos(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            {photoFiles.length > 0 && (
              <ol className="photo-order">
                {photoFiles.map((photo, index) => (
                  <li key={`${photo.name}:${index}`}>
                    <span>
                      Photo {index + 1} · {photo.name}
                    </span>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setPhotoFiles((current) =>
                          current.filter((_, item) => item !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <p className="notice warning">
              Do not photograph patients, faces, wristbands, names, or other
              identifying information. Photos and recognized text stay in your
              private account. An interrupted upload cannot resume.
            </p>
            <label className="checkbox">
              <input type="checkbox" required />I have permission to upload this
              material. It contains no patient information.
            </label>
            {status && (
              <p className={noticeClass(tone)} role={tone === "error" ? "alert" : "status"}>
                {status}
              </p>
            )}
            <button disabled={busy} className="button primary">
              {busy ? "Working…" : "Save to my library"}
              <LockKeyhole size={16} />
            </button>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal title={detail.title} onClose={() => !busy && closeResource()}>
          <span className="badge">
            {detail.visibility} · {detail.topic}
          </span>
          <p className="resource-content">
            {detail.pages
              ? `Private chapter, ${detail.pages} pages. Extracted text stays in your account and is not sent to the class library.`
              : detail.content ||
                "This file has no text notes yet. For a text-based PDF, read the chapter below."}
          </p>
          <p className={`stage stage-${detail.stage || detail.processing || "saved"}`}>
            {chapterStage(detail)}
            {quizLine(detail) ? ` · ${quizLine(detail)}` : ""}
          </p>
          {chapterWork(detail) && detail.processing !== "ready" && (
            <>
              <p className="muted">
                {chapterWork(detail)!.done} of {chapterWork(detail)!.total} pages complete
              </p>
              <div
                className="work-meter"
                aria-label={`${chapterWork(detail)!.done} of ${chapterWork(detail)!.total} pages complete`}
              >
                <span
                  style={{
                    width: `${(chapterWork(detail)!.done / chapterWork(detail)!.total) * 100}%`,
                  }}
                />
              </div>
            </>
          )}
          {photoPages.length > 0 && (
            <div className="photo-review">
              <p>
                Review each photo in order. Uncertain readings are flagged.
                Correct them before you generate a quiz. Citations use the photo
                number.
              </p>
              {photoPages.map((page) => (
                <label className="field" key={page.id}>
                  Photo {page.page_index + 1}
                  {page.uncertain ? " · Uncertain reading" : " · Ready for review"}
                  <textarea
                    rows={5}
                    maxLength={12000}
                    value={photoEdits[page.id] ?? page.ocr_text}
                    onChange={(event) =>
                      setPhotoEdits((current) => ({
                        ...current,
                        [page.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void savePhotoText(page.id)}
                  >
                    Save correction
                  </button>
                </label>
              ))}
            </div>
          )}
          {detail.processing === "failed" && detail.processingError && (
            <p className="notice error" role="alert">
              {detail.processingError}
            </p>
          )}
          {detail.file_path && (
            <button
              disabled={busy}
              className="button secondary"
              onClick={() =>
                void run(async () => {
                  const { data, error } = await supabase!.storage
                    .from("private-materials")
                    .createSignedUrl(detail.file_path!, 60, { download: true });
                  if (error) throw error;
                  const a = document.createElement("a");
                  a.href = data.signedUrl;
                  a.rel = "noopener";
                  a.click();
                })
              }
            >
              Download private file
            </button>
          )}
          {detail.file_path?.toLowerCase().endsWith(".pdf") && (
            <button
              className="button secondary"
              disabled={busy || demo}
              onClick={() =>
                void run(() =>
                  readChapter(detail, detail.processing === "failed"),
                )
              }
            >
              {busy
                ? "Reading the PDF…"
                : detail.processing === "failed"
                  ? "Retry processing"
                  : detail.pages
                    ? "Read chapter again"
                    : "Read chapter text"}
            </button>
          )}
          {!!detail.pages && (
            <button
              className="button secondary"
              disabled={busy || demo}
              onClick={() =>
                void run(async () => {
                  const { data, error } = await supabase!
                    .from("chapter_chunks")
                    .select("page_start,page_end,content")
                    .eq("resource_id", detail.id)
                    .order("chunk_index");
                  if (error) throw error;
                  setChapterText(
                    (data ?? []).map((chunk) => ({
                      pages:
                        chunk.page_start === chunk.page_end
                          ? `p. ${chunk.page_start}`
                          : `pp. ${chunk.page_start}–${chunk.page_end}`,
                      content: chunk.content,
                    })),
                  );
                })
              }
            >
              View extracted text
            </button>
          )}
          {chapterText && (
            <div className="resource-content">
              {chapterText.map((chunk, index) => (
                <p key={`${chunk.pages}:${index}`}>
                  <strong>{chunk.pages}</strong> {chunk.content}
                </p>
              ))}
            </div>
          )}
          {!!detail.pages && (
            <div className="button-row">
              <label className="field">
                From page
                <input
                  inputMode="numeric"
                  value={pageFrom}
                  placeholder="1"
                  onChange={(e) => setPageFrom(e.target.value)}
                />
              </label>
              <label className="field">
                Through page
                <input
                  inputMode="numeric"
                  value={pageTo}
                  placeholder={String(detail.pages)}
                  onChange={(e) => setPageTo(e.target.value)}
                />
              </label>
            </div>
          )}
          <div className="button-row">
            <button
              className="button primary"
              disabled={
                busy || (detail.content.length < 20 && !(detail.pages ?? 0))
              }
              onClick={() => void generate("quiz", detail.id)}
            >
              <Sparkles size={16} />
              {busy ? "Working…" : "Create quiz"}
            </button>
            <button
              className="button secondary"
              disabled={
                busy || (detail.content.length < 20 && !(detail.pages ?? 0))
              }
              onClick={() => void generate("cards", detail.id)}
            >
              Generate flashcards
            </button>
            <button
              className="button secondary"
              onClick={() => {
                setResourceId(detail.id);
                pendingChapter.current = null;
                setDetail(null);
                setPage("AI tutor");
                pushPlace("AI tutor", null);
              }}
            >
              Ask RESCUE
            </button>
            {detail.visibility === "private" && (
              <button
                className="button secondary"
                onClick={() => setShare(!share)}
              >
                Submit to class
              </button>
            )}
          </div>
          {share && (
            <div className="share-box">
              <p>
                Submit a separate copy of the notes you typed. The uploaded
                file, extracted chapter text, and generated quizzes stay
                private. Do not submit AAOS or other publisher chapters without
                explicit distribution permission.
              </p>
              <label className="field">
                Class
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  <option value="">Select your class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Sharing permission
                <select
                  value={rights}
                  onChange={(e) =>
                    setRights(e.target.value as "original" | "authorized")
                  }
                >
                  <option value="original">
                    I wrote this original material
                  </option>
                  <option value="authorized">
                    I have permission to share this material
                  </option>
                </select>
              </label>
              <button
                disabled={busy || !classId}
                className="button primary"
                onClick={() => void submitShare()}
              >
                Confirm rights & submit
              </button>
            </div>
          )}
          {(quizLine(detail) === "Initial quiz failed" ||
            (quizLine(detail) === "Initial quiz pending" && detail.processing === "ready")) && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setQuizActivity((current) => ({ ...current, [detail.id]: "generating" }));
                void generate("quiz", detail.id, "auto");
              }}
            >
              {quizLine(detail) === "Initial quiz failed"
                ? "Retry initial quiz"
                : "Create initial quiz"}
            </button>
          )}
          {status && (
            <p className={noticeClass(tone)} role={tone === "error" ? "alert" : "status"}>
              {status}
            </p>
          )}
          {detail.owner_id === (demo ? "demo" : session?.user.id) &&
            detail.visibility === "private" && (
              <details className="delete-area">
                <summary>Delete resource</summary>
                <p>
                  This permanently removes this resource and its private file.
                  Existing study sets remain.
                </p>
                <button
                  className="text-button red"
                  disabled={busy}
                  onClick={() => void removeResource(detail)}
                >
                  Permanently delete
                </button>
              </details>
            )}
        </Modal>
      )}
    </WorkspaceFrame>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span>
        <Activity size={26} />
      </span>
      RESCUE<span className="brand-dot">•</span>
    </div>
  );
}
function Heading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty">
      {icon}
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Auth({ onDemo }: { onDemo: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin"),
    [message, setMessage] = useState(""),
    [messageTone, setMessageTone] = useState<NoticeTone>("info"),
    [busy, setBusy] = useState(false);
  function say(text: string, next: NoticeTone) {
    setMessage(text);
    setMessageTone(next);
  }
  return (
    <>
      <span className="eyebrow">WELCOME TO RESCUE</span>
      <h2>
        {mode === "signup"
          ? "Start your next chapter."
          : mode === "reset"
            ? "Reset your password."
            : "Your study station awaits."}
      </h2>
      <p className="muted">
        {mode === "signup"
          ? "Create your personal EMT study account."
          : "Sign in to pick up where you left off."}
      </p>
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          setMessageTone("info");
          const f = new FormData(e.currentTarget),
            email = String(f.get("email")),
            password = String(f.get("password")),
            first = String(f.get("first") ?? "").trim(),
            last = String(f.get("last") ?? "").trim();
          try {
            if (mode === "reset") {
              const { error } = await supabase!.auth.resetPasswordForEmail(
                email,
                { redirectTo: `${window.location.origin}/reset-password` },
              );
              if (error) throw error;
              say("Check your email for a password reset link.", "success");
            } else {
              const { data, error } =
                mode === "signup"
                  ? await supabase!.auth.signUp({
                      email,
                      password,
                      options: { data: { first_name: first, last_name: last } },
                    })
                  : await supabase!.auth.signInWithPassword({
                      email,
                      password,
                    });
              if (error) throw error;
              if (!data.session)
                say(
                  "Check your email to confirm your account, then sign in.",
                  "success",
                );
            }
          } catch (err) {
            say(
              err instanceof Error ? err.message : "Unable to sign in.",
              "error",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </label>
        {mode === "signup" && (
          <>
            <label className="field">
              First name
              <input name="first" required maxLength={40} autoComplete="given-name" />
            </label>
            <label className="field">
              Last name
              <input name="last" required maxLength={40} autoComplete="family-name" />
            </label>
          </>
        )}
        {mode !== "reset" && (
          <label className="field">
            Password
            <input
              type="password"
              name="password"
              minLength={10}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
              placeholder="At least 10 characters"
            />
          </label>
        )}
        {message && (
          <p role={messageTone === "error" ? "alert" : "status"} className={noticeClass(messageTone)}>
            {message}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy
            ? "One moment…"
            : mode === "signup"
              ? "Create account"
              : mode === "reset"
                ? "Send reset link"
                : "Sign in"}
          <ArrowRight size={17} />
        </button>
      </form>
      <div className="auth-links">
        <button
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setMessage("");
          }}
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
        <button onClick={() => setMode("reset")}>Forgot password?</button>
      </div>
      <div className="divider" />
      <button className="button secondary full" onClick={onDemo}>
        Explore the demo <ArrowRight size={17} />
      </button>
    </>
  );
}
