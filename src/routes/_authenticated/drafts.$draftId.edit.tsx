import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { PostEditor } from "@/components/PostEditor";

export const Route = createFileRoute("/_authenticated/drafts/$draftId/edit")({
  component: EditDraftPage,
});

function EditDraftPage() {
  const { draftId } = Route.useParams();
  return (
    <div>
      <PageHeader title="Edit Draft" subtitle="Lanjutkan postingan yang tersimpan otomatis" />
      <PostEditor draftId={draftId} />
    </div>
  );
}
