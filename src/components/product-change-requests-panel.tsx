import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
	AdminPmIntegrationConfig,
	AdminPmIntegrationLabelMapping,
	AdminProductChangeRequestPmLink,
	AdminProductChangeRequest,
	AdminProductChangeRequestAttachment,
	AdminProductChangeRequestStatus,
	AdminProductListItem,
	ClassKitClient,
} from "@class-kit/react";
import { Clock3, Download, ExternalLink, Eye, ImageIcon, Paperclip, RefreshCw, Search, Send, Trash2, Unlink, X } from "lucide-react";
import { adminBadgeClass } from "./admin-badge";
import { AdminEmptyState, AdminPanelMessage } from "./admin-feedback";

type AdminProductChangeRequestRevision = AdminProductChangeRequest["revisions"][number];
type RequestTypeFilter = "all" | AdminProductChangeRequest["type"];
type RequestStatusFilter = "all" | AdminProductChangeRequestStatus;

type ProductChangeRequestsPanelProps = {
	client: ClassKitClient;
	product: AdminProductListItem;
};

const statuses: AdminProductChangeRequestStatus[] = ["open", "in_progress", "done", "closed"];

export function ProductChangeRequestsPanel({ client, product }: ProductChangeRequestsPanelProps) {
	const [requests, setRequests] = useState<AdminProductChangeRequest[]>([]);
	const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
	const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
	const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>("all");
	const [typeFilter, setTypeFilter] = useState<RequestTypeFilter>("all");
	const [query, setQuery] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
	const [pendingAttachmentId, setPendingAttachmentId] = useState<string | null>(null);
	const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<Record<string, string>>({});
	const [pmConfig, setPmConfig] = useState<AdminPmIntegrationConfig | null>(null);
	const [pmLabelMappings, setPmLabelMappings] = useState<AdminPmIntegrationLabelMapping[]>([]);
	const [pmLinks, setPmLinks] = useState<AdminProductChangeRequestPmLink[]>([]);
	const [pendingPmAction, setPendingPmAction] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const sortedRequests = useMemo(
		() => [...requests].sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at)),
		[requests],
	);
	const filteredRequests = useMemo(
		() => sortedRequests.filter((request) => matchesFilters(request, { query, statusFilter, typeFilter })),
		[query, sortedRequests, statusFilter, typeFilter],
	);
	const selectedRequest = filteredRequests.find((request) => request.id === selectedRequestId) ?? filteredRequests[0] ?? null;
	const selectedRevisions = selectedRequest ? getRequestRevisions(selectedRequest) : [];
	const selectedRevision = selectedRevisions.find((revision) => revision.id === selectedRevisionId) ?? selectedRevisions[selectedRevisions.length - 1] ?? null;
	const pmLinksByThreadId = useMemo(() => new Map(pmLinks.map((link) => [link.request_thread_id, link])), [pmLinks]);
	const selectedPmLink = selectedRequest ? pmLinksByThreadId.get(selectedRequest.thread_id) ?? null : null;
	const openCount = sortedRequests.filter((request) => request.status === "open").length;
	const attachmentCount = sortedRequests.reduce((total, request) => total + getRequestRevisions(request).reduce((count, revision) => count + revision.attachments.length, 0), 0);

	const loadAttachmentPreviews = useCallback(async (requestRows: AdminProductChangeRequest[]) => {
		const imageAttachments = requestRows
			.flatMap((request) => getRequestRevisions(request).flatMap((revision) => revision.attachments))
			.filter((attachment) => attachment.status === "uploaded" && isImageAttachment(attachment));

		if (imageAttachments.length === 0) {
			setAttachmentPreviewUrls({});
			return;
		}

		const entries = await Promise.all(imageAttachments.map(async (attachment) => {
			try {
				const data = await client.admin.changeRequests.createAttachmentDownloadUrl(attachment.id, { download: false });
				return [attachment.id, data.download.signed_url] as const;
			} catch {
				return null;
			}
		}));

		setAttachmentPreviewUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))));
	}, [client]);

	const loadRequests = useCallback(async (options: { showLoading?: boolean } = {}) => {
		if (options.showLoading ?? true) setIsLoading(true);
		setError(null);
		try {
			const data = await client.admin.changeRequests.list({ productKey: product.product_key });
			setRequests(data.requests);
			await loadAttachmentPreviews(data.requests);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not load product change requests.");
		} finally {
			if (options.showLoading ?? true) setIsLoading(false);
		}
	}, [client, loadAttachmentPreviews, product.product_key]);

	const syncPmLinks = useCallback(async (options: { silent?: boolean } = {}) => {
		if (!pmConfig?.enabled) return;
		if (!options.silent) setPendingPmAction("sync-all");
		if (!options.silent) setError(null);

		try {
			const data = await client.admin.pmIntegrations.syncLinkedWorkItems({ productKey: product.product_key });
			setPmLinks(data.links);
			if (!options.silent) {
				const detached = data.summary.detached ?? 0;
				if (data.summary.failed > 0) {
					setMessage(`Synced ${data.summary.synced} Trello card${data.summary.synced === 1 ? "" : "s"}; ${data.summary.failed} failed${detached > 0 ? `; ${detached} detached` : ""}.`);
				} else {
					setMessage(detached > 0 ? `Trello statuses synced; ${detached} missing card${detached === 1 ? " was" : "s were"} detached.` : "Trello statuses synced.");
				}
				await loadRequests({ showLoading: false });
			}
		} catch (caught) {
			if (!options.silent) setError(caught instanceof Error ? caught.message : "Could not sync Trello cards.");
		} finally {
			if (!options.silent) setPendingPmAction(null);
		}
	}, [client, loadRequests, pmConfig?.enabled, product.product_key]);

	const loadPmConfig = useCallback(async () => {
		try {
			const data = await client.admin.pmIntegrations.getConfig();
			setPmConfig(data.config);
			setPmLabelMappings(data.label_mappings);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not load Trello integration config.");
		}
	}, [client]);

	useEffect(() => {
		let isCurrent = true;
		client.admin.changeRequests.list({ productKey: product.product_key })
			.then(async (data) => {
				if (!isCurrent) return;
				setRequests(data.requests);
				await loadAttachmentPreviews(data.requests);
				setError(null);
			})
			.catch((caught: unknown) => {
				if (!isCurrent) return;
				setError(caught instanceof Error ? caught.message : "Could not load product change requests.");
			})
			.finally(() => {
				if (isCurrent) setIsLoading(false);
			});

		return () => {
			isCurrent = false;
		};
	}, [client, loadAttachmentPreviews, product.product_key]);

	useEffect(() => {
		void loadPmConfig();
	}, [loadPmConfig]);

	useEffect(() => {
		if (!pmConfig?.enabled) return;
		void syncPmLinks({ silent: true });
		const interval = window.setInterval(() => {
			void syncPmLinks({ silent: true });
		}, 30_000);
		return () => window.clearInterval(interval);
	}, [pmConfig?.enabled, syncPmLinks]);

	useEffect(() => {
		if (!selectedRequest) {
			setSelectedRequestId(null);
			setSelectedRevisionId(null);
			return;
		}
		setSelectedRequestId(selectedRequest.id);
		setSelectedRevisionId(selectedRequest.id);
	}, [selectedRequest?.id]);

	async function updateStatus(request: AdminProductChangeRequest, status: AdminProductChangeRequestStatus) {
		if (request.status === status) return;
		setPendingRequestId(request.id);
		setMessage(null);
		setError(null);

		try {
			await client.admin.changeRequests.updateStatus({ requestId: request.id, status });
			setMessage("Request status updated.");
			await loadRequests({ showLoading: false });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not update request status.");
		} finally {
			setPendingRequestId(null);
		}
	}

	async function createPmWorkItem(request: AdminProductChangeRequest, labelMappingIds: string[], options: { forceNew?: boolean } = {}) {
		setPendingPmAction(`create-${request.id}`);
		setMessage(null);
		setError(null);

		try {
			const data = await client.admin.pmIntegrations.createWorkItem({ requestId: request.id, labelMappingIds, forceNew: options.forceNew });
			setPmLinks((links) => replacePmLink(links, data.link));
			const warningText = data.warnings.length > 0 ? ` ${data.warnings.length} attachment warning${data.warnings.length === 1 ? "" : "s"}.` : "";
			setMessage(`${options.forceNew ? "New Trello card created." : "Trello card created."}${warningText}`);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not create Trello card.");
		} finally {
			setPendingPmAction(null);
		}
	}

	async function detachPmWorkItem(link: AdminProductChangeRequestPmLink) {
		setPendingPmAction(`detach-${link.id}`);
		setMessage(null);
		setError(null);

		try {
			await client.admin.pmIntegrations.detachWorkItem({ pmLinkId: link.id });
			setPmLinks((links) => removePmLink(links, link.id));
			setMessage("Trello card detached. The Trello card was not deleted.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not detach Trello card.");
		} finally {
			setPendingPmAction(null);
		}
	}

	async function syncPmWorkItem(link: AdminProductChangeRequestPmLink) {
		setPendingPmAction(`sync-${link.id}`);
		setMessage(null);
		setError(null);

		try {
			const data = await client.admin.pmIntegrations.syncWorkItem({ pmLinkId: link.id });
			if (data.detached || !data.link) {
				setPmLinks((links) => removePmLink(links, link.id));
				setMessage("Trello card was missing, so this request was detached.");
			} else {
				const syncedLink = data.link;
				setPmLinks((links) => replacePmLink(links, syncedLink));
				setMessage("Trello card synced.");
			}
			await loadRequests({ showLoading: false });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not sync Trello card.");
		} finally {
			setPendingPmAction(null);
		}
	}

	async function openAttachment(attachment: AdminProductChangeRequestAttachment) {
		setPendingAttachmentId(attachment.id);
		setMessage(null);
		setError(null);

		try {
			const data = await client.admin.changeRequests.createAttachmentDownloadUrl(attachment.id);
			window.open(data.download.signed_url, "_blank", "noopener,noreferrer");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not create attachment download URL.");
		} finally {
			setPendingAttachmentId(null);
		}
	}

	async function deleteRequest(request: AdminProductChangeRequest) {
		setPendingRequestId(request.id);
		setMessage(null);
		setError(null);

		try {
			await client.admin.changeRequests.delete({ requestId: request.id });
			setMessage("Request deleted.");
			await loadRequests({ showLoading: false });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not delete request.");
		} finally {
			setPendingRequestId(null);
		}
	}

	return (
		<section className="overflow-hidden rounded-md border border-border bg-card">
			<div className="flex min-w-0 flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<p className="admin-label truncate">Product requests</p>
					<h2 className="admin-panel-heading mt-1">Change requests</h2>
					<p className="admin-meta mt-1">Issues and feature requests opened by this product's managers.</p>
				</div>
				<div className="grid gap-2 sm:grid-cols-3 lg:min-w-[26rem]">
					<SummaryTile label="Open" value={String(openCount)} />
					<SummaryTile label="Total" value={String(sortedRequests.length)} />
					<SummaryTile label="Files" value={String(attachmentCount)} />
				</div>
			</div>

			<div className="border-b border-border px-4 py-3">
				<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_auto] lg:items-center">
					<label className="relative min-w-0">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
						<input
							className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search requests"
						/>
					</label>
					<select
						className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
						value={statusFilter}
						onChange={(event) => setStatusFilter(event.target.value as RequestStatusFilter)}
					>
						<option value="all">All statuses</option>
						{statuses.map((status) => <option value={status} key={status}>{formatStatus(status)}</option>)}
					</select>
					<select
						className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
						value={typeFilter}
						onChange={(event) => setTypeFilter(event.target.value as RequestTypeFilter)}
					>
						<option value="all">All types</option>
						<option value="feature_request">Feature requests</option>
						<option value="issue">Issues</option>
					</select>
					<button
						type="button"
						className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
						onClick={() => void loadRequests()}
						disabled={isLoading}
					>
						<RefreshCw className="size-4" aria-hidden="true" />
						Refresh
					</button>
				</div>
			</div>

			<AdminPanelMessage message={message} error={error} />

			{isLoading ? <AdminEmptyState>Loading product change requests.</AdminEmptyState> : null}
			{!isLoading && sortedRequests.length === 0 ? <AdminEmptyState>No product change requests yet.</AdminEmptyState> : null}
			{!isLoading && sortedRequests.length > 0 && filteredRequests.length === 0 ? <AdminEmptyState>No requests match the current filters.</AdminEmptyState> : null}

			{!isLoading && filteredRequests.length > 0 ? (
				<div className="grid min-h-[38rem] lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(34rem,1fr)_18rem] 2xl:grid-cols-[20rem_minmax(42rem,1fr)_20rem]">
					<RequestInbox
						requests={filteredRequests}
						selectedRequestId={selectedRequest?.id ?? null}
						onSelectRequest={(request) => {
							setSelectedRequestId(request.id);
							setSelectedRevisionId(request.id);
						}}
					/>

					<RequestDetail
						pmConfig={pmConfig}
						pmLabelMappings={pmLabelMappings}
						pmLink={selectedPmLink}
						onCreatePmWorkItem={createPmWorkItem}
						onDelete={deleteRequest}
						onDetachPmWorkItem={detachPmWorkItem}
						onSyncPmWorkItem={syncPmWorkItem}
						onUpdateStatus={updateStatus}
						pendingPmAction={pendingPmAction}
						pendingRequestId={pendingRequestId}
						request={selectedRequest}
						revision={selectedRevision}
					/>

					<RequestSideRail
						attachmentPreviewUrls={attachmentPreviewUrls}
						onOpenAttachment={openAttachment}
						onSelectRevision={setSelectedRevisionId}
						pendingAttachmentId={pendingAttachmentId}
						request={selectedRequest}
						revisions={selectedRevisions}
						selectedRevision={selectedRevision}
					/>
				</div>
			) : null}
		</section>
	);
}

function SummaryTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-md border border-border bg-background px-3 py-2">
			<p className="admin-label truncate">{label}</p>
			<p className="mt-1 truncate text-base font-semibold text-foreground">{value}</p>
		</div>
	);
}

function RequestInbox({
	onSelectRequest,
	requests,
	selectedRequestId,
}: {
	onSelectRequest: (request: AdminProductChangeRequest) => void;
	requests: AdminProductChangeRequest[];
	selectedRequestId: string | null;
}) {
	return (
		<aside className="grid content-start border-b border-border bg-background/60 lg:row-span-2 lg:border-b-0 lg:border-r xl:row-span-1">
			<div className="border-b border-border px-3 py-2">
				<p className="admin-label">Queue</p>
			</div>
			<div className="grid max-h-[42rem] content-start gap-1 overflow-auto p-2">
				{requests.map((request) => (
					<button
						type="button"
						className={`grid min-w-0 gap-2 rounded-md border p-3 text-left transition ${request.id === selectedRequestId ? "border-primary bg-card shadow-sm" : "border-transparent hover:border-border hover:bg-card"}`}
						onClick={() => onSelectRequest(request)}
						key={request.id}
					>
						<span className="flex min-w-0 items-center justify-between gap-2">
							<span className={adminBadgeClass({ tone: request.type === "issue" ? "muted" : "active", size: "compact" })}>{formatRequestType(request.type)}</span>
							<span className={adminBadgeClass({ tone: statusTone(request.status), size: "compact" })}>{formatStatus(request.status)}</span>
						</span>
						<span className="truncate text-sm font-semibold text-foreground">{request.title || request.description}</span>
						<span className="line-clamp-2 text-xs leading-5 text-muted-foreground">{request.description}</span>
						<span className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
							<span className="inline-flex min-w-0 items-center gap-1">
								<Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
								<span className="truncate">{formatDateTime(request.updated_at)}</span>
							</span>
							<span className="inline-flex items-center gap-1">
								<Paperclip className="size-3.5" aria-hidden="true" />
								{countRequestAttachments(request)}
							</span>
						</span>
					</button>
				))}
			</div>
		</aside>
	);
}

