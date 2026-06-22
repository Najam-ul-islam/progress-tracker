export interface KPIData {
  label: string;
  value: string | number;
  delta: string;
  trend: "up" | "down" | "neutral";
  description: string;
  sparkline?: number[];
}

export interface ActivityEvent {
  id: string;
  user: {
    name: string;
    avatarUrl?: string;
    initials: string;
  };
  action: string;
  timestamp: string; // ISO format
  category: "security" | "billing" | "system" | "user";
}

export interface UserTableItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "suspended" | "pending";
  createdAt: string;
  [key: string]: unknown;
}

export interface ChartDataPoint {
  name: string;
  revenue: number;
  users: number;
  expenses: number;
}

export const mockKPICards: KPIData[] = [
  {
    label: "Total Revenue",
    value: "$48,256",
    delta: "+12.5%",
    trend: "up",
    description: "vs previous month",
    sparkline: [32, 38, 35, 42, 40, 48, 52, 49, 55, 58, 54, 62],
  },
  {
    label: "Active Users",
    value: "10,240",
    delta: "+8.1%",
    trend: "up",
    description: "from yesterday",
    sparkline: [72, 68, 71, 74, 70, 75, 78, 76, 80, 82, 79, 85],
  },
  {
    label: "Churn Rate",
    value: "2.4%",
    delta: "-1.2%",
    trend: "down",
    description: "vs last quarter",
    sparkline: [6, 5.5, 5.8, 5.2, 4.8, 4.5, 4.2, 3.8, 3.5, 3.2, 2.8, 2.4],
  },
  {
    label: "MRR Growth",
    value: "24.3%",
    delta: "+4.2%",
    trend: "up",
    description: "from last month",
    sparkline: [14, 15, 14.5, 16, 17, 16.5, 18, 19, 18.5, 20, 21, 24.3],
  },
];

export const mockActivityFeed: ActivityEvent[] = [
  {
    id: "act-1",
    user: { name: "Sarah Connor", initials: "SC" },
    action: "upgraded her subscription to enterprise tier",
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5m ago
    category: "billing"
  },
  {
    id: "act-2",
    user: { name: "John Doe", initials: "JD" },
    action: "failed login attempt (invalid password, IP: 198.51.100.42)",
    timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(), // 32m ago
    category: "security"
  },
  {
    id: "act-3",
    user: { name: "System Daemon", initials: "SD" },
    action: "automated database backup completed successfully in 14.2s",
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2h ago
    category: "system"
  },
  {
    id: "act-4",
    user: { name: "Alex Mercer", initials: "AM" },
    action: "changed role of 'Jane Smith' to Manager",
    timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), // 4h ago
    category: "user"
  },
  {
    id: "act-5",
    user: { name: "Marcus Aurelius", initials: "MA" },
    action: "requested API token deletion",
    timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // 1d ago
    category: "security"
  }
];

export const mockUserTableData: UserTableItem[] = [
  { id: "usr-1", name: "Alice Vance", email: "alice.vance@example.com", role: "Administrator", status: "active", createdAt: "2025-01-15" },
  { id: "usr-2", name: "Bob Miller", email: "bob.miller@example.com", role: "Operator", status: "active", createdAt: "2025-02-11" },
  { id: "usr-3", name: "Charlie Green", email: "charlie.green@example.com", role: "Billing Admin", status: "pending", createdAt: "2026-06-01" },
  { id: "usr-4", name: "David Vance", email: "david.vance@example.com", role: "Operator", status: "suspended", createdAt: "2025-08-19" },
  { id: "usr-5", name: "Eva Long", email: "eva.long@example.com", role: "Developer", status: "active", createdAt: "2026-03-24" },
  { id: "usr-6", name: "Fay Wray", email: "fay.wray@example.com", role: "Developer", status: "active", createdAt: "2026-04-12" },
  { id: "usr-7", name: "George King", email: "george.king@example.com", role: "Billing Admin", status: "active", createdAt: "2025-11-05" },
  { id: "usr-8", name: "Hannah Abbott", email: "hannah.abbott@example.com", role: "Operator", status: "pending", createdAt: "2026-06-15" },
  { id: "usr-9", name: "Ian Fleming", email: "ian.fleming@example.com", role: "Developer", status: "active", createdAt: "2026-02-28" },
  { id: "usr-10", name: "Julia Roberts", email: "julia.roberts@example.com", role: "Operator", status: "active", createdAt: "2026-01-10" }
];

export const mockMonthlyChartData: ChartDataPoint[] = [
  { name: "Jan", revenue: 12000, users: 4000, expenses: 8000 },
  { name: "Feb", revenue: 19000, users: 4500, expenses: 9500 },
  { name: "Mar", revenue: 15000, users: 5100, expenses: 9000 },
  { name: "Apr", revenue: 22000, users: 5900, expenses: 11000 },
  { name: "May", revenue: 26000, users: 6800, expenses: 13000 },
  { name: "Jun", revenue: 31000, users: 7400, expenses: 15000 },
  { name: "Jul", revenue: 28000, users: 7900, expenses: 14000 },
  { name: "Aug", revenue: 35000, users: 8500, expenses: 17000 },
  { name: "Sep", revenue: 39000, users: 9100, expenses: 18000 },
  { name: "Oct", revenue: 41000, users: 9500, expenses: 19000 },
  { name: "Nov", revenue: 45000, users: 9900, expenses: 20000 },
  { name: "Dec", revenue: 48256, users: 10240, expenses: 21500 }
];
