import { useCallback, useEffect, useMemo, useState } from "react";
import type {
	AdminProductChangeRequest,
	AdminProductChangeRequestAttachment,
	AdminProductChangeRequestStatus,
	AdminProductListItem,
	ClassKitClient,
} from "@class-kit/react";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { adminBadgeClass } from "./admin-badge";
import { AdminEmptyState, AdminPanelMessage } from "./admin-feedback";

type AdminProductChangeRequestRevision = AdminProductChangeRequest["revisions"][number];

type ProductChangeRequestsPanelProps = {
	client: ClassKitClient;
	product: AdminProductListItem;
};

const statuses: AdminProductChangeRequestStatus[] = ["open", "in_progress", "done", "closed"];

export function ProductChangeRequestsPanel({ client, product }: ProductChangeRequestsPanelProps) {
	const [requests, setRequests] = useState<AdminProductChangeRequest[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
	const [pendingAttachmentId, setPendingAttachmentId] = useState<string | null>(null);
	const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<Record<string, string>>({});
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const sortedRequests = useMemo(
		() => [...requests].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)),
		[requests],
	);

	const loadAttachmentPreviews = useCallback(async (requestRows: AdminProductChangeRequest[]) => {
		const imageAttachments = requestRows
			.flatMap((request) => request.revisions.flatMap((revision) => revision.attachments))
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
		<section className="grid gap-4 rounded-md border border-border bg-card p-4">
			<div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div className="min-w-0">
					<p className="admin-label truncate">Product requests</p>
					<h2 className="admin-panel-title">Change requests</h2>
					<p className="admin-meta mt-1">Issues and feature requests opened by this product's managers.</p>
				</div>
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

			<AdminPanelMessage message={message} error={error} />

			{isLoading ? <AdminEmptyState>Loading product change requests.</AdminEmptyState> : null}
			{!isLoading && sortedRequests.length === 0 ? <AdminEmptyState>No product change requests yet.</AdminEmptyState> : null}

			{sortedRequests.length > 0 ? (
				<div className="grid gap-3">
					{sortedRequests.map((request) => (
						<ChangeRequestCard
							attachmentPreviewUrls={attachmentPreviewUrls}
							key={request.id}
							onDelete={deleteRequest}
							onOpenAttachment={openAttachment}
							onUpdateStatus={updateStatus}
							pendingAttachmentId={pendingAttachmentId}
							pendingRequestId={pendingRequestId}
							request={request}
						/>
					))}
				</div>
			) : null}
		</section>
	);
}

function ChangeRequestCard({
	attachmentPreviewUrls,
	onDelete,
	onOpenAttachment,
	onUpdateStatus,
	pendingAttachmentId,
	pendingRequestId,
	request,
}: {
	attachmentPreviewUrls: Record<string, string>;
	onDelete: (request: AdminProductChangeRequest) => Promise<void>;
	onOpenAttachment: (attachment: AdminProductChangeRequestAttachment) => Promise<void>;
	onUpdateStatus: (request: AdminProductChangeRequest, status: AdminProductChangeRequestStatus) => Promise<void>;
	pendingAttachmentId: string | null;
	pendingRequestId: string | null;
	request: AdminProductChangeRequest;
}) {
	const [selectedRevisionId, setSelectedRevisionId] = useState(request.id);
	const revisions = request.revisions.length > 0 ? request.revisions : [request];
	const selectedRevision = revisions.find((revision) => revision.id === selectedRevisionId) ?? revisions[revisions.length - 1];
	const hasRevisionRail = revisions.length > 1;

	useEffect(() => {
		setSelectedRevisionId(request.id);
	}, [request.id]);

	return (
		<article className="grid gap-3 rounded-md border border-border bg-background p-3">
			<div className={`grid gap-4 ${hasRevisionRail ? "xl:grid-cols-[minmax(0,1fr)_17rem]" : ""}`}>
				<div className="grid min-w-0 gap-3">
					<div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<RequestHeader request={selectedRevision} latestRequest={request} />
						<label className="grid gap-1 text-sm md:w-44 md:shrink-0">
							<span className="admin-label">Status</span>
							<select
								className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground"
								value={request.status}
								onChange={(event) => void onUpdateStatus(request, event.target.value as AdminProductChangeRequestStatus)}
								disabled={pendingRequestId === request.id}
							>
								{statuses.map((status) => <option value={status} key={status}>{formatStatus(status)}</option>)}
							</select>
						</label>
					</div>

					<div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
						<RequestMeta label="Created" value={formatDateTime(selectedRevision.created_at)} />
						<RequestMeta label="Updated" value={formatDateTime(selectedRevision.updated_at)} />
						<RequestMeta label="Context" value={formatRequestContext(selectedRevision.context) ?? "No context"} />
					</div>

					<AttachmentList
						attachmentPreviewUrls={attachmentPreviewUrls}
						attachments={selectedRevision.attachments}
						onOpenAttachment={onOpenAttachment}
						pendingAttachmentId={pendingAttachmentId}
					/>

					<button
						type="button"
						className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground hover:border-destructive hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60 md:w-44"
						onClick={() => void onDelete(request)}
						disabled={pendingRequestId === request.id}
					>
						<Trash2 className="size-4" aria-hidden="true" />
						Delete
					</button>
				</div>

				{hasRevisionRail ? (
					<RevisionRail
						currentRequestId={request.id}
						revisions={revisions}
						selectedRevisionId={selectedRevision.id}
						onSelectRevision={setSelectedRevisionId}
					/>
				) : null}
			</div>
		</article>
	);
}