function RequestDetail({
	pmConfig,
	pmLabelMappings,
	pmLink,
	onCreatePmWorkItem,
	onDelete,
	onDetachPmWorkItem,
	onSyncPmWorkItem,
	onUpdateStatus,
	pendingPmAction,
	pendingRequestId,
	request,
	revision,
}: {
	pmConfig: AdminPmIntegrationConfig | null;
	pmLabelMappings: AdminPmIntegrationLabelMapping[];
	pmLink: AdminProductChangeRequestPmLink | null;
	onCreatePmWorkItem: (request: AdminProductChangeRequest, labelMappingIds: string[], options?: { forceNew?: boolean }) => Promise<void>;
	onDelete: (request: AdminProductChangeRequest) => Promise<void>;
	onDetachPmWorkItem: (link: AdminProductChangeRequestPmLink) => Promise<void>;
	onSyncPmWorkItem: (link: AdminProductChangeRequestPmLink) => Promise<void>;
	onUpdateStatus: (request: AdminProductChangeRequest, status: AdminProductChangeRequestStatus) => Promise<void>;
	pendingPmAction: string | null;
	pendingRequestId: string | null;
	request: AdminProductChangeRequest | null;
	revision: AdminProductChangeRequestRevision | null;
}) {
	if (!request || !revision) {
		return <AdminEmptyState>Select a request to inspect its details.</AdminEmptyState>;
	}

	const contextLabel = formatRequestContext(revision.context);

	return (
		<div className="grid content-start gap-4 border-b border-border p-4 lg:border-b-0">
			<div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
				<div className="min-w-0">
					<div className="flex flex-wrap gap-2">
						<span className={adminBadgeClass({ tone: revision.type === "issue" ? "muted" : "active" })}>{formatRequestType(revision.type)}</span>
						<span className={adminBadgeClass({ tone: statusTone(revision.status) })}>{formatStatus(revision.status)}</span>
						<span className={adminBadgeClass({ tone: revision.id === request.id ? "neutral" : "muted" })}>v{revision.version_number}</span>
						{revision.id !== request.id ? <span className={adminBadgeClass({ tone: "muted" })}>Older version</span> : null}
					</div>
					<h3 className="mt-3 text-xl font-semibold leading-tight text-foreground">{revision.title || revision.description}</h3>
					<p className="admin-code mt-2 truncate" title={revision.id}>{revision.id}</p>
				</div>
				<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
					<label className="grid gap-1 text-sm">
						<span className="admin-label">Status</span>
						<select
							className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
							value={request.status}
							onChange={(event) => void onUpdateStatus(request, event.target.value as AdminProductChangeRequestStatus)}
							disabled={pendingRequestId === request.id}
						>
							{statuses.map((status) => <option value={status} key={status}>{formatStatus(status)}</option>)}
						</select>
					</label>
					<button
						type="button"
						className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground hover:border-destructive hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
						onClick={() => void onDelete(request)}
						disabled={pendingRequestId === request.id}
					>
						<Trash2 className="size-4" aria-hidden="true" />
						Delete
					</button>
				</div>
			</div>

			<div className="grid gap-3 md:grid-cols-3">
				<RequestMeta label="Created" value={formatDateTime(revision.created_at)} />
				<RequestMeta label="Updated" value={formatDateTime(revision.updated_at)} />
				<RequestMeta label="Context" value={contextLabel ?? "No context"} />
			</div>

			<div className="grid gap-2 rounded-md border border-border bg-background p-4">
				<p className="admin-label">Client request</p>
				<p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{revision.description}</p>
			</div>

			{revision.previous_request_id ? (
				<div className="rounded-md border border-border bg-background p-4">
					<p className="admin-label">Version note</p>
					<p className="admin-meta mt-1">This is version {revision.version_number}. Use the version panel to compare older request text and attachments.</p>
				</div>
			) : null}

			<TrelloWorkItemPanel
				config={pmConfig}
				labelMappings={pmLabelMappings}
				link={pmLink}
				onCreate={(labelMappingIds, options) => void onCreatePmWorkItem(request, labelMappingIds, options)}
				onDetach={() => pmLink ? void onDetachPmWorkItem(pmLink) : undefined}
				onSync={() => pmLink ? void onSyncPmWorkItem(pmLink) : undefined}
				isCreating={pendingPmAction === `create-${request.id}`}
				isDetaching={pmLink ? pendingPmAction === `detach-${pmLink.id}` : false}
				isSyncing={pmLink ? pendingPmAction === `sync-${pmLink.id}` : false}
			/>
		</div>
	);
}

