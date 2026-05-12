import { useMutation } from "@tanstack/react-query";
import { login } from "@/modules/auth/services/auth.api";
import { useSessionStore } from "@/modules/auth/store/session.store";
import type { AuthError, TokenResponse } from "@/modules/auth/types";
import type { LoginInput } from "@/modules/auth/schemas/login.schema";

export function useLogin() {
  const setSession = useSessionStore((s) => s.setSession);
  return useMutation<TokenResponse, AuthError, LoginInput>({
    mutationFn: login,
    onSuccess: (data) => {
      setSession(data);
    },
  });
}
