import { useCallback, useEffect, useState } from "react";
import type { AdminPmBoardSnapshotRow, AdminPmConnectionTestResult, AdminPmIntegrationConfig, AdminPmIntegrationConfigInput, ClassKitClient } from "@class-kit/react";
import { Link2, Plus, RefreshCw, Save, Settings2, Trash2 } from "lucide-react";
import { adminBadgeClass } from "./admin-badge";
import { AdminPanelMessage } from "./admin-feedback";

type TrelloConfigForm = AdminPmIntegrationConfigInput;

type GlobalIntegrationsPanelProps = {
	client: ClassKitClient;
	productKey?: string | null;
};

export function GlobalIntegrationsPanel({ client, productKey }: GlobalIntegrationsPanelProps) {
	const [config, setConfig] = useState<AdminPmIntegrationConfig | null>(null);
	const [form, setForm] = useState<TrelloConfigForm>(emptyTrelloConfigForm());
	const [boardSnapshot, setBoardSnapshot] = useState<AdminPmBoardSnapshotRow | null>(null);
	const [pendingAction, setPendingAction] = useState<"load" | "save" | "test" | "sync" | "sync-board" | null>("load");
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const loadConfig = useCallback(async () => {
		setPendingAction("load");
		setError(null);
		try {
			const data = await client.admin.pmIntegrations.getConfig();
			setConfig(data.config);
			setForm(configToForm(data.config, data.label_mappings));
			if (data.config) {
				const snapshot = await client.admin.pmIntegrations.getBoardSnapshot({ boardId: data.config.board_id });
				setBoardSnapshot(snapshot.snapshot);
			} else {
				setBoardSnapshot(null);
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not load Trello integration config.");
		} finally {
			setPendingAction(null);
		}
	}, [client]);

	useEffect(() => {
		void loadConfig();
	}, [loadConfig]);

	async function saveConfig() {
		setPendingAction("save");
		setMessage(null);
		setError(null);

		try {
			const data = await client.admin.pmIntegrations.updateConfig(form);
			setConfig(data.config);
			setForm(configToForm(data.config, data.label_mappings));
			setMessage("Trello integration config saved.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not save Trello integration config.");
		} finally {
			setPendingAction(null);
		}
	}

	async function testConnection() {
		setPendingAction("test");
		setMessage(null);
		setError(null);

		try {
			const data = await client.admin.pmIntegrations.testConnection();
			setMessage(formatTrelloTestResult(data.result));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not test Trello connection.");
		} finally {
			setPendingAction(null);
		}
	}

	async function syncBoardData() {
		const boardId = form.boardId.trim();
		if (!boardId) {
			setError("Board ID is required before syncing Trello board data.");
			return;
		}

		setPendingAction("sync-board");
		setMessage(null);
		setError(null);

		try {
			const data = await client.admin.pmIntegrations.syncBoardSnapshot({ boardId });
			setBoardSnapshot(data.snapshot);
			setMessage(`Synced Trello board data for ${data.snapshot.snapshot.name}.`);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not sync Trello board data.");
		} finally {
			setPendingAction(null);
		}
	}

	async function syncLinkedCards() {
		setPendingAction("sync");
		setMessage(null);
		setError(null);

		try {
			const data = await client.admin.pmIntegrations.syncLinkedWorkItems({ productKey: productKey ?? undefined });
			setMessage(data.summary.failed > 0 ? `Synced ${data.summary.synced} Trello card${data.summary.synced === 1 ? "" : "s"}; ${data.summary.failed} failed.` : "Linked Trello cards synced.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not sync linked Trello cards.");
		} finally {
			setPendingAction(null);
		}
	}

	const isBusy = pendingAction !== null;
	const credentialsMissing = error ? isMissingTrelloCredentialsError(error) : false;
	const status = getIntegrationStatus(config, credentialsMissing);
	const activeSnapshot = boardSnapshot?.board_id === form.boardId.trim() ? boardSnapshot : null;

	return (
		<section className="rounded-md border border-border bg-card">
			<div className="flex min-w-0 items-start justify-between gap-4 border-b border-border p-5">
				<div className="min-w-0">
					<p className="admin-label">Integrations</p>
					<h2 className="mt-1 text-xl font-semibold text-foreground">Trello</h2>
					<p className="admin-meta mt-1">Connect ClassKit request handling to a global Trello board.</p>
				</div>
				<span className={adminBadgeClass({ tone: status.tone })}>{status.label}</span>
			</div>

			<div className="grid gap-5 p-5">
				<AdminPanelMessage message={message} error={error} />
				{credentialsMissing ? (
					<div className="rounded-md border border-destructive bg-background px-3 py-2 text-sm text-destructive">
						Set server-side <span className="font-mono">TRELLO_API_KEY</span> and <span className="font-mono">TRELLO_TOKEN</span> in the ClassKit API Supabase environment, then test the connection again.
					</div>
				) : null}

				<div className="grid gap-3 rounded-md border border-border bg-background p-4">
					<div className="flex items-center justify-between gap-3">
						<div>
							<h3 className="admin-panel-title">Connection</h3>
							<p className="admin-meta mt-1">Credentials stay server-side in Supabase secrets.</p>
						</div>
						<label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
							<input
								type="checkbox"
								className="size-4 rounded border-border"
								checked={form.enabled}
								onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
							/>
							Enabled
						</label>
					</div>
					<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
						<TrelloField label="Board ID" value={form.boardId} onChange={(boardId) => setForm({ ...form, boardId })} />
						<button
							type="button"
							className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => void syncBoardData()}
							disabled={isBusy || !form.boardId.trim()}
						>
							<RefreshCw className="size-4" aria-hidden="true" />
							Sync board data
						</button>
					</div>
					{activeSnapshot ? (
						<p className="admin-meta">
							Using {activeSnapshot.snapshot.name} · {activeSnapshot.snapshot.lists.length} lists · {activeSnapshot.snapshot.labels.length} labels · synced {formatDateTime(activeSnapshot.synced_at)}
						</p>
					) : null}
				</div>

				<div className="grid gap-3 rounded-md border border-border bg-background p-4">
					<div>
						<h3 className="admin-panel-title">List mapping</h3>
						<p className="admin-meta mt-1">New cards start in To do. Trello list movement updates ClassKit request status.</p>
					</div>
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
						<TrelloListField label="To do list" lists={activeSnapshot?.snapshot.lists ?? []} value={form.todoListId} onChange={(todoListId) => setForm({ ...form, todoListId })} />
						<TrelloListField label="In progress list" lists={activeSnapshot?.snapshot.lists ?? []} value={form.inProgressListId} onChange={(inProgressListId) => setForm({ ...form, inProgressListId })} />
						<TrelloListField label="Blocked list" lists={activeSnapshot?.snapshot.lists ?? []} value={form.blockedListId} onChange={(blockedListId) => setForm({ ...form, blockedListId })} />
						<TrelloListField label="Done list" lists={activeSnapshot?.snapshot.lists ?? []} value={form.doneListId} onChange={(doneListId) => setForm({ ...form, doneListId })} />
					</div>
				</div>

				<div className="grid gap-3 rounded-md border border-border bg-background p-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<h3 className="admin-panel-title">Label mapping</h3>
							<p className="admin-meta mt-1">Choose synced Trello labels and name them for ClassKit card creation.</p>
						</div>
						<button
							type="button"
							className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-foreground"
							onClick={() => setForm({ ...form, labelMappings: [...(form.labelMappings ?? []), { providerLabelId: "", displayName: "" }] })}
						>
							<Plus className="size-4" aria-hidden="true" />
							Add label
						</button>
					</div>
					{(form.labelMappings ?? []).length === 0 ? (
						<p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">No Trello labels mapped yet.</p>
					) : null}
					<div className="grid gap-2">
						{(form.labelMappings ?? []).map((label, index) => (
							<div className="grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" key={index}>
								<TrelloField
									label="Display name"
									value={label.displayName}
									onChange={(displayName) => setForm({
										...form,
										labelMappings: replaceLabelAt(form.labelMappings ?? [], index, { ...label, displayName }),
									})}
								/>
								<TrelloLabelField
									label="Trello label"
									labels={activeSnapshot?.snapshot.labels ?? []}
									value={label.providerLabelId}
									onChange={(providerLabelId) => {
										const selected = activeSnapshot?.snapshot.labels.find((snapshotLabel) => snapshotLabel.id === providerLabelId);
										setForm({
											...form,
											labelMappings: replaceLabelAt(form.labelMappings ?? [], index, {
												...label,
												providerLabelId,
												displayName: shouldReplaceLabelDisplayName(label, activeSnapshot)
													? (selected?.name || label.displayName)
													: label.displayName,
											}),
										});
									}}
								/>
								<button
									type="button"
									className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground hover:border-destructive hover:text-destructive"
									onClick={() => setForm({ ...form, labelMappings: (form.labelMappings ?? []).filter((_, rowIndex) => rowIndex !== index) })}
								>
									<Trash2 className="size-4" aria-hidden="true" />
									Remove
								</button>
							</div>
						))}
					</div>
				</div>

				<div className="flex items-center justify-between gap-3">
					<div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
						<Settings2 className="size-4" aria-hidden="true" />
						<span>{config?.updated_at ? `Last saved ${formatDateTime(config.updated_at)}` : "Not configured yet"}</span>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => void testConnection()}
							disabled={isBusy || !config}
						>
							<Link2 className="size-4" aria-hidden="true" />
							Test connection
						</button>
						<button
							type="button"
							className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => void syncLinkedCards()}
							disabled={isBusy || !config?.enabled}
						>
							<RefreshCw className="size-4" aria-hidden="true" />
							Sync linked cards
						</button>
						<button
							type="button"
							className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => void saveConfig()}
							disabled={isBusy}
						>
							<Save className="size-4" aria-hidden="true" />
							Save settings
						</button>
					</div>
				</div>
			</div>
		</section>
	);
}

