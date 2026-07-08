import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AdminProductChangeRequest, AdminProductListItem, ClassKitClient } from "@class-kit/react";
import {
	Activity,
	Archive,
	ArrowRight,
	ClipboardList,
	ExternalLink,
	Moon,
	Paperclip,
	Plus,
	Search,
	Settings2,
	Sun,
	Users,
	Wrench,
	X,
} from "lucide-react";
import { classKitClient, supabaseTarget } from "./class-kit-client";
import type { AdminBoardStatus, SelectedAdminProduct } from "./admin-types";
import { AdminAuthPanel } from "./components/admin-auth-panel";
import { GlobalIntegrationsPanel } from "./components/global-integrations-panel";
import { ProductAuthPolicyPanel } from "./components/product-auth-policy-panel";
import { ProductAuthRedirectPanel } from "./components/product-auth-redirect-panel";
import { ProductChangeRequestsPanel } from "./components/product-change-requests-panel";
import { ProductCreateForm } from "./components/product-create-form";
import { ProductList } from "./components/product-list";
import { ProductOriginPanel } from "./components/product-origin-panel";
import { ProductResetPanel } from "./components/product-reset-panel";
import { ProductRolePanel } from "./components/product-role-panel";
import { ProductUsersPanel } from "./components/product-users-panel";
import { adminBadgeClass } from "./components/admin-badge";
import { AdminEmptyState } from "./components/admin-feedback";

type ProductSection = "overview" | "settings" | "roles" | "users" | "requests" | "deployments";
type PlatformSection = "products" | "global-settings" | "integrations" | "audit";
type ThemeMode = "light" | "dark";

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
	const [platformSection, setPlatformSection] = useState<PlatformSection>("products");
	const [productSection, setProductSection] = useState<ProductSection>("overview");
	const [isCreateOpen, setCreateOpen] = useState(false);
	const [theme, setTheme] = useState<ThemeMode>(() => readInitialTheme());

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
		window.localStorage.setItem("class-kit-admin-theme", theme);
	}, [theme]);

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

	function openProductSection(section: ProductSection) {
		setPlatformSection("products");
		setProductSection(section);
	}

	return (
		<main className="min-h-screen min-w-[1280px] bg-background text-foreground">
			<div className="grid min-h-screen grid-rows-[4.25rem_minmax(0,1fr)]">
				<TopBar
					products={products}
					selectedProduct={selectedProduct}
					session={session}
					theme={theme}
					onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")}
				/>

				<div className="grid min-h-0 grid-cols-[15rem_17rem_minmax(0,1fr)_19rem]">
					<PlatformSidebar
						activeSection={platformSection}
						onCreateProduct={() => setCreateOpen(true)}
						onSelectSection={(section) => {
							setPlatformSection(section);
							if (section === "products") setProductSection("overview");
						}}
					/>

					<ProductSwitcher
						products={products}
						selectedProduct={selectedProduct}
						onSelect={(product) => {
							setSelectedProduct(product);
							setPlatformSection("products");
							setProductSection("overview");
						}}
					/>

					<section className="min-w-0 overflow-auto border-r border-border">
						<div className="mx-auto grid max-w-[64rem] gap-4 p-5">
							<AdminAuthPanel client={classKitClient} session={session} error={status === "error" || status === "forbidden" ? error : null} supabaseTarget={supabaseTarget} onSignedIn={refreshSessionAndProducts} />

							{status === "signed_out" ? <StatusPanel title="Signed out" message="Sign in to load platform products." /> : null}
							{status === "loading" ? <StatusPanel title="Loading" message="Checking session and product access." /> : null}
							{status === "forbidden" ? <StatusPanel title="Platform admin required" message={error ?? "This account cannot list platform products."} tone="error" /> : null}
							{status === "error" ? <StatusPanel title="Admin board unavailable" message={error ?? "The admin board could not load."} tone="error" /> : null}

							{status === "ready" && classKitClient ? (
								platformSection === "integrations" || platformSection === "global-settings" ? (
									<GlobalIntegrationsPanel client={classKitClient} productKey={selectedProduct?.product_key ?? null} />
								) : platformSection === "audit" ? (
									<AuditPlaceholder />
								) : (
									<SelectedProductWorkspace
										client={classKitClient}
										currentUserId={session?.user.id ?? null}
										onChanged={loadProducts}
										onOpenCreateProduct={() => setCreateOpen(true)}
										onOpenProductSection={openProductSection}
										product={selectedProduct}
										productSection={productSection}
										setProductSection={setProductSection}
									/>
								)
							) : null}
						</div>
					</section>

					<OperationsRail client={classKitClient} product={selectedProduct} onOpenRequests={() => openProductSection("requests")} />
				</div>
			</div>

			<CreateProductDrawer
				client={classKitClient}
				isOpen={isCreateOpen}
				onClose={() => setCreateOpen(false)}
				onCreated={async () => {
					await loadProducts();
					setCreateOpen(false);
				}}
			/>
		</main>
	);
}

