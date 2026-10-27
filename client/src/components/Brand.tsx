import './Brand.css';

/** AlgoForge mark: three concept nodes joined by a forge-anvil stroke. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brandmark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 46 L32 14 L50 46" />
        <path d="M22 34 L42 34" />
      </g>
      <circle cx="32" cy="14" r="5" fill="var(--accent-2)" />
      <circle cx="14" cy="46" r="5" fill="var(--accent)" />
      <circle cx="50" cy="46" r="5" fill="var(--accent-3)" />
    </svg>
  );
}

export function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`wordmark ${compact ? 'wordmark--compact' : ''}`}>
      <BrandMark size={compact ? 22 : 28} />
      <span className="wordmark__text">
        Algo<span className="wordmark__accent">Forge</span>
      </span>
    </span>
  );
}
