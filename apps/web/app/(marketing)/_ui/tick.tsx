// The 2 px --verified tick beside an included item (direction §4.8). The words carry the meaning;
// the tick is decoration. Server-safe.

export function Tick({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      className={className ?? "mt-[3px] shrink-0 text-verified"}
    >
      <path
        d="M3 8.5 6.5 12 13 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
