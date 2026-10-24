import type { Request, Response, NextFunction } from "express";
import { db, usersTable, modelProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, verifyToken } from "./auth";

export function isOwnerEmail(email: string): boolean {
  const ownerEmail = process.env["OWNER_EMAIL"];
  return !!ownerEmail && email.trim().toLowerCase() === ownerEmail.trim().toLowerCase();
}

/** Signed-in model. Attaches req.user and req.modelProfile. Role is checked on the server, never from the client. */
export function requireModel(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, async () => {
    const user = (req as any).user;
    if (user.role !== "model") { res.status(403).json({ error: "This area is for models." }); return; }
    const [profile] = await db.select().from(modelProfilesTable).where(eq(modelProfilesTable.userId, user.id));
    if (!profile) { res.status(403).json({ error: "No model profile found for this account." }); return; }
    (req as any).modelProfile = profile;
    next();
  });
}

/** Signed-in brand. Attaches req.user. */
export function requireBrand(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    const user = (req as any).user;
    if (user.role !== "brand") { res.status(403).json({ error: "This area is for brands." }); return; }
    next();
  });
}

/** Attaches req.user when a valid token is present, otherwise carries on as a visitor. */
export async function optionalUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const userId = verifyToken(auth.slice(7));
      if (userId) {
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
        if (user && user.accountStatus === "active") (req as any).user = user;
      }
    }
  } catch { /* a bad token just means a visitor */ }
  next();
}
