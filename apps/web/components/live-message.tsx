// Live regions that stay in the accessibility tree while empty; only their text changes. A region
// that is hidden (display: none) or created together with its text is often not announced at all
// (WCAG 4.1.3). An empty region has no children, so `not-empty:` spacing applies only once there is
// something to say.

interface LiveMessageProps {
  message?: string | undefined;
  /** Classes for the region, e.g. "not-empty:mt-4" for spacing that appears with the message. */
  className?: string;
}

/** An error the moment it happens (role="alert", assertive). */
export function AlertMessage({ message, className }: LiveMessageProps) {
  return (
    <div role="alert" aria-atomic="true" className={className}>
      {message ? <p className="text-sm font-medium text-risk">{message}</p> : null}
    </div>
  );
}

/** Progress and confirmations (role="status", polite). */
export function StatusMessage({ message, className }: LiveMessageProps) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={className}>
      {message ? <p className="text-sm text-text-soft">{message}</p> : null}
    </div>
  );
}
