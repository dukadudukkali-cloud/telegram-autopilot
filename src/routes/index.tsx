import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const nav = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      nav({ to: data.session ? "/dashboard" : "/login", replace: true });
    });
  }, [nav]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-gradient-neon font-display text-2xl">Loading…</div>
    </div>
  );
}
