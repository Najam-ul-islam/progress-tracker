import * as React from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

export const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

type FormItemContextValue = { id: string };
const FormItemContext = React.createContext<FormItemContextValue | null>(null);

export function useFormField() {
  const fieldCtx = React.useContext(FormFieldContext);
  const itemCtx = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  if (!fieldCtx) {
    throw new Error("useFormField must be used inside <FormField>");
  }
  if (!itemCtx) {
    throw new Error("useFormField must be used inside <FormItem>");
  }
  const fieldState = getFieldState(fieldCtx.name, formState);
  const id = itemCtx.id;
  return {
    id,
    name: fieldCtx.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-description`,
    formMessageId: `${id}-message`,
    ...fieldState,
  };
}

export const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function FormItem({ className, ...props }, ref) {
    const id = React.useId();
    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props} />
      </FormItemContext.Provider>
    );
  }
);

export const FormLabel = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  function FormLabel({ className, ...props }, ref) {
    const { formItemId, error } = useFormField();
    return (
      <Label
        ref={ref}
        htmlFor={formItemId}
        className={cn(error && "text-red-600", className)}
        {...props}
      />
    );
  }
);

export const FormControl = React.forwardRef<HTMLElement, { children: React.ReactElement }>(
  function FormControl({ children }, ref) {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
    const child = children as React.ReactElement<Record<string, unknown>>;
    return React.cloneElement(child, {
      ref,
      id: formItemId,
      "aria-describedby": error
        ? `${formDescriptionId} ${formMessageId}`
        : `${formDescriptionId}`,
      "aria-invalid": !!error,
    });
  }
);

export const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  function FormDescription({ className, ...props }, ref) {
    const { formDescriptionId } = useFormField();
    return (
      <p ref={ref} id={formDescriptionId} className={cn("text-xs text-slate-500", className)} {...props} />
    );
  }
);

export const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  function FormMessage({ className, children, ...props }, ref) {
    const { error, formMessageId } = useFormField();
    const body = error ? String(error.message ?? "") : children;
    if (!body) return null;
    return (
      <p
        ref={ref}
        id={formMessageId}
        className={cn("text-xs font-medium text-red-600", className)}
        {...props}
      >
        {body}
      </p>
    );
  }
);