function TopBar({
	onToggleTheme,
	products,
	selectedProduct,
	session,
	theme,
}: {
	onToggleTheme: () => void;
	products: AdminProductListItem[];
	selectedProduct: SelectedAdminProduct;
	session: Session | null;
	theme: ThemeMode;
}) {
	return (
		<header className="grid grid-cols-[24rem_minmax(20rem,1fr)_31rem] items-center gap-4 border-b border-border bg-card px-5">
			<div className="min-w-0">
				<h1 className="truncate text-xl font-semibold text-foreground">Class Kit Admin</h1>
				<p className="admin-meta mt-0.5">Platform operations</p>
			</div>
			<label className="flex h-10 min-w-0 items-center gap-3 rounded-md border border-border bg-background px-3 text-sm">
				<Search className="size-4 text-muted-foreground" aria-hidden="true" />
				<input className="min-w-0 flex-1 bg-transparent text-foreground outline-none" placeholder="Search or run command..." />
				<span className="admin-code shrink-0">⌘K</span>
			</label>
			<div className="grid min-w-0 grid-cols-[6rem_10rem_6rem_auto] items-center gap-2">
				<HeaderMetric label="Products" value={String(products.length)} />
				<HeaderMetric label="Active workspace" value={selectedProduct?.name ?? "None"} />
				<HeaderMetric label="Session" value={session ? "Active" : "Signed out"} active={Boolean(session)} />
				<button
					type="button"
					className="inline-flex size-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-primary hover:text-foreground"
					onClick={onToggleTheme}
					aria-label="Toggle theme"
				>
					{theme === "dark" ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
				</button>
			</div>
		</header>
	);
}

function HeaderMetric({ active, label, value }: { active?: boolean; label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-md border border-border bg-background px-3 py-2">
			<p className="admin-label truncate">{label}</p>
			<p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-foreground">
				{active ? <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> : null}
				<span className="truncate">{value}</span>
			</p>
		</div>
	);
}

function PlatformSidebar({
	activeSection,
	onCreateProduct,
	onSelectSection,
}: {
	activeSection: PlatformSection;
	onCreateProduct: () => void;
	onSelectSection: (section: PlatformSection) => void;
}) {
	return (
		<aside className="grid min-h-0 content-between border-r border-border bg-card p-4">
			<div className="grid content-start gap-4">
				<button
					type="button"
					className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
					onClick={onCreateProduct}
				>
					<Plus className="size-4" aria-hidden="true" />
					New product
				</button>
				<nav className="grid gap-1">
					<NavButton icon={<Archive />} label="Products" active={activeSection === "products"} onClick={() => onSelectSection("products")} />
					<NavButton icon={<Settings2 />} label="Global Settings" active={activeSection === "global-settings"} onClick={() => onSelectSection("global-settings")} />
					<NavButton icon={<Wrench />} label="Integrations" active={activeSection === "integrations"} onClick={() => onSelectSection("integrations")} />
					<NavButton icon={<Activity />} label="Audit Log" active={activeSection === "audit"} onClick={() => onSelectSection("audit")} />
				</nav>
			</div>

			<div className="rounded-md border border-border bg-background p-3">
				<p className="text-sm font-semibold text-foreground">Class Kit Platform</p>
				<div className="mt-2 flex items-center justify-between gap-2">
					<span className="admin-code">Local admin</span>
					<span className={adminBadgeClass({ tone: "muted", size: "compact" })}>No status monitor</span>
				</div>
			</div>
		</aside>
	);
}

function NavButton({ active, badge, icon, label, onClick }: { active: boolean; badge?: number; icon: ReactNode; label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			className={`flex h-10 items-center justify-between gap-3 rounded-md px-3 text-left text-sm font-medium transition ${active ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
			onClick={onClick}
		>
			<span className="inline-flex min-w-0 items-center gap-3">
				<span className="[&>svg]:size-4">{icon}</span>
				<span className="truncate">{label}</span>
			</span>
			{badge ? <span className={adminBadgeClass({ tone: "muted", size: "compact" })}>{badge}</span> : null}
		</button>
	);
}

function ProductSwitcher({
	onSelect,
	products,
	selectedProduct,
}: {
	onSelect: (product: AdminProductListItem) => void;
	products: AdminProductListItem[];
	selectedProduct: SelectedAdminProduct;
}) {
	return (
		<aside className="min-h-0 overflow-auto border-r border-border bg-background p-4">
			<ProductList products={products} selectedProductKey={selectedProduct?.product_key ?? null} onSelect={onSelect} />
		</aside>
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

function SelectedProductWorkspace({
	client,
	currentUserId,
	onChanged,
	onOpenCreateProduct,
	onOpenProductSection,
	product,
	productSection,
	setProductSection,
}: {
	client: NonNullable<typeof classKitClient>;
	currentUserId: string | null;
	onChanged: () => Promise<void>;
	onOpenCreateProduct: () => void;
	onOpenProductSection: (section: ProductSection) => void;
	product: SelectedAdminProduct;
	productSection: ProductSection;
	setProductSection: (section: ProductSection) => void;
}) {
	const [refreshKey, setRefreshKey] = useState(0);

	if (!product) {
		return (
			<section className="rounded-md border border-border bg-card p-5">
				<h2 className="text-lg font-semibold text-foreground">No product selected</h2>
				<p className="admin-meta mt-1">Select a product or create a new workspace.</p>
				<button
					type="button"
					className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
					onClick={onOpenCreateProduct}
				>
					<Plus className="size-4" aria-hidden="true" />
					New product
				</button>
			</section>
		);
	}

	async function handleChanged() {
		await onChanged();
		setRefreshKey((current) => current + 1);
	}

	return (
		<div className="grid gap-4">
			<ProductHeader product={product} activeSection={productSection} onSelectSection={setProductSection} />

			{productSection === "overview" ? (
				<ProductOverview
					product={product}
					onOpenRequests={() => onOpenProductSection("requests")}
					onOpenSettings={() => setProductSection("settings")}
					onOpenUsers={() => setProductSection("users")}
				/>
			) : null}

			{productSection === "settings" ? (
				<div className="class-kit-demo-workflows grid gap-4">
					<ProductOriginPanel client={client} product={product} onChanged={handleChanged} />
					<ProductAuthRedirectPanel client={client} product={product} onChanged={handleChanged} />
					<ProductAuthPolicyPanel client={client} product={product} onChanged={handleChanged} />
					<ProductResetPanel client={client} product={product} onChanged={handleChanged} />
				</div>
			) : null}

			{productSection === "roles" ? <ProductRolePanel client={client} product={product} /> : null}

			{productSection === "users" ? (
				<ProductUsersPanel client={client} product={product} currentUserId={currentUserId} refreshKey={refreshKey} />
			) : null}

			{productSection === "requests" ? <ProductChangeRequestsPanel client={client} product={product} /> : null}

			{productSection === "deployments" ? <DeploymentsPlaceholder product={product} /> : null}
		</div>
	);
}

function ProductHeader({ activeSection, onSelectSection, product }: { activeSection: ProductSection; onSelectSection: (section: ProductSection) => void; product: AdminProductListItem }) {
	const primaryOrigin = product.product_allowed_origins.find((origin) => origin.environment === "production") ?? product.product_allowed_origins[0] ?? null;

	return (
		<section className="rounded-md border border-border bg-card p-5">
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<span>Products</span>
						<ArrowRight className="size-3" aria-hidden="true" />
						<span className="truncate text-foreground">{product.name}</span>
					</div>
					<div className="mt-3 flex min-w-0 items-center gap-2">
						<h2 className="truncate text-2xl font-semibold text-foreground">{product.name}</h2>
						<span className={adminBadgeClass({ tone: product.status === "active" ? "active" : "muted" })}>{formatProductStatus(product.status)}</span>
					</div>
					<p className="admin-meta mt-1">Key: <span className="font-mono">{product.product_key}</span></p>
				</div>
				<div className="flex items-center gap-2">
					{primaryOrigin ? (
						<a
							className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:border-primary"
							href={primaryOrigin.origin}
							target="_blank"
							rel="noreferrer"
						>
							Open site
							<ExternalLink className="size-4" aria-hidden="true" />
						</a>
					) : null}
				</div>
			</div>
			<div className="mt-5 flex items-center gap-2 border-b border-border">
				<ProductTab active={activeSection === "overview"} onClick={() => onSelectSection("overview")}>Overview</ProductTab>
				<ProductTab active={activeSection === "settings"} onClick={() => onSelectSection("settings")}>Settings</ProductTab>
				<ProductTab active={activeSection === "roles"} onClick={() => onSelectSection("roles")}>Roles & permissions</ProductTab>
				<ProductTab active={activeSection === "users"} onClick={() => onSelectSection("users")}>Users</ProductTab>
				<ProductTab active={activeSection === "requests"} onClick={() => onSelectSection("requests")}>Requests</ProductTab>
				<ProductTab active={activeSection === "deployments"} onClick={() => onSelectSection("deployments")}>Deployments</ProductTab>
			</div>
		</section>
	);
}

function ProductTab({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
	return (
		<button
			type="button"
			className={`h-10 border-b-2 px-3 text-sm font-semibold ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
			onClick={onClick}
		>
			{children}
		</button>
	);
}

function ProductOverview({
	onOpenRequests,
	onOpenSettings,
	onOpenUsers,
	product,
}: {
	onOpenRequests: () => void;
	onOpenSettings: () => void;
	onOpenUsers: () => void;
	product: AdminProductListItem;
}) {
	const originCount = product.product_allowed_origins.length;
	const originEnvironmentCount = new Set(product.product_allowed_origins.map((origin) => origin.environment)).size;
	const enabledAuthMethods = [
		product.email_password_enabled ? "Email" : null,
		product.google_oauth_enabled ? "Google" : null,
	].filter(Boolean);

	return (
		<div className="grid gap-4">
			<div className="grid grid-cols-4 gap-3">
				<DetailItem label="Status" value={formatProductStatus(product.status)} helper="Product availability" tone={product.status === "active" ? "active" : "muted"} />
				<DetailItem label="Access" value={formatAuthMode(product.auth_mode)} helper="Registration policy" tone={product.auth_mode === "open" ? "active" : "muted"} />
				<DetailItem label="Sign-in" value={enabledAuthMethods.length > 0 ? enabledAuthMethods.join(" + ") : "None"} helper="Enabled providers" />
				<DetailItem label="Origins" value={String(originCount)} helper={`${originEnvironmentCount || 0} environment${originEnvironmentCount === 1 ? "" : "s"}`} />
			</div>

			<section className="rounded-md border border-border bg-card p-4">
				<p className="admin-panel-title">Quick actions</p>
				<div className="mt-3 flex flex-wrap gap-2">
					<QuickAction icon={<ClipboardList />} label="View requests" onClick={onOpenRequests} />
					<QuickAction icon={<Users />} label="Manage users" onClick={onOpenUsers} />
					<QuickAction icon={<Settings2 />} label="Product settings" onClick={onOpenSettings} />
				</div>
			</section>

			<section className="rounded-md border border-border bg-card p-4">
				<p className="admin-panel-title">Origins</p>
				<div className="mt-3 grid gap-2">
					{product.product_allowed_origins.length === 0 ? <p className="admin-meta">No origins configured.</p> : null}
					{product.product_allowed_origins.map((origin) => (
						<div className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 rounded-md border border-border bg-background px-3 py-2" key={`${origin.environment}:${origin.origin}`}>
							<div className="min-w-0">
								<p className="truncate text-sm font-semibold text-foreground">{formatEnvironment(origin.environment)}</p>
								<p className="admin-meta truncate">{origin.origin}</p>
							</div>
							<span className={adminBadgeClass({ tone: "muted", size: "compact" })}>{origin.environment}</span>
						</div>
					))}
				</div>
			</section>

			<section className="grid grid-cols-2 gap-4">
				<EmptyFeaturePanel title="Requests" actionLabel="Open requests" onAction={onOpenRequests}>
					Request summaries load inside the product Requests tab.
				</EmptyFeaturePanel>
				<EmptyFeaturePanel title="Deployments">
					Deployment tracking has no connected data source yet.
				</EmptyFeaturePanel>
			</section>
		</div>
	);
}

function DetailItem({ helper, label, tone = "neutral", value }: { helper: string; label: string; tone?: "neutral" | "active" | "muted"; value: string }) {
	return (
		<div className="rounded-md border border-border bg-card p-4">
			<p className="admin-label">{label}</p>
			<p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
			<p className="admin-meta mt-1">{helper}</p>
			<span className={`mt-3 block h-1 rounded-full ${tone === "active" ? "bg-emerald-500" : tone === "muted" ? "bg-muted-foreground/30" : "bg-primary/30"}`} />
		</div>
	);
}

function QuickAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:border-primary"
			onClick={onClick}
		>
			<span className="[&>svg]:size-4">{icon}</span>
			{label}
		</button>
	);
}

