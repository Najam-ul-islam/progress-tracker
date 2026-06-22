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

// Clients RBAC (mirrors 004-clients-management access-control-matrix):
// admin + manager may view/create/edit; only admin may delete; developers have
// no access at all (no self-view carve-out).
export function canViewClients(role: Role | null): boolean {
  return role === "admin" || role === "manager";
}

export function canEditClients(role: Role | null): boolean {
  return role === "admin" || role === "manager";
}

export function canDeleteClients(role: Role | null): boolean {
  return role === "admin";
}

// Projects RBAC:
// admin + manager full access.
// developers see only assigned (filtered in API + UI).
export function canViewProjects(role: Role | null): boolean {
  return role === "admin" || role === "manager" || role === "developer";
}

export function canEditProjects(role: Role | null): boolean {
  return role === "admin" || role === "manager";
}

export function canDeleteProjects(role: Role | null): boolean {
  return role === "admin";
}

// Analytics RBAC (mirrors 007-reporting security model):
// admin + manager → aggregate reports (dashboard/payments/projects/developers); denied /me.
// developer → /reports/developers/me only; denied all aggregate reports.
export function canViewAnalytics(role: Role | null): boolean {
  return role === "admin" || role === "manager";
}

export function canViewOwnPerformance(role: Role | null): boolean {
  return role === "developer";
}

// Earnings RBAC: developers see their own earnings only; admin/manager see all.
export function canViewEarnings(role: Role | null): boolean {
  return role === "admin" || role === "manager" || role === "developer";
}

// Payments RBAC: admin + manager only.
export function canViewPayments(role: Role | null): boolean {
  return role === "admin" || role === "manager";
}

// Notifications RBAC: all authenticated users can view.
export function canViewNotifications(role: Role | null): boolean {
  return role !== null;
}

// Settings RBAC: all authenticated users can view.
export function canViewSettings(role: Role | null): boolean {
  return role !== null;
}

// Progress updates: admin/manager or the assigned developer.
export function canUpdateProgress(
  role: Role | null,
  sessionUserId: number | null,
  assignedDeveloperId: number
): boolean {
  if (role === "admin" || role === "manager") return true;
  if (role === "developer" && sessionUserId !== null && sessionUserId === assignedDeveloperId) {
    return true;
  }
  return false;
}
