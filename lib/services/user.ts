/**
 * User creation and validation. Shared by signup and admin user creation.
 */

import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string | null;
}

export interface CreateUserResult {
  id: string;
  email: string;
  name: string | null;
}

export type CreateUserError =
  | { code: "INVALID_EMAIL"; message: string }
  | { code: "INVALID_PASSWORD"; message: string }
  | { code: "EMAIL_EXISTS"; message: string };

export function validateEmail(email: string): string | CreateUserError {
  const trimmed = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
    return { code: "INVALID_EMAIL", message: "Valid email required" };
  }
  return trimmed;
}

export function validatePassword(password: string): CreateUserError | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { code: "INVALID_PASSWORD", message: "Password must be at least 8 characters" };
  }
  return null;
}

/**
 * Create a user. Validates email, password, checks for existing email, hashes, and persists.
 * Used by signup and admin user creation.
 */
export async function createUser(input: CreateUserInput): Promise<CreateUserResult | CreateUserError> {
  const emailResult = validateEmail(input.email);
  if (typeof emailResult !== "string") return emailResult;

  const passwordError = validatePassword(input.password);
  if (passwordError) return passwordError;

  const existing = await prisma.user.findUnique({ where: { email: emailResult } });
  if (existing) {
    return { code: "EMAIL_EXISTS", message: "An account with this email already exists" };
  }

  const passwordHash = await hash(input.password, 12);
  const name = input.name != null && String(input.name).trim() ? String(input.name).trim() : emailResult.split("@")[0];
  const user = await prisma.user.create({
    data: { email: emailResult, name, passwordHash },
  });
  return { id: user.id, email: user.email, name: user.name };
}
