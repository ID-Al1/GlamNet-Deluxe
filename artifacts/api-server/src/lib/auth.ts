import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";

function getTokenSecret(): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error("SESSION_SECRET is required to sign authentication tokens");
  }
  return secret;
}
const tokenSecret = getTokenSecret();

export function verifyToken(token: string): string | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const expectedSig = createHmac("sha256", tokenSecret)
      .update(Buffer.from(payloadB64, "base64url").toString())
      .digest("hex");
    if (sig.length !== expectedSig.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    return payload.userId as string;
  } catch {
    return null;
  }
}

export async function requireOwner(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Not authenticated" }); return; }
  const userId = verifyToken(auth.slice(7));
  if (!userId) { res.status(401).json({ error: "Invalid token" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const ownerEmail = process.env["OWNER_EMAIL"];
  if (!ownerEmail || user.email.trim().toLowerCase() !== ownerEmail.trim().toLowerCase()) {
    res.status(403).json({ error: "Access restricted to Bonisa owner" }); return;
  }
  (req as any).user = user;
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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
  const ownerEmail = process.env["OWNER_EMAIL"];
  if (user.accountStatus === "suspended" && (!ownerEmail || user.email.trim().toLowerCase() !== ownerEmail.trim().toLowerCase())) {
    res.status(403).json({ error: "Account suspended" }); return;
  }
  (req as any).user = user;
  next();
}
