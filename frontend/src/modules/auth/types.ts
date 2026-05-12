export const ROLES = ["admin", "manager", "developer"] as const;
export type Role = (typeof ROLES)[number];

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
};

export type TokenResponse = {
  accessToken: string;
  tokenType: "bearer";
  user: User;
};

export type AuthErrorKind =
  | "invalid-credentials"
  | "email-in-use"
  | "forbidden"
  | "validation"
  | "session-ended"
  | "network";

export class AuthError extends Error {
  readonly kind: AuthErrorKind;
  readonly fieldErrors?: Record<string, string>;
  constructor(kind: AuthErrorKind, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AuthError";
    this.kind = kind;
    this.fieldErrors = fieldErrors;
  }
}

export type ClearReason = "user-initiated" | "session-ended" | "backend-rejected";
