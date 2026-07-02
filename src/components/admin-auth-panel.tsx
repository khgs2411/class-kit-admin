import { useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import type { ClassKitClient } from "@class-kit/react";
import { KeyRound, Lock, LogIn, LogOut, Mail } from "lucide-react";
import type { SupabaseTarget } from "../class-kit-client";

type AdminAuthPanelProps = {
	client: ClassKitClient | null;
	session: Session | null;
	error: string | null;
	supabaseTarget: SupabaseTarget;
	onSignedIn: () => Promise<void>;
};

type PlatformAppAuthRedirect = {
	provider: "google" | "apple";
	environment: "development" | "production";
	redirect_url: string;
	is_default: boolean;
};

type PlatformAppContextResponse = {
	app: {
		auth_redirects: PlatformAppAuthRedirect[];
	};
};

type ApiResponse<T> =
	| { data: T; error: null }
	| { data: null; error: { message: string } };

function getBrowserEnvironment(): PlatformAppAuthRedirect["environment"] {
	const hostname = window.location.hostname;
	return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" ? "development" : "production";
}

function getClassKitSiteHeaders(): Record<string, string> {
	const url = new URL(window.location.href);
	url.hash = "";
	url.search = "";
	return { "x-class-kit-site-url": url.pathname === "/" ? url.origin : url.href };
}

function getDefaultGoogleRedirect(context: PlatformAppContextResponse): string | null {
	const redirects = context.app.auth_redirects.filter((redirect) => redirect.provider === "google");
	const environmentRedirects = redirects.filter((redirect) => redirect.environment === getBrowserEnvironment());
	return environmentRedirects.find((redirect) => redirect.is_default)?.redirect_url ??
		environmentRedirects[0]?.redirect_url ??
		redirects.find((redirect) => redirect.is_default)?.redirect_url ??
		redirects[0]?.redirect_url ??
		null;
}

export function AdminAuthPanel({ client, session, error, supabaseTarget, onSignedIn }: AdminAuthPanelProps) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [localError, setLocalError] = useState<string | null>(null);
	const isLocalTarget = supabaseTarget === "local";

	async function handlePasswordSignIn(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!client) {
			setLocalError("Class Kit client is not configured.");
			return;
		}

		setIsSubmitting(true);
		setLocalError(null);
		try {
			const result = await client.auth.signIn(email, password);
			if (result.error) {
				setLocalError(result.error);
				return;
			}

			await onSignedIn();
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleGoogleSignIn() {
		if (!client) {
			setLocalError("Class Kit client is not configured.");
			return;
		}

		setIsSubmitting(true);
		setLocalError(null);
		const { data: context, error: contextError } = await client.supabase.functions.invoke<ApiResponse<PlatformAppContextResponse>>(
			"class-kit-platform-app-context",
			{ body: { app_key: "class-kit-admin" }, headers: getClassKitSiteHeaders() },
		);
		const redirectTo = context?.data ? getDefaultGoogleRedirect(context.data) : null;

		if (contextError || context?.error || !redirectTo) {
			setLocalError(context?.error?.message ?? contextError?.message ?? "Google OAuth redirect is not configured for class-kit-admin.");
			setIsSubmitting(false);
			return;
		}

		const { error } = await client.supabase.auth.signInWithOAuth({
			provider: "google",
			options: { redirectTo },
		});
		if (error) {
			setLocalError(error.message);
			setIsSubmitting(false);
		}
	}

	async function handleSignOut() {
		if (!client) return;
		setIsSubmitting(true);
		setLocalError(null);
		const result = await client.auth.signOut();
		if (result.error) setLocalError(result.error);
		await onSignedIn();
		setIsSubmitting(false);
	}

	return (
		<section className="rounded-md border border-border bg-card px-4 py-3">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="text-sm font-semibold">Admin access</h2>
					<p className="admin-meta mt-1 truncate">
						{session
							? session.user.email ?? "Signed in"
							: isLocalTarget
								? "Sign in with your local platform admin account."
								: "Sign in with your platform admin Google account."}
					</p>
				</div>
				{session ? (
					<button
						type="button"
						className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border px-3 text-sm font-semibold hover:border-primary disabled:opacity-60"
						onClick={handleSignOut}
						disabled={isSubmitting}
					>
						<LogOut className="size-4" aria-hidden="true" />
						Sign out
					</button>
				) : isLocalTarget ? (
					<form className="grid gap-2 md:min-w-[24rem]" onSubmit={(event) => void handlePasswordSignIn(event)}>
						<div className="grid gap-2 sm:grid-cols-2">
							<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
								<span>Email</span>
								<span className="flex h-10 min-w-0 items-center gap-2 rounded-md border border-input bg-background px-3">
									<Mail className="size-4 shrink-0" aria-hidden="true" />
									<input
										className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
										type="email"
										value={email}
										autoComplete="email"
										onChange={(event) => setEmail(event.target.value)}
										required
										disabled={isSubmitting || !client}
									/>
								</span>
							</label>
							<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
								<span>Password</span>
								<span className="flex h-10 min-w-0 items-center gap-2 rounded-md border border-input bg-background px-3">
									<Lock className="size-4 shrink-0" aria-hidden="true" />
									<input
										className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
										type="password"
										value={password}
										autoComplete="current-password"
										onChange={(event) => setPassword(event.target.value)}
										required
										disabled={isSubmitting || !client}
									/>
								</span>
							</label>
						</div>
						<button
							type="submit"
							className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
							disabled={isSubmitting || !client}
						>
							<LogIn className="size-4" aria-hidden="true" />
							{isSubmitting ? "Signing in" : "Sign in"}
						</button>
					</form>
				) : (
					<div className="flex flex-wrap gap-2 md:justify-end">
						<button
							type="button"
							className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
							onClick={() => void handleGoogleSignIn()}
							disabled={isSubmitting || !client}
						>
							<KeyRound className="size-4" aria-hidden="true" />
							{isSubmitting ? "Redirecting" : "Sign in with Google"}
						</button>
					</div>
				)}
			</div>
			{error || localError ? <p className="mt-3 text-sm font-medium text-destructive">{localError ?? error}</p> : null}
		</section>
	);
}