function EmptyFeaturePanel({ actionLabel, children, onAction, title }: { actionLabel?: string; children: ReactNode; onAction?: () => void; title: string }) {
	return (
		<div className="rounded-md border border-border bg-card p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="admin-panel-title">{title}</p>
					<p className="admin-meta mt-1">{children}</p>
				</div>
				{actionLabel && onAction ? (
					<button
						type="button"
						className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:border-primary"
						onClick={onAction}
					>
						{actionLabel}
						<ArrowRight className="size-4" aria-hidden="true" />
					</button>
				) : null}
			</div>
		</div>
	);
}

function OperationsRail({ client, onOpenRequests, product }: { client: ClassKitClient | null; onOpenRequests: () => void; product: SelectedAdminProduct }) {
	const [requests, setRequests] = useState<AdminProductChangeRequest[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadRequests = useCallback(async () => {
		if (!client || !product) {
			setRequests([]);
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const data = await client.admin.changeRequests.list({ productKey: product.product_key });
			setRequests(data.requests);
		} catch (caught) {
			setRequests([]);
			setError(caught instanceof Error ? caught.message : "Could not load request summaries.");
		} finally {
			setIsLoading(false);
		}
	}, [client, product]);

	useEffect(() => {
		void loadRequests();
		if (!client || !product) return;
		const interval = window.setInterval(() => {
			void loadRequests();
		}, 30_000);
		return () => window.clearInterval(interval);
	}, [client, loadRequests, product]);

	const sortedRequests = useMemo(
		() => [...requests].sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at)),
		[requests],
	);
	const openCount = sortedRequests.filter((request) => request.status === "open").length;
	const inProgressCount = sortedRequests.filter((request) => request.status === "in_progress").length;
	const doneCount = sortedRequests.filter((request) => request.status === "done").length;
	const visibleRequests = sortedRequests.slice(0, 6);
	const primaryActionLabel = openCount > 0
		? `Review ${openCount} open request${openCount === 1 ? "" : "s"}`
		: inProgressCount > 0
			? `Review ${inProgressCount} in-progress request${inProgressCount === 1 ? "" : "s"}`
			: sortedRequests.length > 0
				? "View all requests"
				: "Open requests";

	return (
		<aside className="min-h-0 overflow-auto bg-background p-4">
			<section className="rounded-md border border-border bg-card">
				<div className="border-b border-border p-4">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<h3 className="text-lg font-semibold leading-tight text-foreground">Product change requests</h3>
							<p className="admin-meta mt-1">Issues and feature requests for the selected product.</p>
						</div>
						<button
							type="button"
							className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground hover:border-primary hover:text-foreground"
							onClick={onOpenRequests}
							aria-label="Open product requests"
						>
							<ClipboardList className="size-4" aria-hidden="true" />
						</button>
					</div>

					<div className="mt-4 grid grid-cols-2 gap-2">
						<RailMetric label="Open" value={openCount} active={openCount > 0} />
						<RailMetric label="In progress" value={inProgressCount} active={inProgressCount > 0} />
						<RailMetric label="Done" value={doneCount} />
						<RailMetric label="Total" value={sortedRequests.length} />
					</div>

					<button
						type="button"
						className="mt-4 flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/10 px-3 text-left text-sm font-semibold text-primary hover:bg-primary/15"
						onClick={onOpenRequests}
					>
						<span className="min-w-0 truncate">{primaryActionLabel}</span>
						<ArrowRight className="size-4 shrink-0" aria-hidden="true" />
					</button>
				</div>

				<div className="p-4">
					<div className="flex items-center justify-between gap-3">
						<p className="admin-label">Requests</p>
						{isLoading && requests.length > 0 ? <span className={adminBadgeClass({ tone: "muted", size: "compact" })}>Refreshing</span> : null}
					</div>

					<div className="mt-3 grid gap-2">
						{!product ? <AdminEmptyState>Select a product to view change requests.</AdminEmptyState> : null}
						{product && isLoading && requests.length === 0 ? <AdminEmptyState>Loading request summaries.</AdminEmptyState> : null}
						{product && error ? <AdminEmptyState>{error}</AdminEmptyState> : null}
						{product && !isLoading && !error && sortedRequests.length === 0 ? <AdminEmptyState>No change requests for this product yet.</AdminEmptyState> : null}
						{visibleRequests.map((request) => <RailRequestButton key={request.id} request={request} onOpen={onOpenRequests} />)}
					</div>

					{sortedRequests.length > visibleRequests.length ? (
						<button
							type="button"
							className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary hover:text-foreground"
							onClick={onOpenRequests}
						>
							View all requests
							<ArrowRight className="size-4" aria-hidden="true" />
						</button>
					) : null}
				</div>

				{product ? (
					<button
						type="button"
						className="m-4 mt-0 flex w-[calc(100%-2rem)] cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-left hover:border-primary"
						onClick={onOpenRequests}
					>
						<div className="min-w-0">
							<p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
							<p className="admin-code mt-0.5 truncate">{product.product_key}</p>
						</div>
						<ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					</button>
				) : null}
			</section>
		</aside>
	);
}

