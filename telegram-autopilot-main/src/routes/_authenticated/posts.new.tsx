import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { PostEditor } from "@/components/PostEditor";

export const Route = createFileRoute("/_authenticated/posts/new")({
  component: () => (
    <div>
      <PageHeader
        title="Buat Postingan"
        subtitle="Editor postingan dengan preview Telegram realtime"
      />
      <PostEditor />
    </div>
  ),
});
