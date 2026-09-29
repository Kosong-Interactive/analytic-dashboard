/**
 * Only same-site paths are accepted as a post-login destination, so a crafted
 * `?next=` link cannot send someone to another site after they sign in.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  if (value === "/login" || value.startsWith("/login?")) return "/";
  return value;
}

export function loginPath(next: string): string {
  const safe = safeNextPath(next);
  return safe === "/" ? "/login" : `/login?next=${encodeURIComponent(safe)}`;
}
