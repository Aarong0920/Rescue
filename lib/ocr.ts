import { renderPageAsImage } from "unpdf";
import { normalizeChapterText } from "./chapters";

type OcrWorker = {
  recognize: (
    image: Buffer,
  ) => Promise<{ data: { text: string; confidence?: number } }>;
  terminate: () => Promise<unknown>;
};

let workerPromise: Promise<OcrWorker> | null = null;

async function worker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(async ({ createWorker }) => {
      const created = await createWorker("eng", 1, {
        cachePath: "/tmp/rescue-tesseract",
      });
      return created as OcrWorker;
    });
  }
  return workerPromise;
}

export async function recognizeImage(bytes: Buffer) {
  try {
    const active = await worker();
    const result = await active.recognize(bytes);
    return {
      text: normalizeChapterText(result.data.text ?? ""),
      confidence: Number(result.data.confidence ?? 0),
    };
  } catch (error) {
    if (workerPromise) {
      const active = await workerPromise.catch(() => null);
      workerPromise = null;
      await active?.terminate().catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : "";
    if (/cannot find module|napi-rs\/canvas|tesseract/i.test(message)) {
      throw new Error("Photo text recognition is not available in this environment.");
    }
    throw new Error("This photo could not be read. It was saved and can be retried.");
  }
}

export async function recognizePage(
  pdf: Parameters<typeof renderPageAsImage>[0],
  pageNumber: number,
) {
  try {
    const png = await renderPageAsImage(pdf, pageNumber, {
      scale: 1.5,
      canvasImport: () => import("@napi-rs/canvas"),
    });
    const active = await worker();
    const result = await active.recognize(Buffer.from(png));
    return normalizeChapterText(result.data.text ?? "");
  } catch (error) {
    if (workerPromise) {
      const active = await workerPromise.catch(() => null);
      workerPromise = null;
      await active?.terminate().catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : "";
    if (/cannot find module|napi-rs\/canvas|tesseract/i.test(message)) {
      throw new Error(
        "OCR is not available in this environment. Text-based PDFs can still be read.",
      );
    }
    throw new Error(
      `Page ${pageNumber} could not be read. The chapter was saved through the previous page and can be retried.`,
    );
  }
}
