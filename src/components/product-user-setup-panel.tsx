import { useState, type FormEvent } from "react";
import type { AdminProductListItem, BuiltInProductRole, ClassKitClient } from "@class-kit/react";
import { CopyableId } from "./copyable-id";

type ProductUserSetupPanelProps = {
	client: ClassKitClient;
	product: AdminProductListItem;
	currentUserId: string | null;
	onChanged: () => Promise<void>;
};

export function ProductUserSetupPanel({ client, product, currentUserId, onChanged }: ProductUserSetupPanelProps) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [createdUserId, setCreatedUserId] = useState("");
	const [userId, setUserId] = useState("");
	const [role, setRole] = useState<BuiltInProductRole>("user");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const isEditingSelf = Boolean(currentUserId && userId.trim() === currentUserId);

	async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setMessage(null);
		setError(null);

		try {
			const created = await client.admin.users.create({
				productKey: product.product_key,
				email,
				password: password || undefined,
				displayName: displayName || undefined,
				role,
			});
			setCreatedUserId(created.user.id);
			setUserId(created.user.id);
			setEmail("");
			setPassword("");
			setDisplayName("");
			setMessage(`Created user ${created.user.email ?? created.user.id} and added them to ${product.name}.`);
			await onChanged();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not create user.");
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleAssignUser(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setMessage(null);
		setError(null);

		if (isEditingSelf) {
			setError("Use platform admin controls for your own account. Product membership cannot change your platform admin authority.");
			setIsSubmitting(false);
			return;
		}

		try {
			await client.admin.users.assignProductUser({
				productKey: product.product_key,
				userId,
				role,
				status: "active",
			});
			setMessage("User assigned to product.");
			await onChanged();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not assign user.");
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handlePromoteManager() {
		if (!userId) return;
		setIsSubmitting(true);
		setMessage(null);
		setError(null);

		if (isEditingSelf) {
			setError("Use platform admin controls for your own account. Product manager is only a product-local role.");
			setIsSubmitting(false);
			return;
		}

		try {
			await client.admin.users.updateProductUser({
				productKey: product.product_key,
				userId,
				role: "manager",
				status: "active",
			});
			setRole("manager");
			setMessage("User promoted to manager.");
			await onChanged();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not promote user.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<section className="rounded-md border border-border bg-card p-4">
			<h2 className="admin-panel-title">Product membership</h2>
			<p className="admin-meta mt-1">Create users and set product-local membership. Platform admin status is separate.</p>
			<div className="mt-4 grid gap-4">
				<form className="grid gap-3" onSubmit={handleCreateUser}>
					<div className="grid gap-3 lg:grid-cols-3">
						<TextField label="Email" value={email} onChange={setEmail} type="email" required />
						<TextField label="Password" value={password} onChange={setPassword} type="password" />
						<TextField label="Display name" value={displayName} onChange={setDisplayName} />
					</div>
					<button type="submit" className="inline-flex h-10 w-fit max-w-full items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={isSubmitting}>
						Create product user
					</button>
				</form>

				<form className="grid gap-3 border-t border-border pt-4" onSubmit={handleAssignUser}>
					<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
						<TextField label="User ID" value={userId} onChange={setUserId} required />
						<label className="grid gap-1 text-sm">
							<span className="font-medium">Membership role</span>
							<select className="h-10 rounded-md border border-input bg-background px-3" value={role} onChange={(event) => setRole(event.target.value as BuiltInProductRole)}>
								<option value="user">user</option>
								<option value="manager">manager</option>
							</select>
						</label>
					</div>
					{isEditingSelf ? <p className="text-sm font-medium text-destructive">You are signed in as a platform admin. Do not use product membership controls to change your own authority.</p> : null}
					<div className="flex flex-wrap gap-2">
						<button type="submit" className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={isSubmitting || isEditingSelf}>
							Add active member
						</button>
						<button type="button" className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-border px-4 text-sm font-semibold hover:border-primary disabled:opacity-60" onClick={() => void handlePromoteManager()} disabled={isSubmitting || !userId || isEditingSelf}>
							Promote to manager
						</button>
					</div>
				</form>
			</div>
			{createdUserId ? (
				<p className="admin-meta mt-3 flex min-w-0 flex-wrap items-center gap-2">
					<span className="font-medium">Created user ID</span>
					<CopyableId value={createdUserId} label="created user ID" />
				</p>
			) : null}
			{message || error ? <p className={`mt-3 text-sm font-medium ${error ? "text-destructive" : "text-muted-foreground"}`}>{error ?? message}</p> : null}
		</section>
	);
}

function TextField({
	label,
	value,
	onChange,
	type = "text",
	required,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	type?: string;
	required?: boolean;
}) {
	return (
		<label className="grid gap-1 text-sm">
			<span className="font-medium">{label}</span>
			<input className="h-10 min-w-0 rounded-md border border-input bg-background px-3" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
		</label>
	);
}
