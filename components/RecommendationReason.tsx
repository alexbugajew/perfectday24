type RecommendationReasonProps = {
  reason?: string | null;
  reasonBadges?: string[];
  compact?: boolean;
};

export default function RecommendationReason({
  reason,
  reasonBadges,
  compact = false,
}: RecommendationReasonProps) {
  const hasReason = Boolean(reason);
  const hasBadges = Boolean(reasonBadges && reasonBadges.length > 0);

  if (!hasReason && !hasBadges) return null;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {hasReason ? (
        <div
          className={`rounded-xl border border-black/10 bg-stone-50 text-gray-700 ${
            compact ? "px-3 py-2 text-[11px]" : "px-3 py-2 text-xs"
          }`}
        >
          {reason}
        </div>
      ) : null}

      {hasBadges ? (
        <div className="flex flex-wrap gap-2">
          {reasonBadges!.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-black/10 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900"
            >
              {badge}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
