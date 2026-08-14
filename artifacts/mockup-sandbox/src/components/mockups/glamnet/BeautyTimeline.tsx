import { useState } from "react";

const services = [
  {
    id: 1,
    service: "Braids",
    lastDone: "June 17, 2026",
    dueIn: 3,
    cycleDays: 56,
    status: "due-soon",
    icon: "🪢",
    note: "Your braids typically last 8 weeks",
  },
  {
    id: 2,
    service: "Nail Refill",
    lastDone: "July 3, 2026",
    dueIn: -2,
    cycleDays: 21,
    status: "overdue",
    icon: "💅",
    note: "Acrylic fills recommended every 3 weeks",
  },
  {
    id: 3,
    service: "Lash Extensions",
    lastDone: "July 8, 2026",
    dueIn: 10,
    cycleDays: 21,
    status: "upcoming",
    icon: "👁️",
    note: "Infill keeps your lashes full and fresh",
  },
  {
    id: 4,
    service: "Colour Touch-Up",
    lastDone: "May 30, 2026",
    dueIn: 20,
    cycleDays: 45,
    status: "upcoming",
    icon: "🎨",
    note: "Roots recommended every 4–6 weeks",
  },
  {
    id: 5,
    service: "Brow Tint",
    lastDone: "June 28, 2026",
    dueIn: 18,
    cycleDays: 30,
    status: "upcoming",
    icon: "🌿",
    note: "Tint fades naturally over a month",
  },
];

function statusStyle(status: string) {
  if (status === "overdue") return { bg: "#fee2e2", text: "#b91c1c", badge: "Overdue", dot: "#ef4444" };
  if (status === "due-soon") return { bg: "#FFF7ED", text: "#c2410c", badge: "Due soon", dot: "#FF8A3D" };
  return { bg: "#f0f7ff", text: "#1d4ed8", badge: `In ${services.find(s => s.status === status)?.dueIn ?? "?"} days`, dot: "#7BC6FF" };
}

function ProgressBar({ dueIn, cycleDays }: { dueIn: number; cycleDays: number }) {
  const pct = Math.max(0, Math.min(100, ((cycleDays - dueIn) / cycleDays) * 100));
  const color = dueIn < 0 ? "#ef4444" : dueIn <= 5 ? "#FF8A3D" : "#6E4B72";
  return (
    <div className="h-1.5 rounded-full w-full" style={{ background: "#f0e8f0" }}>
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function BeautyTimeline() {
  const [selected, setSelected] = useState<number | null>(null);

  const overdue = services.filter(s => s.status === "overdue");
  const dueSoon = services.filter(s => s.status === "due-soon");
  const upcoming = services.filter(s => s.status === "upcoming");

  return (
    <div className="min-h-screen flex flex-col px-5 pt-10 pb-8 gap-5" style={{ background: "#F8F5F0" }}>
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#FF8A3D" }}>Smart Reminders</p>
        <h1 className="text-2xl font-bold" style={{ color: "#1a1a1a" }}>Your Beauty Timeline</h1>
        <p className="text-sm mt-0.5" style={{ color: "#7a7a7a" }}>GlamNet tracks your services so you're always ready.</p>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2">
        {overdue.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "#fee2e2", color: "#b91c1c" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#ef4444", display: "inline-block" }} />
            {overdue.length} Overdue
          </div>
        )}
        {dueSoon.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "#FFF7ED", color: "#c2410c" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#FF8A3D", display: "inline-block" }} />
            {dueSoon.length} Due soon
          </div>
        )}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "#f0f7ff", color: "#1d4ed8" }}>
          <span className="w-2 h-2 rounded-full" style={{ background: "#7BC6FF", display: "inline-block" }} />
          {upcoming.length} Upcoming
        </div>
      </div>

      {/* Service cards */}
      <div className="space-y-3">
        {services.map(s => {
          const st = s.status === "upcoming"
            ? { bg: "#f0f7ff", text: "#1d4ed8", badge: `In ${s.dueIn} days`, dot: "#7BC6FF" }
            : statusStyle(s.status);

          return (
            <div
              key={s.id}
              className="rounded-2xl p-4 border cursor-pointer transition-all"
              style={{
                background: "white",
                borderColor: selected === s.id ? "#6E4B72" : "#e8e0ea",
                boxShadow: selected === s.id ? "0 0 0 2px #6E4B7230" : "none",
              }}
              onClick={() => setSelected(selected === s.id ? null : s.id)}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: st.bg }}>
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm" style={{ color: "#1a1a1a" }}>{s.service}</p>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>
                      {st.badge}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "#888" }}>Last done: {s.lastDone}</p>
                </div>
              </div>

              <ProgressBar dueIn={s.dueIn} cycleDays={s.cycleDays} />

              {selected === s.id && (
                <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: "#f0e8f0" }}>
                  <p className="text-xs" style={{ color: "#555" }}>💡 {s.note}</p>
                  <button
                    className="w-full py-2.5 rounded-xl text-white text-sm font-semibold"
                    style={{ background: "linear-gradient(135deg, #6E4B72, #9b6ea0)" }}
                  >
                    Book {s.service} Now
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add service */}
      <button
        className="w-full py-3 rounded-2xl border-2 border-dashed text-sm font-medium"
        style={{ borderColor: "#d4b8d6", color: "#6E4B72", background: "transparent" }}
      >
        + Add a service to track
      </button>
    </div>
  );
}
