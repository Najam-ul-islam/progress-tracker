import type { Role } from "@/modules/auth/types";

export function canViewUsers(role: Role | null): boolean {
  return role === "admin" || role === "manager";
}

export function canEditUsers(role: Role | null): boolean {
  return role === "admin";
}

export function canViewUserProfile(
  sessionRole: Role | null,
  sessionUserId: number | null,
  targetUserId: number
): boolean {
  if (sessionRole === "admin" || sessionRole === "manager") return true;
  if (sessionRole === "developer" && sessionUserId !== null && sessionUserId === targetUserId) {
    return true;
  }
  return false;
}
