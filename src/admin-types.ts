import type { AdminProductListItem } from "@class-kit/react";

export type AdminBoardStatus = "loading" | "signed_out" | "ready" | "forbidden" | "error";

export type SelectedAdminProduct = AdminProductListItem | null;
