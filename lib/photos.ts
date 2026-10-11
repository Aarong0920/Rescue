export const MAX_PHOTOS = 12;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const imagePattern = /\.(jpe?g|png|heic|heif)$/i;

export function isStudyImage(file: { name: string; type?: string }) {
  const type = file.type?.toLowerCase() ?? "";
  return (
    imagePattern.test(file.name) ||
    type === "image/jpeg" ||
    type === "image/png" ||
    type === "image/heic" ||
    type === "image/heif"
  );
}

export function photoProblem(file: { name: string; type?: string; size: number }) {
  if (!isStudyImage(file)) return "Use a JPG, PNG, or HEIC photo.";
  if (file.size > MAX_PHOTO_BYTES) return "Each photo must be under 8 MB.";
  if (file.size < 1) return "That photo is empty.";
  return null;
}

export function photoSetProblem(files: { size: number }[]) {
  if (!files.length) return "Add at least one photo.";
  if (files.length > MAX_PHOTOS) return `A photo set can include up to ${MAX_PHOTOS} photos.`;
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > 50 * 1024 * 1024) return "The photo set must stay under 50 MB.";
  return null;
}

export function orderedPhotoNames(names: string[]) {
  return names.map((name, index) => ({
    index,
    name,
    label: `Photo ${index + 1}`,
  }));
}

export function readingQuality(text: string, confidence: number) {
  const trimmed = text.replace(/\u0000/g, "").trim();
  const letters = (trimmed.match(/[A-Za-z]/g) ?? []).length;
  const alreadyFlagged = /\[unclear\]|uncertain reading/i.test(trimmed);
  const uncertain = alreadyFlagged || confidence < 70 || letters < 40;
  const body =
    uncertain && trimmed && !alreadyFlagged
      ? `${trimmed}\n\n[Uncertain reading — review this photo before you study from it.]`
      : trimmed || "[unclear] This photo could not be read.";
  return {
    text: body.slice(0, 12000),
    uncertain: uncertain || !trimmed,
    letters,
  };
}
