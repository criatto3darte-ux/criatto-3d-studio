import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminLayout } from "@/features/admin/layout/AdminLayout";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: () => (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  ),
});
