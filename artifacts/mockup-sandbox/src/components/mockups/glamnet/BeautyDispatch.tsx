import { useState } from "react";

const SERVICES = ["Makeup", "Hair", "Nails", "Lashes", "Brows", "Skincare"];
const BUDGETS = ["Under R300", "R300–R600", "R600–R1000", "R1000+"];
const TIMES = ["ASAP", "Within 1 hr", "Within 2 hrs", "Today, flexible"];

export function BeautyDispatch() {
  const [step, setStep] = useState<"select" | "matching" | "found">("select");
  const [service, setService] = useState("Makeup");
  const [budget, setBudget] = useState("R300–R600");
  const [time, setTime] = useState("ASAP");

  if (step === "matching") {
    setTimeout(() => setStep("found"), 2200);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6" style={{ background: "#F8F5F0" }}>
        <div className="relative w-28 h-28">
          <div className="absolute inset-0 rounded-full border-4 animate-ping" style={{ borderColor: "#FF8A3D", opacity: 0.3 }} />
          <div className="absolute inset-2 rounded-full border-4 animate-ping" style={{ borderColor: "#FF8A3D", opacity: 0.5, animationDelay: "0.3s" }} />
          <div className="absolute inset-4 rounded-full border-4 animate-ping" style={{ borderColor: "#FF8A3D", animationDelay: "0.6s" }} />
          <div className="absolute inset-0 flex items-center justify-center text-3xl">⚡</div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-xl font-bold" style={{ color: "#1a1a1a" }}>Finding your artist…</p>
          <p className="text-sm" style={{ color: "#7a7a7a" }}>Scanning {service} artists available now near you</p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          {["Checking availability", "Verifying location", "Confirming response time"].map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white animate-pulse" style={{ background: "#6E4B72", animationDelay: `${i * 0.4}s` }}>✓</div>
              <span className="text-sm" style={{ color: "#555" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === "found") {
    return (
      <div className="min-h-screen flex flex-col px-5 pt-12 pb-8 gap-6" style={{ background: "#F8F5F0" }}>
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mb-3" style={{ background: "#e8f7e8", color: "#2d7a2d" }}>
            <span>●</span> Artist found nearby
          </div>
          <h2 className="text-2xl font-bold" style={{ color: "#1a1a1a" }}>Your artist is ready</h2>
        </div>

        <div className="rounded-2xl p-5 shadow-sm border" style={{ background: "white", borderColor: "#e8e0ea" }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #6E4B72, #9b6ea0)" }}>AK</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-lg" style={{ color: "#1a1a1a" }}>Alwande Khoza</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#7BC6FF22", color: "#2a7ab5" }}>Verified ✓</span>
              </div>
              <p className="text-sm" style={{ color: "#6E4B72" }}>Makeup Artist · 4.9 ⭐</p>
              <p className="text-xs mt-0.5" style={{ color: "#7a7a7a" }}>1.2 km away · responds in ~3 min</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[["Punctuality", "98%"], ["Repeat clients", "76%"], ["Cancellations", "2%"]].map(([label, val]) => (
              <div key={label} className="text-center rounded-xl py-2" style={{ background: "#F8F5F0" }}>
                <p className="text-base font-bold" style={{ color: "#6E4B72" }}>{val}</p>
                <p className="text-xs" style={{ color: "#888" }}>{label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between py-3 border-t" style={{ borderColor: "#f0e8f0" }}>
            <div>
              <p className="text-xs" style={{ color: "#888" }}>Service · {service}</p>
              <p className="text-lg font-bold" style={{ color: "#1a1a1a" }}>R450</p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: "#888" }}>Earliest available</p>
              <p className="text-sm font-semibold" style={{ color: "#2d7a2d" }}>Today, 2:30 PM</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setStep("select")}
            className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg"
            style={{ background: "linear-gradient(135deg, #FF8A3D, #ff6b00)" }}
          >
            Confirm & Book Now
          </button>
          <button
            onClick={() => setStep("select")}
            className="w-full py-3 rounded-2xl font-semibold text-sm border"
            style={{ color: "#6E4B72", borderColor: "#d4b8d6" }}
          >
            Find someone else
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-5 pt-10 pb-8 gap-5" style={{ background: "#F8F5F0" }}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">⚡</span>
          <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "#FF8A3D22", color: "#FF8A3D" }}>Beauty Dispatch</span>
        </div>
        <h1 className="text-2xl font-bold leading-tight" style={{ color: "#1a1a1a" }}>Need someone<br /><span style={{ color: "#FF8A3D" }}>today?</span></h1>
        <p className="text-sm mt-1" style={{ color: "#7a7a7a" }}>GlamNet finds the best available artist near you — instantly.</p>
      </div>

      {/* Service */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#6E4B72" }}>Service needed</p>
        <div className="grid grid-cols-3 gap-2">
          {SERVICES.map(s => (
            <button
              key={s}
              onClick={() => setService(s)}
              className="py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: service === s ? "#6E4B72" : "white",
                color: service === s ? "white" : "#555",
                border: `1.5px solid ${service === s ? "#6E4B72" : "#e8e0ea"}`,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#6E4B72" }}>Budget</p>
        <div className="grid grid-cols-2 gap-2">
          {BUDGETS.map(b => (
            <button
              key={b}
              onClick={() => setBudget(b)}
              className="py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: budget === b ? "#7BC6FF22" : "white",
                color: budget === b ? "#2a7ab5" : "#555",
                border: `1.5px solid ${budget === b ? "#7BC6FF" : "#e8e0ea"}`,
              }}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Time */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#6E4B72" }}>Availability</p>
        <div className="grid grid-cols-2 gap-2">
          {TIMES.map(t => (
            <button
              key={t}
              onClick={() => setTime(t)}
              className="py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: time === t ? "#FF8A3D15" : "white",
                color: time === t ? "#FF8A3D" : "#555",
                border: `1.5px solid ${time === t ? "#FF8A3D" : "#e8e0ea"}`,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Location pill */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border" style={{ background: "white", borderColor: "#e8e0ea" }}>
        <span>📍</span>
        <span className="text-sm" style={{ color: "#555" }}>Sandton, Johannesburg</span>
        <span className="ml-auto text-xs font-medium" style={{ color: "#6E4B72" }}>Change</span>
      </div>

      {/* Dispatch button */}
      <button
        onClick={() => setStep("matching")}
        className="w-full py-5 rounded-2xl text-white font-bold text-xl shadow-xl mt-auto"
        style={{ background: "linear-gradient(135deg, #FF8A3D, #e5660a)" }}
      >
        ⚡ Dispatch Now
      </button>
      <p className="text-center text-xs" style={{ color: "#aaa" }}>Usually matched in under 2 minutes</p>
    </div>
  );
}
