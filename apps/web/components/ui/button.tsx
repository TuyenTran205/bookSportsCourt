import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils/cn';

/**
 * Button – docs/07-design-system.md mục 9.
 *
 * Variants: primary | secondary | outline | ghost | danger
 * Sizes:    sm (h-8) | md (h-10) | lg (h-12)
 * States:   default | hover | focus-visible | active | disabled | loading
 *
 * Focus-visible dùng ring thay vì outline để không đẩy layout.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-btn text-sm font-medium',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary-700 text-white hover:bg-primary-600 active:bg-primary-800',
        secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300',
        outline:
          'border border-border bg-bg text-neutral-900 hover:bg-neutral-50 active:bg-neutral-100',
        ghost: 'text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200',
        danger: 'bg-danger text-white hover:bg-red-700 active:bg-red-800',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render phần tử con thay vì `<button>` (dùng cho `<Link>`). */
  asChild?: boolean;
  /** Hiện spinner và chặn tương tác. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    // `asChild` + `loading` xung đột: Slot chỉ nhận đúng một con, nên spinner
    // không thể chèn thêm. Chặn ngay ở kiểu thay vì render sai âm thầm.
    if (asChild) {
      return (
        <Slot ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Spinner size="sm" variant="current" label="" />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
