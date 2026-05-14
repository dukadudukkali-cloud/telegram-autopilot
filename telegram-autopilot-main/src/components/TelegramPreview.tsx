type Btn = { button_text: string; button_url: string };

export function TelegramPreview({
  channelName,
  imageUrl,
  caption,
  buttons,
}: {
  channelName?: string;
  imageUrl?: string | null;
  caption?: string;
  buttons?: Btn[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-[oklch(0.16_0.02_270)] p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-neon-cyan to-neon-violet text-xs font-bold text-background">
          {(channelName || "TG").slice(0, 2).toUpperCase()}
        </div>
        <div className="text-sm font-medium">{channelName || "Telegram Channel"}</div>
      </div>
      <div className="overflow-hidden rounded-xl bg-[oklch(0.2_0.03_270)]">
        {imageUrl ? (
          <img src={imageUrl} alt="post preview" className="aspect-square w-full object-cover" />
        ) : (
          <div className="flex aspect-video items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
        <div className="space-y-2 p-3">
          {caption ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{caption}</p>
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
  );
}
