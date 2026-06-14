import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/run-auto-posting")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runAutoPostingTick } = await import("@/lib/auto-posting.server");
          const { runAutoPostingQueueTick } = await import("@/lib/auto-posting-queue.server");
          const [jobs, queue] = await Promise.all([
            runAutoPostingTick(supabaseAdmin).catch((e) => ({ ok: false, error: String(e?.message ?? e) })),
            runAutoPostingQueueTick(supabaseAdmin).catch((e) => ({ error: String(e?.message ?? e) })),
          ]);
          return new Response(JSON.stringify({ ok: true, jobs, queue }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[auto-posting] tick failed", e);
          return new Response(
            JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
