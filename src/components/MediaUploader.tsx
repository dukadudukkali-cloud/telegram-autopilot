import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, GripVertical, Image as ImageIcon, Film, Loader2 } from "lucide-react";

export type MediaItem = {
  id: string;
  type: "image" | "video";
  url: string;
  thumb_url?: string | null;
  file_size?: number;
  mime_type?: string;
  name?: string;
};

const IMG_MAX = 10 * 1024 * 1024;
const VID_MAX = 100 * 1024 * 1024;
const IMG_MIMES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const VID_MIMES = ["video/mp4", "video/quicktime", "video/webm"];

function fmtSize(b?: number) {
  if (!b && b !== 0) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

async function videoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.1, video.duration / 2);
      } catch {
        resolve(null);
      }
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => {
        URL.revokeObjectURL(url);
        resolve(b);
      }, "image/jpeg", 0.85);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
}

export function MediaUploader({
  value,
  onChange,
  bucket = "telegram-media",
  max = 10,
}: {
  value: MediaItem[];
  onChange: (next: MediaItem[]) => void;
  bucket?: string;
  max?: number;
}) {
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const upload = useCallback(
    async (files: File[]) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Login dulu");
        return;
      }
      const slots = Math.max(0, max - value.length);
      const todo = files.slice(0, slots);
      if (files.length > slots) toast.warning(`Hanya ${slots} file diupload (limit ${max})`);

      const next: MediaItem[] = [...value];
      for (const file of todo) {
        const isImg = IMG_MIMES.includes(file.type) || file.type.startsWith("image/");
        const isVid = VID_MIMES.includes(file.type) || file.type.startsWith("video/");
        if (!isImg && !isVid) {
          toast.error(`Format tidak didukung: ${file.name}`);
          continue;
        }
        if (isImg && file.size > IMG_MAX) {
          toast.error(`Gambar > 10MB: ${file.name}`);
          continue;
        }
        if (isVid && file.size > VID_MAX) {
          toast.error(`Video > 100MB: ${file.name}`);
          continue;
        }

        const id = crypto.randomUUID();
        const ext = file.name.split(".").pop() || (isImg ? "jpg" : "mp4");
        const folder = isImg ? "images" : "videos";
        const path = `${u.user.id}/${folder}/${id}.${ext}`;
        setProgress((p) => ({ ...p, [id]: 1 }));

        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
        if (error) {
          toast.error(`Upload gagal: ${error.message}`);
          setProgress((p) => {
            const { [id]: _, ...rest } = p;
            return rest;
          });
          continue;
        }
        setProgress((p) => ({ ...p, [id]: 60 }));
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);

        let thumb_url: string | undefined;
        if (isVid) {
          const thumbBlob = await videoThumbnail(file);
          if (thumbBlob) {
            const thumbPath = `${u.user.id}/videos/${id}.thumb.jpg`;
            await supabase.storage.from(bucket).upload(thumbPath, thumbBlob, {
              contentType: "image/jpeg",
              upsert: true,
            });
            thumb_url = supabase.storage.from(bucket).getPublicUrl(thumbPath).data.publicUrl;
          }
        }

        next.push({
          id,
          type: isImg ? "image" : "video",
          url: pub.publicUrl,
          thumb_url,
          file_size: file.size,
          mime_type: file.type,
          name: file.name,
        });
        setProgress((p) => {
          const { [id]: _, ...rest } = p;
          return rest;
        });
      }
      onChange(next);
    },
    [value, onChange, bucket, max],
  );

  // paste handler
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const it of items) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) upload(files);
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [upload]);

  const remove = (id: string) => onChange(value.filter((m) => m.id !== id));

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length) upload(files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${
          isDragging
            ? "border-[var(--neon-cyan)] bg-[color-mix(in_oklab,var(--neon-cyan)_8%,transparent)]"
            : "border-border hover:border-[var(--neon-cyan)]/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={[...IMG_MIMES, ...VID_MIMES].join(",")}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) upload(files);
            e.target.value = "";
          }}
        />
        <Upload className="mx-auto mb-2 h-6 w-6 text-[var(--neon-cyan)]" />
        <p className="text-sm font-medium">Drop, paste, atau klik untuk upload</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Gambar (PNG/JPG/WEBP ≤ 10MB) · Video (MP4/MOV/WEBM ≤ 100MB) · max {max} file
        </p>
      </div>

      {(value.length > 0 || Object.keys(progress).length > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <AnimatePresence>
            {value.map((m, i) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIdx !== null) reorder(dragIdx, i);
                  setDragIdx(null);
                }}
                className="group relative overflow-hidden rounded-xl border border-border bg-muted/30"
              >
                <div className="aspect-square w-full">
                  {m.type === "image" ? (
                    <img src={m.url} alt={m.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : m.thumb_url ? (
                    <img src={m.thumb_url} alt={m.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <video src={m.url} className="h-full w-full object-cover" muted />
                  )}
                </div>
                <div className="absolute left-1 top-1 flex items-center gap-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] backdrop-blur">
                  {m.type === "image" ? <ImageIcon className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                  <span>{fmtSize(m.file_size)}</span>
                </div>
                <button
                  onClick={() => remove(m.id)}
                  className="absolute right-1 top-1 rounded-md bg-destructive/90 p-1 text-destructive-foreground opacity-0 transition group-hover:opacity-100"
                  type="button"
                  aria-label="Hapus media"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-1 left-1 cursor-grab rounded-md bg-background/80 p-1 opacity-0 transition group-hover:opacity-100">
                  <GripVertical className="h-3 w-3" />
                </div>
                <div className="absolute bottom-1 right-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-bold">
                  #{i + 1}
                </div>
              </motion.div>
            ))}
            {Object.entries(progress).map(([id, p]) => (
              <motion.div
                key={id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex aspect-square items-center justify-center rounded-xl border border-border bg-muted/30"
              >
                <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--neon-cyan)]" />
                  <span>{p}%</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {value.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Tip: tarik-geser thumbnail untuk mengubah urutan.
        </p>
      )}
    </div>
  );
}