function TrelloWorkItemPanel({
	config,
	isCreating,
	isDetaching,
	isSyncing,
	labelMappings,
	link,
	onCreate,
	onDetach,
	onSync,
}: {
	config: AdminPmIntegrationConfig | null;
	isCreating: boolean;
	isDetaching: boolean;
	isSyncing: boolean;
	labelMappings: AdminPmIntegrationLabelMapping[];
	link: AdminProductChangeRequestPmLink | null;
	onCreate: (labelMappingIds: string[], options?: { forceNew?: boolean }) => void;
	onDetach: () => void;
	onSync: () => void;
}) {
	const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
	useEffect(() => {
		setSelectedLabelIds(link?.labels.flatMap((label) => label.label_mapping_id ? [label.label_mapping_id] : []) ?? []);
	}, [link?.id, link?.labels]);

	return (
		<div className="grid gap-3 rounded-md border border-border bg-background p-4">
			<div className="flex min-w-0 items-center justify-between gap-3">
				<div className="min-w-0">
					<p className="admin-label">Trello card</p>
					<p className="admin-meta mt-1">{link ? "Linked to product management software." : "Create a Trello card when this request is ready for work."}</p>
				</div>
				{link ? <span className={adminBadgeClass({ tone: pmStatusTone(link.provider_status) })}>{formatPmStatus(link.provider_status)}</span> : null}
			</div>
			{!config?.enabled ? (
				<p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">Enable the Trello integration before creating cards.</p>
			) : null}
			{link ? (
				<div className="grid gap-3 md:grid-cols-3">
					<RequestMeta label="Last sync" value={link.last_synced_at ? formatDateTime(link.last_synced_at) : "Not synced"} />
					<RequestMeta label="Attachment sync" value={formatAttachmentSync(link)} />
					<RequestMeta label="Card ID" value={link.provider_card_id} />
				</div>
			) : null}
			{link && link.labels.length > 0 ? (
				<div className="flex flex-wrap gap-2">
					{link.labels.map((label) => (
						<span className={adminBadgeClass({ tone: "active", size: "compact" })} key={label.id}>{label.display_name}</span>
					))}
				</div>
			) : null}
			{config?.enabled && labelMappings.length > 0 ? (
				<div className="grid gap-2 rounded-md border border-border bg-card p-3">
					<p className="admin-label">Trello labels</p>
					<div className="flex flex-wrap gap-2">
						{labelMappings.map((label) => {
							const isSelected = selectedLabelIds.includes(label.id);
							return (
								<label
									className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium ${isSelected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary hover:text-foreground"}`}
									key={label.id}
								>
									<input
										type="checkbox"
										className="size-3.5"
										checked={isSelected}
										onChange={(event) => {
											setSelectedLabelIds((current) => event.target.checked
												? [...current, label.id]
												: current.filter((id) => id !== label.id));
										}}
									/>
									{label.display_name}
								</label>
							);
						})}
					</div>
				</div>
			) : null}
			<div className="flex flex-wrap items-center gap-2">
				{link ? (
					<>
						<a
							className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
							href={link.provider_card_url}
							target="_blank"
							rel="noreferrer"
						>
							<ExternalLink className="size-4" aria-hidden="true" />
							Open in Trello
						</a>
						<button
							type="button"
							className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
							onClick={onSync}
							disabled={isSyncing}
						>
							<RefreshCw className="size-4" aria-hidden="true" />
							Sync now
						</button>
						<button
							type="button"
							className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
							onClick={onDetach}
							disabled={isDetaching}
						>
							<Unlink className="size-4" aria-hidden="true" />
							Detach
						</button>
						<button
							type="button"
							className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => onCreate(selectedLabelIds, { forceNew: true })}
							disabled={!config?.enabled || isCreating}
						>
							<Send className="size-4" aria-hidden="true" />
							Create new card
						</button>
					</>
				) : (
					<button
						type="button"
						className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
						onClick={() => onCreate(selectedLabelIds)}
						disabled={!config?.enabled || isCreating}
					>
						<Send className="size-4" aria-hidden="true" />
						Create Trello card
					</button>
				)}
			</div>
		</div>
	);
}