function TrelloField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
	return (
		<label className="grid min-w-0 gap-1">
			<span className="admin-label">{label}</span>
			<input
				className="h-10 min-w-0 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		</label>
	);
}

function TrelloListField({
	label,
	lists,
	onChange,
	value,
}: {
	label: string;
	lists: AdminPmBoardSnapshotRow["snapshot"]["lists"];
	onChange: (value: string) => void;
	value: string;
}) {
	if (lists.length === 0) {
		return <TrelloField label={`${label} ID`} value={value} onChange={onChange} />;
	}

	return (
		<label className="grid min-w-0 gap-1">
			<span className="admin-label">{label}</span>
			<select
				className="h-10 min-w-0 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
				value={value}
				onChange={(event) => onChange(event.target.value)}
			>
				<option value="">Choose a list</option>
				{lists.map((list) => (
					<option value={list.id} key={list.id}>
						{list.name}{list.closed ? " (closed)" : ""}
					</option>
				))}
			</select>
		</label>
	);
}

function TrelloLabelField({
	label,
	labels,
	onChange,
	value,
}: {
	label: string;
	labels: AdminPmBoardSnapshotRow["snapshot"]["labels"];
	onChange: (value: string) => void;
	value: string;
}) {
	if (labels.length === 0) {
		return <TrelloField label={`${label} ID`} value={value} onChange={onChange} />;
	}

	return (
		<label className="grid min-w-0 gap-1">
			<span className="admin-label">{label}</span>
			<select
				className="h-10 min-w-0 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
				value={value}
				onChange={(event) => onChange(event.target.value)}
			>
				<option value="">Choose a label</option>
				{labels.map((trelloLabel) => (
					<option value={trelloLabel.id} key={trelloLabel.id}>
						{formatTrelloLabelOption(trelloLabel)}
					</option>
				))}
			</select>
		</label>
	);
}

