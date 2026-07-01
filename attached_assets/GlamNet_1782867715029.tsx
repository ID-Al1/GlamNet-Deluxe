import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════ */
const C = {
  bg: "#F7F2EC", bgAlt: "#EFE8DF", card: "#FFFFFF", border: "#E0D4C5",
  charcoal: "#1A1A1A", mid: "#4A4A4A", muted: "#8A8A8A",
  rose: "#B87C62", roseDark: "#96624C", roseLight: "#E8C8B5", rosePale: "#F5E8DE",
  success: "#4A7A59", successBg: "#EBF3EE",
  danger: "#A84040", dangerBg: "#F5EAEA",
  pending: "#9A7030", pendingBg: "#F5EDD8",
  amber: "#B07830", amberBg: "#FDF3E3",
  white: "#FFFFFF",
};
const F = {
  serif: "'Georgia', 'Times New Roman', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

/* ═══════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════ */
const ALL_SERVICES = ["All", "Makeup", "Hair", "Nails", "Lashes", "Brows", "Skincare"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const CERTS = ["CIDESCO Certificate", "SAAHSP Member", "ITEC Diploma", "City & Guilds", "SAQA NQ Level 3/4", "Guinot Certified", "Other"];
const PORT_TYPES = ["Bridal Look", "Full Glam", "Natural Glam", "Editorial", "Hair Style", "Nail Art", "Skincare Treatment", "Before & After"];

/* ═══════════════════════════════════════════
   SEED DATA
═══════════════════════════════════════════ */
const SEED_USERS = [
  { id: "demo_client", name: "Amara Osei", email: "client@glamnet.co.za", password: "demo1234", role: "client" },
  { id: "demo_artist", name: "Kefilwe Nkosi", email: "artist@glamnet.co.za", password: "demo1234", role: "artist", artistId: "demo_artist" },
  { id: "demo_brand", name: "Lumi Beauty SA", email: "brand@glamnet.co.za", password: "demo1234", role: "brand" },
];

const SEED_ARTISTS = [
  {
    id: "demo_artist", name: "Kefilwe Nkosi", specialty: "Makeup", location: "Johannesburg", area: "Sandton",
    bio: "SA-based makeup artist passionate about bridal and editorial looks. 5 years in the industry working with real brides and fashion clients.",
    rating: 4.5, reviewCount: 34, verified: false, verificationStatus: "none",
    emoji: "💄", accentColor: "#C4856A",
    services: [
      { id: "ds1", name: "Bridal Makeup", price: 1800, duration: 90 },
      { id: "ds2", name: "Natural Glam", price: 800, duration: 60 },
    ],
    availability: ["Mon", "Wed", "Fri", "Sat"],
    tags: ["Bridal", "Events"], portfolio: [], instagram: "", website: "",
  },
  {
    id: "a1", name: "Ayanda Dlamini", specialty: "Makeup", location: "Johannesburg", area: "Sandton",
    bio: "Editorial makeup artist with 8 years in the SA beauty industry. Worked with Vogue Africa and SA Fashion Week. Specialising in bridal and avant-garde looks.",
    rating: 4.9, reviewCount: 127, verified: true, verificationStatus: "verified",
    emoji: "💄", accentColor: "#C4856A",
    services: [
      { id: "s1", name: "Bridal Makeup", price: 2500, duration: 120 },
      { id: "s2", name: "Editorial Look", price: 1800, duration: 90 },
      { id: "s3", name: "Natural Glam", price: 950, duration: 60 },
      { id: "s4", name: "Full Glam", price: 1200, duration: 75 },
    ],
    availability: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    tags: ["Bridal", "Editorial", "Events"],
    portfolio: [
      { id: "p1", title: "Winter Bridal Look", description: "Dewy skin with warm bronze tones for a garden wedding in Joburg.", type: "Bridal Look", emoji: "👰" },
      { id: "p2", title: "SA Fashion Week Editorial", description: "High contrast monochrome look for an editorial spread.", type: "Editorial", emoji: "📸" },
    ],
    instagram: "@ayanda.glam", website: "ayandadlamini.co.za",
  },
  {
    id: "a2", name: "Nomvula Khumalo", specialty: "Hair", location: "Johannesburg", area: "Rosebank",
    bio: "Natural hair specialist and extension artist. Certified in keratin treatments and protective styling. Your crown deserves the best.",
    rating: 4.8, reviewCount: 203, verified: true, verificationStatus: "verified",
    emoji: "👸", accentColor: "#8A6A9A",
    services: [
      { id: "s1", name: "Full Sew-in", price: 1800, duration: 240 },
      { id: "s2", name: "Box Braids", price: 1500, duration: 300 },
      { id: "s3", name: "Wash & Style", price: 650, duration: 90 },
      { id: "s4", name: "Keratin Treatment", price: 2200, duration: 180 },
    ],
    availability: ["Tue", "Wed", "Thu", "Sat", "Sun"],
    tags: ["Natural Hair", "Extensions", "Protective Styles"],
    portfolio: [
      { id: "p1", title: "Knotless Braids", description: "Long knotless braids with curled ends on natural 4C hair.", type: "Hair Style", emoji: "✨" },
    ],
    instagram: "@nomvula.hair", website: "",
  },
  {
    id: "a3", name: "Lerato Mokoena", specialty: "Nails", location: "Johannesburg", area: "Fourways",
    bio: "Nail technician and nail artist creating custom designs. CIDESCO certified. Specialising in long-lasting gel systems and intricate nail art.",
    rating: 4.7, reviewCount: 89, verified: true, verificationStatus: "verified",
    emoji: "💅", accentColor: "#C48A8A",
    services: [
      { id: "s1", name: "Gel Manicure", price: 450, duration: 60 },
      { id: "s2", name: "Acrylic Set", price: 750, duration: 90 },
      { id: "s3", name: "Custom Nail Art", price: 950, duration: 120 },
      { id: "s4", name: "Gel Pedicure", price: 380, duration: 60 },
    ],
    availability: ["Mon", "Wed", "Fri", "Sat"],
    tags: ["Nail Art", "Gel", "Acrylics"], portfolio: [], instagram: "@lerato.nails", website: "",
  },
  {
    id: "a4", name: "Zinhle Ndaba", specialty: "Lashes", location: "Durban", area: "Umhlanga",
    bio: "Lash technician with expertise in Russian volume, classic, and hybrid sets. Trained internationally. My clients wake up flawless.",
    rating: 5.0, reviewCount: 54, verified: true, verificationStatus: "verified",
    emoji: "👁️", accentColor: "#6A8AB8",
    services: [
      { id: "s1", name: "Classic Lash Set", price: 650, duration: 90 },
      { id: "s2", name: "Russian Volume", price: 950, duration: 120 },
      { id: "s3", name: "Hybrid Set", price: 800, duration: 110 },
      { id: "s4", name: "Lash Removal", price: 200, duration: 30 },
    ],
    availability: ["Mon", "Tue", "Thu", "Fri", "Sat"],
    tags: ["Volume Lashes", "Classic", "Hybrid"], portfolio: [], instagram: "@zinhle.lashes", website: "",
  },
  {
    id: "a5", name: "Precious Sithole", specialty: "Skincare", location: "Cape Town", area: "Sea Point",
    bio: "Aesthetician and skin therapist specialising in melanin-rich skin, hyperpigmentation, and holistic skin wellness. SAAHSP member.",
    rating: 4.9, reviewCount: 176, verified: false, verificationStatus: "pending",
    emoji: "🌿", accentColor: "#6A9A7A",
    services: [
      { id: "s1", name: "Deep Cleanse Facial", price: 750, duration: 75 },
      { id: "s2", name: "Chemical Peel", price: 1100, duration: 60 },
      { id: "s3", name: "Microdermabrasion", price: 950, duration: 60 },
      { id: "s4", name: "Skin Consultation", price: 350, duration: 45 },
    ],
    availability: ["Tue", "Wed", "Thu", "Fri"],
    tags: ["Melanin Skin", "Facials", "Peels"], portfolio: [], instagram: "@precious.skin", website: "",
  },
  {
    id: "a6", name: "Thandeka Mthembu", specialty: "Brows", location: "Pretoria", area: "Pretoria East",
    bio: "Brow architect specialising in microblading, ombre brows, and brow lamination. Changing faces, one brow at a time.",
    rating: 4.8, reviewCount: 112, verified: true, verificationStatus: "verified",
    emoji: "✏️", accentColor: "#9A8A6A",
    services: [
      { id: "s1", name: "Microblading", price: 2800, duration: 120 },
      { id: "s2", name: "Ombre Brows", price: 2500, duration: 120 },
      { id: "s3", name: "Brow Lamination", price: 750, duration: 60 },
      { id: "s4", name: "Tint & Shape", price: 380, duration: 45 },
    ],
    availability: ["Mon", "Wed", "Fri", "Sat"],
    tags: ["Microblading", "Ombre", "Lamination"], portfolio: [], instagram: "@thandeka.brows", website: "",
  },
  {
    id: "a7", name: "Sibongile Radebe", specialty: "Hair", location: "Johannesburg", area: "Bryanston",
    bio: "Hair colourist and stylist trained in London and Joburg. Balayage, colour correction, and creative colour are my speciality.",
    rating: 4.6, reviewCount: 91, verified: false, verificationStatus: "none",
    emoji: "🎨", accentColor: "#B87A9A",
    services: [
      { id: "s1", name: "Balayage", price: 2200, duration: 180 },
      { id: "s2", name: "Full Colour", price: 1500, duration: 120 },
      { id: "s3", name: "Colour Correction", price: 3500, duration: 300 },
      { id: "s4", name: "Blowout & Style", price: 550, duration: 60 },
    ],
    availability: ["Mon", "Tue", "Thu", "Sat", "Sun"],
    tags: ["Colour", "Balayage", "Highlights"], portfolio: [], instagram: "", website: "",
  },
  {
    id: "a8", name: "Amahle Zungu", specialty: "Makeup", location: "Pretoria", area: "Centurion",
    bio: "Makeup artist serving Pretoria and surrounds. Specialising in matric farewell, bridal parties, and events. Glamour for every occasion.",
    rating: 4.7, reviewCount: 68, verified: false, verificationStatus: "none",
    emoji: "✨", accentColor: "#C4A06A",
    services: [
      { id: "s1", name: "Matric Farewell", price: 800, duration: 75 },
      { id: "s2", name: "Event Makeup", price: 700, duration: 60 },
      { id: "s3", name: "Bridal Party (pp)", price: 950, duration: 75 },
      { id: "s4", name: "Everyday Glam", price: 550, duration: 45 },
    ],
    availability: ["Wed", "Thu", "Fri", "Sat", "Sun"],
    tags: ["Events", "Bridal", "Matric"], portfolio: [], instagram: "", website: "",
  },
];

const SEED_CAMPAIGNS = [
  {
    id: "c1", brandId: "brand_sorbet", brandName: "Sorbet Group",
    title: "Summer Nail Campaign 2025",
    brief: "Looking for verified nail technicians in Johannesburg and Cape Town for our summer campaign. Must have 50+ reviews.",
    budget: "R5,000 - R15,000", deadline: "2025-08-15", specialty: "Nails",
    applicantIds: [], applicantCount: 12,
  },
  {
    id: "c2", brandId: "brand_foschini", brandName: "Foschini Beauty",
    title: "Natural Hair Content Series",
    brief: "Seeking natural hair artists for a 3-part video content series. Must be based in Joburg or Cape Town.",
    budget: "R8,000 - R20,000", deadline: "2025-08-30", specialty: "Hair",
    applicantIds: [], applicantCount: 7,
  },
  {
    id: "c3", brandId: "brand_clicks", brandName: "Clicks",
    title: "Melanin Skincare Awareness",
    brief: "Certified skin therapists needed for a melanin-skin focused campaign. SAAHSP membership preferred.",
    budget: "R10,000 - R25,000", deadline: "2025-09-10", specialty: "Skincare",
    applicantIds: [], applicantCount: 19,
  },
];

/* ═══════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════ */
const ls = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
const R = (n) => `R${Number(n).toLocaleString("en-ZA")}`;

const calcStrength = (artist) => {
  if (!artist) return { score: 0, tips: [] };
  let score = 10;
  const tips = [];

  const hasBio = artist.bio && artist.bio.length > 40 && !artist.bio.startsWith("Tell clients");
  if (hasBio) score += 20;
  else tips.push({ key: "bio", icon: "✍️", title: "Write your bio", sub: "Clients book artists they feel they know" });

  const svcCount = artist.services?.length || 0;
  if (svcCount >= 3) score += 20;
  else if (svcCount >= 1) { score += 10; tips.push({ key: "services", icon: "💼", title: `Add more services (you have ${svcCount})`, sub: "Aim for 3+ to show your range" }); }
  else tips.push({ key: "services", icon: "💼", title: "Add your services and pricing", sub: "Clients can't book without this" });

  const dayCount = artist.availability?.length || 0;
  if (dayCount >= 3) score += 10;
  else tips.push({ key: "availability", icon: "📅", title: "Set your working days", sub: "So clients know when to book you" });

  if (artist.instagram || artist.website) score += 10;
  else tips.push({ key: "social", icon: "📸", title: "Add your Instagram or website", sub: "Your best portfolio is already on social" });

  const portCount = artist.portfolio?.length || 0;
  if (portCount >= 2) score += 15;
  else if (portCount === 1) { score += 7; tips.push({ key: "portfolio", icon: "🖼️", title: "Add more portfolio work (you have 1)", sub: "2+ items builds trust faster" }); }
  else tips.push({ key: "portfolio", icon: "🖼️", title: "Add portfolio items", sub: "Show clients what you can do" });

  if (artist.verified) score += 15;
  else if (artist.verificationStatus === "pending") { score += 5; }
  else tips.push({ key: "verify", icon: "✅", title: "Get verified", sub: "Verified artists get 3x more bookings" });

  return { score: Math.min(score, 100), tips };
};

/* ═══════════════════════════════════════════
   COMPONENTS
═══════════════════════════════════════════ */

function Toast({ msg, type }) {
  return (
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: type === "error" ? C.danger : C.success, color: C.white, padding: "11px 22px", borderRadius: 24, fontFamily: F.sans, fontSize: 14, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>
      {msg}
    </div>
  );
}

function Badge({ label, color = C.rose, bg = C.rosePale }) {
  return <span style={{ display: "inline-block", fontSize: 10, fontFamily: F.sans, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color, background: bg, padding: "3px 9px", borderRadius: 20 }}>{label}</span>;
}

function Btn({ children, onClick, variant = "primary", small, disabled, fullWidth, style: extStyle = {} }) {
  const v = {
    primary: { background: C.rose, color: C.white, border: "none" },
    secondary: { background: "transparent", color: C.rose, border: `1.5px solid ${C.rose}` },
    ghost: { background: "transparent", color: C.mid, border: `1.5px solid ${C.border}` },
    danger: { background: C.danger, color: C.white, border: "none" },
    success: { background: C.success, color: C.white, border: "none" },
    amber: { background: C.amber, color: C.white, border: "none" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...v[variant], padding: small ? "8px 16px" : "13px 24px", borderRadius: 8, fontFamily: F.sans, fontSize: small ? 13 : 15, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, width: fullWidth ? "100%" : "auto", boxSizing: "border-box", transition: "opacity 0.15s", ...extStyle }}>
      {children}
    </button>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "", rows, hint }) {
  const base = { width: "100%", boxSizing: "border-box", padding: "12px 14px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 15, color: C.charcoal, background: C.white, outline: "none" };
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontFamily: F.sans, fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</label>}
      {rows ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...base, resize: "vertical" }} /> : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} />}
      {hint && <div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Dropdown({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontFamily: F.sans, fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 15, color: C.charcoal, background: C.white, outline: "none" }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Card({ children, onClick, style: extStyle = {} }) {
  return <div onClick={onClick} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 18, cursor: onClick ? "pointer" : "default", ...extStyle }}>{children}</div>;
}

