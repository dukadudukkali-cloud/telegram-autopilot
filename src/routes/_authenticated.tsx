import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const nav = useNavigate();
  const { loading, user, role, isAdmin } = useAuth();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login", replace: true });
  }, [loading, user, nav]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gradient-neon font-display">Loading…</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar isAdmin={isAdmin} />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/60 bg-background/70 px-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="hidden text-sm text-muted-foreground sm:block">
                Selamat datang, <span className="font-medium text-foreground">{user.email}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[var(--neon-cyan)]/40 bg-[var(--neon-cyan)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--neon-cyan)]">
                {role || "user"}
              </span>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