function RequestSideRail({
	attachmentPreviewUrls,
	onOpenAttachment,
	onSelectRevision,
	pendingAttachmentId,
	request,
	revisions,
	selectedRevision,
}: {
	attachmentPreviewUrls: Record<string, string>;
	onOpenAttachment: (attachment: AdminProductChangeRequestAttachment) => Promise<void>;
	onSelectRevision: (revisionId: string) => void;
	pendingAttachmentId: string | null;
	request: AdminProductChangeRequest | null;
	revisions: AdminProductChangeRequestRevision[];
	selectedRevision: AdminProductChangeRequestRevision | null;
}) {
	return (
		<aside className="grid content-start gap-4 border-t border-border bg-background/70 p-3 lg:col-start-2 xl:col-start-auto xl:border-l xl:border-t-0">
			<div className="grid gap-2">
				<p className="admin-label">Versions</p>
				{request && revisions.length > 0 ? (
					<div className="grid gap-2">
						{[...revisions].reverse().map((revision) => {
							const isSelected = revision.id === selectedRevision?.id;
							const isCurrent = revision.id === request.id;
							return (
								<button
									type="button"
									className={`grid min-w-0 gap-1 rounded-md border p-3 text-left text-sm transition ${isSelected ? "border-primary bg-card shadow-sm" : "border-border bg-card/70 hover:border-primary hover:bg-card"}`}
									onClick={() => onSelectRevision(revision.id)}
									key={revision.id}
								>
									<span className="flex items-center justify-between gap-2">
										<span className="font-semibold text-foreground">v{revision.version_number}</span>
										<span className={adminBadgeClass({ tone: isCurrent ? "active" : statusTone(revision.status), size: "compact" })}>{isCurrent ? "Current" : formatStatus(revision.status)}</span>
									</span>
									<span className="truncate text-foreground">{revision.title || revision.description}</span>
									<span className="admin-meta truncate">{formatDateTime(revision.created_at)}</span>
									<span className="admin-meta">{revision.attachments.length} attachment{revision.attachments.length === 1 ? "" : "s"}</span>
								</button>
							);
						})}
					</div>
				) : <AdminEmptyState>No versions.</AdminEmptyState>}
			</div>

			<AttachmentPanel
				attachmentPreviewUrls={attachmentPreviewUrls}
				attachments={selectedRevision?.attachments ?? []}
				onOpenAttachment={onOpenAttachment}
				pendingAttachmentId={pendingAttachmentId}
			/>
		</aside>
	);
}