function RailMetric({ active = false, label, value }: { active?: boolean; label: string; value: number }) {
	return (
		<div className={`rounded-md border p-3 ${active ? "border-primary/50 bg-primary/10" : "border-border bg-background"}`}>
			<p className="admin-label truncate">{label}</p>
			<p className="mt-2 text-xl font-semibold leading-none text-foreground">{value}</p>
		</div>
	);
}

function RailRequestButton({ onOpen, request }: { onOpen: () => void; request: AdminProductChangeRequest }) {
	const attachmentCount = request.attachments.length;

	return (
		<button
			type="button"
			className="grid w-full cursor-pointer gap-3 rounded-md border border-border bg-background p-3 text-left transition hover:border-primary hover:bg-primary/5"
			onClick={onOpen}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold text-foreground">{request.title || request.description}</p>
					<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{request.description}</p>
				</div>
				<span className={adminBadgeClass({ tone: statusTone(request.status), size: "compact", className: "shrink-0" })}>{formatRequestStatus(request.status)}</span>
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				<span className={adminBadgeClass({ tone: request.type === "issue" ? "muted" : "active", size: "compact" })}>{formatRequestType(request.type)}</span>
				<span className={adminBadgeClass({ tone: "muted", size: "compact" })}>v{request.version_number}</span>
				<span className="ml-auto admin-meta whitespace-nowrap">{formatDateTime(request.updated_at)}</span>
				<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
					<Paperclip className="size-3.5" aria-hidden="true" />
					{attachmentCount}
				</span>
			</div>
		</button>
	);
}

