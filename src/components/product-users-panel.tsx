import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
	AdminProductListItem,
	AdminProductRole,
	AdminProductUser,
	AdminProductUserRoleAssignment,
	BuiltInProductRole,
	ClassKitClient,
	ProductUserStatus,
} from "@class-kit/react";
import { Plus, ShieldCheck, UserCog } from "lucide-react";
import { adminBadgeClass } from "./admin-badge";
import { AdminDialog, AdminEmptyState, AdminPanelMessage } from "./admin-feedback";
import { CopyableId } from "./copyable-id";

type ProductUsersPanelProps = {
	client: ClassKitClient;
	product: AdminProductListItem;
	currentUserId: string | null;
	refreshKey?: number;
};

type RoleGrantByUser = Map<string, AdminProductUserRoleAssignment[]>;
type RowSaveState = {
	isSaving: boolean;
	error: string | null;
};

export function ProductUsersPanel({ client, product, currentUserId, refreshKey = 0 }: ProductUsersPanelProps) {
	const [users, setUsers] = useState<AdminProductUser[]>([]);
	const [roles, setRoles] = useState<AdminProductRole[]>([]);
	const [assignments, setAssignments] = useState<AdminProductUserRoleAssignment[]>([]);
	const [selectedUser, setSelectedUser] = useState<AdminProductUser | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [createdUserId, setCreatedUserId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [rowSaveState, setRowSaveState] = useState<Record<string, RowSaveState>>({});
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

	const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);
	const grantsByUser = useMemo<RoleGrantByUser>(() => {
		const grouped: RoleGrantByUser = new Map();
		for (const assignment of assignments) {
			const current = grouped.get(assignment.user_id) ?? [];
			current.push(assignment);
			grouped.set(assignment.user_id, current);
		}
		return grouped;
	}, [assignments]);

	const loadUserManagement = useCallback(async (options: { showLoading?: boolean } = {}) => {
		if (options.showLoading ?? true) {
			setIsLoading(true);
		}
		setError(null);

		try {
			const [userData, roleData, assignmentData] = await Promise.all([
				client.admin.users.listProductUsers(product.product_key),
				client.admin.productRoles.listRoles(product.product_key),
				client.admin.productRoles.listUserRoles(product.product_key),
			]);
			setUsers(userData.users);
			setRoles(roleData.roles);
			setAssignments(assignmentData.assignments);
			return userData.users;
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not load product users.");
			return [];
		} finally {
			if (options.showLoading ?? true) {
				setIsLoading(false);
			}
		}
	}, [client, product.product_key]);

	useEffect(() => {
		if (!createdUserId) return;
		const row = rowRefs.current.get(createdUserId);
		if (!row) return;
		row.focus();
		row.scrollIntoView({ block: "nearest" });
	}, [createdUserId, users]);

	useEffect(() => {
		let isCurrent = true;

		Promise.all([
			client.admin.users.listProductUsers(product.product_key),
			client.admin.productRoles.listRoles(product.product_key),
			client.admin.productRoles.listUserRoles(product.product_key),
		])
			.then(([userData, roleData, assignmentData]) => {
				if (!isCurrent) return;
				setUsers(userData.users);
				setRoles(roleData.roles);
				setAssignments(assignmentData.assignments);
				setError(null);
			})
			.catch((caught: unknown) => {
				if (!isCurrent) return;
				setError(caught instanceof Error ? caught.message : "Could not load product users.");
			})
			.finally(() => {
				if (!isCurrent) return;
				setIsLoading(false);
			});

		return () => {
			isCurrent = false;
		};
	}, [client, product.product_key, refreshKey]);

	async function updateMembership(user: AdminProductUser, role: BuiltInProductRole) {
		await saveRowChange(user, { role });
	}

	async function updateStatus(user: AdminProductUser, status: ProductUserStatus) {
		await saveRowChange(user, { status });
	}

	async function saveRowChange(user: AdminProductUser, patch: { role?: BuiltInProductRole; status?: ProductUserStatus }) {
		setMessage(null);
		setError(null);

		if (currentUserId === user.user_id) {
			setRowSaveState((current) => ({
				...current,
				[user.user_id]: {
					isSaving: false,
					error: "Use platform admin controls for your own account. Product membership cannot change your platform admin authority.",
				},
			}));
			return;
		}

		setRowSaveState((current) => ({
			...current,
			[user.user_id]: { isSaving: true, error: null },
		}));

		try {
			await client.admin.users.updateProductUser({
				productKey: product.product_key,
				userId: user.user_id,
				role: patch.role,
				status: patch.status,
			});
			setMessage("User membership updated.");
			await loadUserManagement({ showLoading: false });
			setRowSaveState((current) => ({
				...current,
				[user.user_id]: { isSaving: false, error: null },
			}));
		} catch (caught) {
			setRowSaveState((current) => ({
				...current,
				[user.user_id]: {
					isSaving: false,
					error: caught instanceof Error ? caught.message : "Could not update product user.",
				},
			}));
		}
	}

	return (
		<section className="min-w-0 rounded-md border border-border bg-card p-4">
			<div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
				<div className="min-w-0">
					<h2 className="admin-panel-title">User management</h2>
					<p className="admin-meta mt-1 truncate">
						{product.name} <span className="admin-code">{product.product_key}</span>
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 md:justify-end">
					<button type="button" className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60" onClick={() => void loadUserManagement()} disabled={isLoading}>
						Refresh
					</button>
					<button type="button" className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" onClick={() => setIsCreateOpen(true)}>
						<Plus className="size-4" aria-hidden="true" />
						Create user
					</button>
				</div>
			</div>

			<div className="mt-4">
				{isLoading ? <AdminEmptyState>Loading users and role grants.</AdminEmptyState> : null}
				<AdminPanelMessage message={message} error={error} />
			</div>

			{createdUserId ? (
				<div className="admin-meta mt-3 flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border bg-background p-3">
					<span className="font-medium">Created user ID</span>
					<CopyableId value={createdUserId} label="created user ID" />
				</div>
			) : null}

			{!isLoading && !error && users.length === 0 ? (
				<AdminEmptyState className="mt-4">No product users yet. Create a user to start managing access for this product.</AdminEmptyState>
			) : null}

			{!isLoading && !error && users.length > 0 ? (
				<div className="mt-4 max-w-full overflow-x-auto">
					<table className="w-full table-fixed border-collapse text-sm">
						<thead>
							<tr className="border-b border-border text-left">
								<th className="w-[30%] py-2 pr-2 font-semibold lg:w-[24%] lg:pr-3">User</th>
								<th className="w-[7rem] py-2 pr-2 font-semibold lg:pr-3">Membership</th>
								<th className="w-[6.25rem] py-2 pr-2 font-semibold lg:pr-3">Status</th>
								<th className="w-[18%] py-2 pr-2 font-semibold lg:w-[22%] lg:pr-3">Role grants</th>
								<th className="w-[5.25rem] py-2 pr-2 font-semibold lg:w-32 lg:pr-3">User ID</th>
								<th className="w-11 py-2 text-right font-semibold xl:w-40">Actions</th>
							</tr>
						</thead>
						<tbody>
							{users.map((user) => {
								const isCurrentUser = currentUserId === user.user_id;
								const isCreatedUser = createdUserId === user.user_id;
								const state = rowSaveState[user.user_id] ?? { isSaving: false, error: null };
								const grants = grantsByUser.get(user.user_id) ?? [];
								return (
									<tr
										key={user.user_id}
										ref={(node) => {
											if (node) {
												rowRefs.current.set(user.user_id, node);
											} else {
												rowRefs.current.delete(user.user_id);
											}
										}}
										tabIndex={isCreatedUser ? -1 : undefined}
										className={`border-b border-border align-top outline-none last:border-0 ${isCreatedUser ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}
									>
										<td className="min-w-0 py-3 pr-2 lg:pr-3">
											<p className="truncate font-medium">{user.display_name || user.email || "Unnamed user"}</p>
											{user.email ? <p className="admin-code mt-1 truncate" title={user.email}>{user.email}</p> : null}
											<div className="mt-2 flex flex-wrap gap-1.5">
												{user.is_platform_admin ? (
													<span className={adminBadgeClass({ tone: "active" })}>
														<ShieldCheck className="size-3" aria-hidden="true" />
														Platform admin{isCurrentUser ? " (you)" : ""}
													</span>
												) : null}
											</div>
										</td>
										<td className="py-3 pr-2 lg:pr-3">
											<select
												className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
												value={user.role}
												onChange={(event) => void updateMembership(user, event.target.value as BuiltInProductRole)}
												disabled={state.isSaving || isCurrentUser}
											>
												<option value="user">user</option>
												<option value="manager">manager</option>
											</select>
											{isCurrentUser ? <p className="admin-meta mt-1 text-xs">Self changes disabled</p> : null}
										</td>
										<td className="py-3 pr-2 lg:pr-3">
											<select
												className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
												value={user.status}
												onChange={(event) => void updateStatus(user, event.target.value as ProductUserStatus)}
												disabled={state.isSaving || isCurrentUser}
											>
												<option value="active">active</option>
												<option value="inactive">inactive</option>
											</select>
											{state.isSaving ? <p className="admin-meta mt-1 text-xs">Saving.</p> : null}
										</td>
										<td className="min-w-0 py-3 pr-2 lg:pr-3">
											<RoleGrantSummary grants={grants} roleById={roleById} compact />
										</td>
										<td className="min-w-0 py-3 pr-2 lg:pr-3">
											<CopyableId value={user.user_id} label="user ID" prefixLength={4} suffixLength={4} />
										</td>
										<td className="py-3 text-right">
											<div className="flex justify-end gap-2">
												<button
													type="button"
													className="inline-flex h-9 w-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border text-sm font-medium hover:border-primary disabled:opacity-60 xl:w-auto xl:px-3"
													onClick={() => setSelectedUser(user)}
													disabled={state.isSaving || isCurrentUser}
													aria-label="Manage roles"
													title="Manage roles"
												>
													<UserCog className="size-4" aria-hidden="true" />
													<span className="hidden xl:inline">Manage roles</span>
												</button>
											</div>
											{state.error ? <p className="mt-2 text-left text-xs font-medium text-destructive">{state.error}</p> : null}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : null}

			{isCreateOpen ? (
				<CreateUserDialog
					client={client}
					product={product}
					onClose={() => setIsCreateOpen(false)}
					onCreated={async (createdUserId, assignedToProduct) => {
						setCreatedUserId(createdUserId);
						setMessage(assignedToProduct ? "Created and assigned user." : "Created user without product membership.");
						await loadUserManagement();
					}}
				/>
			) : null}

			{selectedUser ? (
				<RoleGrantDialog
					client={client}
					product={product}
					user={selectedUser}
					roles={roles}
					grants={grantsByUser.get(selectedUser.user_id) ?? []}
					roleById={roleById}
					onClose={() => setSelectedUser(null)}
					onChanged={async (action) => {
						setMessage(action === "grant" ? "Product role granted." : "Product role revoked.");
						await loadUserManagement();
					}}
				/>
			) : null}
		</section>
	);
}

function RoleGrantSummary({ grants, roleById, compact = false }: { grants: AdminProductUserRoleAssignment[]; roleById: Map<string, AdminProductRole>; compact?: boolean }) {
	const activeGrants = grants.filter((grant) => grant.status === "active");
	if (activeGrants.length === 0) return <span className="admin-meta">{compact ? "No grants" : "No active role grants"}</span>;

	return (
		<div className="flex min-w-0 flex-wrap gap-1.5">
			{activeGrants.map((grant) => {
				const role = roleById.get(grant.role_id);
				const permissionCount = role?.permissions.length ?? 0;
				return (
					<span key={`${grant.user_id}-${grant.role_id}`} className={adminBadgeClass({ tone: "neutral", size: compact ? "compact" : "default", className: "truncate" })}>
						<span className="truncate">{grant.role_key ?? role?.key ?? "role"}</span> <span className="text-muted-foreground">({permissionCount} perms)</span>
					</span>
				);
			})}
		</div>
	);
}

function CreateUserDialog({
	client,
	product,
	onClose,
	onCreated,
}: {
	client: ClassKitClient;
	product: AdminProductListItem;
	onClose: () => void;
	onCreated: (createdUserId: string, assignedToProduct: boolean) => Promise<void>;
}) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [role, setRole] = useState<BuiltInProductRole>("user");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			const created = await client.admin.users.create({
				productKey: product.product_key,
				email,
				password: password || undefined,
				displayName: displayName || undefined,
				role,
			});
			await onCreated(created.user.id, true);
			onClose();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not create user.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<AdminDialog title="Create user" onClose={onClose}>
			<form className="grid gap-3" onSubmit={handleSubmit}>
				<TextField label="Email" value={email} onChange={setEmail} type="email" required autoFocus disabled={isSubmitting} />
				<TextField label="Password" value={password} onChange={setPassword} type="password" disabled={isSubmitting} />
				<TextField label="Display name" value={displayName} onChange={setDisplayName} disabled={isSubmitting} />
				<label className="grid gap-1 text-sm">
					<span className="font-medium">Initial product membership</span>
					<select className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" value={role} onChange={(event) => setRole(event.target.value as BuiltInProductRole)} disabled={isSubmitting}>
						<option value="user">user</option>
						<option value="manager">manager</option>
					</select>
				</label>
				<AdminPanelMessage message={null} error={error} />
				<div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
					<button type="button" className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-border px-4 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60" onClick={onClose} disabled={isSubmitting}>
						Cancel
					</button>
					<button type="submit" className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={isSubmitting}>
						{isSubmitting ? "Creating user" : "Create and assign"}
					</button>
				</div>
			</form>
		</AdminDialog>
	);
}

function RoleGrantDialog({
	client,
	product,
	user,
	roles,
	grants,
	roleById,
	onClose,
	onChanged,
}: {
	client: ClassKitClient;
	product: AdminProductListItem;
	user: AdminProductUser;
	roles: AdminProductRole[];
	grants: AdminProductUserRoleAssignment[];
	roleById: Map<string, AdminProductRole>;
	onClose: () => void;
	onChanged: (action: "grant" | "revoke") => Promise<void>;
}) {
	const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
	const [roleErrors, setRoleErrors] = useState<Record<string, string>>({});
	const grantsByRoleId = useMemo(() => new Map(grants.map((grant) => [grant.role_id, grant])), [grants]);

	async function toggleRole(role: AdminProductRole, isGranted: boolean) {
		setPendingRoleId(role.id);
		setRoleErrors((current) => ({ ...current, [role.id]: "" }));

		try {
			if (isGranted) {
				await client.admin.productRoles.revokeUserRole({
					productKey: product.product_key,
					userId: user.user_id,
					roleId: role.id,
				});
				await onChanged("revoke");
			} else {
				await client.admin.productRoles.assignUserRole({
					productKey: product.product_key,
					userId: user.user_id,
					roleId: role.id,
				});
				await onChanged("grant");
			}
		} catch (caught) {
			setRoleErrors((current) => ({
				...current,
				[role.id]: caught instanceof Error ? caught.message : isGranted ? "Could not revoke product role." : "Could not grant product role.",
			}));
		} finally {
			setPendingRoleId(null);
		}
	}

	return (
		<AdminDialog title="Manage roles" onClose={onClose}>
			<div className="grid gap-4">
				<div className="min-w-0 rounded-md border border-border p-3 text-sm">
					<p className="font-medium">{user.display_name || user.email || "Unnamed user"}</p>
					{user.email ? <p className="admin-code mt-1 truncate" title={user.email}>{user.email}</p> : null}
					<div className="mt-2 max-w-full">
						<CopyableId value={user.user_id} label="user ID" />
					</div>
				</div>

				<div>
					<p className="text-sm font-medium">Current role grants</p>
					<div className="mt-2">
						<RoleGrantSummary grants={grants} roleById={roleById} />
					</div>
				</div>

				<div className="grid gap-2">
					{roles.length === 0 ? <AdminEmptyState>No product roles are configured yet. Create a product role before granting one to this user.</AdminEmptyState> : null}
					{roles.map((role) => {
						const grant = grantsByRoleId.get(role.id);
						const isGranted = grant?.status === "active";
						const isPending = pendingRoleId === role.id;
						const roleError = roleErrors[role.id];
						return (
							<label key={role.id} className="grid gap-2 rounded-md border border-border p-3 text-sm">
								<span className="flex items-start gap-3">
									<input
										type="checkbox"
										className="mt-1 size-4 accent-primary"
										checked={isGranted}
										disabled={Boolean(pendingRoleId)}
										onChange={() => void toggleRole(role, isGranted)}
									/>
									<span className="min-w-0 flex-1">
										<span className="flex flex-wrap items-center gap-1.5">
											<span className="font-medium">{role.name}</span>
											<span className="admin-code truncate" title={role.key}>{role.key}</span>
											<span className={adminBadgeClass({ tone: "neutral", size: "compact" })}>{role.is_builtin ? "Built-in" : "Custom"}</span>
											<span className={adminBadgeClass({ tone: role.is_protected ? "muted" : "active", size: "compact" })}>
												{role.is_protected ? "Protected" : "Editable"}
											</span>
										</span>
										<span className="admin-meta mt-1 block">
											{isPending ? "Updating role grant." : isGranted ? "Granted to this user." : grant ? "Revoked from this user." : "Not granted to this user."} {role.permissions.length} permissions.
										</span>
									</span>
								</span>
								{roleError ? <span className="text-xs font-medium text-destructive">{roleError}</span> : null}
							</label>
						);
					})}
					<div className="flex justify-end">
						<button type="button" className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-border px-4 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60" onClick={onClose} disabled={Boolean(pendingRoleId)}>
							Done
						</button>
					</div>
				</div>
			</div>
		</AdminDialog>
	);
}

function TextField({
	label,
	value,
	onChange,
	type = "text",
	required,
	autoFocus,
	disabled,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	type?: string;
	required?: boolean;
	autoFocus?: boolean;
	disabled?: boolean;
}) {
	return (
		<label className="grid gap-1 text-sm">
			<span className="font-medium">{label}</span>
			<input className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} autoFocus={autoFocus} disabled={disabled} />
		</label>
	);
}
