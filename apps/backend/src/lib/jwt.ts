import jwt from "jsonwebtoken";

const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 16) {
  console.error(
    "FATAL: SESSION_SECRET environment variable is missing or too short (min 16 chars). Refusing to start.",
  );
  process.exit(1);
}
export const JWT_SECRET: string = secret;

export interface JwtPayload {
  id: number;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
