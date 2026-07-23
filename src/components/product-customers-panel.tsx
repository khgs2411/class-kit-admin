import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
	AdminProductListItem,
	ClassKitClient,
	Customer,
	CustomerMergeJsonValue,
	CustomerMergeFieldResolutionsInput,
	CustomerMergePreview,
	CustomerMergeResolutionInput,
	CustomerMergeSelection,
	MergeCustomersResponse,
} from "@class-kit/react";
import { ArrowRight, Combine, Plus, RefreshCw } from "lucide-react";
import { createSelectedProductClient } from "../class-kit-client";
import { AdminDialog, AdminEmptyState, AdminPanelMessage } from "./admin-feedback";
import { CopyableId } from "./copyable-id";

type FieldDraft = { selection: CustomerMergeSelection; replacement: string };
type ResolutionDraft = {
	displayName: FieldDraft;
	contactEmail: FieldDraft;
	phoneNumber: FieldDraft;
	metadata: Record<string, FieldDraft>;
};

export function ProductCustomersPanel({ product }: { product: AdminProductListItem }) {
	const client = useMemo(() => createSelectedProductClient(product.product_key), [product.product_key]);
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [loading, setLoading] = useState(Boolean(client));
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const [mergeOpen, setMergeOpen] = useState(false);

	const loadCustomers = useCallback(async () => {
		if (!client) return;
		setLoading(true);
		setError(null);
		try {
			setCustomers((await client.management.customers.list({ limit: 100 })).customers);
		} catch (caught) {
			setError(errorMessage(caught, "Could not load product customers."));
		} finally {
			setLoading(false);
		}
	}, [client]);

	useEffect(() => {
		setCustomers([]);
		setMessage(null);
		setError(null);
		void loadCustomers();
	}, [loadCustomers]);

	if (!client) {
		return (
		<section className="rounded-md border border-border bg-card p-4">
			<h2 className="admin-panel-title">Customer management</h2>
			<AdminEmptyState className="mt-4">
				Selected-product customer operations require ClassKit Admin to run on localhost. This prevents a hosted admin origin from silently resolving customer requests against the wrong product until the SDK exposes an explicit platform-admin customer target.
			</AdminEmptyState>
		</section>
		);
	}

	const ghosts = customers.filter((customer) => customer.identityStatus === "unlinked" && customer.status === "active");
	const linked = customers.filter((customer) => customer.identityStatus === "linked" && customer.status === "active");

	return (
		<section className="min-w-0 rounded-md border border-border bg-card p-4">
			<div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
				<div>
					<h2 className="admin-panel-title">Customer management</h2>
					<p className="admin-meta mt-1">Create product-owned ghost customers and consolidate them into linked customers for <span className="admin-code">{product.product_key}</span>.</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<ActionButton onClick={() => void loadCustomers()} disabled={loading}><RefreshCw className="size-4" /> Refresh</ActionButton>
					<ActionButton onClick={() => setMergeOpen(true)} disabled={ghosts.length === 0 || linked.length === 0}><Combine className="size-4" /> Merge</ActionButton>
					<ActionButton primary onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Create ghost customer</ActionButton>
				</div>
			</div>

			<div className="mt-4 grid grid-cols-3 gap-3">
				<Metric label="Total customers" value={customers.length} />
				<Metric label="Unlinked customers" value={customers.filter((customer) => customer.identityStatus === "unlinked").length} />
				<Metric label="Linked customers" value={customers.filter((customer) => customer.identityStatus === "linked").length} />
			</div>

			<div className="mt-4"><AdminPanelMessage message={message} error={error} /></div>
			{loading ? <AdminEmptyState className="mt-4">Loading product customers.</AdminEmptyState> : null}
			{!loading && !error && customers.length === 0 ? <AdminEmptyState className="mt-4">No customers exist for this product yet.</AdminEmptyState> : null}

			{!loading && customers.length > 0 ? (
				<div className="mt-4 max-w-full overflow-x-auto rounded-md border border-border">
					<table className="w-full min-w-[52rem] border-collapse text-sm">
						<thead><tr className="border-b border-border text-left">
							<th className="p-3 font-semibold">Customer</th><th className="p-3 font-semibold">Identity</th><th className="p-3 font-semibold">Contact</th><th className="p-3 font-semibold">Status</th><th className="p-3 font-semibold">Customer ID</th>
						</tr></thead>
						<tbody>{customers.map((customer) => (
							<tr className="border-b border-border last:border-b-0" key={customer.customerId}>
								<td className="p-3"><p className="font-medium">{customerLabel(customer)}</p><p className="admin-meta">{customerOriginLabel(customer.customerOrigin)}</p></td>
								<td className="p-3"><Badge tone={customer.identityStatus === "linked" ? "linked" : "ghost"}>{customer.identityStatus}</Badge>{customer.userId ? <div className="mt-1"><CopyableId value={customer.userId} label="user ID" prefixLength={4} suffixLength={4} /></div> : null}</td>
								<td className="p-3 admin-meta">{customer.contactEmail ?? customer.phoneNumber ?? "—"}</td>
								<td className="p-3"><Badge tone={customer.status === "active" ? "linked" : "muted"}>{customer.status}</Badge></td>
								<td className="p-3"><CopyableId value={customer.customerId} label="customer ID" prefixLength={6} suffixLength={4} /></td>
							</tr>
						))}</tbody>
					</table>
				</div>
			) : null}

			{createOpen ? <CreateCustomerDialog client={client} onClose={() => setCreateOpen(false)} onCreated={async (customer) => { setCreateOpen(false); setMessage(`Created ${customer.displayName} as an unlinked customer.`); await loadCustomers(); }} /> : null}
			{mergeOpen ? <MergeCustomerDialog client={client} customers={customers} onClose={() => setMergeOpen(false)} onMerged={async (result) => { setMergeOpen(false); setMessage(`Merged ghost history into ${result.customer.displayName}.`); await loadCustomers(); }} /> : null}
		</section>
	);
}

