import { AxiosError } from "axios";
import { http } from "@/lib/http";
import { AuthError, type TokenResponse, type User } from "@/modules/auth/types";
import type { LoginInput } from "@/modules/auth/schemas/login.schema";
import type { RegisterInput } from "@/modules/auth/schemas/register.schema";

type WireUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "manager" | "developer";
  created_at?: string;
};

type WireToken = {
  access_token: string;
  token_type: "bearer";
  user: WireUser;
};

function toUser(w: WireUser): User {
  return {
    id: w.id,
    name: w.name,
    email: w.email,
    role: w.role,
    createdAt: w.created_at,
  };
}

function toTokenResponse(w: WireToken): TokenResponse {
  return {
    accessToken: w.access_token,
    tokenType: "bearer",
    user: toUser(w.user),
  };
}

type ValidationDetail = { loc: (string | number)[]; msg: string; type: string };

function fieldErrorsFromValidation(detail: ValidationDetail[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of detail) {
    const key = typeof d.loc[1] === "string" ? d.loc[1] : String(d.loc[d.loc.length - 1] ?? "form");
    if (!(key in out)) out[key] = d.msg;
  }
  return out;
}

function mapAxiosError(err: unknown, ctx: "login" | "register" | "me"): never {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const data = err.response?.data as { detail?: unknown } | undefined;

    if (status === 401) {
      throw new AuthError("invalid-credentials", "Invalid email or password");
    }
    if (status === 409 && ctx === "register") {
      throw new AuthError("email-in-use", "Email already registered", {
        email: "This email is already registered",
      });
    }
    if (status === 403) {
      throw new AuthError("forbidden", "Forbidden");
    }
    if (status === 422 && Array.isArray(data?.detail)) {
      const fieldErrors = fieldErrorsFromValidation(data.detail as ValidationDetail[]);
      throw new AuthError("validation", "Validation failed", fieldErrors);
    }
    if (err.code === "ERR_NETWORK" || !err.response) {
      throw new AuthError("network", "Can't reach the server. Please try again.");
    }
  }
  throw new AuthError("network", "Unexpected error. Please try again.");
}

export async function login(input: LoginInput): Promise<TokenResponse> {
  try {
    const res = await http.post<WireToken>("/auth/login", input);
    return toTokenResponse(res.data);
  } catch (err) {
    mapAxiosError(err, "login");
  }
}

export async function register(input: RegisterInput): Promise<TokenResponse> {
  try {
    await http.post<WireUser>("/auth/register", input);
  } catch (err) {
    mapAxiosError(err, "register");
  }
  return login({ email: input.email, password: input.password });
}

export async function fetchCurrentUser(): Promise<User> {
  try {
    const res = await http.get<WireUser>("/auth/me");
    return toUser(res.data);
  } catch (err) {
    mapAxiosError(err, "me");
  }
}