function AttachmentPanel({
	attachmentPreviewUrls,
	attachments,
	onOpenAttachment,
	pendingAttachmentId,
}: {
	attachmentPreviewUrls: Record<string, string>;
	attachments: AdminProductChangeRequestAttachment[];
	onOpenAttachment: (attachment: AdminProductChangeRequestAttachment) => Promise<void>;
	pendingAttachmentId: string | null;
}) {
	const [previewAttachment, setPreviewAttachment] = useState<{ attachment: AdminProductChangeRequestAttachment; url: string } | null>(null);

	return (
		<div className="grid gap-2">
			<div className="flex items-center justify-between gap-2">
				<p className="admin-label">Attachments</p>
				<span className={adminBadgeClass({ tone: "muted", size: "compact" })}>{attachments.length}</span>
			</div>
			{attachments.length === 0 ? (
				<div className="rounded-md border border-dashed border-border bg-card p-4 text-center">
					<ImageIcon className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
					<p className="admin-meta mt-2">No files on this version.</p>
				</div>
			) : null}
			{attachments.map((attachment) => {
				const previewUrl = attachmentPreviewUrls[attachment.id];
				return (
					<div className="grid min-w-0 gap-2 rounded-md border border-border bg-card p-2" key={attachment.id}>
						{previewUrl ? (
							<button
								type="button"
								className="group grid min-w-0 gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
								onClick={() => setPreviewAttachment({ attachment, url: previewUrl })}
								disabled={pendingAttachmentId === attachment.id}
							>
								<span className="relative block overflow-hidden rounded-md border border-border bg-background">
									<img
										className="h-40 w-full object-contain transition group-hover:scale-[1.01]"
										src={previewUrl}
										alt={attachment.file_name}
										loading="lazy"
									/>
									<span className="absolute inset-x-2 bottom-2 inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-card/95 px-3 text-xs font-semibold text-foreground opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100">
										<Eye className="size-3.5" aria-hidden="true" />
										Preview
									</span>
								</span>
								<span className="truncate text-xs font-medium text-muted-foreground group-hover:text-foreground">{attachment.file_name}</span>
							</button>
						) : (
							<p className="truncate text-sm font-medium text-foreground">{attachment.file_name}</p>
						)}
						<button
							type="button"
							className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => void onOpenAttachment(attachment)}
							disabled={pendingAttachmentId === attachment.id || attachment.status !== "uploaded"}
						>
							<Download className="size-4 shrink-0" aria-hidden="true" />
							Download
						</button>
					</div>
				);
			})}
			<AttachmentPreviewDialog preview={previewAttachment} onClose={() => setPreviewAttachment(null)} onDownload={onOpenAttachment} pendingAttachmentId={pendingAttachmentId} />
		</div>
	);
}

