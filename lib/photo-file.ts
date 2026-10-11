import { photoProblem } from "./photos";

export async function prepareStudyImage(file: File) {
  const problem = photoProblem(file);
  if (problem) throw new Error(problem);
  const type = file.type.toLowerCase();
  if (
    (type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) &&
    file.size <= 1_500_000
  )
    return { blob: file, type: "image/jpeg" as const, extension: "jpg" };
  if (type === "image/png" && file.size <= 1_500_000 && /\.png$/i.test(file.name))
    return { blob: file, type: "image/png" as const, extension: "png" };
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap)
    throw new Error(
      "This browser could not read that photo. HEIC works in Safari; otherwise export it as JPEG.",
    );
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare that photo.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob)
    throw new Error(
      "This browser could not read that photo. Export it as JPEG and try again.",
    );
  return { blob, type: "image/jpeg" as const, extension: "jpg" };
}
