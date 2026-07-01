import { Router } from "express";
import { db, usersTable, referralsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID, randomBytes } from "crypto";
import { createHmac, timingSafeEqual } from "crypto";
import { SignupBody, LoginBody } from "@workspace/api-zod";

const router = Router();

function hashPassword(password: string): string {
  return createHmac("sha256", process.env["JWT_SECRET"] ?? "glamnet_secret_key")
    .update(password)
    .digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  const inputHash = hashPassword(password);
  return timingSafeEqual(Buffer.from(inputHash), Buffer.from(hash));
}

function signToken(userId: string): string {
  const payload = JSON.stringify({ userId, iat: Date.now() });
  const sig = createHmac("sha256", process.env["JWT_SECRET"] ?? "glamnet_secret_key")
    .update(payload)
    .digest("hex");
  return Buffer.from(payload).toString("base64url") + "." + sig;
}

export function verifyToken(token: string): string | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const expectedSig = createHmac("sha256", process.env["JWT_SECRET"] ?? "glamnet_secret_key")
      .update(Buffer.from(payloadB64, "base64url").toString())
      .digest("hex");
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    return payload.userId as string;
  } catch {
    return null;
  }
}

function generateReferralCode(): string {
  return randomBytes(5).toString("hex").toUpperCase();
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    businessName: u.businessName ?? null,
    avatarUrl: u.avatarUrl ?? null,
    referralCode: u.referralCode ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

router.post("/auth/signup", async (req, res) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const { name, email, password, role, businessName } = parsed.data;
  const referralCode = (req.body.referralCode as string | undefined)?.trim().toUpperCase() || null;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  // Resolve referrer if a referral code was provided
  let referrer: (typeof usersTable.$inferSelect) | null = null;
  if (referralCode) {
    const [found] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode));
    referrer = found ?? null;
  }

  const id = randomUUID();
  const passwordHash = hashPassword(password);
  const newReferralCode = generateReferralCode();

  const [user] = await db.insert(usersTable).values({
    id,
    name,
    email,
    passwordHash,
    role: role as "client" | "stylist" | "brand",
    businessName: businessName ?? null,
    referralCode: newReferralCode,
  }).returning();

  if (role === "stylist") {
    const { stylistProfilesTable } = await import("@workspace/db");
    await db.insert(stylistProfilesTable).values({
      id: randomUUID(),
      userId: id,
      name,
      specialty: "Makeup",
      location: "",
      area: "",
    });
  }

  // Create referral record if a valid referrer was found
  if (referrer) {
    await db.insert(referralsTable).values({
      id: randomUUID(),
      referrerId: referrer.id,
      referredId: id,
      referredType: role === "stylist" ? "artist" : "client",
      status: "pending",
      bonusPaid: false,
    });
  }

  const token = signToken(id);
  res.status(201).json({ user: formatUser(user), token });
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken(user.id);
  res.json({ user: formatUser(user), token });
});

router.post("/auth/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = verifyToken(auth.slice(7));
  if (!userId) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(formatUser(user));
});

export default router;
