import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils/cn';

/**
 * Spinner – vòng tròn xoay dùng chung cho mọi trạng thái tải.
 *
 * Nguồn: docs/specs/loading-states-spec.md (SPEC-FE-LOADING-01).
 *
 * Thiết kế: một track tròn mảnh (màu hiện tại, mờ 20%) + một cung 1/4 bo đầu
 * nét tròn xoay đều. Không gradient, không phát sáng – đúng tinh thần
 * docs/07-design-system.md mục 7 (ưu tiên nét mảnh, dè dặt).
 *
 * Chuyển động do class `bsc-spinner` trong globals.css đảm nhiệm để có thể
 * hạ xuống hiệu ứng nhịp thở khi người dùng bật `prefers-reduced-motion`
 * (quy tắc toàn cục `animation-duration: 0.01ms !important` sẽ làm vòng xoay
 * đứng yên, nên cần một animation riêng thay thế).
 */
const spinnerVariants = cva('block shrink-0', {
  variants: {
    size: {
      xs: 'h-3.5 w-3.5',
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-8 w-8',
      xl: 'h-11 w-11',
    },
    variant: {
      primary: 'text-primary-600',
      white: 'text-neutral-0',
      neutral: 'text-neutral-400',
      current: 'text-current',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'primary',
  },
});

/**
 * Kích thước pixel dự phòng cứng cho SVG.
 * Đảm bảo ngay cả khi CSS của Next.js chưa tải, bị trễ, hoặc gặp lỗi 404,
 * thẻ <svg> không bao giờ bị trình duyệt tự phóng to 100% chiều rộng màn hình.
 */
const SPINNER_PIXEL_SIZES: Record<NonNullable<VariantProps<typeof spinnerVariants>['size']>, number> = {
  xs: 14,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 44,
};

export interface SpinnerProps
  extends Omit<React.SVGAttributes<SVGSVGElement>, 'children'>,
    VariantProps<typeof spinnerVariants> {
  /** Nhãn đọc cho screen-reader. Truyền chuỗi rỗng khi spinner đã nằm trong một live region khác. */
  label?: string;
}

export function Spinner({ size, variant, label = 'Đang tải dữ liệu', className, style, ...props }: SpinnerProps) {
  const decorative = label.length === 0;
  const resolvedSize = size ?? 'md';
  const pixelSize = SPINNER_PIXEL_SIZES[resolvedSize] ?? 24;

  return (
    <span
      className="inline-flex items-center justify-center"
      role={decorative ? undefined : 'status'}
      aria-live={decorative ? undefined : 'polite'}
      aria-label={decorative ? undefined : label}
    >
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className={cn(spinnerVariants({ size, variant }), 'bsc-spinner', className)}
        style={{
          width: `${pixelSize}px`,
          height: `${pixelSize}px`,
          maxWidth: '100%',
          maxHeight: '100%',
          ...style,
        }}
        {...props}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2.5"
          className="opacity-20"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {!decorative && <span className="sr-only">{label}</span>}
    </span>
  );
}
