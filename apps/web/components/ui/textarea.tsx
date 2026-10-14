import * as React from 'react';

import { cn } from '@/lib/utils/cn';

/** Textarea – cùng quy tắc viền/focus/lỗi với Input. */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(
      'flex w-full rounded-input border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900',
      'placeholder:text-neutral-400',
      'transition-colors duration-150',
      'focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/20',
      'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400',
      'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/20',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
