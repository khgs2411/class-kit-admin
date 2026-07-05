import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AdminProductListItem } from "@class-kit/react";
import { CheckCircle2, Circle, CircleSlash2, Globe2, KeyRound, Plus, ShieldCheck } from "lucide-react";
import { classKitClient, supabaseTarget } from "./class-kit-client";
import type { AdminBoardStatus, SelectedAdminProduct } from "./admin-types";
import { AdminAuthPanel } from "./components/admin-auth-panel";
import { ProductAuthPolicyPanel } from "./components/product-auth-policy-panel";
import { ProductAuthRedirectPanel } from "./components/product-auth-redirect-panel";
import { ProductCreateForm } from "./components/product-create-form";
import { ProductList } from "./components/product-list";
import { ProductRolePanel } from "./components/product-role-panel";
import { ProductOriginPanel } from "./components/product-origin-panel";
import { ProductResetPanel } from "./components/product-reset-panel";
import { ProductUsersPanel } from "./components/product-users-panel";
import { adminBadgeClass } from "./components/admin-badge";

function isForbiddenError(message: string) {
	const normalized = message.toLowerCase();
	return normalized.includes("forbidden") || normalized.includes("permission") || normalized.includes("not authorized");
}

export function App() {
	const [session, setSession] = useState<Session | null>(null);
	const [products, setProducts] = useState<AdminProductListItem[]>([]);
	const [selectedProduct, setSelectedProduct] = useState<SelectedAdminProduct>(null);
	const [status, setStatus] = useState<AdminBoardStatus>("loading");
	const [error, setError] = useState<string | null>(null);

	const loadProducts = useCallback(async () => {
		if (!classKitClient) {
			setStatus("error");
			setError("Class Kit client is not configured. Check VITE_CLASS_KIT_TARGET and local ClassKit Supabase values.");
			return;
		}

		setStatus("loading");
		setError(null);

		try {
			const result = await classKitClient.admin.products.list();
			setProducts(result.products);
			setSelectedProduct((current) => {
				if (current) return result.products.find((product) => product.product_key === current.product_key) ?? result.products[0] ?? null;
				return result.products[0] ?? null;
			});
			setStatus("ready");
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "Could not load products.";
			setProducts([]);
			setSelectedProduct(null);
			setError(message);
			setStatus(isForbiddenError(message) ? "forbidden" : "error");
		}
	}, []);

	const refreshSessionAndProducts = useCallback(async () => {
		if (!classKitClient) {
			setSession(null);
			setStatus("error");
			setError("Class Kit client is not configured. Check VITE_CLASS_KIT_TARGET and local ClassKit Supabase values.");
			return;
		}

		const currentSession = await classKitClient.auth.getSession();
		setSession(currentSession);

		if (!currentSession) {
			setProducts([]);
			setSelectedProduct(null);
			setError(null);
			setStatus("signed_out");
			return;
		}

		await loadProducts();
	}, [loadProducts]);

	useEffect(() => {
		let isCurrent = true;

		async function initializeAdminBoard() {
			if (!classKitClient) {
				if (!isCurrent) return;
				setSession(null);
				setStatus("error");
				setError("Class Kit client is not configured. Check VITE_CLASS_KIT_TARGET and local ClassKit Supabase values.");
				return;
			}

			const currentSession = await classKitClient.auth.getSession();
			if (!isCurrent) return;
			setSession(currentSession);

			if (!currentSession) {
				setProducts([]);
				setSelectedProduct(null);
				setError(null);
				setStatus("signed_out");
				return;
			}

			await loadProducts();
		}

		void initializeAdminBoard();

		return () => {
			isCurrent = false;
		};
	}, [loadProducts]);

	return (
		<main className="min-h-screen bg-background px-3 py-3 text-foreground md:px-4 md:py-4">
			<div className="grid w-full gap-4">
				<header className="flex min-w-0 flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="min-w-0 space-y-1">
						<p className="admin-label truncate">Local platform operations</p>
						<h1 className="truncate text-2xl font-semibold tracking-normal md:text-3xl">Class Kit Admin</h1>
					</div>
					<div className="grid min-w-0 gap-2 text-sm text-muted-foreground sm:grid-cols-3 lg:min-w-[30rem]">
						<HeaderMetric label="Products" value={String(products.length)} />
						<HeaderMetric label="Selected" value={selectedProduct?.product_key ?? "none"} />
						<HeaderMetric label="Session" value={session ? "active" : "signed out"} />
					</div>
				</header>

				<AdminAuthPanel client={classKitClient} session={session} error={status === "error" || status === "forbidden" ? error : null} supabaseTarget={supabaseTarget} onSignedIn={refreshSessionAndProducts} />

				{status === "signed_out" ? <StatusPanel title="Signed out" message="Sign in to load platform products." /> : null}
				{status === "loading" ? <StatusPanel title="Loading" message="Checking session and product access." /> : null}
				{status === "forbidden" ? <StatusPanel title="Platform admin required" message={error ?? "This account cannot list platform products."} tone="error" /> : null}
				{status === "error" ? <StatusPanel title="Admin board unavailable" message={error ?? "The admin board could not load."} tone="error" /> : null}

				{status === "ready" && classKitClient ? (
					<div className="grid gap-4 xl:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)]">
						<aside className="order-2 grid min-w-0 content-start gap-4 xl:order-none xl:sticky xl:top-4">
							<details className="rounded-md border border-border bg-card p-4">
								<summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
									<div className="min-w-0">
										<h2 className="admin-panel-title">Workspace</h2>
										<p className="admin-meta mt-1">Create and choose products.</p>
									</div>
									<span className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
										<Plus className="size-4" aria-hidden="true" />
										New
									</span>
								</summary>
								<div className="mt-4 border-t border-border pt-4">
									<ProductCreateForm client={classKitClient} onCreated={loadProducts} />
								</div>
							</details>
							<ProductList products={products} selectedProductKey={selectedProduct?.product_key ?? null} onSelect={setSelectedProduct} />
						</aside>
						<SelectedProductDetail
							key={selectedProduct?.product_key ?? "none"}
							client={classKitClient}
							product={selectedProduct}
							currentUserId={session?.user.id ?? null}
							onChanged={loadProducts}
						/>
					</div>
				) : null}
			</div>
		</main>
	);
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-md border border-border bg-card px-3 py-2">
			<p className="admin-label truncate">{label}</p>
			<p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
		</div>
	);
}

