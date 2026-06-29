type AdminBadgeTone = "neutral" | "muted" | "active" | "selected" | "selected-muted";
type AdminBadgeSize = "compact" | "default";

type AdminBadgeOptions = {
	tone?: AdminBadgeTone;
	size?: AdminBadgeSize;
	mono?: boolean;
	className?: string;
};

const toneClasses: Record<AdminBadgeTone, string> = {
	neutral: "border-border bg-background text-foreground",
	muted: "border-border bg-background text-muted-foreground",
	active: "border-primary/40 bg-primary/10 text-primary",
	selected: "border-primary-foreground/35 bg-primary-foreground text-primary",
	"selected-muted": "border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground/85",
};

const sizeClasses: Record<AdminBadgeSize, string> = {
	compact: "min-h-6 px-1.5 py-0.5 text-[0.7rem]",
	default: "min-h-7 px-2 py-1 text-xs",
};

export function adminBadgeClass({ tone = "muted", size = "default", mono = false, className = "" }: AdminBadgeOptions = {}) {
	return [
		"inline-flex max-w-full min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap rounded-md border font-medium leading-none",
		sizeClasses[size],
		toneClasses[tone],
		mono ? "font-mono" : "",
		className,
	].filter(Boolean).join(" ");
}