function RequestHeader({ latestRequest, request }: { latestRequest: AdminProductChangeRequest; request: AdminProductChangeRequestRevision }) {
	const contextLabel = formatRequestContext(request.context);
	return (
		<div className="min-w-0">
			<div className="flex flex-wrap gap-2">
				<span className={adminBadgeClass({ tone: request.type === "issue" ? "muted" : "active" })}>
					{formatRequestType(request.type)}
				</span>
				<span className={adminBadgeClass({ tone: statusTone(request.status) })}>{formatStatus(request.status)}</span>
				<span className={adminBadgeClass({ tone: request.id === latestRequest.id ? "neutral" : "muted" })}>v{request.version_number}</span>
				{request.id !== latestRequest.id ? <span className={adminBadgeClass({ tone: "muted" })}>Older version</span> : null}
				{contextLabel ? <span className={adminBadgeClass({ tone: "neutral" })}>{contextLabel}</span> : null}
			</div>
			<h3 className="mt-2 truncate text-sm font-semibold text-foreground">{request.title || request.description}</h3>
			<p className="admin-meta mt-1 whitespace-pre-wrap">{request.description}</p>
			<p className="admin-code mt-2 truncate" title={request.id}>{request.id}</p>
		</div>
	);
}

function RevisionRail({
	currentRequestId,
	onSelectRevision,
	revisions,
	selectedRevisionId,
}: {
	currentRequestId: string;
	onSelectRevision: (revisionId: string) => void;
	revisions: AdminProductChangeRequestRevision[];
	selectedRevisionId: string;
}) {
	if (revisions.length <= 1) return null;

	return (
		<aside className="grid content-start gap-2 border-t border-border pt-3 xl:border-l xl:border-t-0 xl:pl-3 xl:pt-0">
			<p className="admin-label">Versions</p>
			<div className="grid gap-2">
				{[...revisions].reverse().map((revision) => {
					const isSelected = revision.id === selectedRevisionId;
					const isCurrent = revision.id === currentRequestId;
					return (
						<button
							type="button"
							className={`grid min-w-0 gap-1 rounded-md border p-3 text-left text-sm transition ${isSelected ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground"}`}
							onClick={() => onSelectRevision(revision.id)}
							key={revision.id}
						>
							<span className="flex items-center justify-between gap-2">
								<span className="font-semibold text-foreground">v{revision.version_number}</span>
								<span className={adminBadgeClass({ tone: isCurrent ? "active" : "muted", size: "compact" })}>{isCurrent ? "Current" : formatStatus(revision.status)}</span>
							</span>
							<span className="truncate">{revision.title || revision.description}</span>
							<span className="admin-meta truncate">{formatDateTime(revision.created_at)}</span>
							<span className="admin-meta">{revision.attachments.length} attachment{revision.attachments.length === 1 ? "" : "s"}</span>
						</button>
					);
				})}
			</div>
		</aside>
	);
}

function AttachmentList({
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
	if (attachments.length === 0) return null;

	return (
		<div className="grid gap-2 border-t border-border pt-3">
			<p className="admin-label">Attachments</p>
			{attachments.some((attachment) => attachmentPreviewUrls[attachment.id]) ? (
				<div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
					{attachments.map((attachment) => {
						const previewUrl = attachmentPreviewUrls[attachment.id];
						if (!previewUrl) return null;
						return (
							<button
								type="button"
								className="group grid min-w-0 gap-2 rounded-md border border-border bg-card p-2 text-left hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
								onClick={() => void onOpenAttachment(attachment)}
								disabled={pendingAttachmentId === attachment.id}
								key={`${attachment.id}:preview`}
							>
								<img
									className="h-44 w-full rounded-md border border-border object-contain"
									src={previewUrl}
									alt={attachment.file_name}
									loading="lazy"
								/>
								<span className="truncate text-xs font-medium text-muted-foreground group-hover:text-foreground">{attachment.file_name}</span>
							</button>
						);
					})}
				</div>
			) : null}
			<div className="flex flex-wrap gap-2">
				{attachments.map((attachment) => (
					<button
						type="button"
						className="inline-flex h-9 max-w-full items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
						onClick={() => void onOpenAttachment(attachment)}
						disabled={pendingAttachmentId === attachment.id || attachment.status !== "uploaded"}
						key={attachment.id}
					>
						<Download className="size-4 shrink-0" aria-hidden="true" />
						<span className="truncate">{attachment.file_name}</span>
					</button>
				))}
			</div>
		</div>
	);
}

function RequestMeta({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-md border border-border bg-card px-3 py-2">
			<p className="admin-label truncate">{label}</p>
			<p className="mt-1 truncate text-foreground" title={value}>{value}</p>
		</div>
	);
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

function formatDateTime(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}