function emptyTrelloConfigForm(): TrelloConfigForm {
	return {
		enabled: false,
		boardId: "",
		todoListId: "",
		inProgressListId: "",
		blockedListId: "",
		doneListId: "",
		labelMappings: [],
	};
}

function configToForm(config: AdminPmIntegrationConfig | null, labelMappings: Array<{ provider_label_id: string; display_name: string }> = []): TrelloConfigForm {
	if (!config) return emptyTrelloConfigForm();
	return {
		enabled: config.enabled,
		boardId: config.board_id,
		todoListId: config.todo_list_id,
		inProgressListId: config.in_progress_list_id,
		blockedListId: config.blocked_list_id,
		doneListId: config.done_list_id,
		labelMappings: labelMappings.map((label) => ({
			providerLabelId: label.provider_label_id,
			displayName: label.display_name,
		})),
	};
}

function replaceLabelAt<T>(labels: T[], index: number, label: T) {
	return labels.map((current, currentIndex) => currentIndex === index ? label : current);
}

function shouldReplaceLabelDisplayName(label: NonNullable<TrelloConfigForm["labelMappings"]>[number], snapshot: AdminPmBoardSnapshotRow | null) {
	if (!label.displayName.trim()) return true;
	const currentSnapshotLabel = snapshot?.snapshot.labels.find((trelloLabel) => trelloLabel.id === label.providerLabelId);
	return Boolean(currentSnapshotLabel?.name && currentSnapshotLabel.name === label.displayName);
}

function formatTrelloLabelOption(label: AdminPmBoardSnapshotRow["snapshot"]["labels"][number]) {
	const name = label.name.trim() || "Unnamed label";
	return label.color ? `${name} · ${label.color}` : name;
}

function formatTrelloTestResult(result: AdminPmConnectionTestResult) {
	const missing = Object.values(result.routeValidation).filter((status) => status === "missing").length;
	if (result.ok) return result.boardName ? `Trello connection works for ${result.boardName}.` : "Trello connection works.";
	return result.message ?? `${missing} configured Trello list${missing === 1 ? "" : "s"} could not be found.`;
}

function getIntegrationStatus(config: AdminPmIntegrationConfig | null, credentialsMissing: boolean): { label: string; tone: "active" | "muted" | "neutral" } {
	if (!config?.enabled) return { label: "Disabled", tone: "muted" };
	if (credentialsMissing) return { label: "Needs credentials", tone: "neutral" };
	return { label: "Enabled", tone: "active" };
}

function isMissingTrelloCredentialsError(message: string) {
	return message.toLowerCase().includes("trello credentials");
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
