// Inline SVG illustrations for empty states — no external images.
// All use currentColor / CSS vars for dark-mode compatibility.

interface IllustrationProps {
  width?: number;
  height?: number;
}

export function EmptyTransactions({ width = 140, height = 100 }: IllustrationProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Receipt body */}
      <rect x="30" y="8" width="60" height="72" rx="4" fill="var(--color-bg-tertiary)" stroke="var(--color-border)" strokeWidth="1.5" />
      {/* Receipt lines */}
      <rect x="40" y="22" width="40" height="3" rx="1.5" fill="var(--color-border)" />
      <rect x="40" y="32" width="32" height="3" rx="1.5" fill="var(--color-border)" />
      <rect x="40" y="42" width="36" height="3" rx="1.5" fill="var(--color-border)" />
      <rect x="40" y="52" width="28" height="3" rx="1.5" fill="var(--color-border)" />
      {/* Divider */}
      <line x1="38" y1="63" x2="82" y2="63" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3 2" />
      {/* Total amount */}
      <rect x="50" y="68" width="20" height="4" rx="2" fill="#6366f1" opacity="0.7" />
      {/* Coin icon - right side */}
      <circle cx="112" cy="36" r="16" fill="var(--color-bg-tertiary)" stroke="var(--color-border)" strokeWidth="1.5" />
      <circle cx="112" cy="36" r="10" fill="#6366f1" opacity="0.15" stroke="#6366f1" strokeWidth="1" />
      <text x="112" y="41" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#6366f1" opacity="0.8">$</text>
      {/* Small coin */}
      <circle cx="20" cy="64" r="10" fill="var(--color-bg-tertiary)" stroke="var(--color-border)" strokeWidth="1.5" />
      <circle cx="20" cy="64" r="6" fill="#6366f1" opacity="0.15" stroke="#6366f1" strokeWidth="1" />
      <text x="20" y="68" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#6366f1" opacity="0.8">$</text>
    </svg>
  );
}

export function EmptyInvestments({ width = 140, height = 100 }: IllustrationProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Chart background */}
      <rect x="15" y="15" width="110" height="70" rx="6" fill="var(--color-bg-tertiary)" stroke="var(--color-border)" strokeWidth="1.5" />
      {/* Y-axis grid lines */}
      <line x1="30" y1="68" x2="110" y2="68" stroke="var(--color-border)" strokeWidth="1" />
      <line x1="30" y1="55" x2="110" y2="55" strokeDasharray="3 2" stroke="var(--color-border)" strokeWidth="1" />
      <line x1="30" y1="42" x2="110" y2="42" strokeDasharray="3 2" stroke="var(--color-border)" strokeWidth="1" />
      <line x1="30" y1="29" x2="110" y2="29" strokeDasharray="3 2" stroke="var(--color-border)" strokeWidth="1" />
      {/* X-axis */}
      <line x1="30" y1="28" x2="30" y2="68" stroke="var(--color-border)" strokeWidth="1" />
      {/* Bar chart going up */}
      <rect x="38" y="58" width="12" height="10" rx="2" fill="#6366f1" opacity="0.5" />
      <rect x="56" y="50" width="12" height="18" rx="2" fill="#6366f1" opacity="0.6" />
      <rect x="74" y="42" width="12" height="26" rx="2" fill="#6366f1" opacity="0.75" />
      <rect x="92" y="32" width="12" height="36" rx="2" fill="#6366f1" />
      {/* Upward trend line */}
      <polyline
        points="44,56 62,48 80,40 98,30"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.8"
      />
      {/* Arrow up */}
      <polyline
        points="94,22 98,30 102,22"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function EmptyRecurring({ width = 140, height = 100 }: IllustrationProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Calendar body */}
      <rect x="20" y="20" width="72" height="64" rx="6" fill="var(--color-bg-tertiary)" stroke="var(--color-border)" strokeWidth="1.5" />
      {/* Calendar header */}
      <rect x="20" y="20" width="72" height="20" rx="6" fill="#6366f1" opacity="0.2" />
      <rect x="20" y="32" width="72" height="8" fill="#6366f1" opacity="0.2" />
      {/* Header pins */}
      <rect x="36" y="14" width="4" height="12" rx="2" fill="var(--color-border)" />
      <rect x="72" y="14" width="4" height="12" rx="2" fill="var(--color-border)" />
      {/* Calendar grid dots */}
      <circle cx="36" cy="54" r="3" fill="var(--color-border)" />
      <circle cx="48" cy="54" r="3" fill="var(--color-border)" />
      <circle cx="60" cy="54" r="3" fill="#6366f1" opacity="0.7" />
      <circle cx="72" cy="54" r="3" fill="var(--color-border)" />
      <circle cx="36" cy="66" r="3" fill="var(--color-border)" />
      <circle cx="48" cy="66" r="3" fill="var(--color-border)" />
      <circle cx="60" cy="66" r="3" fill="var(--color-border)" />
      <circle cx="72" cy="66" r="3" fill="var(--color-border)" />
      <circle cx="36" cy="78" r="3" fill="var(--color-border)" />
      <circle cx="48" cy="78" r="3" fill="var(--color-border)" />
      {/* Repeat arrow - overlapping bottom-right */}
      <circle cx="108" cy="68" r="20" fill="var(--color-bg-tertiary)" stroke="var(--color-border)" strokeWidth="1.5" />
      {/* Circular arrow */}
      <path
        d="M100 68 A8 8 0 1 1 108 76"
        stroke="#6366f1"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <polyline
        points="105,74 108,77 111,74"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function EmptyEmployers({ width = 140, height = 100 }: IllustrationProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Briefcase body */}
      <rect x="25" y="35" width="74" height="50" rx="6" fill="var(--color-bg-tertiary)" stroke="var(--color-border)" strokeWidth="1.5" />
      {/* Briefcase handle */}
      <path
        d="M50 35 L50 26 Q50 20 62 20 Q74 20 74 26 L74 35"
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Center clasp line */}
      <line x1="25" y1="55" x2="99" y2="55" stroke="var(--color-border)" strokeWidth="1.5" />
      {/* Clasp */}
      <rect x="54" y="51" width="16" height="8" rx="2" fill="var(--color-bg-tertiary)" stroke="var(--color-border)" strokeWidth="1.5" />
      {/* Lines inside briefcase bottom */}
      <rect x="38" y="65" width="30" height="3" rx="1.5" fill="var(--color-border)" />
      <rect x="38" y="73" width="20" height="3" rx="1.5" fill="var(--color-border)" />
      {/* Plus icon — bottom right */}
      <circle cx="106" cy="72" r="18" fill="var(--color-bg-tertiary)" stroke="var(--color-border)" strokeWidth="1.5" />
      <line x1="106" y1="64" x2="106" y2="80" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="98" y1="72" x2="114" y2="72" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
