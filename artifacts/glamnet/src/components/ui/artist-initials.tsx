const AVATAR_PALETTES = [
  ["hsl(40 45% 92%)", "hsl(38 35% 78%)", "hsl(348 55% 27%)"],
  ["hsl(348 30% 90%)", "hsl(348 32% 74%)", "hsl(348 55% 24%)"],
  ["hsl(38 40% 90%)", "hsl(30 30% 72%)", "hsl(350 40% 22%)"],
  ["hsl(350 22% 88%)", "hsl(350 25% 70%)", "hsl(348 55% 27%)"],
  ["hsl(42 38% 91%)", "hsl(348 20% 74%)", "hsl(348 50% 25%)"],
];

interface ArtistInitialsProps {
  name: string;
  className?: string;
  textClassName?: string;
}

export function ArtistInitials({ name, className = "", textClassName = "text-5xl" }: ArtistInitialsProps) {
  const initials = name.trim().split(/\s+/).map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const p = AVATAR_PALETTES[name.charCodeAt(0) % AVATAR_PALETTES.length];
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center ${className}`}
      style={{ background: `linear-gradient(135deg, ${p[0]}, ${p[1]})` }}
    >
      <span className={`font-serif font-bold select-none ${textClassName}`} style={{ color: p[2] }}>
        {initials}
      </span>
    </div>
  );
}
