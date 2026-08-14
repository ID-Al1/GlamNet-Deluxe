/**
 * Canonical Bonisa mark: three petals opening from a centre circle.
 * Petal colours never change. On a plum background the centre swaps to cream.
 */
export function BonisaMark({ size = 30, onPlum = false }: { size?: number; onPlum?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Bonisa">
      <path d="M32 32 C26 26 24 14 32 4 C40 14 38 26 32 32 Z" fill="#6D1F36" />
      <path d="M32 32 C37 24 46 22 52 27 C49 37 40 40 32 32 Z" fill="#8E3C56" />
      <path d="M32 32 C27 24 18 22 12 27 C15 37 24 40 32 32 Z" fill="#591A2C" />
      <circle cx="32" cy="32" r="4.5" fill="#FDF8F0" stroke="#C1793A" strokeWidth="1.2" />
    </svg>
  );
}

export function BonisaLogo({ size = 30, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="inline-flex items-center" style={{ gap: 9 }}>
      <BonisaMark size={size} />
      <span
        className="font-serif"
        style={{ fontWeight: 600, fontSize: Math.round(size * 0.63), color: light ? "#FDF8F0" : undefined }}
      >
        Bonisa
      </span>
    </span>
  );
}

/** Time-of-day greeting. French only, three variants, accents intact. */
export function frenchGreeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Bonjour,";
  if (h < 18) return "Bon après-midi,";
  return "Bonsoir,";
}
