import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

type CopyableIdProps = {
	value: string;
	label: string;
	className?: string;
	prefixLength?: number;
	suffixLength?: number;
};

export function CopyableId({ value, label, className = "", prefixLength = 8, suffixLength = 4 }: CopyableIdProps) {
	const [copied, setCopied] = useState(false);
	const displayValue = useMemo(() => compactId(value, prefixLength, suffixLength), [value, prefixLength, suffixLength]);

	useEffect(() => {
		if (!copied) return;
		const timeoutId = window.setTimeout(() => setCopied(false), 1600);
		return () => window.clearTimeout(timeoutId);
	}, [copied]);

	async function handleCopy() {
		if (navigator.clipboard) {
			await navigator.clipboard.writeText(value);
		} else {
			const textarea = document.createElement("textarea");
			textarea.value = value;
			textarea.setAttribute("readonly", "");
			textarea.style.position = "fixed";
			textarea.style.opacity = "0";
			document.body.append(textarea);
			textarea.select();
			document.execCommand("copy");
			textarea.remove();
		}
		setCopied(true);
	}

	return (
		<span className={`inline-flex max-w-full min-w-0 items-center gap-1.5 ${className}`}>
			<code className="admin-code min-w-0 truncate" title={value}>
				{displayValue}
			</code>
			<button
				type="button"
				className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-primary hover:text-foreground"
				onClick={() => void handleCopy()}
				aria-label={`Copy ${label}`}
				title={copied ? "Copied" : `Copy ${label}`}
			>
				{copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
			</button>
		</span>
	);
}

function compactId(value: string, prefixLength: number, suffixLength: number) {
	const visibleLength = prefixLength + suffixLength;
	if (value.length <= visibleLength + 4) return value;
	return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`;
}
