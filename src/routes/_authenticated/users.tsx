import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateUser, adminListUsers, adminUpdateUser, adminDeleteUser } from "@/lib/admin.functions";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldAlert, Trash2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function UsersPage() {
  const { isAdmin } = useAuth();
  const listFn = useServerFn(adminListUsers);
  const createFn = useServerFn(adminCreateUser);
  const updateFn = useServerFn(adminUpdateUser);
  const deleteFn = useServerFn(adminDeleteUser);
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "operator" as "admin" | "operator", status: "active" as "active" | "inactive" });
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setRows(await listFn({})); } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="panel rounded-2xl p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-3 font-medium">Akses ditolak. Hanya admin yang dapat mengelola pengguna.</p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createFn({ data: form });
      toast.success("User dibuat");
      setForm({ name: "", email: "", password: "", role: "operator", status: "active" });
      load();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  }
  async function changeRole(uid: string, role: "admin" | "operator") {
    try { await updateFn({ data: { targetUserId: uid, role } }); toast.success("Role diperbarui"); load(); } catch (e: any) { toast.error(e.message); }
  }
  async function changeStatus(uid: string, status: "active" | "inactive") {
    try { await updateFn({ data: { targetUserId: uid, status } }); toast.success("Status diperbarui"); load(); } catch (e: any) { toast.error(e.message); }
  }
  async function del(uid: string) {
    if (!confirm("Hapus user ini?")) return;
    try { await deleteFn({ data: { targetUserId: uid } }); toast.success("User dihapus"); load(); } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div>
      <PageHeader title="Tambah Pengguna" subtitle="Kelola admin dan operator" />
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={submit} className="panel rounded-2xl p-6 lg:col-span-1">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><UserPlus className="h-4 w-4" />User Baru</h2>
          <div className="space-y-3">
            <div><Label>Nama</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Password</Label><Input required minLength={6} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Role</Label>
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <Button disabled={busy} className="w-full glow">{busy ? "Menyimpan…" : "Simpan"}</Button>
          </div>
        </form>

        <div className="panel rounded-2xl lg:col-span-2 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">Nama</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((u) => (
                <tr key={u.user_id} className="hover:bg-muted/20">
                  <td className="p-3 font-medium">{u.name || "—"}</td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3">
                    <select value={u.role} onChange={(e) => changeRole(u.user_id, e.target.value as any)} className="h-8 rounded border border-input bg-background px-2 text-xs">
                      <option value="operator">operator</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <select value={u.status} onChange={(e) => changeStatus(u.user_id, e.target.value as any)} className="h-8 rounded border border-input bg-background px-2 text-xs">
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </td>
                  <td className="p-3 text-right"><Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(u.user_id)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
