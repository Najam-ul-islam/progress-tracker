import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/modules/projects/services/projects.api";

export function useDeveloperProjects() {
  return useQuery({
    queryKey: ["projects", "developer"],
    queryFn: () => projectsApi.list(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}