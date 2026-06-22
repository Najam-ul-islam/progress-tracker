import type { Role } from "@/modules/auth/types";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useLayoutStore } from "./layout.store";
import { cn } from "@/lib/cn";
import {
  navigationConfig,
  type NavConfigItem,
  type NavSection,
} from "@/config/navigation.config";
import {
  useSessionStore,
  selectRole,
} from "@/modules/auth/store/session.store";
import { ChevronDown, ChevronLeft, ChevronRight, Activity } from "lucide-react";

function isNavSection(item: NavConfigItem): item is NavSection {
  return "children" in item;
}

function hasAccess(item: NavConfigItem, role: Role | null): boolean {
  if (!item.roles) {
    return role !== null;
  }
  return role !== null && item.roles.includes(role);
}

export function Sidebar({ className }: { className?: string }) {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar, setMobileOpen } = useLayoutStore();
  const role = useSessionStore(selectRole);

  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(
    {},
  );

  const toggleSubmenu = (label: string) => {
    setExpandedMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLinkClick = () => setMobileOpen(false);

  const isItemActive = (item: NavConfigItem): boolean => {
    if (isNavSection(item)) {
      return item.children.some((child) => location.pathname === child.path);
    }
    return location.pathname === item.path;
  };

  const visibleItems = navigationConfig.filter((item) => hasAccess(item, role));

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] border-r border-[var(--sidebar-border)] transition-all duration-200 ease-in-out select-none",
        sidebarCollapsed ? "w-16" : "w-60",
        className,
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--sidebar-border)]">
        <Link
          to="/"
          className="flex items-center gap-2.5 font-extrabold text-white tracking-tight"
          onClick={handleLinkClick}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--sidebar-active-bg)] text-white shadow-lg shadow-[var(--sidebar-active-bg)]/30">
            <Activity className="w-4.5 h-4.5" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-lg">Progress Tracker</span>
          )}
        </Link>
      </div>

      {/* Nav List */}
      <nav
        className="flex-1 py-4 overflow-y-auto px-3 space-y-1"
        aria-label="Main navigation"
      >
        {visibleItems.map((item) => {
          const active = isItemActive(item);

          if (isNavSection(item)) {
            const isExpanded = expandedMenus[item.label] ?? false;

            return (
              <div key={item.label} className="space-y-1">
                <button
                  onClick={() => toggleSubmenu(item.label)}
                  className={cn(
                    "flex items-center w-full px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors group justify-between",
                    active
                      ? "bg-[var(--sidebar-active-bg)] text-white"
                      : "text-[var(--sidebar-text)] hover:text-white hover:bg-[var(--sidebar-hover-bg)]",
                  )}
                  aria-expanded={isExpanded}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="flex items-center gap-3">
                    <item.icon
                      className={cn(
                        "w-5 h-5 shrink-0",
                        active ? "text-white" : "",
                      )}
                    />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </span>
                  {!sidebarCollapsed && (
                    <span
                      className={cn(
                        "transition-transform duration-200",
                        isExpanded && "rotate-180",
                      )}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  )}
                </button>

                {!sidebarCollapsed && isExpanded && (
                  <div className="mt-1 ml-4 pl-3 space-y-0.5 border-l border-[var(--sidebar-border)]">
                    {item.children.map((child) => {
                      const isChildActive = location.pathname === child.path;
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={handleLinkClick}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors relative",
                            isChildActive
                              ? "text-white"
                              : "text-[var(--sidebar-text)] hover:text-white hover:bg-[var(--sidebar-hover-bg)]",
                          )}
                          aria-current={isChildActive ? "page" : undefined}
                        >
                          {isChildActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--accent)] rounded-r-full" />
                          )}
                          <child.icon
                            className={cn(
                              "w-4 h-4 shrink-0",
                              isChildActive ? "text-[var(--accent)]" : "",
                            )}
                          />
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleLinkClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors relative",
                active
                  ? "bg-[var(--sidebar-active-bg)] text-white"
                  : "text-[var(--sidebar-text)] hover:text-white hover:bg-[var(--sidebar-hover-bg)]",
              )}
              title={sidebarCollapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--accent)] rounded-r-full" />
              )}
              <item.icon
                className={cn("w-5 h-5 shrink-0", active ? "text-white" : "")}
              />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle Footer */}
      <div className="p-3 border-t border-[var(--sidebar-border)] hidden md:block">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full px-2 py-2 text-xs font-semibold rounded-lg hover:bg-[var(--sidebar-hover-bg)] text-[var(--sidebar-text)] hover:text-white transition-colors gap-2"
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
