import { useState, type FormEvent } from "react";
import type { AdminProductListItem, ClassKitClient, ProductEnvironment } from "@class-kit/react";
import { adminBadgeClass } from "./admin-badge";
import { AdminEmptyState, AdminPanelMessage } from "./admin-feedback";

type ProductOriginPanelProps = {
	client: ClassKitClient;
	product: AdminProductListItem;
	onChanged: () => Promise<void>;
};

export function ProductOriginPanel({ client, product, onChanged }: ProductOriginPanelProps) {
	const [origin, setOrigin] = useState("");
	const [environment, setEnvironment] = useState<ProductEnvironment>("development");
	const [originPendingRemoval, setOriginPendingRemoval] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function handleAddOrigin(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setMessage(null);
		setError(null);
		const originToAdd = origin;

		try {
			await client.admin.products.addOrigin({
				productKey: product.product_key,
				origin: originToAdd,
				environment,
			});
			setOrigin("");
			setOriginPendingRemoval(null);
			setMessage(`Added ${originToAdd}.`);
			await onChanged();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not add origin.");
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleRemoveOrigin(originToRemove: string) {
		setIsSubmitting(true);
		setMessage(null);
		setError(null);

		try {
			await client.admin.products.removeOrigin({
				productKey: product.product_key,
				origin: originToRemove,
			});
			setOriginPendingRemoval(null);
			setMessage(`Removed ${originToRemove}.`);
			await onChanged();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not remove origin.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<section className="rounded-md border border-border bg-card p-4">
			<div className="flex items-center justify-between gap-3">
				<h2 className="admin-panel-title">Origins</h2>
				<span className={adminBadgeClass({ tone: "muted" })}>
					{product.product_allowed_origins.length} {product.product_allowed_origins.length === 1 ? "origin" : "origins"}
				</span>
			</div>
			{product.product_allowed_origins.length > 0 ? (
				<ul className="mt-3 grid gap-2">
					{product.product_allowed_origins.map((allowedOrigin) => (
						<li key={`${allowedOrigin.environment}:${allowedOrigin.origin}`} className="grid gap-2 rounded-md border border-border px-3 py-2 text-sm md:grid-cols-[1fr_auto] md:items-center">
							<span className="grid min-w-0 gap-1">
								<span className="admin-code truncate" title={allowedOrigin.origin}>{allowedOrigin.origin}</span>
								<span className={adminBadgeClass({ tone: allowedOrigin.environment === "production" ? "active" : "muted", size: "compact", className: "w-fit" })}>{allowedOrigin.environment}</span>
							</span>
							<div className="flex flex-wrap items-center gap-2 md:justify-end">
								{originPendingRemoval === allowedOrigin.origin ? (
									<>
										<button type="button" className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-destructive px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60" onClick={() => void handleRemoveOrigin(allowedOrigin.origin)} disabled={isSubmitting}>
											{isSubmitting ? "Removing" : "Confirm remove"}
										</button>
										<button type="button" className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60" onClick={() => setOriginPendingRemoval(null)} disabled={isSubmitting}>
											Cancel
										</button>
									</>
								) : (
									<button type="button" className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:border-destructive hover:text-foreground disabled:opacity-60" onClick={() => setOriginPendingRemoval(allowedOrigin.origin)} disabled={isSubmitting}>
										Remove
									</button>
								)}
							</div>
						</li>
					))}
				</ul>
			) : (
				<AdminEmptyState className="mt-3">No origins configured yet. Add the first allowed browser origin before using this product from a web app.</AdminEmptyState>
			)}
			<form className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem] md:items-end" onSubmit={handleAddOrigin}>
				<label className="grid gap-1 text-sm">
					<span className="font-medium">Origin</span>
					<input className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" type="url" value={origin} onChange={(event) => setOrigin(event.target.value)} required disabled={isSubmitting} />
				</label>
				<label className="grid gap-1 text-sm">
					<span className="font-medium">Environment</span>
					<select className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" value={environment} onChange={(event) => setEnvironment(event.target.value as ProductEnvironment)} disabled={isSubmitting}>
						<option value="development">development</option>
						<option value="production">production</option>
					</select>
				</label>
				<button type="submit" className="inline-flex h-10 w-fit max-w-full items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60 md:col-span-2" disabled={isSubmitting}>
					{isSubmitting ? "Saving origin" : "Add origin"}
				</button>
			</form>
			<div className="mt-3">
				<AdminPanelMessage message={message} error={error} />
			</div>
		</section>
	);
}
