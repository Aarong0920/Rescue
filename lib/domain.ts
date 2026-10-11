import { z } from "zod";
export const requestSchema = z.object({
  mode: z.enum(["cards", "quiz", "tutor"]),
  resourceId: z.uuid(),
  message: z.string().trim().max(1500).optional(),
  pageStart: z.number().int().min(1).max(2000).optional(),
  pageEnd: z.number().int().min(1).max(2000).optional(),
  count: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal(30)]).optional(),
  style: z.enum(["terminology", "scenarios", "mixed"]).optional(),
  difficulty: z.enum(["basic", "intermediate", "advanced"]).optional(),
  topic: z.string().trim().max(80).optional(),
  origin: z.enum(["auto", "custom"]).optional(),
  learning: z.enum(["material", "expanded", "scenario"]).optional(),
  scope: z.enum(["material", "expanded"]).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(800),
      }),
    )
    .max(4)
    .optional(),
  avoid: z.array(z.string().trim().min(1).max(180)).max(12).optional(),
});
export const cardSchema = z.object({
  front: z.string(),
  back: z.string(),
  source: z.string(),
});
export const questionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string(),
  source: z.string(),
});
export const studySchema = z.object({
  title: z.string(),
  cards: z.array(cardSchema).min(1).max(12),
  questions: z.array(questionSchema).min(1).max(10),
});
export type Card = z.infer<typeof cardSchema> & {
  id?: string;
  evidence?: string;
};
export type Question = Omit<z.infer<typeof questionSchema>, "answer"> & {
  answer?: number;
  kind?: "terminology" | "scenario";
  evidence?: string;
};
export type Resource = {
  id: string;
  owner_id: string;
  title: string;
  topic: string;
  content: string;
  file_path?: string | null;
  pages?: number;
  totalPages?: number;
  stage?: "uploading" | "extracting" | "ocr" | "quiz" | "ready" | "failed";
  processing?: "uploaded" | "processing" | "ready" | "failed";
  processingError?: string;
  nextPage?: number;
  visibility: "private" | "pending" | "class";
  rights: "private" | "original" | "authorized";
  class_id?: string | null;
  created_at?: string;
};
export type StudySet = {
  id: string;
  title: string;
  topic: string;
  cards: Card[];
  questions: Question[];
  resourceId: string;
  groundingVersion?: 1;
  origin?: "auto" | "custom";
  stored?: boolean;
  style?: "terminology" | "scenarios" | "mixed";
  difficulty?: "basic" | "intermediate" | "advanced";
  coverage?: {
    pageStart: number | null;
    pageEnd: number | null;
    partial: boolean;
  };
};
export type Attempt = {
  id: string;
  topic: string;
  correct: number;
  total: number;
  date: string;
  resourceTitle?: string;
  setId?: string;
  mode?: "practice" | "exam";
  missed?: { question: string; explanation: string; source: string }[];
};
export type StudySession = {
  id: string;
  kind: "quiz" | "cards";
  topic: string;
  date: string;
};
export type Progress = {
  sets: StudySet[];
  mastered: string[];
  attempts: Attempt[];
  messages: { role: "user" | "assistant"; text: string; resourceId?: string }[];
  missed?: { id: string; topic: string; question: string; explanation: string; source: string; date: string }[];
  sessions?: StudySession[];
  cardMisses?: Record<string, number>;
  place?: {
    setId?: string;
    cardIndex?: number;
    answers?: number[];
    submitted?: boolean;
    quizMode?: "practice" | "exam";
  };
};
export function accuracy(attempts: Attempt[]) {
  const total = attempts.reduce((n, a) => n + a.total, 0);
  return total
    ? Math.round((attempts.reduce((n, a) => n + a.correct, 0) / total) * 100)
    : 0;
}
export function canSubmit(rights: Resource["rights"], classId?: string | null) {
  return rights !== "private" && !!classId;
}
export function score(questions: Question[], answers: number[]) {
  return questions.reduce(
    (sum, q, i) => sum + (q.answer !== undefined && q.answer === answers[i] ? 1 : 0),
    0,
  );
}
