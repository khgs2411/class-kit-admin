import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { ClassKitClient } from "@class-kit/react";
import { KeyRound, LogOut } from "lucide-react";

type AdminAuthPanelProps = {
	client: ClassKitClient | null;
	session: Session | null;
	error: string | null;
	onSignedIn: () => Promise<void>;
};

export function AdminAuthPanel({ client, session, error, onSignedIn }: AdminAuthPanelProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [localError, setLocalError] = useState<string | null>(null);

	async function handleGoogleSignIn() {
		if (!client) {
			setLocalError("Class Kit client is not configured.");
			return;
		}

		setIsSubmitting(true);
		setLocalError(null);
		const result = await client.auth.signInWithGoogle();
		if (result.error) {
			setLocalError(result.error);
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
						{session ? session.user.email ?? "Signed in" : "Sign in with your platform admin Google account."}
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
