import { createClassKitClient } from "@class-kit/react";

const localSupabaseUrl = import.meta.env.VITE_LOCAL_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const localSupabasePublishableKey = import.meta.env.VITE_LOCAL_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const remoteSupabaseUrl = import.meta.env.VITE_REMOTE_SUPABASE_URL || "";
const remoteSupabasePublishableKey = import.meta.env.VITE_REMOTE_SUPABASE_PUBLISHABLE_KEY || "";
const requestedTarget = import.meta.env.VITE_SUPABASE_TARGET === "remote" ? "remote" : "local";
const supabaseTarget = import.meta.env.PROD ? "remote" : requestedTarget;

export const classKitClient = createClassKitClient({
	supabaseUrl: supabaseTarget === "remote" ? remoteSupabaseUrl : localSupabaseUrl,
	supabasePublishableKey: supabaseTarget === "remote" ? remoteSupabasePublishableKey : localSupabasePublishableKey,
	authStorageKey: "class-kit-demo-auth",
	authRedirectUrl: import.meta.env.VITE_AUTH_REDIRECT_URL || undefined,
});
