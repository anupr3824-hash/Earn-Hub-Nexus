import type { Request, Response, NextFunction } from "express";
import { verifyAdminToken } from "../lib/jwt";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifyAdminToken(auth.slice(7));
    (req as Request & { admin: { username: string } }).admin = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