function customerLabel(customer: Customer) {
	return customer.displayName?.trim() || customer.contactEmail || customer.phoneNumber || `Customer ${customer.customerId.slice(0, 6)}…${customer.customerId.slice(-4)}`;
}

function customerOriginLabel(origin: Customer["customerOrigin"]) {
	if (origin === "manager_created") return "Manager-created";
	if (origin === "identity_provisioned") return "Created at signup";
	return "Legacy customer";
}

function CreateCustomerDialog({ client, onClose, onCreated }: { client: ClassKitClient; onClose: () => void; onCreated: (customer: Customer) => Promise<void> }) {
	const [displayName, setDisplayName] = useState("");
	const [contactEmail, setContactEmail] = useState("");
	const [phoneNumber, setPhoneNumber] = useState("");
	const [metadata, setMetadata] = useState("{}");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function create() {
		if (!displayName.trim()) return;
		setSaving(true);
		setError(null);
		try {
			const response = await client.management.customers.create({
				displayName: displayName.trim(),
				contactEmail: nullableText(contactEmail),
				phoneNumber: nullableText(phoneNumber),
				metadata: parseMetadata(metadata),
			});
			await onCreated(response.customer);
		} catch (caught) {
			setError(errorMessage(caught, "Could not create the customer."));
		} finally {
			setSaving(false);
		}
	}

	return (
		<AdminDialog title="Create ghost customer" onClose={onClose}>
			<div className="grid gap-4">
				<p className="admin-meta">This creates a product customer without a Supabase Auth identity or access role.</p>
				<TextField label="Display name" value={displayName} onChange={setDisplayName} required autoFocus />
				<TextField label="Contact email (optional)" type="email" value={contactEmail} onChange={setContactEmail} />
				<TextField label="Phone number (optional)" type="tel" value={phoneNumber} onChange={setPhoneNumber} />
				<label className="grid gap-1.5 text-sm"><span className="font-medium">Manager metadata (JSON object)</span><textarea className="min-h-28 rounded-md border border-input bg-background p-3 font-mono text-sm" value={metadata} onChange={(event) => setMetadata(event.target.value)} disabled={saving} /></label>
				<AdminPanelMessage message={null} error={error} />
				<div className="flex justify-end gap-2 border-t border-border pt-4"><ActionButton onClick={onClose} disabled={saving}>Cancel</ActionButton><ActionButton primary onClick={() => void create()} disabled={saving || !displayName.trim()}>{saving ? "Creating" : "Create customer"}</ActionButton></div>
			</div>
		</AdminDialog>
	);
}

