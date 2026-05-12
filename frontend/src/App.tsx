import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "@/routes";
import { queryClient } from "@/lib/query-client";
import { attachCrossTabSync } from "@/modules/auth/store/cross-tab";

function App() {
  useEffect(() => {
    return attachCrossTabSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
