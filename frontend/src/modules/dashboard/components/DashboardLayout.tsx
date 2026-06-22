import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { useLayoutStore } from "./layout.store";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { mobileOpen, setMobileOpen } = useLayoutStore();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50 font-sans antialiased selection:bg-indigo-500/10">
      {/* 1. Desktop Sidebar */}
      <Sidebar className="hidden lg:flex shrink-0 h-full border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900" />

      {/* 2. Mobile/Tablet Sidebar Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Smooth Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer panel */}
          <div className="relative flex flex-col w-72 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out animate-in slide-in-from-left z-10">
            {/* Contextual Mobile Close Button */}
            <div className="absolute right-4 top-4 z-20">
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Close menu"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Mobile Sidebar Instance */}
            <Sidebar className="w-full h-full border-r-0 pt-12" />
          </div>
        </div>
      )}

      {/* 3. Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Navbar />

        <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/20 px-4 py-6 md:p-8 lg:p-10 transition-colors duration-300">
          <div className="mx-auto max-w-7xl w-full space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

// import { Sidebar } from "./Sidebar";
// import { Navbar } from "./Navbar";
// import { useLayoutStore } from "./layout.store";

// export function DashboardLayout({ children }: { children: React.ReactNode }) {
//   const { mobileOpen, setMobileOpen } = useLayoutStore();

//   return (
//     <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors font-sans">
//       {/* Desktop Sidebar (Fixed, hidden on mobile/tablet) */}
//       <Sidebar className="hidden md:flex shrink-0 h-full" />

//       {/* Mobile/Tablet Sidebar Drawer Overlay */}
//       {mobileOpen && (
//         <div className="fixed inset-0 z-50 flex md:hidden">
//           {/* Backdrop overlay */}
//           <div
//             className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
//             onClick={() => setMobileOpen(false)}
//           />

//           {/* Drawer panel */}
//           <div className="relative flex flex-col w-60 h-full bg-slate-900 shadow-2xl animate-in slide-in-from-left duration-250 ease-out z-10">
//             <Sidebar className="w-full h-full border-r-0" />
//           </div>
//         </div>
//       )}

//       {/* Main Content Pane */}
//       <div className="flex flex-col flex-1 h-full overflow-hidden">
//         <Navbar />
//         <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950/40 p-4 md:p-6 transition-colors">
//           <div className="mx-auto max-w-7xl w-full">
//             {children}
//           </div>
//         </main>
//       </div>
//     </div>
//   );
// }
