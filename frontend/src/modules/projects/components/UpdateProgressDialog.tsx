import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { projectsApi, PROJECTS_QUERY_KEYS } from "@/modules/projects/services/projects.api";
import { ProjectsApiError } from "@/modules/projects/types";

interface UpdateProgressDialogProps {
  projectId: number;
  moduleId: number;
  moduleName: string;
  currentProgress: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateProgressDialog({
  projectId,
  moduleId,
  moduleName,
  currentProgress,
  open,
  onOpenChange,
}: UpdateProgressDialogProps) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(currentProgress);
  const [error, setError] = useState<string | null>(null);

  // Reset progress when the dialog opens or currentProgress changes.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevCurrentProgress, setPrevCurrentProgress] = useState(currentProgress);
  if (open !== prevOpen || currentProgress !== prevCurrentProgress) {
    setPrevOpen(open);
    setPrevCurrentProgress(currentProgress);
    if (open) {
      setProgress(currentProgress);
      setError(null);
    }
  }

  const mutation = useMutation({
    mutationFn: (val: number) => projectsApi.updateModuleProgress(moduleId, val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEYS.progress(projectId) });
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEYS.detail(projectId) });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ProjectsApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    },
  });

  const handleSave = () => {
    setError(null);
    if (isNaN(progress) || progress < 0 || progress > 100) {
      setError("Progress must be between 0 and 100");
      return;
    }
    mutation.mutate(progress);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Update Progress</DialogTitle>
          <DialogDescription>
            Reporting progress for <strong>{moduleName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="progress-input" className="text-sm font-medium text-slate-700">
              Progress Percentage (%)
            </label>
            <div className="flex items-center gap-4">
              <input
                id="progress-slider"
                type="range"
                min="0"
                max="100"
                step="1"
                value={progress}
                onChange={(e) => setProgress(parseInt(e.target.value))}
                className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <Input
                id="progress-input"
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(parseInt(e.target.value) || 0)}
                className="w-20 font-mono"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Progress"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
