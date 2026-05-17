// Shared helpers for templates, drafts, and validation.

export function applyVariables(text: string, vars: Record<string, string>): string {
  if (!text) return "";
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`));
}

export function extractVariables(text: string): string[] {
  const found = new Set<string>();
  const re = /\{([a-zA-Z0-9_]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || ""))) found.add(m[1]);
  return Array.from(found);
}

export function isValidUrl(u: string): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let t: any;
  return ((...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  }) as T;
}
