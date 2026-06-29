import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AdminPermission, AdminProductListItem, AdminProductRole, ClassKitClient } from "@class-kit/react";
import { Plus } from "lucide-react";
import { adminBadgeClass } from "./admin-badge";
import { AdminDialog, AdminEmptyState, AdminPanelMessage } from "./admin-feedback";
import { CopyableId } from "./copyable-id";

type ProductRolePanelProps = {
	client: ClassKitClient;
	product: AdminProductListItem;
};

type RoleDraft = {
	name: string;
	level: number;
	permissions: string[];
};

export function ProductRolePanel({ client, product }: ProductRolePanelProps) {
	const [roles, setRoles] = useState<AdminProductRole[]>([]);
	const [permissions, setPermissions] = useState<AdminPermission[]>([]);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
	const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const permissionsByKey = useMemo(() => new Map(permissions.map((permission) => [permission.key, permission])), [permissions]);
	const groupedPermissions = useMemo(() => groupPermissions(permissions), [permissions]);
	const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null;
	const selectedGroup = groupedPermissions.find((group) => group.key === selectedGroupKey) ?? groupedPermissions[0] ?? null;

	const loadRoles = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const [roleData, permissionData] = await Promise.all([
				client.admin.productRoles.listRoles(product.product_key),
				client.admin.productRoles.listPermissions(product.product_key),
			]);
			setRoles(roleData.roles);
			setPermissions(permissionData.permissions);
			setSelectedRoleId((current) => current && roleData.roles.some((role) => role.id === current) ? current : roleData.roles[0]?.id ?? null);
			setSelectedGroupKey((current) => current && permissionData.permissions.some((permission) => (permission.groupKey ?? "other") === current) ? current : permissionData.permissions[0]?.groupKey ?? "other");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not load product roles.");
		} finally {
			setIsLoading(false);
		}
	}, [client, product.product_key]);

	useEffect(() => {
		let isCurrent = true;

		Promise.all([
			client.admin.productRoles.listRoles(product.product_key),
			client.admin.productRoles.listPermissions(product.product_key),
		])
			.then(([roleData, permissionData]) => {
				if (!isCurrent) return;
				setRoles(roleData.roles);
				setPermissions(permissionData.permissions);
				setSelectedRoleId((current) => current && roleData.roles.some((role) => role.id === current) ? current : roleData.roles[0]?.id ?? null);
				setSelectedGroupKey((current) => current && permissionData.permissions.some((permission) => (permission.groupKey ?? "other") === current) ? current : permissionData.permissions[0]?.groupKey ?? "other");
				setError(null);
			})
			.catch((caught: unknown) => {
				if (!isCurrent) return;
				setError(caught instanceof Error ? caught.message : "Could not load product roles.");
			})
			.finally(() => {
				if (!isCurrent) return;
				setIsLoading(false);
			});

		return () => {
			isCurrent = false;
		};
	}, [client, product.product_key]);

	async function handleCreateRole(input: { key: string; name: string; level: number }) {
		setIsSubmitting(true);
		setMessage(null);
		setError(null);

		try {
			await client.admin.productRoles.createRole({
				productKey: product.product_key,
				key: input.key,
				name: input.name,
				level: input.level,
			});
			setMessage("Product role created.");
			await loadRoles();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not create product role.");
			throw caught;
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleUpdateRole(role: AdminProductRole, draft: RoleDraft) {
		setIsSubmitting(true);
		setMessage(null);
		setError(null);

		try {
			await client.admin.productRoles.updateRole({
				productKey: product.product_key,
				roleId: role.id,
				name: draft.name,
				level: draft.level,
			});

			const nextPermissions = new Set(draft.permissions);
			const currentPermissions = new Set(role.permissions);
			const grant = role.key === "manager"
				? (permissionKey: string) => client.admin.productRoles.grantManagerPermission({ productKey: product.product_key, permissionKey })
				: (permissionKey: string) => client.admin.productRoles.grantPermission({ productKey: product.product_key, roleId: role.id, permissionKey });
			const revoke = role.key === "manager"
				? (permissionKey: string) => client.admin.productRoles.revokeManagerPermission({ productKey: product.product_key, permissionKey })
				: (permissionKey: string) => client.admin.productRoles.revokePermission({ productKey: product.product_key, roleId: role.id, permissionKey });

			for (const permission of nextPermissions) {
				if (!currentPermissions.has(permission)) await grant(permission);
			}
			for (const permission of currentPermissions) {
				if (!nextPermissions.has(permission)) await revoke(permission);
			}

			setMessage(`Updated ${role.key}.`);
			await loadRoles();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not update product role.");
			throw caught;
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<section className="rounded-md border border-border bg-card p-4">
			<div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<h2 className="admin-panel-title">Roles & permissions</h2>
					<p className="admin-meta mt-1 truncate">
						{product.name} <span className="admin-code">{product.product_key}</span>
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 lg:justify-end">
					<button type="button" className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60" onClick={() => void loadRoles()} disabled={isLoading}>
						Refresh
					</button>
					<button type="button" className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" onClick={() => setIsCreateOpen(true)} disabled={isSubmitting}>
						<Plus className="size-4" aria-hidden="true" />
						Create role
					</button>
				</div>
			</div>

			<div className="mt-4">
				{isLoading ? <AdminEmptyState>Loading roles and permissions.</AdminEmptyState> : null}
				<AdminPanelMessage message={message} error={error} />
			</div>

			{!isLoading && !error && roles.length === 0 ? (
				<AdminEmptyState className="mt-4">No product roles yet. Create a custom role to start granting product-scoped permissions.</AdminEmptyState>
			) : null}

			{!isLoading && !error && roles.length > 0 ? (
				<div className="admin-role-workspace mt-4">
					<div className="admin-role-rail">
						<div className="admin-role-rail-head">
							<div>
								<h3>Roles</h3>
								<p>{roles.length} configured</p>
							</div>
						</div>
						<div className="admin-role-list">
							{roles.map((role) => {
								const isSelected = selectedRole?.id === role.id;
								return (
									<button
										type="button"
										key={role.id}
										onClick={() => setSelectedRoleId(role.id)}
										className={`admin-role-list-item ${isSelected ? "is-active" : ""}`}
									>
										<span className="flex min-w-0 items-start justify-between gap-2">
											<span className="min-w-0">
												<strong className="block truncate">{role.name}</strong>
												<span className="admin-code block truncate">{role.key} · Level {role.level}</span>
											</span>
											<span className={adminBadgeClass({ tone: role.is_builtin ? "neutral" : "active" })}>{role.is_builtin ? "Built-in" : "Custom"}</span>
										</span>
										<span className="admin-meta">{role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}</span>
									</button>
								);
							})}
						</div>
					</div>

					{selectedRole ? (
						<RoleEditor
							key={selectedRole.id}
							role={selectedRole}
							groupedPermissions={groupedPermissions}
							selectedGroup={selectedGroup}
							selectedGroupKey={selectedGroup?.key ?? null}
							onSelectGroup={setSelectedGroupKey}
							permissionsByKey={permissionsByKey}
							isSubmitting={isSubmitting}
							onSaved={(draft) => handleUpdateRole(selectedRole, draft)}
						/>
					) : null}
				</div>
			) : null}

			{isCreateOpen ? (
				<CreateRoleDialog
					isSubmitting={isSubmitting}
					onClose={() => setIsCreateOpen(false)}
					onCreated={async (input) => {
						await handleCreateRole(input);
						setIsCreateOpen(false);
					}}
				/>
			) : null}

		</section>
	);
}

function RoleEditor({
	role,
	groupedPermissions,
	selectedGroup,
	selectedGroupKey,
	onSelectGroup,
	permissionsByKey,
	isSubmitting,
	onSaved,
}: {
	role: AdminProductRole;
	groupedPermissions: Array<{ key: string; label: string; permissions: AdminPermission[] }>;
	selectedGroup: { key: string; label: string; permissions: AdminPermission[] } | null;
	selectedGroupKey: string | null;
	onSelectGroup: (groupKey: string) => void;
	permissionsByKey: Map<string, AdminPermission>;
	isSubmitting: boolean;
	onSaved: (draft: RoleDraft) => Promise<void>;
}) {
	const [name, setName] = useState(role.name);
	const [level, setLevel] = useState(role.level);
	const [selectedPermissions, setSelectedPermissions] = useState(() => new Set(role.permissions));
	const [error, setError] = useState<string | null>(null);
	const selectedGroupGrantCount = selectedGroup?.permissions.filter((permission) => selectedPermissions.has(permission.key)).length ?? 0;

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		try {
			await onSaved({ name, level, permissions: [...selectedPermissions].sort() });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not update product role.");
		}
	}

	return (
		<form className="admin-role-editor" onSubmit={handleSubmit}>
			<div className="admin-role-head">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="admin-panel-heading truncate">{role.name}</h3>
						<span className={adminBadgeClass({ tone: role.is_builtin ? "neutral" : "active" })}>{role.is_builtin ? "Built-in" : "Custom"}</span>
						<span className={adminBadgeClass({ tone: "active" })}>Admin editable</span>
					</div>
					<p className="admin-meta mt-1">Changes update the default bundle for current and future users with this role.</p>
					<CopyableId value={role.id} label={`${role.key} role ID`} className="mt-2" />
				</div>
				<button type="submit" className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={isSubmitting}>
					{isSubmitting ? "Saving" : "Save role"}
				</button>
			</div>

			<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem]">
				<TextField label="Name" value={name} onChange={setName} required disabled={isSubmitting} />
				<NumberField label="Level" value={level} onChange={setLevel} disabled={isSubmitting} />
			</div>

			<div className="admin-role-detail-grid">
				<div className="admin-permission-category-list">
					{groupedPermissions.map((group) => {
						const grantCount = group.permissions.filter((permission) => selectedPermissions.has(permission.key)).length;
						const isSelected = group.key === selectedGroupKey;
						return (
							<button
								type="button"
								key={group.key}
								className={`admin-permission-category ${isSelected ? "is-active" : ""}`}
								onClick={() => onSelectGroup(group.key)}
							>
								<span>
									<strong>{group.label}</strong>
									<small>{grantCount}/{group.permissions.length} granted</small>
								</span>
								<em>{group.permissions.length}</em>
							</button>
						);
					})}
				</div>

				{selectedGroup ? (
					<fieldset className="admin-permission-editor">
						<div className="admin-permission-editor-head">
							<div>
								<legend>{selectedGroup.label}</legend>
								<p>{selectedGroupGrantCount}/{selectedGroup.permissions.length} granted</p>
							</div>
							<p className="admin-meta text-right">Save applies this role bundle to current and future users.</p>
						</div>
						<div className="admin-permission-option-list">
							{selectedGroup.permissions.map((permission) => {
								const checked = selectedPermissions.has(permission.key);
								return (
									<label className="admin-permission-option" key={permission.key}>
										<input
											type="checkbox"
											checked={checked}
											disabled={isSubmitting}
											onChange={(event) => {
												setSelectedPermissions((current) => {
													const next = new Set(current);
													if (event.target.checked) next.add(permission.key);
													else next.delete(permission.key);
													return next;
												});
											}}
										/>
										<span className="min-w-0">
											<span>{permissionsByKey.get(permission.key)?.label ?? permission.label}</span>
											{permission.description ? <small>{permission.description}</small> : null}
										</span>
									</label>
								);
							})}
						</div>
					</fieldset>
				) : (
					<AdminEmptyState>No permissions are configured for this product.</AdminEmptyState>
				)}
			</div>

			<AdminPanelMessage message={null} error={error} />
		</form>
	);
}