function MergeCustomerDialog({ client, customers, onClose, onMerged }: { client: ClassKitClient; customers: Customer[]; onClose: () => void; onMerged: (result: MergeCustomersResponse) => Promise<void> }) {
	const ghosts = customers.filter((customer) => customer.identityStatus === "unlinked" && customer.status === "active");
	const linked = customers.filter((customer) => customer.identityStatus === "linked" && customer.status === "active");
	const [sourceCustomerId, setSourceCustomerId] = useState(ghosts[0]?.customerId ?? "");
	const [survivorCustomerId, setSurvivorCustomerId] = useState(linked[0]?.customerId ?? "");
	const [preview, setPreview] = useState<CustomerMergePreview | null>(null);
	const [resolutions, setResolutions] = useState<ResolutionDraft | null>(null);
	const [idempotencyKey, setIdempotencyKey] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function loadPreview() {
		setSaving(true);
		setError(null);
		try {
			const response = await client.management.customers.previewMerge({ sourceCustomerId, survivorCustomerId });
			setPreview(response.mergePreview);
			setResolutions(createResolutionDraft(response.mergePreview));
			setIdempotencyKey(crypto.randomUUID());
		} catch (caught) {
			setError(errorMessage(caught, "Could not preview this merge."));
		} finally {
			setSaving(false);
		}
	}

	async function merge() {
		if (!preview || !resolutions || !idempotencyKey) return;
		setSaving(true);
		setError(null);
		try {
			await onMerged(await client.management.customers.merge({
				sourceCustomerId: preview.source.customerId,
				survivorCustomerId: preview.survivor.customerId,
				previewToken: preview.previewToken,
				idempotencyKey,
				fieldResolutions: buildResolutions(resolutions),
			}));
		} catch (caught) {
			setError(errorMessage(caught, "Could not merge these customers. Refresh the preview if their data changed."));
		} finally {
			setSaving(false);
		}
	}

	return (
		<AdminDialog title="Merge ghost customer" onClose={onClose} wide>
			<div className="grid gap-4">
				{!preview || !resolutions ? <>
					<p className="admin-meta">Choose the manager-owned ghost customer and the linked customer representing the same person. The linked customer always survives.</p>
					<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
						<CustomerSelect label="Ghost source" customers={ghosts} value={sourceCustomerId} onChange={setSourceCustomerId} /><ArrowRight className="mb-3 size-4 text-muted-foreground" /><CustomerSelect label="Linked survivor" customers={linked} value={survivorCustomerId} onChange={setSurvivorCustomerId} />
					</div>
					<AdminPanelMessage message={null} error={error} />
					<div className="flex justify-end gap-2 border-t border-border pt-4"><ActionButton onClick={onClose} disabled={saving}>Cancel</ActionButton><ActionButton primary onClick={() => void loadPreview()} disabled={saving || !sourceCustomerId || !survivorCustomerId}>{saving ? "Preparing preview" : "Preview merge"}</ActionButton></div>
				</> : <>
					<PreviewSummary preview={preview} />
					<ResolutionEditor preview={preview} draft={resolutions} onChange={setResolutions} />
					<p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm"><strong>This cannot be undone.</strong> The ghost customer is retired after all service history is consolidated into the linked survivor.</p>
					<AdminPanelMessage message={null} error={error} />
					<div className="flex justify-end gap-2 border-t border-border pt-4"><ActionButton onClick={() => { setPreview(null); setResolutions(null); setIdempotencyKey(""); setError(null); }} disabled={saving}>Change customers</ActionButton><ActionButton primary onClick={() => void merge()} disabled={saving}>{saving ? "Merging" : "Confirm irreversible merge"}</ActionButton></div>
				</>}
			</div>
		</AdminDialog>
	);
}

function PreviewSummary({ preview }: { preview: CustomerMergePreview }) {
	const membership = preview.membershipResolution;
	return <div className="grid gap-3">
		<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3"><Party label="Ghost source" customer={preview.source} /><ArrowRight className="size-4 text-muted-foreground" /><Party label="Linked survivor" customer={preview.survivor} /></div>
		<div className="grid grid-cols-4 gap-2"><Metric label="Membership grants moved" value={preview.movementCounts.membershipGrants} /><Metric label="Ledger entries moved" value={preview.movementCounts.membershipLedger} /><Metric label={`Registrations · ${preview.registrations.collisionCount} collisions`} value={preview.registrations.movedCount} /><Metric label={`Attendance · ${preview.participants.collisionCount} collisions`} value={preview.participants.movedCount} /></div>
		<div className="rounded-md border border-border p-3"><div className="flex justify-between gap-3"><strong className="text-sm">Membership resolution</strong><span className="admin-meta">{formatLabel(membership.resolution)}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><Grant label="Ghost membership" grant={membership.sourceGrant} /><Grant label="Linked membership" grant={membership.survivorGrant} /></div>{membership.sourceGrant && membership.survivorGrant ? <p className="admin-meta mt-3">The linked membership wins because it may be transactional. Full details for both grants remain in this merge result.</p> : null}</div>
		<p className="admin-meta">Preview expires {new Date(preview.expiresAt).toLocaleString()}.</p>
	</div>;
}

