import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

export type LoadingButtonProps = ButtonProps & {
  isLoading?: boolean;
  loadingText?: string;
};

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  function LoadingButton(
    { isLoading = false, loadingText, disabled, children, ...props },
    ref
  ) {
    return (
      <Button
        ref={ref}
        disabled={isLoading || disabled}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>{loadingText ?? children}</span>
          </>
        ) : (
          children
        )}
      </Button>
    );
  }
);
