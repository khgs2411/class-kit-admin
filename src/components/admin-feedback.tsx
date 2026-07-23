import { useEffect, useId, type ReactNode } from "react";

type AdminDialogProps = {
	title: string;
	children: ReactNode;
	onClose: () => void;
	wide?: boolean;
};

type AdminPanelMessageProps = {
	message: string | null;
	error: string | null;
};

export function AdminDialog({ title, children, onClose, wide = false }: AdminDialogProps) {
	const titleId = useId();

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				onClose();
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 px-4 py-4 sm:items-center sm:py-6">
			<div className={`grid max-h-[calc(100dvh-2rem)] w-full ${wide ? "max-w-5xl" : "max-w-xl"} grid-rows-[auto_minmax(0,1fr)] rounded-md border border-border bg-card shadow-lg sm:max-h-[calc(100dvh-3rem)]`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
				<div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
					<h3 id={titleId} className="admin-panel-title min-w-0 truncate">{title}</h3>
					<button type="button" className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground" onClick={onClose} aria-label={`Close ${title}`}>
						Close
					</button>
				</div>
				<div className="min-h-0 overflow-y-auto p-4">{children}</div>
			</div>
		</div>
	);
}

export function AdminPanelMessage({ message, error }: AdminPanelMessageProps) {
	if (!message && !error) return null;

	return (
		<p className={`rounded-md border px-3 py-2 text-sm font-medium ${error ? "border-destructive text-destructive" : "border-border bg-background text-muted-foreground"}`}>
			{error ?? message}
		</p>
	);
}

export function AdminEmptyState({ children, className = "" }: { children: ReactNode; className?: string }) {
	return (
		<div className={`admin-meta rounded-md border border-dashed border-border bg-background p-4 ${className}`}>
			{children}
		</div>
	);
}
