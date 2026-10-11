export function displayName(
  profile?: { firstName?: string; email?: string } | null,
  fallback = "responder",
) {
  const first = profile?.firstName?.trim();
  if (first) return first;
  const local = profile?.email?.split("@")[0]?.trim();
  return local || fallback;
}

export function fullName(profile?: {
  firstName?: string;
  lastName?: string;
  email?: string;
}) {
  const name = [profile?.firstName, profile?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name || displayName(profile);
}

export function initials(profile?: {
  firstName?: string;
  lastName?: string;
  email?: string;
}) {
  const first = profile?.firstName?.trim()?.[0];
  const last = profile?.lastName?.trim()?.[0];
  if (first && last) return `${first}${last}`.toUpperCase();
  if (first) return first.toUpperCase();
  return (profile?.email?.trim()?.[0] || "R").toUpperCase();
}
