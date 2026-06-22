import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "@/routes";
import { queryClient } from "@/lib/query-client";
import { attachCrossTabSync } from "@/modules/auth/store/cross-tab";
import { ThemeProvider } from "@/context/ThemeContext";

function App() {
  useEffect(() => {
    return attachCrossTabSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
