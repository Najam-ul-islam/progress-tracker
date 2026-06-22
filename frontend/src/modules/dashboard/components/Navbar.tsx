import { useLocation, Link, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useLayoutStore } from "./layout.store";
import { useTheme } from "@/context/ThemeContext";
import { useSessionStore } from "@/modules/auth/store/session.store";
import {
  Search,
  Menu,
  Sun,
  Moon,
  Monitor,
  LogOut,
  User,
  Settings,
} from "lucide-react";

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleMobileOpen } = useLayoutStore();
  const { theme, setTheme } = useTheme();
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.clear);

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside clicks
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setThemeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Map route path to breadcrumbs/titles
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === "/") return ["Dashboard"];
    
    const parts = path.split("/").filter(Boolean);
    return parts.map((part) => {
      // Capitalize first letter and format
      const formatted = part.charAt(0).toUpperCase() + part.slice(1);
      return formatted === "Developers" ? "Performance" : formatted;
    });
  };

  const breadcrumbs = getBreadcrumbs();
  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "OP";

  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors sticky top-0 z-40">
      {/* Left: Mobile Hamburger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMobileOpen}
          className="flex items-center justify-center w-9 h-9 md:hidden rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350 transition-colors"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page Title / Breadcrumbs */}
        <nav className="flex items-center text-sm font-medium text-slate-550 dark:text-slate-400">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={crumb} className="flex items-center">
                {idx > 0 && <span className="mx-2 text-slate-300 dark:text-slate-700">/</span>}
                <span
                  className={
                    isLast
                      ? "text-slate-900 dark:text-white font-semibold text-base md:text-lg tracking-tight"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }
                >
                  {crumb}
                </span>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Right: Search, Theme, Profile */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Mock Search Trigger */}
        <button
          onClick={() => setSearchModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer w-28 sm:w-44 justify-between"
        >
          <span className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search...</span>
          </span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-400 dark:text-slate-600 font-mono">
            ⌘K
          </kbd>
        </button>

        {/* Theme Selector Dropdown */}
        <div className="relative" ref={themeRef}>
          <button
            onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Toggle theme"
          >
            {theme === "light" && <Sun className="w-4 h-4 text-amber-500" />}
            {theme === "dark" && <Moon className="w-4 h-4 text-[var(--accent)]" />}
            {theme === "system" && <Monitor className="w-4 h-4" />}
          </button>

          {themeDropdownOpen && (
            <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-100">
              <button
                onClick={() => {
                  setTheme("light");
                  setThemeDropdownOpen(false);
                }}
                className={`flex items-center w-full px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors gap-2 ${
                  theme === "light" ? "text-[var(--accent)] bg-[var(--accent-subtle)]" : "text-slate-300"
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light</span>
              </button>
              <button
                onClick={() => {
                  setTheme("dark");
                  setThemeDropdownOpen(false);
                }}
                className={`flex items-center w-full px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors gap-2 ${
                  theme === "dark" ? "text-[var(--accent)] bg-[var(--accent-subtle)]" : "text-slate-300"
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Dark</span>
              </button>
              <button
                onClick={() => {
                  setTheme("system");
                  setThemeDropdownOpen(false);
                }}
                className={`flex items-center w-full px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors gap-2 ${
                  theme === "system" ? "text-[var(--accent)] bg-[var(--accent-subtle)]" : "text-slate-300"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>System</span>
              </button>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 focus:outline-none"
            title="Profile Menu"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--sidebar-active-bg)] text-white font-bold text-sm shadow-md shadow-[var(--sidebar-active-bg)]/30 hover:scale-105 transition-transform">
              {userInitials}
            </div>
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-100">
              {/* User Meta */}
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-850">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Signed in as</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.name || "Administrator"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email || "admin@example.com"}</p>
              </div>

              {/* Action Links */}
              <div className="py-1">
                <Link
                  to={`/users/${user?.id || 1}`}
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors gap-2"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>My Profile</span>
                </Link>
<Link
                   to="/settings"
                   onClick={() => setProfileDropdownOpen(false)}
                   className="flex items-center px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors gap-2"
                 >
                   <Settings className="w-3.5 h-3.5" />
                   <span>Settings</span>
                 </Link>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-850 py-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-2 text-xs text-red-650 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors gap-2 text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Search Dialog Modal (UI Only) */}
      {searchModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh] px-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center px-4 border-b border-slate-200 dark:border-slate-800 h-12">
              <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
              <input
                type="text"
                placeholder="Search metrics, reports, transactions..."
                className="w-full text-sm outline-none bg-transparent text-slate-900 dark:text-white"
                autoFocus
              />
              <button
                onClick={() => setSearchModalOpen(false)}
                className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border dark:border-slate-700 text-slate-500 font-mono hover:bg-slate-200 cursor-pointer"
              >
                ESC
              </button>
            </div>
            <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
              Type something to search (Simulated dialog, press Escape to close)
            </div>
          </div>
          {/* Overlay click to close */}
          <div className="absolute inset-0 -z-10" onClick={() => setSearchModalOpen(false)} />
        </div>
      )}
    </header>
  );
}
