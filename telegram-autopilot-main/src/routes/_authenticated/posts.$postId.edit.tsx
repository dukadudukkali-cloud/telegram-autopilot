import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { PostEditor } from "@/components/PostEditor";

export const Route = createFileRoute("/_authenticated/posts/$postId/edit")({
  component: EditPage,
});

function EditPage() {
  const { postId } = Route.useParams();
  return (
    <div>
      <PageHeader title="Edit Postingan" subtitle="Ubah postingan, tombol, atau jadwalkan ulang" />
      <PostEditor postId={postId} />
    </div>
  );
}