function AttachmentPreviewDialog({
	onClose,
	onDownload,
	pendingAttachmentId,
	preview,
}: {
	onClose: () => void;
	onDownload: (attachment: AdminProductChangeRequestAttachment) => Promise<void>;
	pendingAttachmentId: string | null;
	preview: { attachment: AdminProductChangeRequestAttachment; url: string } | null;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		if (preview && !dialog.open) {
			dialog.showModal();
			return;
		}

		if (!preview && dialog.open) {
			dialog.close();
		}
	}, [preview]);

	return (
		<dialog
			ref={dialogRef}
			className="m-auto w-[calc(100vw-2rem)] max-w-5xl overflow-hidden rounded-md border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-background/70"
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			onClose={onClose}
		>
			{preview ? (
				<div className="grid max-h-[calc(100vh-2rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]">
					<div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
						<div className="min-w-0">
							<p className="admin-label">Attachment preview</p>
							<h3 className="truncate text-sm font-semibold text-foreground" title={preview.attachment.file_name}>{preview.attachment.file_name}</h3>
						</div>
						<button
							type="button"
							className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-primary hover:text-foreground"
							onClick={onClose}
							aria-label="Close preview"
						>
							<X className="size-4" aria-hidden="true" />
						</button>
					</div>
					<div className="min-h-0 overflow-auto bg-background p-4">
						<img
							className="mx-auto max-h-[70vh] w-auto max-w-full rounded-md border border-border bg-card object-contain"
							src={preview.url}
							alt={preview.attachment.file_name}
						/>
					</div>
					<div className="flex min-w-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
						<button
							type="button"
							className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-foreground"
							onClick={onClose}
						>
							Close
						</button>
						<button
							type="button"
							className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => void onDownload(preview.attachment)}
							disabled={pendingAttachmentId === preview.attachment.id || preview.attachment.status !== "uploaded"}
						>
							<Download className="size-4" aria-hidden="true" />
							Download
						</button>
					</div>
				</div>
			) : null}
		</dialog>
	);
}