function ResolutionEditor({ preview, draft, onChange }: { preview: CustomerMergePreview; draft: ResolutionDraft; onChange: (draft: ResolutionDraft) => void }) {
	const fields = preview.fieldComparisons;
	return <div className="grid gap-2"><div><h3 className="admin-panel-title">Surviving profile details</h3><p className="admin-meta mt-1">Choose values deliberately; membership and service-history collision rules are automatic.</p></div>
		<ResolutionRow label="Display name" source={fields.displayName.sourceValue} survivor={fields.displayName.survivorValue} allowed={fields.displayName.allowedSelections} draft={draft.displayName} onChange={(displayName) => onChange({ ...draft, displayName })} />
		<ResolutionRow label="Contact email" source={fields.contactEmail.sourceValue} survivor={fields.contactEmail.survivorValue} allowed={fields.contactEmail.allowedSelections} draft={draft.contactEmail} onChange={(contactEmail) => onChange({ ...draft, contactEmail })} />
		<ResolutionRow label="Phone number" source={fields.phoneNumber.sourceValue} survivor={fields.phoneNumber.survivorValue} allowed={fields.phoneNumber.allowedSelections} draft={draft.phoneNumber} onChange={(phoneNumber) => onChange({ ...draft, phoneNumber })} />
		{fields.metadata.conflicts.map((conflict) => <ResolutionRow key={conflict.key} label={`Metadata: ${conflict.key}`} source={conflict.source.present ? JSON.stringify(conflict.source.value) : "Not set"} survivor={conflict.survivor.present ? JSON.stringify(conflict.survivor.value) : "Not set"} allowed={conflict.allowedSelections} draft={draft.metadata[conflict.key]} onChange={(value) => onChange({ ...draft, metadata: { ...draft.metadata, [conflict.key]: value } })} json />)}
		{fields.metadata.conflicts.length === 0 ? <AdminEmptyState>No metadata conflicts require a manager decision.</AdminEmptyState> : null}
	</div>;
}

function ResolutionRow({ label, source, survivor, allowed, draft, onChange, json = false }: { label: string; source: string | null; survivor: string | null; allowed: CustomerMergeSelection[]; draft: FieldDraft; onChange: (draft: FieldDraft) => void; json?: boolean }) {
	return <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(10rem,0.8fr)_minmax(12rem,1fr)] items-end gap-3 rounded-md border border-border p-3"><div className="min-w-0"><p className="font-medium">{label}</p><p className="admin-meta break-words">Ghost: {source ?? "Not set"}</p><p className="admin-meta break-words">Linked: {survivor ?? "Not set"}</p></div><label className="grid gap-1 text-sm"><span className="font-medium">Keep</span><select className="h-10 rounded-md border border-input bg-background px-3" value={draft.selection} onChange={(event) => onChange({ ...draft, selection: event.target.value as CustomerMergeSelection })}>{allowed.includes("survivor") ? <option value="survivor">Linked value</option> : null}{allowed.includes("source") ? <option value="source">Ghost value</option> : null}{allowed.includes("replacement") ? <option value="replacement">New replacement</option> : null}</select></label>{draft.selection === "replacement" ? <TextField label={json ? "Replacement JSON value" : "Replacement value"} value={draft.replacement} onChange={(replacement) => onChange({ ...draft, replacement })} /> : <div />}</div>;
}

function CustomerSelect({ label, customers, value, onChange }: { label: string; customers: Customer[]; value: string; onChange: (value: string) => void }) {
	return <label className="grid gap-1 text-sm"><span className="font-medium">{label}</span><select className="h-10 rounded-md border border-input bg-background px-3" value={value} onChange={(event) => onChange(event.target.value)}>{customers.map((customer) => <option value={customer.customerId} key={customer.customerId}>{customer.displayName} · {shortId(customer.customerId)}</option>)}</select></label>;
}

