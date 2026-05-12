import { useMutation } from "@tanstack/react-query";
import { register } from "@/modules/auth/services/auth.api";
import { useSessionStore } from "@/modules/auth/store/session.store";
import type { AuthError, TokenResponse } from "@/modules/auth/types";
import type { RegisterInput } from "@/modules/auth/schemas/register.schema";

export function useRegister() {
  const setSession = useSessionStore((s) => s.setSession);
  return useMutation<TokenResponse, AuthError, RegisterInput>({
    mutationFn: register,
    onSuccess: (data) => {
      setSession(data);
    },
  });
}
