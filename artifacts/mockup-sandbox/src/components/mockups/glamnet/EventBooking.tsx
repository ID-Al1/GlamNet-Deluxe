import { useState } from "react";

const EVENTS = [
  { emoji: "💍", label: "Wedding", team: true },
  { emoji: "🎓", label: "Graduation", team: false },
  { emoji: "✈️", label: "Vacation", team: false },
  { emoji: "🎂", label: "Birthday", team: false },
  { emoji: "💼", label: "Job Interview", team: false },
  { emoji: "🎀", label: "Matric Dance", team: true },
  { emoji: "🎤", label: "Photoshoot", team: false },
  { emoji: "🌙", label: "Date Night", team: false },
];

const PLANS: Record<string, { service: string; artist: string; time: string; price: string; note?: string }[]> = {
  Wedding: [
    { service: "Bridal Makeup", artist: "Makeup Artist", time: "6:00 AM", price: "R1,800", note: "Trial recommended" },
    { service: "Bridal Hair", artist: "Hair Stylist", time: "7:30 AM", price: "R1,200" },
    { service: "Nail Art", artist: "Nail Technician", time: "5:00 PM (day before)", price: "R450" },
    { service: "Lash Extensions", artist: "Lash Artist", time: "3:00 PM (day before)", price: "R650" },
  ],
  "Matric Dance": [
    { service: "Glam Makeup", artist: "Makeup Artist", time: "2:00 PM", price: "R950" },
    { service: "Formal Updo", artist: "Hair Stylist", time: "3:30 PM", price: "R750" },
    { service: "Gel Nail Set", artist: "Nail Technician", time: "11:00 AM", price: "R380" },
    { service: "Lash Extensions", artist: "Lash Artist", time: "10:00 AM", price: "R550", note: "Book 2 days before" },
  ],
  Graduation: [
    { service: "Natural Glam Makeup", artist: "Makeup Artist", time: "8:00 AM", price: "R750" },
    { service: "Blowout & Style", artist: "Hair Stylist", time: "9:00 AM", price: "R500" },
  ],
  "Job Interview": [
    { service: "Clean & Polished Makeup", artist: "Makeup Artist", time: "7:30 AM", price: "R650" },
    { service: "Blowdry", artist: "Hair Stylist", time: "8:00 AM", price: "R380" },
  ],
};

function getPlan(event: string) {
  return PLANS[event] ?? [
    { service: "Glam Makeup", artist: "Makeup Artist", time: "Morning", price: "R750" },
    { service: "Hair Styling", artist: "Hair Stylist", time: "Morning", price: "R500" },
  ];
}

export function EventBooking() {
  const [step, setStep] = useState<"pick" | "plan">("pick");
  const [selectedEvent, setSelectedEvent] = useState<typeof EVENTS[0] | null>(null);

  if (step === "plan" && selectedEvent) {
    const plan = getPlan(selectedEvent.label);
    const total = plan.reduce((sum, s) => sum + parseInt(s.price.replace(/[^0-9]/g, "")), 0);
    const isTeam = selectedEvent.team;

    return (
      <div className="min-h-screen flex flex-col px-5 pt-10 pb-8 gap-5" style={{ background: "#F8F5F0" }}>
        <button onClick={() => setStep("pick")} className="flex items-center gap-1 text-sm" style={{ color: "#6E4B72" }}>
          ← Back
        </button>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-3xl">{selectedEvent.emoji}</span>
            <div>
              <h2 className="text-2xl font-bold" style={{ color: "#1a1a1a" }}>Your {selectedEvent.label} Plan</h2>
              <p className="text-sm" style={{ color: "#7a7a7a" }}>GlamNet's recommended beauty timeline</p>
            </div>
          </div>
        </div>

        {isTeam && (
          <div className="rounded-xl px-4 py-3 flex items-start gap-2" style={{ background: "#7BC6FF18", border: "1.5px solid #7BC6FF" }}>
            <span>✨</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#2a7ab5" }}>Team booking recommended</p>
              <p className="text-xs mt-0.5" style={{ color: "#555" }}>For a {selectedEvent.label}, we suggest booking a full glam team. GlamNet coordinates all artists for you.</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {plan.map((item, i) => (
            <div key={i} className="rounded-2xl p-4 border" style={{ background: "white", borderColor: "#e8e0ea" }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: "#6E4B72" }}>
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "#1a1a1a" }}>{item.service}</p>
                    <p className="text-xs" style={{ color: "#6E4B72" }}>{item.artist} · {item.time}</p>
                    {item.note && <p className="text-xs mt-0.5 italic" style={{ color: "#FF8A3D" }}>⚠ {item.note}</p>}
                  </div>
                </div>
                <span className="text-sm font-bold" style={{ color: "#1a1a1a" }}>{item.price}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-4 border" style={{ background: "#6E4B7208", borderColor: "#d4b8d6" }}>
          <div className="flex items-center justify-between">
            <span className="font-semibold" style={{ color: "#6E4B72" }}>Total estimate</span>
            <span className="text-2xl font-bold" style={{ color: "#6E4B72" }}>R{total.toLocaleString()}</span>
          </div>
          <p className="text-xs mt-1" style={{ color: "#aaa" }}>Final price depends on selected artists and add-ons</p>
        </div>

        <button
          className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg mt-auto"
          style={{ background: "linear-gradient(135deg, #6E4B72, #9b6ea0)" }}
        >
          Book Full Package
        </button>
        <button className="w-full text-center text-sm" style={{ color: "#6E4B72" }}>
          Book individually →
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-5 pt-10 pb-8 gap-6" style={{ background: "#F8F5F0" }}>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#FF8A3D" }}>Event Planning</p>
        <h1 className="text-2xl font-bold leading-tight" style={{ color: "#1a1a1a" }}>
          What are you<br />getting ready for?
        </h1>
        <p className="text-sm mt-1.5" style={{ color: "#7a7a7a" }}>GlamNet builds your complete beauty plan and books everything — no planning stress.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {EVENTS.map(event => (
          <button
            key={event.label}
            onClick={() => { setSelectedEvent(event); setStep("plan"); }}
            className="rounded-2xl p-4 text-left border transition-all active:scale-95"
            style={{ background: "white", borderColor: "#e8e0ea" }}
          >
            <div className="text-3xl mb-2">{event.emoji}</div>
            <p className="font-semibold text-sm" style={{ color: "#1a1a1a" }}>{event.label}</p>
            {event.team && (
              <p className="text-xs mt-0.5" style={{ color: "#7BC6FF" }}>Team plan ✦</p>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-4 border flex items-center gap-3" style={{ background: "white", borderColor: "#e8e0ea" }}>
        <span className="text-2xl">🎯</span>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>Something else?</p>
          <p className="text-xs" style={{ color: "#aaa" }}>Tell us what you need</p>
        </div>
        <span style={{ color: "#6E4B72" }}>→</span>
      </div>
    </div>
  );
}