function StatusPanel({ title, message, tone = "default" }: { title: string; message: string; tone?: "default" | "error" }) {
	return (
		<section className={`rounded-md border bg-card p-4 ${tone === "error" ? "border-destructive" : "border-border"}`}>
			<h2 className="admin-panel-title">{title}</h2>
			<p className="admin-meta mt-1">{message}</p>
		</section>
	);
}

function SelectedProductDetail({
	client,
	product,
	currentUserId,
	onChanged,
}: {
	client: NonNullable<typeof classKitClient>;
	product: SelectedAdminProduct;
	currentUserId: string | null;
	onChanged: () => Promise<void>;
}) {
	const [activeSection, setActiveSection] = useState<"settings" | "roles" | "users">("settings");
	const [refreshKey, setRefreshKey] = useState(0);

	if (!product) {
		return <StatusPanel title="No product selected" message="Select a product to inspect setup details." />;
	}

	async function handleChanged() {
		await onChanged();
		setRefreshKey((current) => current + 1);
	}

	const enabledAuthMethods = [
		product.email_password_enabled ? "Email" : null,
		product.google_oauth_enabled ? "Google" : null,
	].filter(Boolean);
	const originCount = product.product_allowed_origins.length;
	const authRedirectCount = product.product_auth_redirects.length;
	const originEnvironmentCount = new Set(product.product_allowed_origins.map((origin) => origin.environment)).size;

	return (
		<div className="order-1 grid gap-4 xl:order-none">
			<section className="min-w-0 rounded-md border border-border bg-card p-4">
				<div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
					<div className="min-w-0">
						<p className="admin-label truncate">Selected product</p>
						<h2 className="admin-panel-heading mt-1 truncate">{product.name}</h2>
						<p className="admin-code mt-1 truncate" title={product.product_key}>{product.product_key}</p>
					</div>
					<div className="grid min-w-0 gap-3 md:justify-items-end">
						<div className="flex min-w-0 flex-col gap-2 md:items-end">
							<p className="admin-label truncate">Current task</p>
							<h3 className="admin-panel-title">{activeSection === "users" ? "User management" : activeSection === "roles" ? "Roles & permissions" : "Product settings"}</h3>
							<div className="flex flex-wrap gap-2 rounded-md bg-background p-1">
								<SectionButton isActive={activeSection === "settings"} onClick={() => setActiveSection("settings")}>Settings</SectionButton>
								<SectionButton isActive={activeSection === "roles"} onClick={() => setActiveSection("roles")}>Roles & permissions</SectionButton>
								<SectionButton isActive={activeSection === "users"} onClick={() => setActiveSection("users")}>Users</SectionButton>
							</div>
						</div>
					</div>
				</div>

				<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
					<DetailItem icon={product.status === "active" ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Circle className="size-4" aria-hidden="true" />} label="Status" value={formatProductStatus(product.status)} tone={product.status === "active" ? "active" : "muted"} />
					<DetailItem icon={<KeyRound className="size-4" aria-hidden="true" />} label="Access" value={formatAuthMode(product.auth_mode)} tone={product.auth_mode === "open" ? "active" : "muted"} />
					<DetailItem icon={<CircleSlash2 className="size-4" aria-hidden="true" />} label="Sign-in" value={enabledAuthMethods.length > 0 ? enabledAuthMethods.join(" + ") : "No providers"} />
					<DetailItem icon={<Globe2 className="size-4" aria-hidden="true" />} label="Origins" value={`${originCount} across ${originEnvironmentCount || 0} env${originEnvironmentCount === 1 ? "" : "s"}`} />
					<DetailItem icon={<ShieldCheck className="size-4" aria-hidden="true" />} label="Redirects" value={`${authRedirectCount} auth ${authRedirectCount === 1 ? "URL" : "URLs"}`} />
				</div>
			</section>

			<section className="grid min-w-0 gap-4">
				<div className="class-kit-demo-workflows grid gap-4">
					{activeSection === "settings" ? (
						<div className="grid gap-4">
							<ProductOriginPanel client={client} product={product} onChanged={handleChanged} />
							<ProductAuthRedirectPanel client={client} product={product} onChanged={handleChanged} />
							<ProductAuthPolicyPanel client={client} product={product} onChanged={handleChanged} />
							<ProductResetPanel client={client} product={product} onChanged={handleChanged} />
						</div>
					) : null}

					{activeSection === "roles" ? <ProductRolePanel client={client} product={product} /> : null}

					{activeSection === "users" ? (
						<ProductUsersPanel client={client} product={product} currentUserId={currentUserId} refreshKey={refreshKey} />
					) : null}
				</div>
			</section>
		</div>
	);
}

function SectionButton({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: ReactNode }) {
	return (
		<button
			type="button"
			className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}
			onClick={onClick}
			aria-pressed={isActive}
		>
			{children}
		</button>
	);
}

function DetailItem({ icon, label, value, tone = "neutral" }: { icon: ReactNode; label: string; value: string; tone?: "neutral" | "active" | "muted" }) {
	return (
		<div className="rounded-md border border-border bg-background p-3">
			<div className="flex items-center gap-2 text-muted-foreground">
				{icon}
				<p className="admin-label truncate">{label}</p>
			</div>
			<p className="mt-2">
				<span className={adminBadgeClass({ tone })}>{value}</span>
			</p>
		</div>
	);
}

function formatAuthMode(authMode: AdminProductListItem["auth_mode"]) {
	return authMode === "invite_only" ? "Invite only" : "Open";
}

function formatProductStatus(status: AdminProductListItem["status"]) {
	return status === "active" ? "Active" : "Inactive";
}
