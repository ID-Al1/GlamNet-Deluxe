export function ReputationScore() {
  const metrics = [
    { label: "Punctuality", value: 98, icon: "🕐", desc: "On time or early" },
    { label: "Response time", value: 94, icon: "💬", desc: "Avg. 4 min reply" },
    { label: "Repeat clients", value: 76, icon: "❤️", desc: "76% return rate" },
    { label: "Verified bookings", value: 100, icon: "✅", desc: "All bookings verified" },
    { label: "Cancellation rate", value: 3, icon: "🚫", desc: "3% cancellation", inverted: true },
  ];

  const score = 94;

  function getColor(val: number, inverted?: boolean) {
    if (inverted) return val <= 5 ? "#2d9e2d" : val <= 15 ? "#FF8A3D" : "#e53e3e";
    if (val >= 90) return "#2d9e2d";
    if (val >= 70) return "#6E4B72";
    return "#FF8A3D";
  }

  function getRingPct(val: number, inverted?: boolean) {
    return inverted ? Math.max(0, 100 - val * 2) : val;
  }

  return (
    <div className="min-h-screen flex flex-col px-5 pt-10 pb-8 gap-5" style={{ background: "#F8F5F0" }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white" style={{ background: "linear-gradient(135deg, #6E4B72, #9b6ea0)" }}>AK</div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#1a1a1a" }}>Alwande Khoza</h2>
          <p className="text-sm" style={{ color: "#6E4B72" }}>Makeup Artist · Sandton</p>
        </div>
      </div>

      {/* Score circle */}
      <div className="rounded-3xl p-6 flex flex-col items-center gap-3" style={{ background: "white", border: "1.5px solid #e8e0ea" }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#6E4B72" }}>GlamNet Reputation Score</p>
        <div className="relative w-36 h-36">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#f0e8f0" strokeWidth="9" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke="#6E4B72" strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42 * score / 100} ${2 * Math.PI * 42}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold" style={{ color: "#1a1a1a" }}>{score}</span>
            <span className="text-xs font-medium" style={{ color: "#6E4B72" }}>/ 100</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <span className="text-sm font-semibold" style={{ color: "#2d9e2d" }}>Excellent — Top 8% on GlamNet</span>
        </div>
        <p className="text-xs text-center" style={{ color: "#aaa" }}>Based on 127 verified bookings over 14 months</p>
      </div>

      {/* Metric breakdown */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#6E4B72" }}>Score breakdown</p>
        {metrics.map(m => (
          <div key={m.label} className="rounded-2xl p-4 flex items-center gap-4 border" style={{ background: "white", borderColor: "#e8e0ea" }}>
            <div className="relative w-12 h-12 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#f0e8f0" strokeWidth="4" />
                <circle
                  cx="18" cy="18" r="14" fill="none"
                  stroke={getColor(m.value, (m as any).inverted)}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 14 * getRingPct(m.value, (m as any).inverted) / 100} ${2 * Math.PI * 14}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-base">{m.icon}</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{m.label}</p>
              <p className="text-xs" style={{ color: "#888" }}>{m.desc}</p>
            </div>
            <span className="text-base font-bold" style={{ color: getColor(m.value, (m as any).inverted) }}>
              {(m as any).inverted ? `${m.value}%` : `${m.value}%`}
            </span>
          </div>
        ))}
      </div>

      {/* Comparison context */}
      <div className="rounded-2xl p-4 border" style={{ background: "#6E4B7208", borderColor: "#d4b8d6" }}>
        <p className="text-sm font-semibold mb-2" style={{ color: "#6E4B72" }}>How does this compare?</p>
        <div className="space-y-1.5">
          {[["Platform average score", "72"], ["Top artists", "90+"], ["Alwande Khoza", "94", true]].map(([label, val, highlight]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs" style={{ color: highlight ? "#6E4B72" : "#888", fontWeight: highlight ? 600 : 400 }}>{label}</span>
              <span className="text-xs font-bold" style={{ color: highlight ? "#6E4B72" : "#aaa" }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
