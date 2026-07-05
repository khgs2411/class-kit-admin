import { useState } from "react";
import type { AdminProductListItem, ClassKitClient } from "@class-kit/react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { AdminDialog, AdminPanelMessage } from "./admin-feedback";

type ProductResetPanelProps = {
	client: ClassKitClient;
	product: AdminProductListItem;
	onChanged: () => Promise<void>;
};

type TruncateProductResult = {
	product_key: string;
	truncated: true;
};

type ApiResponse<T> =
	| { data: T; error: null }
	| { data: null; error: { message: string } };

type AdminProductsWithOptionalTruncate = ClassKitClient["admin"]["products"] & {
	truncate?: (input: { productKey: string }) => Promise<TruncateProductResult>;
};

export function ProductResetPanel({ client, product, onChanged }: ProductResetPanelProps) {
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [confirmation, setConfirmation] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const canReset = confirmation === product.product_key && !isSubmitting;

	function openDialog() {
		setConfirmation("");
		setError(null);
		setIsDialogOpen(true);
	}

	function closeDialog() {
		if (isSubmitting) return;
		setIsDialogOpen(false);
		setConfirmation("");
	}

	async function handleReset() {
		if (!canReset) return;

		setIsSubmitting(true);
		setMessage(null);
		setError(null);

		try {
			await truncateProduct(client, product.product_key);
			setMessage(`Reset ${product.product_key}. Product configuration and your manager access were preserved.`);
			setIsDialogOpen(false);
			setConfirmation("");
			await onChanged();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not reset product.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<section className="rounded-md border border-destructive bg-card p-4">
			<div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
				<div className="min-w-0">
					<div className="flex min-w-0 items-center gap-2 text-destructive">
						<AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
						<h2 className="admin-panel-title">Product reset</h2>
					</div>
					<p className="admin-meta mt-2">
						Remove product development data while preserving the product, auth configuration, roles, permissions, and your active manager baseline.
					</p>
				</div>
				<button type="button" className="inline-flex h-10 w-fit max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-destructive px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" onClick={openDialog} disabled={isSubmitting}>
					<RotateCcw className="size-4" aria-hidden="true" />
					Reset product
				</button>
			</div>
			<div className="mt-3">
				<AdminPanelMessage message={message} error={error} />
			</div>

			{isDialogOpen ? (
				<AdminDialog title={`Reset ${product.product_key}`} onClose={closeDialog}>
					<div className="grid gap-4">
						<div className="rounded-md border border-destructive bg-background p-3 text-sm">
							<p className="font-semibold text-destructive">This removes product-local development data.</p>
							<p className="admin-meta mt-2">
								Classes, schedules, templates, registrations, attendance, memberships, access entries, and non-admin product user assignments will be removed.
							</p>
						</div>
						<label className="grid gap-1 text-sm">
							<span className="font-medium">Type the product key to confirm</span>
							<input
								className="h-10 min-w-0 rounded-md border border-input bg-background px-3 font-mono text-sm disabled:opacity-60"
								value={confirmation}
								onChange={(event) => setConfirmation(event.target.value)}
								placeholder={product.product_key}
								disabled={isSubmitting}
								autoFocus
							/>
						</label>
						<AdminPanelMessage message={null} error={error} />
						<div className="flex flex-wrap justify-end gap-2">
							<button type="button" className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-border px-4 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60" onClick={closeDialog} disabled={isSubmitting}>
								Cancel
							</button>
							<button type="button" className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-destructive px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" onClick={() => void handleReset()} disabled={!canReset}>
								<RotateCcw className="size-4" aria-hidden="true" />
								{isSubmitting ? "Resetting" : "Confirm reset"}
							</button>
						</div>
					</div>
				</AdminDialog>
			) : null}
		</section>
	);
}

async function truncateProduct(client: ClassKitClient, productKey: string): Promise<TruncateProductResult> {
	const truncate = (client.admin.products as AdminProductsWithOptionalTruncate).truncate;
	if (truncate) return await truncate({ productKey });

	const { data, error } = await client.supabase.functions.invoke<ApiResponse<TruncateProductResult>>(
		"class-kit-admin-products",
		{ body: { action: "truncate_product", product_key: productKey } },
	);

	if (error) throw new Error(error.message);
	if (data?.error) throw new Error(data.error.message);
	if (!data?.data) throw new Error("Empty response from product reset API.");
	return data.data;
}
