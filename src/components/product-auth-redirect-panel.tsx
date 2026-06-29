import { useEffect, useState, type FormEvent } from "react";
import type { AdminProductListItem, ClassKitClient, ProductAuthProvider } from "@class-kit/react";
import { adminBadgeClass } from "./admin-badge";
import { AdminEmptyState, AdminPanelMessage } from "./admin-feedback";

type ProductAuthRedirectPanelProps = {
	client: ClassKitClient;
	product: AdminProductListItem;
	onChanged: () => Promise<void>;
};

export function ProductAuthRedirectPanel({ client, product, onChanged }: ProductAuthRedirectPanelProps) {
	const [provider, setProvider] = useState<ProductAuthProvider>("google");
	const [origin, setOrigin] = useState(product.product_allowed_origins[0]?.origin ?? "");
	const [redirectUrl, setRedirectUrl] = useState("");
	const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const redirects = product.product_auth_redirects ?? [];
	const origins = product.product_allowed_origins ?? [];

	useEffect(() => {
		if (origins.length === 0) {
			if (origin) setOrigin("");
			return;
		}

		if (!origins.some((productOrigin) => productOrigin.origin === origin)) {
			setOrigin(origins[0].origin);
		}
	}, [origin, origins]);

	async function handleAddRedirect(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setMessage(null);
		setError(null);

		try {
			await client.admin.products.addAuthRedirect({
				productKey: product.product_key,
				provider,
				origin,
				redirectUrl,
			});
			setRedirectUrl("");
			setPendingRemoval(null);
			setMessage(`Added ${redirectUrl} for ${origin}. Add this URL to the Supabase Auth redirect allow list too.`);
			await onChanged();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not add auth redirect URL.");
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleSetDefault(redirect: AdminProductListItem["product_auth_redirects"][number]) {
		setIsSubmitting(true);
		setMessage(null);
		setError(null);

		try {
			await client.admin.products.setDefaultAuthRedirect({
				productKey: product.product_key,
				provider: redirect.provider,
				environment: redirect.environment,
				origin: redirect.origin ?? undefined,
				redirectUrl: redirect.redirect_url,
			});
			setMessage(`Set ${redirect.redirect_url} as the default ${redirect.provider} redirect.`);
			await onChanged();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not set default auth redirect URL.");
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleRemove(redirect: AdminProductListItem["product_auth_redirects"][number]) {
		setIsSubmitting(true);
		setMessage(null);
		setError(null);

		try {
			await client.admin.products.removeAuthRedirect({
				productKey: product.product_key,
				provider: redirect.provider,
				environment: redirect.environment,
				origin: redirect.origin ?? undefined,
				redirectUrl: redirect.redirect_url,
			});
			setPendingRemoval(null);
			setMessage(`Removed ${redirect.redirect_url}.`);
			await onChanged();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not remove auth redirect URL.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<section className="rounded-md border border-border bg-card p-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h2 className="admin-panel-title">Auth redirects</h2>
					<p className="admin-meta mt-1">Product-owned OAuth return URLs. Supabase must allow-list them globally too.</p>
				</div>
				<span className={adminBadgeClass({ tone: "muted" })}>
					{redirects.length} {redirects.length === 1 ? "redirect" : "redirects"}
				</span>
			</div>
			{redirects.length > 0 ? (
				<ul className="mt-3 grid gap-2">
					{redirects.map((redirect) => {
						const key = `${redirect.provider}:${redirect.environment}:${redirect.origin ?? "legacy"}:${redirect.redirect_url}`;
						return (
							<li key={key} className="grid gap-2 rounded-md border border-border px-3 py-2 text-sm md:grid-cols-[1fr_auto] md:items-center">
								<span className="grid min-w-0 gap-1">
									<span className="admin-code truncate" title={redirect.redirect_url}>{redirect.redirect_url}</span>
									{redirect.origin ? <span className="admin-code truncate text-muted-foreground" title={redirect.origin}>origin: {redirect.origin}</span> : null}
									<span className="flex flex-wrap gap-2">
										<span className={adminBadgeClass({ tone: redirect.provider === "google" ? "active" : "muted", size: "compact" })}>{redirect.provider}</span>
										<span className={adminBadgeClass({ tone: redirect.environment === "production" ? "active" : "muted", size: "compact" })}>{redirect.environment}</span>
										{redirect.origin ? <span className={adminBadgeClass({ tone: "selected-muted", size: "compact" })}>origin-bound</span> : null}
										{redirect.is_default ? <span className={adminBadgeClass({ tone: "selected-muted", size: "compact" })}>default</span> : null}
									</span>
								</span>
								<div className="flex flex-wrap items-center gap-2 md:justify-end">
									{!redirect.is_default ? (
										<button type="button" className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60" onClick={() => void handleSetDefault(redirect)} disabled={isSubmitting}>
											Set default
										</button>
									) : null}
									{pendingRemoval === key ? (
										<>
											<button type="button" className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-destructive px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60" onClick={() => void handleRemove(redirect)} disabled={isSubmitting}>
												{isSubmitting ? "Removing" : "Confirm remove"}
											</button>
											<button type="button" className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60" onClick={() => setPendingRemoval(null)} disabled={isSubmitting}>
												Cancel
											</button>
										</>
									) : (
										<button type="button" className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:border-destructive hover:text-foreground disabled:opacity-60" onClick={() => setPendingRemoval(key)} disabled={isSubmitting}>
											Remove
										</button>
									)}
								</div>
							</li>
						);
					})}
				</ul>
			) : (
				<AdminEmptyState className="mt-3">No auth redirects configured yet. Add one bound to an allowed origin before enabling OAuth.</AdminEmptyState>
			)}
			<form className="mt-4 grid gap-3 md:grid-cols-[9rem_minmax(14rem,20rem)_minmax(0,1fr)] md:items-end" onSubmit={handleAddRedirect}>
				<label className="grid gap-1 text-sm">
					<span className="font-medium">Provider</span>
					<select className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" value={provider} onChange={(event) => setProvider(event.target.value as ProductAuthProvider)} disabled={isSubmitting}>
						<option value="google">google</option>
						<option value="apple">apple</option>
					</select>
				</label>
				<label className="grid gap-1 text-sm">
					<span className="font-medium">Origin</span>
					<select className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" value={origin} onChange={(event) => setOrigin(event.target.value)} disabled={isSubmitting || origins.length === 0}>
						{origins.map((productOrigin) => (
							<option key={productOrigin.origin} value={productOrigin.origin}>
								{productOrigin.origin} ({productOrigin.environment})
							</option>
						))}
					</select>
				</label>
				<label className="grid gap-1 text-sm">
					<span className="font-medium">Redirect URL</span>
					<input className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" type="url" value={redirectUrl} onChange={(event) => setRedirectUrl(event.target.value)} required disabled={isSubmitting} />
				</label>
				<button type="submit" className="inline-flex h-10 w-fit max-w-full items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60 md:col-span-3" disabled={isSubmitting || !origin}>
					{isSubmitting ? "Saving redirect" : "Add auth redirect"}
				</button>
			</form>
			<div className="mt-3">
				<AdminPanelMessage message={message} error={error} />
			</div>
		</section>
	);
}
