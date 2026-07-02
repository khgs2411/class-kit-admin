import { createClassKitClient } from "@class-kit/react";

export type SupabaseTarget = "local" | "remote";

const requestedTarget: SupabaseTarget = import.meta.env.VITE_CLASS_KIT_TARGET === "local" ? "local" : "remote";
export const supabaseTarget: SupabaseTarget = import.meta.env.PROD ? "remote" : requestedTarget;

export const classKitClient = createClassKitClient(import.meta.env, {
	authStorageKey: "class-kit-admin-auth",
});
