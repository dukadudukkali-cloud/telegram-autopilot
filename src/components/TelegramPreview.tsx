import { useState } from "react";
import { Smartphone, Monitor, ChevronLeft, ChevronRight } from "lucide-react";
import type { MediaItem } from "@/components/MediaUploader";

type Btn = { button_text: string; button_url: string };

export function TelegramPreview({
  channelName,
  imageUrl,
  media,
  caption,
  buttons,
}: {
  channelName?: string;
  imageUrl?: string | null;
  media?: MediaItem[];
  caption?: string;
  buttons?: Btn[];
}) {
  const [mode, setMode] = useState<"mobile" | "desktop">("mobile");
  const [idx, setIdx] = useState(0);

  // Normalize media: prefer `media[]`, fall back to legacy imageUrl
  const items: { type: "image" | "video"; url: string; thumb_url?: string | null }[] =
    media && media.length > 0
      ? media
      : imageUrl
      ? [{ type: "image", url: imageUrl }]
      : [];

  const current = items[idx];

  // Render caption with basic HTML tag support (b, i, u, s, code, a)
  const renderedCaption = caption || "";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Preview · {mode === "mobile" ? "Mobile" : "Desktop"}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setMode("mobile")}
            className={`rounded-md p-1.5 transition ${
              mode === "mobile" ? "bg-[var(--neon-cyan)] text-background" : "bg-muted hover:bg-muted/70"
            }`}
            aria-label="Mobile"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setMode("desktop")}
            className={`rounded-md p-1.5 transition ${
              mode === "desktop" ? "bg-[var(--neon-cyan)] text-background" : "bg-muted hover:bg-muted/70"
            }`}
            aria-label="Desktop"
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        className={`mx-auto rounded-2xl border border-border bg-[oklch(0.16_0.02_270)] p-4 shadow-card transition-all ${
          mode === "mobile" ? "max-w-sm" : "max-w-full"
        }`}
      >
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-violet)] text-xs font-bold text-background">
            {(channelName || "TG").slice(0, 2).toUpperCase()}
          </div>
          <div className="text-sm font-medium">{channelName || "Telegram Channel"}</div>
        </div>

        <div className="overflow-hidden rounded-xl bg-[oklch(0.2_0.03_270)]">
          {current ? (
            <div className="relative">
              {current.type === "image" ? (
                <img src={current.url} alt="preview" className="aspect-square w-full object-cover" />
              ) : (
                <video
                  src={current.url}
                  poster={current.thumb_url || undefined}
                  controls
                  className="aspect-square w-full bg-black object-cover"
                />
              )}
              {items.length > 1 && (
                <>
                  <button
                    onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 backdrop-blur"
                    aria-label="Prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setIdx((i) => (i + 1) % items.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 backdrop-blur"
                    aria-label="Next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] backdrop-blur">
                    {idx + 1}/{items.length}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center text-xs text-muted-foreground">
              No media
            </div>
          )}
          <div className="space-y-2 p-3">
            {renderedCaption ? (
              <div
                className="whitespace-pre-wrap text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeTelegramHtml(renderedCaption) }}
              />
            ) : (
              <p className="text-sm italic text-muted-foreground">Caption preview…</p>
            )}
            {buttons && buttons.length > 0 && (
              <div className="grid grid-cols-1 gap-1.5 pt-2">
                {buttons.map((b, i) => (
                  <a
                    key={i}
                    href={b.button_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-[oklch(0.28_0.04_275)] px-3 py-2 text-center text-xs font-medium text-foreground hover:bg-[oklch(0.32_0.05_275)]"
                  >
                    {b.button_text || "Button"}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Minimal sanitizer: allow Telegram-supported tags only
function sanitizeTelegramHtml(html: string): string {
  const allowed = /^(b|strong|i|em|u|s|strike|del|code|pre|a|br)$/i;
  return html.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, tag, attrs) => {
    if (!allowed.test(tag)) return "";
    if (tag.toLowerCase() === "a") {
      const m = /href=("([^"]*)"|'([^']*)')/i.exec(attrs);
      const href = (m?.[2] || m?.[3] || "#").replace(/"/g, "&quot;");
      return full.startsWith("</") ? "</a>" : `<a href="${href}" target="_blank" rel="noreferrer">`;
    }
    return full.startsWith("</") ? `</${tag.toLowerCase()}>` : `<${tag.toLowerCase()}>`;
  });
}
