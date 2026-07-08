import type { AdminProductListItem } from "@class-kit/react";
import { CheckCircle2, Circle, Globe2, KeyRound, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { adminBadgeClass } from "./admin-badge";

type ProductListProps = {
	products: AdminProductListItem[];
	selectedProductKey: string | null;
	onSelect: (product: AdminProductListItem) => void;
};

export function ProductList({ products, selectedProductKey, onSelect }: ProductListProps) {
	const [query, setQuery] = useState("");
	const filteredProducts = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return products;
		return products.filter((product) => {
			return product.name.toLowerCase().includes(normalized) || product.product_key.toLowerCase().includes(normalized) || product.auth_mode.toLowerCase().includes(normalized);
		});
	}, [products, query]);
	const selectedProductIsHidden = Boolean(query.trim() && selectedProductKey && !filteredProducts.some((product) => product.product_key === selectedProductKey));

	if (products.length === 0) {
		return (
			<section className="rounded-md border border-border bg-card p-4">
				<h2 className="admin-panel-title">Products</h2>
				<p className="admin-meta mt-2">No products found.</p>
			</section>
		);
	}

	return (
		<section className="rounded-md border border-border bg-card">
			<div className="border-b border-border p-3">
				<div className="flex items-center justify-between gap-3">
					<h2 className="admin-panel-title">Products</h2>
					<p className="admin-meta shrink-0">{products.length} total</p>
				</div>
				<label className="mt-3 flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
					<Search className="size-4 text-muted-foreground" aria-hidden="true" />
					<span className="sr-only">Search products</span>
					<input className="min-w-0 flex-1 bg-transparent outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" />
				</label>
			</div>
			<div className="divide-y divide-border">
				{filteredProducts.length === 0 ? <p className="admin-meta p-4">No products match that search.</p> : null}
				{selectedProductIsHidden ? <p className="admin-meta border-b border-border p-4">Selected product hidden by search.</p> : null}
				{filteredProducts.map((product) => {
					const isSelected = product.product_key === selectedProductKey;
					const originCount = product.product_allowed_origins.length;

					return (
						<button
							key={product.id}
							type="button"
							className={`grid w-full gap-2 px-3 py-2.5 text-left outline-none transition hover:bg-background focus-visible:ring-2 focus-visible:ring-primary ${
								isSelected ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary" : "bg-card"
							}`}
							onClick={() => onSelect(product)}
							aria-pressed={isSelected}
							aria-current={isSelected ? "true" : undefined}
						>
							<span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
								<span className="min-w-0">
									<span className="block truncate text-sm font-semibold">{product.name}</span>
									<span className={`mt-1 block truncate font-mono text-xs leading-5 ${isSelected ? "text-primary-foreground/75" : "text-muted-foreground"}`} title={product.product_key}>{product.product_key}</span>
								</span>
								<span className={statusBadgeClass(product.status, isSelected)}>
									{product.status === "active" ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <Circle className="size-3.5" aria-hidden="true" />}
									{formatProductStatus(product.status)}
								</span>
							</span>
							<span className={`grid gap-1.5 text-xs ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
								<span className={adminBadgeClass({ tone: isSelected ? "selected-muted" : product.auth_mode === "open" ? "active" : "muted", size: "compact", className: "min-w-0" })}>
									<KeyRound className="size-3.5 shrink-0" aria-hidden="true" />
									<span className="truncate">{formatAuthMode(product.auth_mode)}</span>
								</span>
								<span className={adminBadgeClass({ tone: isSelected ? "selected-muted" : "muted", size: "compact", className: "min-w-0" })}>
									<Globe2 className="size-3.5 shrink-0" aria-hidden="true" />
									<span className="truncate">{originCount} {originCount === 1 ? "origin" : "origins"}</span>
								</span>
							</span>
						</button>
					);
				})}
			</div>
		</section>
	);
}

function formatAuthMode(authMode: AdminProductListItem["auth_mode"]) {
	return authMode === "invite_only" ? "Invite only" : "Open";
}

function formatProductStatus(status: AdminProductListItem["status"]) {
	return status === "active" ? "Active" : "Inactive";
}

function statusBadgeClass(status: AdminProductListItem["status"], isSelected: boolean) {
	if (isSelected) return adminBadgeClass({ tone: "selected" });
	return adminBadgeClass({ tone: status === "active" ? "active" : "muted" });
}
