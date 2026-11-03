/**
 * The AdmitStory mark as a rendered object: a glass sphere lit from the top left, with a signal
 * rim and an orbit. Pure CSS, server-rendered, decorative.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="relative inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 32% 28%, rgb(255 255 255 / 0.95) 0 8%, transparent 24%), radial-gradient(circle at 60% 70%, var(--voice) 0%, transparent 60%), radial-gradient(circle at 40% 40%, var(--signal), color-mix(in srgb, var(--signal) 30%, black) 80%)",
        boxShadow:
          "inset 0 -3px 6px rgb(0 0 0 / 0.35), inset 0 1px 1px rgb(255 255 255 / 0.6), 0 0 18px -2px color-mix(in srgb, var(--signal) 70%, transparent)",
      }}
    >
      <span
        className="absolute rounded-full border border-[color-mix(in_srgb,var(--text)_55%,transparent)]"
        style={{ inset: "-18% -34%", transform: "rotate(-24deg) scaleY(0.38)" }}
      />
    </span>
  );
}
