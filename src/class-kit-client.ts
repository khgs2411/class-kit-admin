import { createClassKitClient, type ClassKitClient } from "@class-kit/react";

export type SupabaseTarget = "local" | "remote";

const requestedTarget: SupabaseTarget = import.meta.env.VITE_CLASS_KIT_TARGET === "local" ? "local" : "remote";
export const supabaseTarget: SupabaseTarget = import.meta.env.PROD ? "remote" : requestedTarget;

export const classKitClient = createClassKitClient(import.meta.env, {
	authStorageKey: "class-kit-admin-auth",
});

export function createSelectedProductClient(productKey: string): ClassKitClient | null {
	if (!classKitClient || !isLocalBrowserOrigin()) return null;

	return createClassKitClient({
		supabaseClient: classKitClient.supabase,
		productKey,
		authStorageKey: classKitClient.authStorageKey,
	});
}

function isLocalBrowserOrigin() {
	const hostname = window.location.hostname;
	return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
