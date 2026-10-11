import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isStudyImage,
  orderedPhotoNames,
  photoProblem,
  photoSetProblem,
  readingQuality,
} from "../lib/photos";
import {
  citationFromUrl,
  citationsFromOutput,
  keepVerifiedUrls,
  publicSearchQuery,
  sanitizePublicTopic,
  sourceFooter,
} from "../lib/external";

test("photo sets keep upload order and reject the wrong files", () => {
  assert.equal(isStudyImage({ name: "page.HEIC", type: "" }), true);
  assert.equal(photoProblem({ name: "notes.pdf", type: "application/pdf", size: 1000 }), "Use a JPG, PNG, or HEIC photo.");
  assert.equal(photoProblem({ name: "page.jpg", type: "image/jpeg", size: 9 * 1024 * 1024 })?.includes("8 MB"), true);
  assert.equal(photoSetProblem(Array.from({ length: 13 }, () => ({ size: 100 }))), "A photo set can include up to 12 photos.");
  assert.deepEqual(
    orderedPhotoNames(["second.jpg", "first.png"]).map((item) => item.label),
    ["Photo 1", "Photo 2"],
  );
});

test("uncertain OCR is flagged and empty photos are not invented", () => {
  const clear = readingQuality("The primary assessment looks for immediate life threats.", 92);
  assert.equal(clear.uncertain, false);
  const weak = readingQuality("ab", 40);
  assert.equal(weak.uncertain, true);
  assert.match(weak.text, /Uncertain reading/);
  const empty = readingQuality("   ", 10);
  assert.match(empty.text, /\[unclear\]/);
});

test("external search uses the public topic and drops private text", () => {
  const notes = "Patient Jane Doe, room 4, textbook page about opioid doses and local protocol 12.";
  assert.equal(sanitizePublicTopic(notes), "");
  assert.equal(publicSearchQuery(notes, "expanded"), null);
  const query = publicSearchQuery("Airway & respiration", "scenario");
  assert.equal(query?.includes("Jane"), false);
  assert.equal(query?.includes("opioid"), false);
  assert.match(query ?? "", /Airway & respiration/);
});

test("only retrieved NREMT, EMS.gov, and AHA links are kept", () => {
  assert.equal(citationFromUrl("http://www.nremt.org/handbooks"), null);
  assert.equal(citationFromUrl("https://example.com/emt")?.url, undefined);
  assert.equal(citationFromUrl("https://www.nremt.org/handbooks")?.title, "NREMT");
  const citations = citationsFromOutput({
    output: [
      { type: "web_search_call", action: { sources: [{ url: "https://www.ems.gov/education" }] } },
      { content: [{ annotations: [{ url: "https://evil.example/fake" }] }] },
    ],
  });
  assert.deepEqual(citations.map((item) => item.title), ["EMS.gov"]);
  const cleaned = keepVerifiedUrls(
    "See https://www.ems.gov/education and https://evil.example/fake.",
    citations,
  );
  assert.match(cleaned, /ems\.gov/);
  assert.match(cleaned, /unverified link removed/);
  assert.match(sourceFooter([], "2026-10-10"), /No page from NREMT/);
});