function CreateProductDrawer({
	client,
	isOpen,
	onClose,
	onCreated,
}: {
	client: typeof classKitClient;
	isOpen: boolean;
	onClose: () => void;
	onCreated: () => Promise<void>;
}) {
	if (!isOpen || !client) return null;

	return (
		<div className="fixed inset-0 z-50 grid justify-items-end bg-background/60 backdrop-blur-sm">
			<aside className="grid h-full w-[26rem] grid-rows-[auto_minmax(0,1fr)] border-l border-border bg-card shadow-2xl">
				<div className="flex items-start justify-between gap-3 border-b border-border p-5">
					<div>
						<h2 className="text-lg font-semibold text-foreground">New product</h2>
						<p className="admin-meta mt-1">Create a product workspace.</p>
					</div>
					<button
						type="button"
						className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-primary hover:text-foreground"
						onClick={onClose}
						aria-label="Close new product drawer"
					>
						<X className="size-4" aria-hidden="true" />
					</button>
				</div>
				<div className="min-h-0 overflow-auto p-5">
					<ProductCreateForm client={client} onCreated={onCreated} />
				</div>
			</aside>
		</div>
	);
}

function AuditPlaceholder() {
	return (
		<section className="rounded-md border border-border bg-card p-5">
			<p className="admin-label">Platform</p>
			<h2 className="mt-1 text-xl font-semibold text-foreground">Audit log</h2>
			<p className="admin-meta mt-1">Audit events will live here once platform event logging is introduced.</p>
		</section>
	);
}

