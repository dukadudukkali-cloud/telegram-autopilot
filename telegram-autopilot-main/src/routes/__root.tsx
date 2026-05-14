import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Telegram Auto Poster Bot" },
      { name: "description", content: "Dashboard premium untuk auto-posting ke Telegram Channel." },
      { property: "og:title", content: "Telegram Auto Poster Bot" },
      { name: "twitter:title", content: "Telegram Auto Poster Bot" },
      {
        property: "og:description",
        content: "Dashboard premium untuk auto-posting ke Telegram Channel.",
      },
      {
        name: "twitter:description",
        content: "Dashboard premium untuk auto-posting ke Telegram Channel.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/84722f41-eadb-407c-a094-6d537c8c5432/id-preview-d7ecf56a--adca2799-21f4-4ffc-a993-30a2f3f1f850.lovable.app-1778543098574.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/84722f41-eadb-407c-a094-6d537c8c5432/id-preview-d7ecf56a--adca2799-21f4-4ffc-a993-30a2f3f1f850.lovable.app-1778543098574.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gradient-neon">404</h1>
        <p className="mt-3 text-muted-foreground">Halaman tidak ditemukan.</p>
        <a href="/" className="mt-4 inline-block text-primary hover:underline">
          Kembali
        </a>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