function Party({ label, customer }: { label: string; customer: Customer }) { return <div className="rounded-md border border-border p-3"><p className="admin-label">{label}</p><p className="mt-1 font-medium">{customer.displayName}</p><p className="admin-meta">{customer.contactEmail ?? customer.phoneNumber ?? shortId(customer.customerId)}</p></div>; }
function Grant({ label, grant }: { label: string; grant: CustomerMergePreview["membershipResolution"]["sourceGrant"] }) { return <div className="rounded-md border border-border bg-background p-3"><p className="admin-label">{label}</p><p className="mt-1 font-medium">{grant?.membershipType.name ?? "None"}</p>{grant ? <p className="admin-meta">{grant.mode} · {grant.totalStock === null ? "unlimited" : `${grant.remainingStock ?? 0}/${grant.totalStock} remaining`}</p> : null}</div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-md border border-border bg-background p-3"><p className="admin-label truncate" title={label}>{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>; }
function Badge({ tone, children }: { tone: "linked" | "ghost" | "muted"; children: string }) { const color = tone === "linked" ? "border-primary/40 text-primary" : tone === "ghost" ? "border-amber-500/40 text-amber-600 dark:text-amber-300" : "border-border text-muted-foreground"; return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold capitalize ${color}`}>{children}</span>; }
function ActionButton({ children, onClick, disabled = false, primary = false }: { children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) { return <button type="button" className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold disabled:opacity-60 ${primary ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`} onClick={onClick} disabled={disabled}>{children}</button>; }
function TextField({ label, value, onChange, type = "text", required = false, autoFocus = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; autoFocus?: boolean }) { return <label className="grid gap-1 text-sm"><span className="font-medium">{label}</span><input className="h-10 rounded-md border border-input bg-background px-3" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} autoFocus={autoFocus} /></label>; }

function createResolutionDraft(preview: CustomerMergePreview): ResolutionDraft {
	const make = (allowed: CustomerMergeSelection[]): FieldDraft => ({ selection: allowed.includes("survivor") ? "survivor" : (allowed[0] ?? "source"), replacement: "" });
	return { displayName: make(preview.fieldComparisons.displayName.allowedSelections), contactEmail: make(preview.fieldComparisons.contactEmail.allowedSelections), phoneNumber: make(preview.fieldComparisons.phoneNumber.allowedSelections), metadata: Object.fromEntries(preview.fieldComparisons.metadata.conflicts.map((conflict) => [conflict.key, make(conflict.allowedSelections)])) };
}

function buildResolutions(draft: ResolutionDraft): CustomerMergeFieldResolutionsInput {
	const scalar = (field: FieldDraft, nullable: boolean): CustomerMergeResolutionInput<string | null> => field.selection === "replacement" ? { selection: "replacement", value: nullable ? nullableText(field.replacement) : requireText(field.replacement, "Display name") } : { selection: field.selection };
	const metadata: Record<string, CustomerMergeResolutionInput<CustomerMergeJsonValue>> = Object.fromEntries(Object.entries(draft.metadata).map(([key, field]) => [key, field.selection === "replacement" ? { selection: "replacement" as const, value: JSON.parse(field.replacement) as CustomerMergeJsonValue } : { selection: field.selection }]));
	return { displayName: scalar(draft.displayName, false), contactEmail: scalar(draft.contactEmail, true), phoneNumber: scalar(draft.phoneNumber, true), metadata: { conflicts: metadata } };
}

function parseMetadata(value: string): Record<string, unknown> { const parsed = JSON.parse(value || "{}"); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Metadata must be a JSON object."); return parsed as Record<string, unknown>; }
function requireText(value: string, label: string) { if (!value.trim()) throw new Error(`${label} cannot be empty.`); return value.trim(); }
function nullableText(value: string) { return value.trim() || null; }
function shortId(value: string) { return `${value.slice(0, 8)}…${value.slice(-4)}`; }
function formatLabel(value: string) { return value.split("_").map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`).join(" "); }
function errorMessage(error: unknown, fallback: string) { if (error instanceof SyntaxError) return "Enter valid JSON before continuing."; return error instanceof Error ? error.message : fallback; }
