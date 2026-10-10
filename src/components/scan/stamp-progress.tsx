import { cn } from "@/lib/cn";
import { stampMessage } from "@/lib/stamp-message";

export function StampProgress({
  current,
  goal,
  brandColor,
}: {
  current: number;
  goal: number;
  brandColor: string;
}) {
  const filled = Math.min(current, goal);
  const { tone, text } = stampMessage(current, goal);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink">Ma carte de fidélité</p>
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink">{filled}</span> / {goal} tampons
        </p>
      </div>
      <ol className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10" aria-label={`${filled} tampons sur ${goal}`}>
        {Array.from({ length: goal }, (_, i) => {
          const on = i < filled;
          return (
            <li
              key={i}
              className={cn(
                "grid aspect-square place-items-center rounded-full border-2 text-xs font-bold",
                on ? "border-transparent text-white" : "border-dashed border-line text-muted",
              )}
              style={on ? { backgroundColor: brandColor } : undefined}
            >
              {on ? "✓" : i + 1}
            </li>
          );
        })}
      </ol>
      <p
        className={cn(
          "mt-3 text-sm",
          tone === "complete" && "rounded-lg bg-good-soft px-3 py-2 font-medium text-good",
          tone === "almost" && "rounded-lg bg-brand-soft px-3 py-2 font-medium text-brand",
          tone === "halfway" && "font-medium text-ink",
          tone === "normal" && "text-ink-2",
        )}
      >
        {text}
      </p>
    </div>
  );
}