function RequestMeta({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-md border border-border bg-background px-3 py-2">
			<p className="admin-label truncate">{label}</p>
			<p className="mt-1 truncate text-sm font-medium text-foreground" title={value}>{value}</p>
		</div>
	);
}

function getRequestRevisions(request: AdminProductChangeRequest): AdminProductChangeRequestRevision[] {
	return request.revisions.length > 0 ? request.revisions : [request];
}

function countRequestAttachments(request: AdminProductChangeRequest): number {
	return getRequestRevisions(request).reduce((total, revision) => total + revision.attachments.length, 0);
}

function matchesFilters(
	request: AdminProductChangeRequest,
	{ query, statusFilter, typeFilter }: { query: string; statusFilter: RequestStatusFilter; typeFilter: RequestTypeFilter },
) {
	if (statusFilter !== "all" && request.status !== statusFilter) return false;
	if (typeFilter !== "all" && request.type !== typeFilter) return false;

	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) return true;
	const context = formatRequestContext(request.context) ?? "";
	return [
		request.id,
		request.title ?? "",
		request.description,
		context,
		request.product?.product_key ?? "",
		request.product?.name ?? "",
	].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function formatRequestType(type: AdminProductChangeRequest["type"]) {
	return type === "issue" ? "Issue" : "Feature request";
}

function formatStatus(status: AdminProductChangeRequestStatus) {
	if (status === "in_progress") return "In progress";
	if (status === "done") return "Done";
	if (status === "closed") return "Closed";
	return "Open";
}

function isImageAttachment(attachment: AdminProductChangeRequestAttachment) {
	if (attachment.content_type?.startsWith("image/")) return true;
	return /\.(png|jpe?g|webp|gif|heic|avif)$/i.test(attachment.file_name);
}

function formatRequestContext(context: Record<string, unknown>) {
	const label = typeof context.label === "string" ? context.label : null;
	const view = typeof context.view === "string" ? context.view : null;
	const path = typeof context.path === "string" ? context.path : null;
	if (label && path) return `${label} (${path})`;
	if (view && path) return `${view} (${path})`;
	return label ?? view ?? path;
}

function statusTone(status: AdminProductChangeRequestStatus) {
	if (status === "done") return "active";
	if (status === "closed") return "muted";
	return "neutral";
}

function pmStatusTone(status: AdminProductChangeRequestPmLink["provider_status"]) {
	if (status === "done") return "active";
	if (status === "blocked" || status === "unknown") return "muted";
	return "neutral";
}

function formatPmStatus(status: AdminProductChangeRequestPmLink["provider_status"]) {
	if (status === "in_progress") return "In progress";
	if (status === "blocked") return "Blocked";
	if (status === "done") return "Done";
	if (status === "unknown") return "Unknown";
	return "To do";
}

function formatAttachmentSync(link: AdminProductChangeRequestPmLink) {
	if (link.attachment_sync_status === "not_started") return "No attachments";
	if (link.attachment_sync_status === "partial") return link.attachment_sync_error ?? "Partial";
	if (link.attachment_sync_status === "failed") return link.attachment_sync_error ?? "Failed";
	return "Complete";
}

function replacePmLink(links: AdminProductChangeRequestPmLink[], next: AdminProductChangeRequestPmLink) {
	const existingIndex = links.findIndex((link) => link.id === next.id || link.request_thread_id === next.request_thread_id);
	if (existingIndex === -1) return [next, ...links];
	return links.map((link, index) => index === existingIndex ? next : link);
}

function removePmLink(links: AdminProductChangeRequestPmLink[], pmLinkId: string) {
	return links.filter((link) => link.id !== pmLinkId);
}

function formatDateTime(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}
