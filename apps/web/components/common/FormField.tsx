import * as React from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';

export interface FormFieldProps {
  label: string;
  /** Id của control bên trong, để label trỏ đúng. */
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * FormField – docs/07-design-system.md mục 9: luôn có label rõ ràng, lỗi nằm
 * dưới control bằng `text-danger text-sm`. Control tự gắn `aria-invalid`.
 */
export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}
