import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StoreLayout } from "@/features/store/layout/StoreLayout";

export const Route = createFileRoute("/_store")({
  component: () => (
    <StoreLayout>
      <Outlet />
    </StoreLayout>
  ),
});
