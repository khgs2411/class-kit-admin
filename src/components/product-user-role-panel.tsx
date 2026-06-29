import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminProductListItem, AdminProductRole, AdminProductUserRoleAssignment, ClassKitClient } from "@class-kit/react";
import { AdminEmptyState, AdminPanelMessage } from "./admin-feedback";
import { CopyableId } from "./copyable-id";

type ProductUserRolePanelProps = {
	client: ClassKitClient;
	product: AdminProductListItem;
	currentUserId: string | null;
	refreshKey?: number;
};

export function ProductUserRolePanel({ client, product, currentUserId, refreshKey = 0 }: ProductUserRolePanelProps) {
	const [assignments, setAssignments] = useState<AdminProductUserRoleAssignment[]>([]);
	const [roles, setRoles] = useState<AdminProductRole[]>([]);
	const [userId, setUserId] = useState("");
	const [roleId, setRoleId] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const isAssigningSelf = Boolean(currentUserId && userId.trim() === currentUserId);

	const loadAssignments = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const [assignmentData, roleData] = await Promise.all([
				client.admin.productRoles.listUserRoles(product.product_key),
				client.admin.productRoles.listRoles(product.product_key),
			]);
			setAssignments(assignmentData.assignments);
			setRoles(roleData.roles);
			setRoleId((current) => current || roleData.roles[0]?.id || "");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not load product user roles.");
		} finally {
			setIsLoading(false);
		}
	}, [client, product.product_key]);

	useEffect(() => {
		let isCurrent = true;

		Promise.all([
			client.admin.productRoles.listUserRoles(product.product_key),
			client.admin.productRoles.listRoles(product.product_key),
		])
			.then(([assignmentData, roleData]) => {
				if (!isCurrent) return;
				setAssignments(assignmentData.assignments);
				setRoles(roleData.roles);
				setRoleId((current) => current || roleData.roles[0]?.id || "");
				setError(null);
			})
			.catch((caught: unknown) => {
				if (!isCurrent) return;
				setError(caught instanceof Error ? caught.message : "Could not load product user roles.");
			})
			.finally(() => {
				if (!isCurrent) return;
				setIsLoading(false);
			});

		return () => {
			isCurrent = false;
		};
	}, [client, product.product_key, refreshKey]);

	async function handleAssignRole(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setMessage(null);
		setError(null);

		if (isAssigningSelf) {
			setError("Product role grants cannot change your platform admin authority. Choose another product user.");
			setIsSubmitting(false);
			return;
		}

		try {
			await client.admin.productRoles.assignUserRole({
				productKey: product.product_key,
				userId,
				roleId,
			});
			setMessage("Product user role assigned.");
			await loadAssignments();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not assign product user role.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<section className="rounded-md border border-border bg-card p-4">
			<div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
				<div>
					<h2 className="admin-panel-title">Product role grants</h2>
					<p className="admin-meta mt-1">Grant product-scoped roles to assigned users. Platform admin authority is separate.</p>
				</div>
				<button type="button" className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-border px-3 text-sm font-semibold hover:border-primary disabled:opacity-60" onClick={() => void loadAssignments()} disabled={isLoading}>
					Refresh
				</button>
			</div>

			<form className="mt-4 grid gap-3 border-b border-border pb-4" onSubmit={handleAssignRole}>
				<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
					<TextField label="Assigned user ID" value={userId} onChange={setUserId} required disabled={isSubmitting} />
					<label className="grid gap-1 text-sm">
						<span className="font-medium">Role</span>
						<select className="h-10 rounded-md border border-input bg-background px-3 disabled:opacity-60" value={roleId} onChange={(event) => setRoleId(event.target.value)} required disabled={isSubmitting || roles.length === 0}>
							{roles.map((role) => (
								<option key={role.id} value={role.id}>
									{role.key}
								</option>
							))}
						</select>
					</label>
				</div>
				{isAssigningSelf ? <p className="text-sm font-medium text-destructive">You are signed in as a platform admin. Product role grants are for product-local authority only.</p> : null}
				<button type="submit" className="inline-flex h-10 w-fit max-w-full items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={isSubmitting || !roleId || isAssigningSelf}>
					{isSubmitting ? "Granting role" : "Grant product role"}
				</button>
			</form>

			<div className="mt-4 grid gap-2">
				{isLoading ? <AdminEmptyState>Loading product role assignments.</AdminEmptyState> : null}
				{!isLoading && !error && roles.length === 0 ? <AdminEmptyState>No product roles are configured yet. Create a role before assigning grants.</AdminEmptyState> : null}
				{!isLoading && !error && roles.length > 0 && assignments.length === 0 ? <AdminEmptyState>No role assignments yet. Grant a product role to an assigned user when they need product-local authority.</AdminEmptyState> : null}
				{assignments.map((assignment) => (
					<div key={`${assignment.user_id}-${assignment.role_id}`} className="grid min-w-0 gap-2 rounded-md border border-border p-3 text-sm lg:grid-cols-[minmax(0,1fr)_12rem_7rem]">
						<CopyableId value={assignment.user_id} label="assigned user ID" />
						{assignment.role_key ? <span className="font-medium">{assignment.role_key}</span> : <CopyableId value={assignment.role_id} label="role ID" />}
						<span className="admin-meta">{assignment.status}</span>
					</div>
				))}
			</div>
			<div className="mt-3">
				<AdminPanelMessage message={message} error={error} />
			</div>
		</section>
	);
}

function TextField({
	label,
	value,
	onChange,
	required,
	disabled,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	required?: boolean;
	disabled?: boolean;
}) {
	return (
		<label className="grid gap-1 text-sm">
			<span className="font-medium">{label}</span>
			<input className="h-10 min-w-0 rounded-md border border-input bg-background px-3 disabled:opacity-60" value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} />
		</label>
	);
}