function InfoRow({ label, value, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontFamily: F.sans, fontSize: 13, color: C.muted }}>{label}</span>
      <span style={{ fontFamily: F.sans, fontSize: 14, fontWeight: bold ? 700 : 500, color: C.charcoal }}>{value}</span>
    </div>
  );
}

function StatusPill({ status }) {
  const map = { pending: ["Pending", C.pending, C.pendingBg], confirmed: ["Confirmed", C.success, C.successBg], declined: ["Declined", C.danger, C.dangerBg], completed: ["Completed", C.muted, C.bgAlt] };
  const [label, color, bg] = map[status] || map.pending;
  return <Badge label={label} color={color} bg={bg} />;
}

function VerifyBadge({ status }) {
  if (status === "verified") return <Badge label="✓ Verified" color={C.success} bg={C.successBg} />;
  if (status === "pending") return <Badge label="Under Review" color={C.amber} bg={C.amberBg} />;
  return null;
}

function ProgressBar({ value }) {
  const color = value >= 80 ? C.success : value >= 50 ? C.rose : C.amber;
  return (
    <div style={{ background: C.border, borderRadius: 6, height: 10, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.5s ease" }} />
    </div>
  );
}

function TipCard({ icon, title, sub, done, onAction, actionLabel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: done ? C.successBg : C.card, border: `1px solid ${done ? C.success + "44" : C.border}`, borderRadius: 10, marginBottom: 8 }}>
      <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{done ? "✅" : icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: done ? C.success : C.charcoal }}>{title}</div>
        {sub && !done && <div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      {!done && onAction && <Btn small variant="secondary" onClick={onAction}>{actionLabel || "Fix"}</Btn>}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ flex: 1, background: C.card, borderRadius: 10, border: `1px solid ${accent ? C.rose : C.border}`, padding: "14px 10px", textAlign: "center" }}>
      <div style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: accent ? C.rose : C.charcoal }}>{value}</div>
      <div style={{ fontFamily: F.sans, fontSize: 11, color: C.muted, marginTop: 3, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function TopBar({ title, subtitle, onBack, right }) {
  return (
    <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "14px 20px", position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: C.charcoal, padding: 0 }}>←</button>}
        <div>
          <div style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 700, color: C.charcoal }}>{title}</div>
          {subtitle && <div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

function Nav({ tabs, active, onChange }) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "8px 0 14px", zIndex: 100 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 10px", color: active === t.id ? C.rose : C.muted }}>
          <span style={{ fontSize: 20 }}>{t.icon}</span>
          <span style={{ fontFamily: F.sans, fontSize: 11, fontWeight: active === t.id ? 700 : 400 }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function FilterChips({ options, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 20px", scrollbarWidth: "none" }}>
      {options.map(o => (
        <div key={o} onClick={() => onChange(o)} style={{ whiteSpace: "nowrap", padding: "7px 16px", borderRadius: 20, cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 600, background: active === o ? C.rose : C.card, color: active === o ? C.white : C.mid, border: `1.5px solid ${active === o ? C.rose : C.border}` }}>
          {o}
        </div>
      ))}
    </div>
  );
}

function SubTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.card, padding: "0 20px", position: "sticky", top: 57, zIndex: 40 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{ padding: "12px 14px", background: "none", border: "none", borderBottom: active === t.id ? `2px solid ${C.rose}` : "2px solid transparent", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: active === t.id ? 700 : 400, color: active === t.id ? C.rose : C.muted, marginBottom: -1 }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   VERIFICATION WIZARD
═══════════════════════════════════════════ */
function VerificationWizard({ artist, onClose, onApprove, onSubmit }) {
  const [step, setStep] = useState(1);
  const [idNumber, setIdNumber] = useState("");
  const [idConfirm, setIdConfirm] = useState(false);
  const [certs, setCerts] = useState([]);
  const [instagram, setInstagram] = useState(artist?.instagram || "");
  const [website, setWebsite] = useState(artist?.website || "");
  const [agreed, setAgreed] = useState(false);

  const toggleCert = (c) => setCerts(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const isPending = artist?.verificationStatus === "pending";

  if (isPending) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: C.bg, borderRadius: "20px 20px 0 0", padding: "28px 20px 48px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
          <div style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.charcoal }}>Under Review</div>
          <div style={{ fontFamily: F.sans, fontSize: 15, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>Your verification is being reviewed. We'll notify you within 2-3 business days.</div>
        </div>
        <div style={{ background: C.amberBg, border: `1px solid ${C.amber}44`, borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.amber, fontWeight: 600 }}>What happens next?</div>
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.mid, marginTop: 6, lineHeight: 1.6 }}>Our team reviews your ID and qualifications. If approved, you get the blue verified badge and appear higher in search results.</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <Btn fullWidth variant="success" onClick={() => { onApprove(); onClose(); }}>Demo: Approve My Verification</Btn>
        </div>
        <Btn fullWidth variant="ghost" onClick={onClose}>Close</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: C.bg, borderRadius: "20px 20px 0 0", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 700, color: C.charcoal }}>Get Verified</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: C.muted }}>×</button>
        </div>

        <div style={{ padding: "12px 20px 4px" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4].map(n => <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= step ? C.rose : C.border }} />)}
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 6 }}>Step {step} of 4</div>
        </div>

        <div style={{ padding: "16px 20px 40px" }}>
          {step === 1 && (
            <div>
              <div style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 700, color: C.charcoal, marginBottom: 6 }}>Identity Verification</div>
              <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>We verify your identity to protect our clients. Your ID number is encrypted and never shown publicly.</div>
              <Field label="SA ID Number" value={idNumber} onChange={setIdNumber} placeholder="000000 0000 000" hint="13-digit South African ID number" />
              <div onClick={() => setIdConfirm(c => !c)} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginTop: 4, marginBottom: 24 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${idConfirm ? C.rose : C.border}`, background: idConfirm ? C.rose : C.white, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  {idConfirm && <span style={{ color: C.white, fontSize: 12 }}>✓</span>}
                </div>
                <span style={{ fontFamily: F.sans, fontSize: 14, color: C.mid, lineHeight: 1.5 }}>I confirm this is my real identity and I agree to GlamNet's verification terms</span>
              </div>
              <Btn fullWidth disabled={!idNumber || !idConfirm} onClick={() => setStep(2)}>Continue</Btn>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 700, color: C.charcoal, marginBottom: 6 }}>Your Qualifications</div>
              <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>Select all the qualifications you hold. You'll be asked to upload proof after this step.</div>
              {CERTS.map(c => (
                <div key={c} onClick={() => toggleCert(c)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", border: `1.5px solid ${certs.includes(c) ? C.rose : C.border}`, borderRadius: 10, marginBottom: 8, cursor: "pointer", background: certs.includes(c) ? C.rosePale : C.card }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${certs.includes(c) ? C.rose : C.border}`, background: certs.includes(c) ? C.rose : C.white, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {certs.includes(c) && <span style={{ color: C.white, fontSize: 12 }}>✓</span>}
                  </div>
                  <span style={{ fontFamily: F.sans, fontSize: 14, fontWeight: certs.includes(c) ? 600 : 400, color: certs.includes(c) ? C.rose : C.charcoal }}>{c}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <Btn variant="ghost" onClick={() => setStep(1)}>Back</Btn>
                <Btn style={{ flex: 1 }} onClick={() => setStep(3)}>Continue</Btn>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 700, color: C.charcoal, marginBottom: 6 }}>Online Presence</div>
              <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>An active online presence helps us verify you faster and shows clients your work.</div>
              <Field label="Instagram Handle" value={instagram} onChange={setInstagram} placeholder="@yourname" />
              <Field label="Website / Portfolio" value={website} onChange={setWebsite} placeholder="https://yoursite.co.za" />
              <div style={{ padding: 14, background: C.rosePale, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.roseDark, marginBottom: 20 }}>
                These will also be added to your public profile to help clients find you.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Btn variant="ghost" onClick={() => setStep(2)}>Back</Btn>
                <Btn style={{ flex: 1 }} onClick={() => setStep(4)}>Continue</Btn>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 700, color: C.charcoal, marginBottom: 6 }}>Review & Submit</div>
              <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>We'll review your submission within 2-3 business days. You'll be notified by email.</div>
              <Card style={{ marginBottom: 16, background: C.bgAlt }}>
                <InfoRow label="ID Verified" value="✓ Confirmed" />
                <InfoRow label="Qualifications" value={certs.length > 0 ? `${certs.length} selected` : "None selected"} />
                <InfoRow label="Instagram" value={instagram || "Not added"} />
                <InfoRow label="Website" value={website || "Not added"} />
              </Card>
              <div onClick={() => setAgreed(a => !a)} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 24 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${agreed ? C.rose : C.border}`, background: agreed ? C.rose : C.white, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                  {agreed && <span style={{ color: C.white, fontSize: 12 }}>✓</span>}
                </div>
                <span style={{ fontFamily: F.sans, fontSize: 14, color: C.mid, lineHeight: 1.5 }}>I confirm all information submitted is accurate and true to the best of my knowledge</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Btn variant="ghost" onClick={() => setStep(3)}>Back</Btn>
                <Btn style={{ flex: 1 }} disabled={!agreed} onClick={() => { onSubmit({ instagram, website, certs }); onClose(); }}>Submit for Review</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════ */
export default function GlamNet() {
  // Core state
  const [users, setUsers] = useState(() => ls.get("gn_users", SEED_USERS));
  const [role, setRole] = useState(() => ls.get("gn_role", null));
  const [user, setUser] = useState(() => ls.get("gn_user", null));
  const [artists, setArtists] = useState(() => ls.get("gn_artists", SEED_ARTISTS));
  const [bookings, setBookings] = useState(() => ls.get("gn_bookings", []));
  const [campaigns, setCampaigns] = useState(() => ls.get("gn_campaigns", SEED_CAMPAIGNS));

  // Navigation
  const [screen, setScreen] = useState(() => ls.get("gn_user", null) ? "app" : "splash");
  const [clientTab, setClientTab] = useState("discover");
  const [artistTab, setArtistTab] = useState("dashboard");
  const [profileSubTab, setProfileSubTab] = useState("overview");
  const [brandTab, setBrandTab] = useState("discover");

  // UI
  const [toast, setToast] = useState(null);
  const [filterService, setFilterService] = useState("All");
  const [searchQ, setSearchQ] = useState("");
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [showVerify, setShowVerify] = useState(false);

  // Auth
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authConfirm, setAuthConfirm] = useState("");

  // Booking
  const [showBook, setShowBook] = useState(false);
  const [bookStep, setBookStep] = useState(1);
  const [selService, setSelService] = useState(null);
  const [selDay, setSelDay] = useState(null);
  const [selTime, setSelTime] = useState(null);
  const [bookNote, setBookNote] = useState("");

  // Artist edit
  const [editMode, setEditMode] = useState(false);
  const [eBio, setEBio] = useState("");
  const [eSpec, setESpec] = useState("Makeup");
  const [eLoc, setELoc] = useState("Johannesburg");
  const [eArea, setEArea] = useState("");
  const [eInstagram, setEInstagram] = useState("");
  const [eWebsite, setEWebsite] = useState("");
  const [eSvcName, setESvcName] = useState("");
  const [eSvcPrice, setESvcPrice] = useState("");
  const [eSvcDur, setESvcDur] = useState("");

  // Portfolio
  const [portTitle, setPortTitle] = useState("");
  const [portDesc, setPortDesc] = useState("");
  const [portType, setPortType] = useState("Bridal Look");

  // Brand campaign
  const [showCampForm, setShowCampForm] = useState(false);
  const [cTitle, setCTitle] = useState("");
  const [cBrief, setCBrief] = useState("");
  const [cBudget, setCBudget] = useState("");
  const [cSpec, setCSpec] = useState("Hair");
  const [cDeadline, setCDeadline] = useState("");

  // Persist
  useEffect(() => { ls.set("gn_users", users); }, [users]);
  useEffect(() => { ls.set("gn_role", role); }, [role]);
  useEffect(() => { ls.set("gn_user", user); }, [user]);
  useEffect(() => { ls.set("gn_artists", artists); }, [artists]);
  useEffect(() => { ls.set("gn_bookings", bookings); }, [bookings]);
  useEffect(() => { ls.set("gn_campaigns", campaigns); }, [campaigns]);

  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  // Set demo email hint based on role
  useEffect(() => {
    const hints = { client: "client@glamnet.co.za", artist: "artist@glamnet.co.za", brand: "brand@glamnet.co.za" };
    if (role && hints[role]) setAuthEmail(hints[role]);
    setAuthPass("demo1234");
  }, [role, screen]);

  /* ─── AUTH ─────────────────────────────────── */
  const doAuth = () => {
    if (!authEmail || !authPass) return notify("Fill all fields", "error");
    if (authMode === "signup") {
      if (!authName) return notify("Enter your full name", "error");
      if (authPass.length < 6) return notify("Password must be at least 6 characters", "error");
      if (authPass !== authConfirm) return notify("Passwords don't match", "error");
      if (users.find(u => u.email === authEmail)) return notify("That email is already registered", "error");
      const newUser = { id: `u_${Date.now()}`, name: authName, email: authEmail, password: authPass, role };
      if (role === "artist") {
        const artistProfile = {
          id: newUser.id, name: newUser.name, specialty: "Makeup", location: "Johannesburg", area: "",
          bio: "", rating: 0, reviewCount: 0, verified: false, verificationStatus: "none",
          emoji: "✨", accentColor: C.rose,
          services: [], availability: ["Mon", "Tue", "Wed", "Thu", "Fri"],
          tags: [], portfolio: [], instagram: "", website: "",
        };
        setArtists(prev => [...prev, artistProfile]);
        newUser.artistId = newUser.id;
      }
      setUsers(prev => [...prev, newUser]);
      setUser({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, artistId: newUser.artistId });
      setScreen("app");
      notify(`Welcome, ${newUser.name}!`);
    } else {
      const found = users.find(u => u.email === authEmail && u.password === authPass && u.role === role);
      if (!found) return notify("Incorrect email or password", "error");
      setUser({ id: found.id, name: found.name, email: found.email, role: found.role, artistId: found.artistId });
      setScreen("app");
      notify(`Welcome back, ${found.name}!`);
    }
  };

  const doLogout = () => {
    ls.del("gn_role"); ls.del("gn_user");
    setRole(null); setUser(null); setScreen("splash");
    setSelectedArtist(null); setShowBook(false);
    notify("Logged out");
  };

  /* ─── BOOKINGS ─────────────────────────────── */
  const confirmBooking = () => {
    if (!selService || !selDay || !selTime) return notify("Select all details", "error");
    const b = { id: `b_${Date.now()}`, clientId: user.id, clientName: user.name, artistId: selectedArtist.id, artistName: selectedArtist.name, artistEmoji: selectedArtist.emoji, service: selService, day: selDay, time: selTime, note: bookNote, status: "pending", createdAt: new Date().toISOString() };
    setBookings(prev => [...prev, b]);
    setShowBook(false); setSelectedArtist(null);
    setBookStep(1); setSelService(null); setSelDay(null); setSelTime(null); setBookNote("");
    setClientTab("bookings");
    notify("Booking request sent!");
  };

  const updateBooking = (id, status) => { setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b)); notify(status === "confirmed" ? "Booking confirmed!" : "Booking declined"); };

  /* ─── ARTIST HELPERS ───────────────────────── */
  const myArtist = user?.artistId ? artists.find(a => a.id === user.artistId) : null;

  const saveProfile = () => {
    setArtists(prev => prev.map(a => a.id !== user?.artistId ? a : { ...a, bio: eBio, specialty: eSpec, location: eLoc, area: eArea, instagram: eInstagram, website: eWebsite }));
    setEditMode(false);
    notify("Profile saved!");
  };

  const addService = () => {
    if (!eSvcName || !eSvcPrice) return notify("Fill name and price", "error");
    setArtists(prev => prev.map(a => a.id !== user?.artistId ? a : { ...a, services: [...a.services, { id: `s_${Date.now()}`, name: eSvcName, price: Number(eSvcPrice), duration: Number(eSvcDur) || 60 }] }));
    setESvcName(""); setESvcPrice(""); setESvcDur("");
    notify("Service added!");
  };

  const removeService = (id) => setArtists(prev => prev.map(a => a.id !== user?.artistId ? a : { ...a, services: a.services.filter(s => s.id !== id) }));

  const toggleDay = (day) => setArtists(prev => prev.map(a => a.id !== user?.artistId ? a : { ...a, availability: a.availability.includes(day) ? a.availability.filter(d => d !== day) : [...a.availability, day] }));

  const addPortfolio = () => {
    if (!portTitle) return notify("Add a title", "error");
    const EMOJIS = { "Bridal Look": "👰", "Full Glam": "💄", "Natural Glam": "🌸", "Editorial": "📸", "Hair Style": "✨", "Nail Art": "💅", "Skincare Treatment": "🌿", "Before & After": "🔄" };
    setArtists(prev => prev.map(a => a.id !== user?.artistId ? a : { ...a, portfolio: [...(a.portfolio || []), { id: `p_${Date.now()}`, title: portTitle, description: portDesc, type: portType, emoji: EMOJIS[portType] || "✨" }] }));
    setPortTitle(""); setPortDesc(""); setPortType("Bridal Look");
    notify("Portfolio item added!");
  };

  const removePortfolio = (id) => setArtists(prev => prev.map(a => a.id !== user?.artistId ? a : { ...a, portfolio: a.portfolio.filter(p => p.id !== id) }));

  const submitVerification = ({ instagram: ig, website: ws }) => {
    setArtists(prev => prev.map(a => a.id !== user?.artistId ? a : { ...a, verificationStatus: "pending", instagram: ig || a.instagram, website: ws || a.website }));
    notify("Submitted for verification!");
  };

  const approveVerification = () => {
    setArtists(prev => prev.map(a => a.id !== user?.artistId ? a : { ...a, verified: true, verificationStatus: "verified" }));
    notify("You're now verified!");
  };

  /* ─── CAMPAIGNS ────────────────────────────── */
  const applyToCampaign = (cid) => {
    setCampaigns(prev => prev.map(c => c.id !== cid || c.applicantIds.includes(user.id) ? c : { ...c, applicantIds: [...c.applicantIds, user.id], applicantCount: c.applicantCount + 1 }));
    notify("Application submitted!");
  };

  const postCampaign = () => {
    if (!cTitle || !cBrief) return notify("Fill title and brief", "error");
    setCampaigns(prev => [...prev, { id: `c_${Date.now()}`, brandId: user.id, brandName: user.name, title: cTitle, brief: cBrief, budget: cBudget, specialty: cSpec, deadline: cDeadline, applicantIds: [], applicantCount: 0 }]);
    setCTitle(""); setCBrief(""); setCBudget(""); setCDeadline("");
    setShowCampForm(false); setBrandTab("campaigns");
    notify("Campaign posted!");
  };

  /* ─── DERIVED ──────────────────────────────── */
  const filteredArtists = artists.filter(a => {
    if (filterService !== "All" && a.specialty !== filterService) return false;
    if (searchQ && !a.name.toLowerCase().includes(searchQ.toLowerCase()) && !a.specialty.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });
  const clientBookings = bookings.filter(b => b.clientId === user?.id);
  const artistBookings = bookings.filter(b => b.artistId === user?.artistId);
  const pendingBookings = artistBookings.filter(b => b.status === "pending");
  const confirmedBookings = artistBookings.filter(b => b.status === "confirmed");
  const myEarnings = confirmedBookings.reduce((s, b) => s + (b.service?.price || 0), 0);
  const { score: profileScore, tips: profileTips } = calcStrength(myArtist);
  const myCampaigns = campaigns.filter(c => c.brandId === user?.id);

  /* ══════════════════════════════════════════════
     SPLASH
  ══════════════════════════════════════════════ */
  if (screen === "splash") return (
    <div style={{ minHeight: "100vh", background: C.charcoal, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {toast && <Toast {...toast} />}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontFamily: F.serif, fontSize: 13, letterSpacing: 6, color: C.rose, marginBottom: 16 }}>✦ ✦ ✦</div>
        <div style={{ fontFamily: F.serif, fontSize: 48, fontWeight: 700, color: C.white, letterSpacing: -1 }}>GlamNet</div>
        <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 8, letterSpacing: 3, textTransform: "uppercase" }}>Africa's Beauty Network</div>
      </div>
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontFamily: F.sans, fontSize: 11, color: "#555", textAlign: "center", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>I am a...</div>
        {[
          { id: "client", label: "Client", sub: "Book beauty services near you", emoji: "🪞" },
          { id: "artist", label: "Beauty Professional", sub: "Manage bookings and grow your brand", emoji: "💄" },
          { id: "brand", label: "Brand / Agency", sub: "Discover and partner with talent", emoji: "🏢" },
        ].map(r => (
          <div key={r.id} onClick={() => { setRole(r.id); setAuthMode("login"); setScreen("auth"); }}
            style={{ background: "#262626", border: "1px solid #333", borderRadius: 12, padding: "18px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.rose}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#333"}
          >
            <div style={{ fontSize: 26, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "#333", borderRadius: 10 }}>{r.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.serif, fontSize: 17, color: C.white, fontWeight: 600 }}>{r.label}</div>
              <div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 2 }}>{r.sub}</div>
            </div>
            <span style={{ color: "#555", fontSize: 18 }}>›</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 40, fontFamily: F.sans, fontSize: 11, color: "#3A3A3A", letterSpacing: 1 }}>Verified professionals · Real bookings · South Africa</div>
    </div>
  );

  /* ══════════════════════════════════════════════
     AUTH
  ══════════════════════════════════════════════ */
  if (screen === "auth") {
    const roleLabel = { client: "Client", artist: "Beauty Professional", brand: "Brand / Agency" }[role];
    const demoCreds = { client: "client@glamnet.co.za", artist: "artist@glamnet.co.za", brand: "brand@glamnet.co.za" };
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
        {toast && <Toast {...toast} />}
        <div style={{ padding: "22px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setScreen("splash")} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.charcoal }}>←</button>
          <div style={{ fontFamily: F.serif, fontSize: 22, color: C.charcoal }}>GlamNet</div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px", maxWidth: 400, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <div style={{ marginBottom: 24 }}>
            <Badge label={roleLabel} />
            <div style={{ fontFamily: F.serif, fontSize: 30, fontWeight: 700, color: C.charcoal, marginTop: 10 }}>{authMode === "login" ? "Welcome back" : "Create account"}</div>
            <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginTop: 6 }}>{authMode === "login" ? "Sign in to continue" : "Join Africa's beauty network"}</div>
          </div>
          {authMode === "signup" && <Field label="Full Name" value={authName} onChange={setAuthName} placeholder="Your full name" />}
          <Field label="Email" value={authEmail} onChange={setAuthEmail} type="email" placeholder="you@email.com" />
          <Field label="Password" value={authPass} onChange={setAuthPass} type="password" placeholder={authMode === "signup" ? "At least 6 characters" : "••••••••"} />
          {authMode === "signup" && <Field label="Confirm Password" value={authConfirm} onChange={setAuthConfirm} type="password" placeholder="Repeat your password" />}
          <Btn onClick={doAuth} fullWidth>{authMode === "login" ? "Sign In" : "Create Account"}</Btn>
          <div style={{ marginTop: 16, textAlign: "center", fontFamily: F.sans, fontSize: 14, color: C.muted }}>
            {authMode === "login" ? "No account? " : "Already registered? "}
            <span onClick={() => { setAuthMode(m => m === "login" ? "signup" : "login"); setAuthName(""); setAuthConfirm(""); }} style={{ color: C.rose, cursor: "pointer", fontWeight: 600 }}>
              {authMode === "login" ? "Sign up" : "Sign in"}
            </span>
          </div>
          {authMode === "login" && (
            <div style={{ marginTop: 14, padding: 13, background: C.rosePale, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.roseDark }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Demo credentials</div>
              <div>{demoCreds[role]} / demo1234</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════
     CLIENT APP
  ══════════════════════════════════════════════ */
  if (role === "client" && screen === "app") {
    if (selectedArtist && !showBook) return (
      <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 30 }}>
        {toast && <Toast {...toast} />}
        <div style={{ background: selectedArtist.accentColor || C.rose, padding: "36px 20px 56px" }}>
          <button onClick={() => setSelectedArtist(null)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 20, color: C.white, padding: "6px 14px", fontSize: 14, cursor: "pointer", marginBottom: 20 }}>← Back</button>
          <div style={{ fontSize: 54, marginBottom: 10 }}>{selectedArtist.emoji}</div>
          <div style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 700, color: C.white }}>{selectedArtist.name}</div>
          <div style={{ fontFamily: F.sans, fontSize: 14, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>{selectedArtist.specialty} · {selectedArtist.area}, {selectedArtist.location}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {selectedArtist.verified && <Badge label="✓ Verified" color={C.white} bg="rgba(255,255,255,0.2)" />}
            {selectedArtist.rating > 0 && <Badge label={`★ ${selectedArtist.rating} (${selectedArtist.reviewCount})`} color={C.white} bg="rgba(255,255,255,0.2)" />}
          </div>
        </div>
        <div style={{ padding: 20, marginTop: -30 }}>
          <Card style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>About</div>
            <div style={{ fontFamily: F.sans, fontSize: 15, color: C.mid, lineHeight: 1.65 }}>{selectedArtist.bio || "No bio added yet."}</div>
            {selectedArtist.instagram && <div style={{ fontFamily: F.sans, fontSize: 13, color: C.rose, marginTop: 10 }}>📸 {selectedArtist.instagram}</div>}
            {selectedArtist.website && <div style={{ fontFamily: F.sans, fontSize: 13, color: C.rose, marginTop: 4 }}>🌐 {selectedArtist.website}</div>}
            {(selectedArtist.tags || []).length > 0 && <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>{selectedArtist.tags.map(t => <Badge key={t} label={t} color={C.mid} bg={C.bgAlt} />)}</div>}
          </Card>

          {(selectedArtist.portfolio || []).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 700, color: C.charcoal, marginBottom: 12 }}>Portfolio</div>
              {selectedArtist.portfolio.map(p => (
                <Card key={p.id} style={{ marginBottom: 10, display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 32, width: 48, height: 48, background: C.bgAlt, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p.emoji}</div>
                  <div>
                    <div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 700, color: C.charcoal }}>{p.title}</div>
                    <div style={{ marginTop: 4 }}><Badge label={p.type} color={C.mid} bg={C.bgAlt} /></div>
                    {p.description && <div style={{ fontFamily: F.sans, fontSize: 13, color: C.mid, marginTop: 6, lineHeight: 1.5 }}>{p.description}</div>}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 700, color: C.charcoal, marginBottom: 12 }}>Services</div>
          {selectedArtist.services.length === 0 && <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, padding: "12px 0" }}>No services listed yet</div>}
          {selectedArtist.services.map(svc => (
            <Card key={svc.id} style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: F.sans, fontSize: 15, fontWeight: 600, color: C.charcoal }}>{svc.name}</div>
                <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 3 }}>{svc.duration} min</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <div style={{ fontFamily: F.serif, fontSize: 15, fontWeight: 700, color: C.rose }}>{R(svc.price)}</div>
                <Btn small onClick={() => { setSelService(svc); setShowBook(true); setBookStep(2); }}>Book</Btn>
              </div>
            </Card>
          ))}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 700, color: C.charcoal, marginBottom: 10 }}>Availability</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DAYS.map(d => <div key={d} style={{ padding: "6px 14px", borderRadius: 20, fontFamily: F.sans, fontSize: 13, fontWeight: 600, background: selectedArtist.availability?.includes(d) ? C.rosePale : C.bgAlt, color: selectedArtist.availability?.includes(d) ? C.rose : C.muted, border: `1px solid ${selectedArtist.availability?.includes(d) ? C.roseLight : C.border}` }}>{d}</div>)}
            </div>
          </div>
          <div style={{ marginTop: 24 }}><Btn fullWidth onClick={() => { setShowBook(true); setBookStep(1); }}>Book an Appointment</Btn></div>
        </div>
      </div>
    );

    if (showBook && selectedArtist) return (
      <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 30 }}>
        {toast && <Toast {...toast} />}
        <TopBar title="Book Appointment" subtitle={selectedArtist.name} onBack={() => { setShowBook(false); setBookStep(1); setSelService(null); }} />
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>{[1, 2, 3].map(n => <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= bookStep ? C.rose : C.border }} />)}</div>
          {bookStep === 1 && (
            <div>
              <div style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.charcoal, marginBottom: 4 }}>Select a Service</div>
              <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginBottom: 20 }}>Choose what you'd like done</div>
              {selectedArtist.services.map(svc => (
                <Card key={svc.id} onClick={() => setSelService(svc)} style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", border: selService?.id === svc.id ? `2px solid ${C.rose}` : `1px solid ${C.border}`, background: selService?.id === svc.id ? C.rosePale : C.card }}>
                  <div><div style={{ fontFamily: F.sans, fontSize: 15, fontWeight: 600, color: C.charcoal }}>{svc.name}</div><div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 3 }}>{svc.duration} min</div></div>
                  <div style={{ fontFamily: F.serif, fontSize: 15, fontWeight: 700, color: C.rose }}>{R(svc.price)}</div>
                </Card>
              ))}
              <div style={{ marginTop: 20 }}><Btn fullWidth disabled={!selService} onClick={() => setBookStep(2)}>Continue</Btn></div>
            </div>
          )}
          {bookStep === 2 && (
            <div>
              <div style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.charcoal, marginBottom: 4 }}>Date & Time</div>
              <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginBottom: 20 }}>Pick from the artist's available slots</div>
              <div style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Day</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                {DAYS.filter(d => selectedArtist.availability?.includes(d)).map(d => <div key={d} onClick={() => setSelDay(d)} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: F.sans, fontSize: 14, fontWeight: 600, background: selDay === d ? C.rose : C.card, color: selDay === d ? C.white : C.charcoal, border: `1.5px solid ${selDay === d ? C.rose : C.border}` }}>{d}</div>)}
              </div>
              <div style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Time</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                {TIMES.map(t => <div key={t} onClick={() => setSelTime(t)} style={{ padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: F.sans, fontSize: 14, fontWeight: 600, background: selTime === t ? C.rose : C.card, color: selTime === t ? C.white : C.charcoal, border: `1.5px solid ${selTime === t ? C.rose : C.border}` }}>{t}</div>)}
              </div>
              <Field label="Note to artist (optional)" value={bookNote} onChange={setBookNote} placeholder="Allergies, special requests..." rows={3} />
              <div style={{ display: "flex", gap: 10 }}><Btn variant="ghost" onClick={() => setBookStep(1)}>Back</Btn><Btn style={{ flex: 1 }} disabled={!selDay || !selTime} onClick={() => setBookStep(3)}>Review</Btn></div>
            </div>
          )}
          {bookStep === 3 && (
            <div>
              <div style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.charcoal, marginBottom: 4 }}>Confirm Booking</div>
              <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginBottom: 20 }}>Review your appointment details</div>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 38 }}>{selectedArtist.emoji}</div>
                  <div><div style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 700, color: C.charcoal }}>{selectedArtist.name}</div><div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted }}>{selectedArtist.area}, {selectedArtist.location}</div></div>
                </div>
                <InfoRow label="Service" value={selService?.name} />
                <InfoRow label="Price" value={R(selService?.price || 0)} bold />
                <InfoRow label="Duration" value={`${selService?.duration} min`} />
                <InfoRow label="Day" value={selDay} />
                <InfoRow label="Time" value={selTime} />
                {bookNote && <InfoRow label="Your note" value={bookNote} />}
              </Card>
              <div style={{ padding: 14, background: C.pendingBg, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.pending, marginBottom: 20 }}>Pending until the artist confirms your booking.</div>
              <div style={{ display: "flex", gap: 10 }}><Btn variant="ghost" onClick={() => setBookStep(2)}>Back</Btn><Btn style={{ flex: 1 }} onClick={confirmBooking}>Confirm Booking</Btn></div>
            </div>
          )}
        </div>
      </div>
    );

    return (
      <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 80 }}>
        {toast && <Toast {...toast} />}
        {clientTab === "discover" && (
          <div>
            <div style={{ background: C.charcoal, padding: "32px 20px 20px" }}>
              <div style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.white }}>Discover Artists</div>
              <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 4 }}>Verified beauty professionals across SA</div>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search by name or service..." style={{ marginTop: 14, width: "100%", boxSizing: "border-box", padding: "12px 16px", borderRadius: 8, border: "none", fontFamily: F.sans, fontSize: 15, color: C.charcoal, background: C.white, outline: "none" }} />
            </div>
            <FilterChips options={ALL_SERVICES} active={filterService} onChange={setFilterService} />
            <div style={{ padding: "0 20px" }}>
              {filteredArtists.length === 0 ? <div style={{ textAlign: "center", padding: 40, fontFamily: F.sans, color: C.muted }}>No artists found</div> : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {filteredArtists.map(a => (
                    <div key={a.id} onClick={() => setSelectedArtist(a)} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", cursor: "pointer" }}>
                      <div style={{ background: a.accentColor || C.rose, padding: "22px 0 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 38 }}>{a.emoji}</div>
                      </div>
                      <div style={{ padding: 12 }}>
                        <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.charcoal }}>{a.name}</div>
                        <div style={{ fontFamily: F.sans, fontSize: 11, color: C.muted, marginTop: 2 }}>{a.specialty} · {a.area}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                          {a.rating > 0 && <span style={{ fontFamily: F.sans, fontSize: 11, color: C.rose, fontWeight: 700 }}>★ {a.rating}</span>}
                          {a.verified && <span style={{ fontSize: 10, color: C.success, fontFamily: F.sans, fontWeight: 700 }}>✓ Verified</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {clientTab === "bookings" && (
          <div>
            <TopBar title="My Bookings" />
            <div style={{ padding: 20 }}>
              {clientBookings.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48 }}>
                  <div style={{ fontSize: 44, marginBottom: 12 }}>📅</div>
                  <div style={{ fontFamily: F.serif, fontSize: 18, color: C.charcoal }}>No bookings yet</div>
                  <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginTop: 6 }}>Browse artists and make your first booking</div>
                  <div style={{ marginTop: 20 }}><Btn onClick={() => setClientTab("discover")}>Discover Artists</Btn></div>
                </div>
              ) : [...clientBookings].reverse().map(b => (
                <Card key={b.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 28 }}>{b.artistEmoji}</div>
                    <div style={{ flex: 1 }}><div style={{ fontFamily: F.sans, fontSize: 15, fontWeight: 700, color: C.charcoal }}>{b.artistName}</div><div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 2 }}>{b.service.name} · {R(b.service.price)}</div></div>
                    <StatusPill status={b.status} />
                  </div>
                  <InfoRow label="Day" value={b.day} />
                  <InfoRow label="Time" value={b.time} />
                  {b.note && <InfoRow label="Note" value={b.note} />}
                </Card>
              ))}
            </div>
          </div>
        )}
        {clientTab === "profile" && (
          <div>
            <TopBar title="My Profile" />
            <div style={{ padding: 20 }}>
              <Card style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 70, height: 70, borderRadius: "50%", background: C.rose, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontFamily: F.serif, fontSize: 28, fontWeight: 700, color: C.white }}>{user?.name?.[0]?.toUpperCase()}</div>
                <div style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.charcoal }}>{user?.name}</div>
                <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginTop: 4 }}>{user?.email}</div>
                <div style={{ marginTop: 10 }}><Badge label="Client" /></div>
              </Card>
              <Card style={{ marginBottom: 16 }}>
                <InfoRow label="Total Bookings" value={clientBookings.length} />
                <InfoRow label="Confirmed" value={clientBookings.filter(b => b.status === "confirmed").length} />
                <InfoRow label="Pending" value={clientBookings.filter(b => b.status === "pending").length} />
              </Card>
              <Btn fullWidth variant="ghost" onClick={doLogout}>Log Out</Btn>
            </div>
          </div>
        )}
        <Nav tabs={[{ id: "discover", label: "Discover", icon: "🔍" }, { id: "bookings", label: "Bookings", icon: "📅" }, { id: "profile", label: "Profile", icon: "👤" }]} active={clientTab} onChange={setClientTab} />
      </div>
    );
  }

  /* ══════════════════════════════════════════════
     ARTIST APP
  ══════════════════════════════════════════════ */
  if (role === "artist" && screen === "app") return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 80 }}>
      {toast && <Toast {...toast} />}
      {showVerify && myArtist && (
        <VerificationWizard
          artist={myArtist}
          onClose={() => setShowVerify(false)}
          onSubmit={submitVerification}
          onApprove={approveVerification}
        />
      )}

      {/* DASHBOARD */}
      {artistTab === "dashboard" && (
        <div>
          <div style={{ background: C.charcoal, padding: "32px 20px 24px" }}>
            <div style={{ fontFamily: F.sans, fontSize: 11, color: C.muted, letterSpacing: 2, textTransform: "uppercase" }}>Welcome back</div>
            <div style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.white, marginTop: 4 }}>{user?.name}</div>
            {myArtist && myArtist.verificationStatus !== "verified" && (
              <div onClick={() => { setArtistTab("profile"); setProfileSubTab("verify"); }} style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,0.06)", borderRadius: 8, cursor: "pointer" }}>
                <div style={{ fontFamily: F.sans, fontSize: 13, color: myArtist.verificationStatus === "pending" ? "#FFCC80" : C.roseLight }}>
                  {myArtist.verificationStatus === "pending" ? "⏳ Verification under review" : "✨ Get verified to unlock more clients →"}
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              <Stat label="Earnings" value={R(myEarnings)} />
              <Stat label="Confirmed" value={confirmedBookings.length} />
              <Stat label="Pending" value={pendingBookings.length} accent={pendingBookings.length > 0} />
            </div>
            {pendingBookings.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 700, color: C.charcoal, marginBottom: 12 }}>New Requests ({pendingBookings.length})</div>
                {pendingBookings.map(b => (
                  <Card key={b.id} style={{ marginBottom: 10, borderLeft: `4px solid ${C.pending}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontFamily: F.sans, fontSize: 15, fontWeight: 700, color: C.charcoal }}>{b.clientName}</div>
                        <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 2 }}>{b.service.name} · {b.day} at {b.time}</div>
                        <div style={{ fontFamily: F.serif, fontSize: 14, fontWeight: 700, color: C.rose, marginTop: 4 }}>{R(b.service.price)}</div>
                        {b.note && <div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 4, fontStyle: "italic" }}>"{b.note}"</div>}
                      </div>
                      <StatusPill status="pending" />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn small variant="danger" onClick={() => updateBooking(b.id, "declined")}>Decline</Btn>
                      <Btn small style={{ flex: 1 }} variant="success" onClick={() => updateBooking(b.id, "confirmed")}>Accept</Btn>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {confirmedBookings.length > 0 && (
              <div>
                <div style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 700, color: C.charcoal, marginBottom: 12 }}>Upcoming</div>
                {confirmedBookings.map(b => (
                  <Card key={b.id} style={{ marginBottom: 10, borderLeft: `4px solid ${C.success}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontFamily: F.sans, fontSize: 15, fontWeight: 700, color: C.charcoal }}>{b.clientName}</div>
                        <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 2 }}>{b.service.name} · {b.day} at {b.time}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <StatusPill status="confirmed" />
                        <span style={{ fontFamily: F.serif, fontSize: 14, fontWeight: 700, color: C.rose }}>{R(b.service.price)}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {artistBookings.length === 0 && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📬</div>
                <div style={{ fontFamily: F.serif, fontSize: 16, color: C.charcoal }}>No bookings yet</div>
                <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 6 }}>Complete your profile to attract clients</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOOKINGS */}
      {artistTab === "bookings" && (
        <div>
          <TopBar title="All Bookings" />
          <div style={{ padding: 20 }}>
            {artistBookings.length === 0 ? <div style={{ textAlign: "center", padding: 48, fontFamily: F.sans, fontSize: 14, color: C.muted }}>No bookings yet</div> :
              [...artistBookings].reverse().map(b => (
                <Card key={b.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: b.status === "pending" ? 12 : 0 }}>
                    <div>
                      <div style={{ fontFamily: F.sans, fontSize: 15, fontWeight: 700, color: C.charcoal }}>{b.clientName}</div>
                      <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 2 }}>{b.service.name} · {b.day} at {b.time}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <StatusPill status={b.status} />
                      <span style={{ fontFamily: F.serif, fontSize: 14, fontWeight: 700, color: C.rose }}>{R(b.service.price)}</span>
                    </div>
                  </div>
                  {b.status === "pending" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn small variant="danger" onClick={() => updateBooking(b.id, "declined")}>Decline</Btn>
                      <Btn small style={{ flex: 1 }} variant="success" onClick={() => updateBooking(b.id, "confirmed")}>Accept</Btn>
                    </div>
                  )}
                </Card>
              ))
            }
          </div>
        </div>
      )}

      {/* CAMPAIGNS */}
      {artistTab === "campaigns" && (
        <div>
          <TopBar title="Brand Campaigns" subtitle="Apply to partner with brands" />
          <div style={{ padding: 20 }}>
            {campaigns.map(c => (
              <Card key={c.id} style={{ marginBottom: 14 }}>
                <Badge label={c.specialty} color={C.rose} bg={C.rosePale} />
                <div style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 700, color: C.charcoal, marginTop: 8 }}>{c.title}</div>
                <div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 2 }}>by {c.brandName}</div>
                <div style={{ fontFamily: F.sans, fontSize: 13, color: C.mid, lineHeight: 1.65, marginTop: 8, marginBottom: 12 }}>{c.brief}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  {c.budget && <Badge label={`💰 ${c.budget}`} color={C.mid} bg={C.bgAlt} />}
                  {c.deadline && <Badge label={`📅 ${c.deadline}`} color={C.mid} bg={C.bgAlt} />}
                  <Badge label={`👥 ${c.applicantCount + c.applicantIds.length} applied`} color={C.mid} bg={C.bgAlt} />
                </div>
                {!myArtist?.verified && <div style={{ padding: "10px 12px", background: C.amberBg, borderRadius: 8, fontFamily: F.sans, fontSize: 12, color: C.amber, marginBottom: 10 }}>Get verified to apply to more brand campaigns</div>}
                <Btn fullWidth small variant={c.applicantIds.includes(user?.id) ? "ghost" : "primary"} disabled={c.applicantIds.includes(user?.id)} onClick={() => applyToCampaign(c.id)}>
                  {c.applicantIds.includes(user?.id) ? "Applied ✓" : "Apply Now"}
                </Btn>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* PROFILE */}
      {artistTab === "profile" && (
        <div>
          <TopBar title="My Profile" />
          <SubTabs
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "services", label: "Services" },
              { id: "portfolio", label: "Portfolio" },
              { id: "verify", label: myArtist?.verified ? "✓ Verified" : myArtist?.verificationStatus === "pending" ? "Under Review" : "Verify Me" },
            ]}
            active={profileSubTab}
            onChange={setProfileSubTab}
          />
          <div style={{ padding: 20 }}>
            {!myArtist ? (
              <div style={{ textAlign: "center", padding: 40, fontFamily: F.sans, color: C.muted }}>Sign up as an Artist to create your profile</div>
            ) : (
              <>
                {/* ── OVERVIEW ── */}
                {profileSubTab === "overview" && (
                  <div>
                    <div style={{ background: myArtist.accentColor || C.rose, borderRadius: 12, padding: "24px 20px 20px", marginBottom: 20, textAlign: "center" }}>
                      <div style={{ fontSize: 52 }}>{myArtist.emoji}</div>
                      <div style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.white, marginTop: 8 }}>{myArtist.name}</div>
                      <div style={{ fontFamily: F.sans, fontSize: 14, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>{myArtist.specialty}{myArtist.area ? ` · ${myArtist.area}` : ""}{myArtist.location ? `, ${myArtist.location}` : ""}</div>
                      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10 }}>
                        <VerifyBadge status={myArtist.verificationStatus} />
                        {myArtist.reviewCount > 0 && <Badge label={`★ ${myArtist.rating} (${myArtist.reviewCount})`} color={C.white} bg="rgba(255,255,255,0.2)" />}
                      </div>
                    </div>

                    {/* Profile Strength */}
                    <Card style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 700, color: C.charcoal }}>Profile Strength</div>
                        <div style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 700, color: profileScore >= 80 ? C.success : profileScore >= 50 ? C.rose : C.amber }}>{profileScore}%</div>
                      </div>
                      <ProgressBar value={profileScore} />
                      <div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 8 }}>
                        {profileScore >= 80 ? "Strong profile! Clients can find and trust you." : profileScore >= 50 ? "Good start. A few more steps will help you stand out." : "Your profile needs attention to attract bookings."}
                      </div>
                    </Card>

                    {/* Tips */}
                    {profileTips.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Improve Your Profile</div>
                        {profileTips.map(tip => (
                          <TipCard
                            key={tip.key}
                            icon={tip.icon}
                            title={tip.title}
                            sub={tip.sub}
                            done={false}
                            actionLabel="Fix"
                            onAction={() => {
                              if (tip.key === "verify") { setProfileSubTab("verify"); }
                              else if (tip.key === "services") { setProfileSubTab("services"); }
                              else if (tip.key === "portfolio") { setProfileSubTab("portfolio"); }
                              else { setEditMode(true); setEBio(myArtist.bio); setESpec(myArtist.specialty); setELoc(myArtist.location); setEArea(myArtist.area || ""); setEInstagram(myArtist.instagram || ""); setEWebsite(myArtist.website || ""); }
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Bio / Info */}
                    {editMode ? (
                      <Card style={{ marginBottom: 20 }}>
                        <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Edit Profile</div>
                        <Field label="Bio" value={eBio} onChange={setEBio} rows={4} placeholder="Tell clients about yourself, your experience, and your style..." />
                        <Dropdown label="Specialty" value={eSpec} onChange={setESpec} options={ALL_SERVICES.slice(1)} />
                        <Dropdown label="City" value={eLoc} onChange={setELoc} options={["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth"]} />
                        <Field label="Area / Suburb" value={eArea} onChange={setEArea} placeholder="e.g. Sandton" />
                        <Field label="Instagram Handle" value={eInstagram} onChange={setEInstagram} placeholder="@yourhandle" />
                        <Field label="Website" value={eWebsite} onChange={setEWebsite} placeholder="https://yoursite.co.za" />
                        <div style={{ display: "flex", gap: 10 }}>
                          <Btn variant="ghost" onClick={() => setEditMode(false)}>Cancel</Btn>
                          <Btn style={{ flex: 1 }} onClick={saveProfile}>Save</Btn>
                        </div>
                      </Card>
                    ) : (
                      <Card style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                          <div style={{ fontFamily: F.sans, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase" }}>About</div>
                          <Btn small variant="ghost" onClick={() => { setEditMode(true); setEBio(myArtist.bio); setESpec(myArtist.specialty); setELoc(myArtist.location); setEArea(myArtist.area || ""); setEInstagram(myArtist.instagram || ""); setEWebsite(myArtist.website || ""); }}>Edit</Btn>
                        </div>
                        <div style={{ fontFamily: F.sans, fontSize: 15, color: myArtist.bio ? C.mid : C.muted, lineHeight: 1.65, fontStyle: myArtist.bio ? "normal" : "italic" }}>{myArtist.bio || "No bio yet. Tap Edit to add one."}</div>
                        {myArtist.instagram && <div style={{ fontFamily: F.sans, fontSize: 13, color: C.rose, marginTop: 10 }}>📸 {myArtist.instagram}</div>}
                        {myArtist.website && <div style={{ fontFamily: F.sans, fontSize: 13, color: C.rose, marginTop: 4 }}>🌐 {myArtist.website}</div>}
                      </Card>
                    )}

                    {/* Availability */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 700, color: C.charcoal, marginBottom: 10 }}>Working Days</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {DAYS.map(d => (
                          <div key={d} onClick={() => toggleDay(d)} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 600, background: myArtist.availability?.includes(d) ? C.rose : C.card, color: myArtist.availability?.includes(d) ? C.white : C.mid, border: `1.5px solid ${myArtist.availability?.includes(d) ? C.rose : C.border}` }}>{d}</div>
                        ))}
                      </div>
                      <div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 8 }}>Tap to toggle your working days</div>
                    </div>

                    <Btn fullWidth variant="ghost" onClick={doLogout}>Log Out</Btn>
                  </div>
                )}

                {/* ── SERVICES ── */}
                {profileSubTab === "services" && (
                  <div>
                    <div style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 700, color: C.charcoal, marginBottom: 12 }}>Your Services</div>
                    {myArtist.services.length === 0 && <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, padding: "12px 0 20px", fontStyle: "italic" }}>No services yet. Add your first one below.</div>}
                    {myArtist.services.map(svc => (
                      <Card key={svc.id} style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div><div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: C.charcoal }}>{svc.name}</div><div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 2 }}>{svc.duration} min</div></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontFamily: F.serif, fontSize: 14, fontWeight: 700, color: C.rose }}>{R(svc.price)}</span>
                          <button onClick={() => removeService(svc.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.danger, fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
                        </div>
                      </Card>
                    ))}
                    <Card style={{ marginTop: 16, background: C.rosePale, border: `1px dashed ${C.roseLight}` }}>
                      <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.roseDark, marginBottom: 14 }}>+ Add New Service</div>
                      <Field label="Service Name" value={eSvcName} onChange={setESvcName} placeholder="e.g. Bridal Makeup" />
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1 }}><Field label="Price (R)" value={eSvcPrice} onChange={setESvcPrice} type="number" placeholder="0" /></div>
                        <div style={{ flex: 1 }}><Field label="Duration (min)" value={eSvcDur} onChange={setESvcDur} type="number" placeholder="60" /></div>
                      </div>
                      <Btn fullWidth small onClick={addService}>Add Service</Btn>
                    </Card>
                  </div>
                )}

                {/* ── PORTFOLIO ── */}
                {profileSubTab === "portfolio" && (
                  <div>
                    <div style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 700, color: C.charcoal, marginBottom: 4 }}>Portfolio</div>
                    <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>Describe your best work. Clients see this before deciding to book you.</div>
                    {(myArtist.portfolio || []).length === 0 && <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, padding: "12px 0 20px", fontStyle: "italic" }}>No portfolio items yet.</div>}
                    {(myArtist.portfolio || []).map(p => (
                      <Card key={p.id} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1 }}>
                            <div style={{ fontSize: 30, width: 46, height: 46, background: C.bgAlt, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p.emoji}</div>
                            <div>
                              <div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 700, color: C.charcoal }}>{p.title}</div>
                              <div style={{ marginTop: 4 }}><Badge label={p.type} color={C.mid} bg={C.bgAlt} /></div>
                              {p.description && <div style={{ fontFamily: F.sans, fontSize: 13, color: C.mid, marginTop: 6, lineHeight: 1.5 }}>{p.description}</div>}
                            </div>
                          </div>
                          <button onClick={() => removePortfolio(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.danger, fontSize: 18, padding: "0 0 0 10px", lineHeight: 1, flexShrink: 0 }}>×</button>
                        </div>
                      </Card>
                    ))}
                    <Card style={{ marginTop: 16, background: C.rosePale, border: `1px dashed ${C.roseLight}` }}>
                      <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 700, color: C.roseDark, marginBottom: 14 }}>+ Add Portfolio Item</div>
                      <Field label="Title" value={portTitle} onChange={setPortTitle} placeholder="e.g. Summer Bridal Look" />
                      <Dropdown label="Type" value={portType} onChange={setPortType} options={PORT_TYPES} />
                      <Field label="Description (optional)" value={portDesc} onChange={setPortDesc} placeholder="Describe the look, technique, or client..." rows={3} />
                      <Btn fullWidth small onClick={addPortfolio}>Add to Portfolio</Btn>
                    </Card>
                  </div>
                )}

                {/* ── VERIFY ── */}
                {profileSubTab === "verify" && (
                  <div>
                    {myArtist.verified ? (
                      <div style={{ textAlign: "center", padding: "32px 0" }}>
                        <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
                        <div style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.success }}>You're Verified</div>
                        <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>Your profile shows the verified badge. Clients trust verified artists more and you appear higher in search results.</div>
                        <div style={{ marginTop: 24, padding: 16, background: C.successBg, borderRadius: 10 }}>
                          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.success, fontWeight: 700, marginBottom: 8 }}>Verified benefits</div>
                          {["✓ Blue verified badge on your profile", "✓ Priority placement in search", "✓ Eligible to apply to brand campaigns", "✓ Higher client trust and conversion"].map(b => <div key={b} style={{ fontFamily: F.sans, fontSize: 13, color: C.mid, marginBottom: 4 }}>{b}</div>)}
                        </div>
                      </div>
                    ) : myArtist.verificationStatus === "pending" ? (
                      <div>
                        <div style={{ textAlign: "center", padding: "24px 0" }}>
                          <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
                          <div style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 700, color: C.charcoal }}>Under Review</div>
                          <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>Your submission is being reviewed. Typically takes 2-3 business days.</div>
                        </div>
                        <Card style={{ marginBottom: 16, background: C.amberBg, border: `1px solid ${C.amber}44` }}>
                          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.amber, fontWeight: 700, marginBottom: 6 }}>What happens next?</div>
                          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.mid, lineHeight: 1.65 }}>Our team checks your ID and qualifications. If everything looks good, you get the verified badge and your profile gets a boost in search results.</div>
                        </Card>
                        <Btn fullWidth variant="success" onClick={() => { approveVerification(); notify("Verification approved!"); }}>Demo: Approve My Verification Now</Btn>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontFamily: F.serif, fontSize: 18, fontWeight: 700, color: C.charcoal, marginBottom: 8 }}>Get Verified</div>
                        <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginBottom: 20, lineHeight: 1.65 }}>Verified artists get 3x more bookings. The process takes about 5 minutes.</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                          {[
                            { icon: "🪪", label: "Identity check", sub: "Your SA ID number, encrypted" },
                            { icon: "📜", label: "Qualifications", sub: "Certificates and memberships" },
                            { icon: "📸", label: "Online presence", sub: "Instagram or website" },
                          ].map((s, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                              <div style={{ fontSize: 24, width: 40, height: 40, background: C.bgAlt, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
                              <div><div style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: C.charcoal }}>{s.label}</div><div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 2 }}>{s.sub}</div></div>
                            </div>
                          ))}
                        </div>
                        <Btn fullWidth onClick={() => setShowVerify(true)}>Start Verification</Btn>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <Nav
        tabs={[
          { id: "dashboard", label: "Home", icon: "📊" },
          { id: "bookings", label: "Bookings", icon: "📅" },
          { id: "campaigns", label: "Campaigns", icon: "📢" },
          { id: "profile", label: "Profile", icon: "✨" },
        ]}
        active={artistTab}
        onChange={setArtistTab}
      />
    </div>
  );

  /* ══════════════════════════════════════════════
     BRAND APP
  ══════════════════════════════════════════════ */
  if (role === "brand" && screen === "app") {
    const filteredBrandArtists = artists.filter(a => {
      if (filterService !== "All" && a.specialty !== filterService) return false;
      if (searchQ && !a.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
      return true;
    });
    return (
      <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 80 }}>
        {toast && <Toast {...toast} />}
        {showCampForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ background: C.bg, borderRadius: "20px 20px 0 0", padding: "24px 20px 48px", maxHeight: "88vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 700, color: C.charcoal }}>Post a Campaign</div>
                <button onClick={() => setShowCampForm(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: C.muted }}>×</button>
              </div>
              <Field label="Campaign Title" value={cTitle} onChange={setCTitle} placeholder="e.g. Summer Hair Campaign 2025" />
              <Field label="Brief" value={cBrief} onChange={setCBrief} placeholder="Describe who you're looking for and what you need..." rows={4} />
              <Field label="Budget Range" value={cBudget} onChange={setCBudget} placeholder="e.g. R5,000 - R15,000" />
              <Dropdown label="Specialty Required" value={cSpec} onChange={setCSpec} options={ALL_SERVICES.slice(1)} />
              <Field label="Application Deadline" value={cDeadline} onChange={setCDeadline} type="date" />
              <Btn fullWidth onClick={postCampaign}>Post Campaign</Btn>
            </div>
          </div>
        )}

        {brandTab === "discover" && (
          <div>
            <div style={{ background: C.charcoal, padding: "32px 20px 20px" }}>
              <div style={{ fontFamily: F.serif, fontSize: 26, fontWeight: 700, color: C.white }}>Discover Talent</div>
              <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 4 }}>{artists.filter(a => a.verified).length} verified professionals available</div>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search artists..." style={{ marginTop: 14, width: "100%", boxSizing: "border-box", padding: "12px 16px", borderRadius: 8, border: "none", fontFamily: F.sans, fontSize: 15, color: C.charcoal, background: C.white, outline: "none" }} />
            </div>
            <FilterChips options={ALL_SERVICES} active={filterService} onChange={setFilterService} />
            <div style={{ padding: "0 20px" }}>
              {filteredBrandArtists.map(a => (
                <Card key={a.id} style={{ marginBottom: 12, display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 54, height: 54, borderRadius: 10, background: a.accentColor || C.rose, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{a.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: F.sans, fontSize: 15, fontWeight: 700, color: C.charcoal }}>{a.name}</span>
                      {a.verified && <span style={{ fontSize: 11, color: C.success, fontFamily: F.sans, fontWeight: 700 }}>✓ Verified</span>}
                      {a.verificationStatus === "pending" && <Badge label="Review" color={C.amber} bg={C.amberBg} />}
                    </div>
                    <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 2 }}>{a.specialty} · {a.area}, {a.location}</div>
                    <div style={{ fontFamily: F.sans, fontSize: 13, color: C.mid, marginTop: 6, lineHeight: 1.5 }}>{(a.bio || "").slice(0, 80)}{a.bio?.length > 80 ? "..." : ""}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {(a.tags || []).slice(0, 2).map(t => <Badge key={t} label={t} color={C.mid} bg={C.bgAlt} />)}
                      {a.rating > 0 && <Badge label={`★ ${a.rating}`} color={C.rose} bg={C.rosePale} />}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {brandTab === "campaigns" && (
          <div>
            <TopBar title="Campaigns" right={<Btn small onClick={() => setShowCampForm(true)}>+ New</Btn>} />
            <div style={{ padding: 20 }}>
              {myCampaigns.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 700, color: C.charcoal, marginBottom: 12 }}>Your Campaigns</div>
                  {myCampaigns.map(c => (
                    <Card key={c.id} style={{ marginBottom: 12, borderLeft: `4px solid ${C.rose}` }}>
                      <Badge label={c.specialty} color={C.rose} bg={C.rosePale} />
                      <div style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 700, color: C.charcoal, marginTop: 8 }}>{c.title}</div>
                      <div style={{ fontFamily: F.sans, fontSize: 13, color: C.mid, lineHeight: 1.6, marginTop: 6 }}>{c.brief}</div>
                      <div style={{ marginTop: 12, padding: "10px 14px", background: C.successBg, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.success }}>{c.applicantCount + c.applicantIds.length} applications received</div>
                    </Card>
                  ))}
                </div>
              )}
              <div style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 700, color: C.charcoal, marginBottom: 12 }}>All Open Campaigns</div>
              {campaigns.filter(c => c.brandId !== user?.id).map(c => (
                <Card key={c.id} style={{ marginBottom: 12 }}>
                  <Badge label={c.specialty} color={C.rose} bg={C.rosePale} />
                  <div style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 700, color: C.charcoal, marginTop: 8 }}>{c.title}</div>
                  <div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 2 }}>by {c.brandName}</div>
                  <div style={{ fontFamily: F.sans, fontSize: 13, color: C.mid, lineHeight: 1.6, marginTop: 8 }}>{c.brief}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    {c.budget && <Badge label={`💰 ${c.budget}`} color={C.mid} bg={C.bgAlt} />}
                    <Badge label={`👥 ${c.applicantCount + c.applicantIds.length} applied`} color={C.mid} bg={C.bgAlt} />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {brandTab === "profile" && (
          <div>
            <TopBar title="Brand Profile" />
            <div style={{ padding: 20 }}>
              <Card style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 70, height: 70, borderRadius: 12, background: C.charcoal, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 28 }}>🏢</div>
                <div style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 700, color: C.charcoal }}>{user?.name}</div>
                <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, marginTop: 4 }}>{user?.email}</div>
                <div style={{ marginTop: 10 }}><Badge label="Brand Partner" /></div>
              </Card>
              <Card style={{ marginBottom: 16 }}>
                <InfoRow label="Campaigns Posted" value={myCampaigns.length} />
                <InfoRow label="Total Artists" value={artists.length} />
                <InfoRow label="Verified Artists" value={artists.filter(a => a.verified).length} />
              </Card>
              <Btn fullWidth variant="ghost" onClick={doLogout}>Log Out</Btn>
            </div>
          </div>
        )}

        <Nav tabs={[{ id: "discover", label: "Discover", icon: "🔍" }, { id: "campaigns", label: "Campaigns", icon: "📢" }, { id: "profile", label: "Profile", icon: "🏢" }]} active={brandTab} onChange={setBrandTab} />
      </div>
    );
  }

  return null;
}
