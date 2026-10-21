import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "@/modules/auth/store/session.store";

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clear = useSessionStore((s) => s.clear);

  return useCallback(() => {
    clear("user-initiated");
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [clear, navigate, queryClient]);
}
