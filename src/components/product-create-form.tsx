import { useState, type FormEvent } from "react";
import type { ClassKitClient, ProductAuthMode, ProductEnvironment } from "@class-kit/react";
import { Plus } from "lucide-react";
import { AdminPanelMessage } from "./admin-feedback";

type ProductCreateFormProps = {
	client: ClassKitClient;
	onCreated: () => Promise<void>;
};

export function ProductCreateForm({ client, onCreated }: ProductCreateFormProps) {
	const [productKey, setProductKey] = useState("");
	const [name, setName] = useState("");
	const [origin, setOrigin] = useState("");
	const [environment, setEnvironment] = useState<ProductEnvironment>("development");
	const [status, setStatus] = useState<"active" | "inactive">("active");
	const [authMode, setAuthMode] = useState<ProductAuthMode>("open");
	const [emailPasswordEnabled, setEmailPasswordEnabled] = useState(true);
	const [googleOauthEnabled, setGoogleOauthEnabled] = useState(false);
	const [generationHorizonWeeks, setGenerationHorizonWeeks] = useState(8);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);
		setMessage(null);

		try {
			await client.admin.products.create({
				productKey,
				name,
				origin,
				environment,
				status,
				authMode,
				emailPasswordEnabled,
				googleOauthEnabled,
				generationHorizonWeeks,
			});
			setProductKey("");
			setName("");
			setOrigin("");
			setEnvironment("development");
			setStatus("active");
			setAuthMode("open");
			setEmailPasswordEnabled(true);
			setGoogleOauthEnabled(false);
			setGenerationHorizonWeeks(8);
			setMessage("Product created.");
			await onCreated();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not create product.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div>
			<div>
				<h2 className="admin-panel-title">Create product</h2>
				<p className="admin-meta mt-1">Add product details, origin, and auth policy.</p>
			</div>
			<form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
				<div className="grid gap-3">
					<TextField label="Product key" value={productKey} onChange={setProductKey} required disabled={isSubmitting} />
					<TextField label="Name" value={name} onChange={setName} required disabled={isSubmitting} />
					<TextField label="Initial origin" value={origin} onChange={setOrigin} type="url" required disabled={isSubmitting} />
					<label className="grid gap-1 text-sm">
						<span className="font-medium">Environment</span>
						<select className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" value={environment} onChange={(event) => setEnvironment(event.target.value as ProductEnvironment)} disabled={isSubmitting}>
							<option value="development">development</option>
							<option value="production">production</option>
						</select>
					</label>
					<label className="grid gap-1 text-sm">
						<span className="font-medium">Status</span>
						<select className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")} disabled={isSubmitting}>
							<option value="active">active</option>
							<option value="inactive">inactive</option>
						</select>
					</label>
					<label className="grid gap-1 text-sm">
						<span className="font-medium">Auth mode</span>
						<select className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" value={authMode} onChange={(event) => setAuthMode(event.target.value as ProductAuthMode)} disabled={isSubmitting}>
							<option value="open">open</option>
							<option value="invite_only">invite_only</option>
						</select>
					</label>
					<TextField label="Generation horizon weeks" value={String(generationHorizonWeeks)} onChange={(value) => setGenerationHorizonWeeks(Number(value))} type="number" min={1} required disabled={isSubmitting} />
				</div>
				<div className="flex flex-wrap gap-4 text-sm">
					<label className="flex items-center gap-2">
						<input type="checkbox" checked={emailPasswordEnabled} onChange={(event) => setEmailPasswordEnabled(event.target.checked)} disabled={isSubmitting} />
						Email password
					</label>
					<label className="flex items-center gap-2">
						<input type="checkbox" checked={googleOauthEnabled} onChange={(event) => setGoogleOauthEnabled(event.target.checked)} disabled={isSubmitting} />
						Google OAuth
					</label>
				</div>
				<button type="submit" className="inline-flex h-10 w-fit max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={isSubmitting}>
					<Plus className="size-4" aria-hidden="true" />
					{isSubmitting ? "Creating product" : "Create product"}
				</button>
			</form>
			<div className="mt-3">
				<AdminPanelMessage message={message} error={error} />
			</div>
		</div>
	);
}

function TextField({
	label,
	value,
	onChange,
	type = "text",
	required,
	min,
	disabled,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	type?: string;
	required?: boolean;
	min?: number;
	disabled?: boolean;
}) {
	return (
		<label className="grid gap-1 text-sm">
			<span className="font-medium">{label}</span>
			<input className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} min={min} disabled={disabled} />
		</label>
	);
}
