import type { NextFunction, Request, Response } from "express";

/**
 * A small in-memory limiter for open (no login) endpoints. It is per server
 * process, which is enough to blunt a person or script hammering one page; it is
 * not a defence against a distributed attack.
 */
export function rateLimit(options: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = Date.now();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (now - lastSweep > options.windowMs) {
      for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
      lastSweep = now;
    }
    const forwarded = req.headers["x-forwarded-for"];
    const key = (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined) || req.ip || "unknown";
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > options.max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({ error: "Too many requests. Please try again in a minute." });
      return;
    }
    next();
  };
}
