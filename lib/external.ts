export const SOURCE_DOMAINS = ["nremt.org", "ems.gov", "heart.org", "cpr.heart.org"];

export type PublicCitation = { title: string; url: string };

export function sanitizePublicTopic(topic: string) {
  const cleaned = topic.replace(/[^A-Za-z0-9 &/-]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > 80 || cleaned.split(" ").length > 8) return "";
  return cleaned;
}

/** Search text is the public topic only. Notes, chapters, and questions are never included. */
export function publicSearchQuery(topic: string, kind: "expanded" | "scenario") {
  const subject = sanitizePublicTopic(topic);
  if (!subject) return null;
  const focus =
    kind === "scenario"
      ? "EMT student scenario practice principles"
      : "EMT education standards";
  return `${focus} ${subject}`;
}

export function citationFromUrl(url: string): PublicCitation | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const allowed = SOURCE_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
  if (!allowed) return null;
  const title = host.includes("nremt")
    ? "NREMT"
    : host === "ems.gov" || host.endsWith(".ems.gov")
      ? "EMS.gov"
      : "American Heart Association";
  return { title, url: parsed.toString() };
}

export function citationsFromOutput(output: unknown): PublicCitation[] {
  const found: PublicCitation[] = [];
  const seen = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") {
      if (typeof value === "string" && /^https:\/\//.test(value)) {
        const citation = citationFromUrl(value);
        if (citation && !seen.has(citation.url)) {
          seen.add(citation.url);
          found.push(citation);
        }
      }
      return;
    }
    for (const entry of Object.values(value as Record<string, unknown>)) visit(entry);
  };
  visit(output);
  return found.slice(0, 6);
}

export function keepVerifiedUrls(text: string, citations: PublicCitation[]) {
  return text.replace(/https?:\/\/[^\s)]+/g, (url) => {
    const bare = url.replace(/[.,]+$/, "");
    return citations.some((citation) => citation.url.startsWith(bare) || bare.startsWith(citation.url))
      ? url
      : "[unverified link removed]";
  });
}

export function sourceFooter(citations: PublicCitation[], retrievedAt: string) {
  if (!citations.length) {
    return "No page from NREMT, EMS.gov, or the American Heart Association was retrieved, so no external source is included. This is not a statement that those organizations have no guidance.";
  }
  const lines = citations.map((citation) => `${citation.title}: ${citation.url}`);
  return `Retrieved ${retrievedAt} from:\n${lines.join("\n")}\nThese pages were retrieved at that time. They are educational references, not local EMS protocols, and they do not replace your assigned material.`;
}
