import { useQuery } from "@tanstack/react-query";
import { getMySelfReport } from "@/modules/earnings/api";

export function useMySelfReport() {
  return useQuery({
    queryKey: ["reports", "developers", "me"],
    queryFn: getMySelfReport,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
