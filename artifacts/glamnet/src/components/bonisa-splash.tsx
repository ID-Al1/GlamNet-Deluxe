import { useEffect, useState } from "react";
import { BonisaMark, frenchGreeting } from "@/components/bonisa-logo";

const SEEN_KEY = "bonisa_splash_seen";

/**
 * Signature launch moment: the petal mark blooms over a cream field,
 * the wordmark settles beneath it, then the whole thing fades away.
 * Shown once per browser session. Respects prefers-reduced-motion.
 */
export function BonisaSplash() {
  const [phase, setPhase] = useState<"hidden" | "bloom" | "fade">("hidden");

  useEffect(() => {
    if (sessionStorage.getItem(SEEN_KEY) || navigator.webdriver) return;
    sessionStorage.setItem(SEEN_KEY, "1");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // skip the animation entirely
    setPhase("bloom");
    const t1 = setTimeout(() => setPhase("fade"), 1900);
    const t2 = setTimeout(() => setPhase("hidden"), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{
        background: "#EFE8DB",
        opacity: phase === "fade" ? 0 : 1,
        transition: "opacity 600ms ease",
        pointerEvents: phase === "fade" ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes bonisa-bloom {
          0%   { transform: scale(0.2) rotate(-24deg); opacity: 0; }
          55%  { transform: scale(1.08) rotate(3deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes bonisa-rise {
          0%   { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <div style={{ animation: "bonisa-bloom 900ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
        <BonisaMark size={84} />
      </div>
      <div
        className="font-serif"
        style={{
          animation: "bonisa-rise 600ms ease 650ms both",
          fontWeight: 600,
          fontSize: 34,
          color: "#2A1418",
          marginTop: 14,
        }}
      >
        Bonisa
      </div>
      <div
        style={{
          animation: "bonisa-rise 600ms ease 950ms both",
          color: "#6B1F2E",
          fontSize: 15,
          marginTop: 6,
          letterSpacing: "0.02em",
        }}
      >
        {frenchGreeting()}
      </div>
    </div>
  );
}