function CreateRoleDialog({
	isSubmitting,
	onClose,
	onCreated,
}: {
	isSubmitting: boolean;
	onClose: () => void;
	onCreated: (input: { key: string; name: string; level: number }) => Promise<void>;
}) {
	const [key, setKey] = useState("");
	const [name, setName] = useState("");
	const [level, setLevel] = useState(10);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		try {
			await onCreated({ key, name, level });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not create product role.");
		}
	}

	return (
		<AdminDialog title="Create custom role" onClose={onClose}>
			<form className="grid gap-3" onSubmit={handleSubmit}>
				<TextField label="Role key" value={key} onChange={setKey} required disabled={isSubmitting} />
				<TextField label="Name" value={name} onChange={setName} required disabled={isSubmitting} />
				<NumberField label="Level" value={level} onChange={setLevel} disabled={isSubmitting} />
				<AdminPanelMessage message={null} error={error} />
				<div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
					<button type="button" className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-border px-4 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60" onClick={onClose} disabled={isSubmitting}>
						Cancel
					</button>
					<button type="submit" className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={isSubmitting}>
						{isSubmitting ? "Creating role" : "Create role"}
					</button>
				</div>
			</form>
		</AdminDialog>
	);
}

function groupPermissions(permissions: AdminPermission[]) {
	const groups = new Map<string, { key: string; label: string; permissions: AdminPermission[] }>();
	for (const permission of permissions) {
		const key = permission.groupKey ?? "other";
		const group = groups.get(key) ?? {
			key,
			label: permission.groupLabel ?? "Other",
			permissions: [],
		};
		group.permissions.push(permission);
		groups.set(key, group);
	}

	return [...groups.values()].map((group) => ({
		...group,
		permissions: group.permissions.sort((left, right) =>
			(left.sortOrder ?? 1000) - (right.sortOrder ?? 1000) ||
			left.label.localeCompare(right.label),
		),
	}));
}

function TextField({
	label,
	value,
	onChange,
	disabled,
	required,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	required?: boolean;
}) {
	return (
		<label className="grid gap-1 text-sm">
			<span className="font-medium">{label}</span>
			<input className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={required} />
		</label>
	);
}

function NumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
	return (
		<label className="grid gap-1 text-sm">
			<span className="font-medium">{label}</span>
			<input className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" type="number" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled} />
		</label>
	);
}
