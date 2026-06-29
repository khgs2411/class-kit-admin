import { useMemo, useState, type FormEvent } from "react";
import type { AdminProductListItem, ClassKitClient, ProductAuthMode } from "@class-kit/react";

type ProductAuthPolicyPanelProps = {
	client: ClassKitClient;
	product: AdminProductListItem;
	onChanged: () => Promise<void>;
};

type AuthPolicyDraft = {
	productKey: string;
	baseAuthMode: ProductAuthMode;
	baseEmailPasswordEnabled: boolean;
	baseGoogleOauthEnabled: boolean;
	authMode: ProductAuthMode;
	emailPasswordEnabled: boolean;
	googleOauthEnabled: boolean;
};

export function ProductAuthPolicyPanel({ client, product, onChanged }: ProductAuthPolicyPanelProps) {
	const [draft, setDraft] = useState<AuthPolicyDraft>(() => createAuthPolicyDraft(product));
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState<{ productKey: string; text: string } | null>(null);
	const [error, setError] = useState<{ productKey: string; text: string } | null>(null);
	const currentDraft = isDraftCurrent(draft, product) ? draft : createAuthPolicyDraft(product);
	const changes = useMemo(() => {
		const nextChanges: string[] = [];
		if (currentDraft.authMode !== currentDraft.baseAuthMode) nextChanges.push(`auth mode ${currentDraft.baseAuthMode} -> ${currentDraft.authMode}`);
		if (currentDraft.emailPasswordEnabled !== currentDraft.baseEmailPasswordEnabled) nextChanges.push(`email password ${formatEnabled(currentDraft.baseEmailPasswordEnabled)} -> ${formatEnabled(currentDraft.emailPasswordEnabled)}`);
		if (currentDraft.googleOauthEnabled !== currentDraft.baseGoogleOauthEnabled) nextChanges.push(`Google OAuth ${formatEnabled(currentDraft.baseGoogleOauthEnabled)} -> ${formatEnabled(currentDraft.googleOauthEnabled)}`);
		return nextChanges;
	}, [currentDraft]);
	const hasChanges = changes.length > 0;
	const visibleMessage = message?.productKey === product.product_key ? message.text : null;
	const visibleError = error?.productKey === product.product_key ? error.text : null;

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!hasChanges) {
			setMessage({ productKey: product.product_key, text: "No auth policy changes to save." });
			setError(null);
			return;
		}

		setIsSubmitting(true);
		setMessage(null);
		setError(null);
		const savedChanges = changes;

		try {
			await client.admin.products.updateAuthPolicy({
				productKey: product.product_key,
				authMode: currentDraft.authMode,
				emailPasswordEnabled: currentDraft.emailPasswordEnabled,
				googleOauthEnabled: currentDraft.googleOauthEnabled,
			});
			setMessage({ productKey: product.product_key, text: `Saved auth policy: ${savedChanges.join("; ")}.` });
			await onChanged();
		} catch (caught) {
			setError({ productKey: product.product_key, text: caught instanceof Error ? caught.message : "Could not update auth policy." });
		} finally {
			setIsSubmitting(false);
		}
	}

	function updateDraft(patch: Partial<Pick<AuthPolicyDraft, "authMode" | "emailPasswordEnabled" | "googleOauthEnabled">>) {
		setDraft((current) => ({ ...(isDraftCurrent(current, product) ? current : createAuthPolicyDraft(product)), ...patch }));
		setMessage(null);
		setError(null);
	}

	return (
		<section className="rounded-md border border-border bg-card p-4">
			<h2 className="admin-panel-title">Auth policy</h2>
			<form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
				<label className="grid gap-1 text-sm">
					<span className="font-medium">Auth mode</span>
					<select className="h-10 rounded-md border border-input bg-background px-3" value={currentDraft.authMode} onChange={(event) => updateDraft({ authMode: event.target.value as ProductAuthMode })}>
						<option value="open">open</option>
						<option value="invite_only">invite_only</option>
					</select>
				</label>
				<div className="flex flex-wrap gap-4 text-sm">
					<label className="flex items-center gap-2">
						<input type="checkbox" checked={currentDraft.emailPasswordEnabled} onChange={(event) => updateDraft({ emailPasswordEnabled: event.target.checked })} />
						Email password
					</label>
					<label className="flex items-center gap-2">
						<input type="checkbox" checked={currentDraft.googleOauthEnabled} onChange={(event) => updateDraft({ googleOauthEnabled: event.target.checked })} />
						Google OAuth
					</label>
				</div>
				{hasChanges ? <p className="admin-meta">Pending changes: {changes.join("; ")}.</p> : <p className="admin-meta">No pending auth policy changes.</p>}
				<button type="submit" className="inline-flex h-10 w-fit max-w-full items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={isSubmitting || !hasChanges}>
					{isSubmitting ? "Saving auth policy" : "Save auth policy"}
				</button>
			</form>
			{visibleMessage || visibleError ? <p className={`mt-3 text-sm font-medium ${visibleError ? "text-destructive" : "text-muted-foreground"}`}>{visibleError ?? visibleMessage}</p> : null}
		</section>
	);
}

function createAuthPolicyDraft(product: AdminProductListItem): AuthPolicyDraft {
	return {
		productKey: product.product_key,
		baseAuthMode: product.auth_mode,
		baseEmailPasswordEnabled: product.email_password_enabled,
		baseGoogleOauthEnabled: product.google_oauth_enabled,
		authMode: product.auth_mode,
		emailPasswordEnabled: product.email_password_enabled,
		googleOauthEnabled: product.google_oauth_enabled,
	};
}

function isDraftCurrent(draft: AuthPolicyDraft, product: AdminProductListItem) {
	return draft.productKey === product.product_key
		&& draft.baseAuthMode === product.auth_mode
		&& draft.baseEmailPasswordEnabled === product.email_password_enabled
		&& draft.baseGoogleOauthEnabled === product.google_oauth_enabled;
}

function formatEnabled(value: boolean) {
	return value ? "enabled" : "disabled";
}
