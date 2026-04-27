import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface SubmitButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  isLoading?: boolean;
  children: ReactNode;
}

export default function SubmitButton({
  isLoading = false,
  disabled,
  children,
  className,
  ...rest
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={className}
      {...rest}
    >
      <span className="inline-flex items-center justify-center">
        {children}
        {isLoading && <Loader2 className="w-4 h-4 animate-spin ms-2" aria-hidden="true" />}
      </span>
    </button>
  );
}
