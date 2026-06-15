import jwt from "jsonwebtoken";

const SECRET = process.env.SESSION_SECRET ?? "change-me-in-production";

export function signAdminToken(payload: { username: string }): string {
  return jwt.sign(payload, SECRET, { expiresIn: "8h" });
}

export function verifyAdminToken(token: string): { username: string } {
  return jwt.verify(token, SECRET) as { username: string };
}
