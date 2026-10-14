import * as React from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Input – docs/07-design-system.md mục 9.
 *
 * - Luôn có label rõ ràng (không chỉ placeholder) — xem `FormField`.
 * - Error state: `border-danger` + text lỗi `text-danger text-sm` phía dưới.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-input border border-neutral-300 bg-white px-3 py-2',
        'text-sm text-neutral-900',
        'placeholder:text-neutral-400',
        'transition-colors duration-150',
        'focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/20',
        'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/20',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
