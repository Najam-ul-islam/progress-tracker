import type { Role } from "@/modules/auth/types";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Layers,
  CreditCard,
  DollarSign,
  Bell,
  BarChart3,
  TrendingUp,
  Settings,
  Package,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: readonly Role[];
}

export interface NavSection {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: NavItem[];
  roles?: readonly Role[];
}

export type NavConfigItem = NavItem | NavSection;

export const navigationConfig: NavConfigItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, roles: ["admin", "manager"] },
  { label: "My Workspace", path: "/developer", icon: Package, roles: ["developer"] },
  { label: "Users", path: "/users", icon: Users, roles: ["admin", "manager"] },
  { label: "Clients", path: "/clients", icon: Briefcase, roles: ["admin", "manager"] },
  { label: "Projects", path: "/projects", icon: Layers },
  { label: "My Modules", path: "/my-modules", icon: Package, roles: ["developer"] },
  { label: "My Projects", path: "/my-projects", icon: Layers, roles: ["developer"] },
  { label: "Payments", path: "/payments", icon: CreditCard, roles: ["admin", "manager"] },
  { label: "My Earnings", path: "/earnings", icon: DollarSign, roles: ["developer"] },
  { label: "Notifications", path: "/notifications", icon: Bell, roles: ["admin", "manager"] },
  {
    label: "Analytics",
    icon: BarChart3,
    roles: ["admin", "manager"],
    children: [
      { label: "Overview", path: "/analytics", icon: BarChart3 },
      { label: "Revenue", path: "/analytics/revenue", icon: TrendingUp },
      { label: "Projects", path: "/analytics/projects", icon: Layers },
      { label: "Developers", path: "/analytics/developers", icon: Users },
    ],
  },
  { label: "Settings", path: "/settings", icon: Settings },
];
