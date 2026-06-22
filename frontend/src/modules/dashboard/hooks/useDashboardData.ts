import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";
import type { ChartDataPoint } from "@/modules/reporting/types";
import type { Notification } from "@/modules/notifications/types";
import type { UserTableItem } from "../services/mockData";
import type { User } from "@/modules/users/types";

const POLL_INTERVAL_MS = 30_000;

async function fetchSummary() {
  const res = await http.get("/reports/dashboard");
  return res.data;
}

async function fetchChartData() {
  const res = await http.get<{ items: ChartDataPoint[] }>("/reports/dashboard/chart-data");
  return res.data.items;
}

async function fetchUsers() {
  const res = await http.get<User[]>("/users");
  return res.data;
}

async function fetchActivity() {
  const res = await http.get<{ items: Notification[] }>("/notifications");
  return res.data.items;
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchSummary,
    staleTime: 30_000,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardChartData() {
  return useQuery({
    queryKey: ["dashboard", "chart"],
    queryFn: fetchChartData,
    staleTime: 30_000,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardUsers() {
  return useQuery({
    queryKey: ["dashboard", "users"],
    queryFn: fetchUsers,
    staleTime: 30_000,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardActivity() {
  return useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: fetchActivity,
    staleTime: 30_000,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function mapUserToTableItem(u: User): UserTableItem {
  const status: "active" | "suspended" | "pending" = u.isActive ? "active" : "suspended";
  return {
    id: String(u.id),
    name: u.name,
    email: u.email,
    role: u.role,
    status,
    createdAt: u.createdAt,
  };
}

export function mapNotificationToActivity(n: Notification) {
  const categoryMap: Record<string, "security" | "billing" | "system" | "user"> = {
    assignment: "user",
    payment: "billing",
    payment_paid: "billing",
    deadline: "system",
    system: "system",
  };
  return {
    id: String(n.id),
    user: {
      name: "System",
      initials: "SY",
    },
    action: `${n.title}: ${n.message}`,
    timestamp: n.createdAt,
    category: categoryMap[n.type] ?? "system",
  };
}