function DeploymentsPlaceholder({ product }: { product: AdminProductListItem }) {
	return (
		<section className="rounded-md border border-border bg-card p-5">
			<p className="admin-label">Deployments</p>
			<h2 className="mt-1 text-xl font-semibold text-foreground">{product.name}</h2>
			<p className="admin-meta mt-1">Deployment tracking is reserved for a later ClassKit admin slice.</p>
		</section>
	);
}

function readInitialTheme(): ThemeMode {
	if (typeof window === "undefined") return "light";
	const stored = window.localStorage.getItem("class-kit-admin-theme");
	if (stored === "dark" || stored === "light") return stored;
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function formatAuthMode(authMode: AdminProductListItem["auth_mode"]) {
	return authMode === "invite_only" ? "Invite only" : "Open";
}

function formatDateTime(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}

function formatEnvironment(environment: AdminProductListItem["product_allowed_origins"][number]["environment"]) {
	return environment === "production" ? "Production" : "Development";
}

function formatProductStatus(status: AdminProductListItem["status"]) {
	return status === "active" ? "Active" : "Inactive";
}

function formatRequestStatus(status: AdminProductChangeRequest["status"]) {
	if (status === "in_progress") return "In progress";
	if (status === "done") return "Done";
	if (status === "closed") return "Closed";
	return "Open";
}

function formatRequestType(type: AdminProductChangeRequest["type"]) {
	return type === "issue" ? "Issue" : "Feature request";
}

function statusTone(status: AdminProductChangeRequest["status"]) {
	if (status === "done") return "active";
	if (status === "closed") return "muted";
	return "neutral";
}
