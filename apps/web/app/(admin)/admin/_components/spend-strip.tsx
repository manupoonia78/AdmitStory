import { usd } from "@/lib/admin/costs";

// The daily spend strip on Costs (direction doc, M): server-rendered inline SVG, one bar a day. A
// "high" day is outlined, and the accessible table beneath says "high" in words (colour never alone).

export function SpendStrip({ days }: { days: { day: string; usd: number; anomaly: boolean }[] }) {
  if (days.length === 0) return null;
  const max = Math.max(...days.map((d) => d.usd), 0.0001);
  const width = 720;
  const height = 96;
  const gap = 2;
  const bar = Math.max(2, (width - gap * (days.length - 1)) / days.length);
  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-24 w-full max-w-3xl"
        role="img"
        aria-label={`Daily spend over ${days.length} days, highest ${usd(max)}`}
      >
        {days.map((d, i) => {
          const h = Math.max(1, (d.usd / max) * (height - 4));
          return (
            <rect
              key={d.day}
              x={i * (bar + gap)}
              y={height - h}
              width={bar}
              height={h}
              rx={1}
              className={d.anomaly ? "fill-needs stroke-text" : "fill-signal/70"}
              strokeWidth={d.anomaly ? 1.5 : 0}
            >
              <title>{`${d.day}: ${usd(d.usd)}${d.anomaly ? " (high)" : ""}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="text-sm text-text-soft">
        Outlined bars are days above 1.5× the range&apos;s daily mean.
      </figcaption>
    </figure>
  );
}
