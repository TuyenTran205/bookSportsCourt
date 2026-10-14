import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import type { BookingStatus, OwnerApplicationStatus, PaymentStatus, UserStatus, VenueStatus } from '@bsc/shared';

import { cn } from '@/lib/utils/cn';

/**
 * StatusBadge – docs/07-design-system.md mục 9.
 *
 * Yêu cầu cốt lõi: nhận ĐỦ mọi giá trị enum, và giá trị lạ phải fail
 * typecheck — KHÔNG fallback im lặng về màu mặc định.
 *
 * Cách đảm bảo: `Record<BookingStatus, Tone>` buộc map phủ hết khoá. Thêm
 * một trạng thái mới vào enum shared sẽ làm đỏ `tsc` ngay tại đây thay vì
 * render một badge xám vô nghĩa trên production.
 */

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        // Booking
        yellow: 'border-amber-200 bg-amber-50 text-amber-800',
        'yellow-strong': 'border-amber-300 bg-amber-100 text-amber-900',
        blue: 'border-blue-200 bg-blue-50 text-blue-800',
        green: 'border-primary-200 bg-primary-50 text-primary-800',
        red: 'border-red-200 bg-red-50 text-red-800',
        gray: 'border-border bg-neutral-100 text-neutral-700',
        'gray-light': 'border-border bg-neutral-50 text-neutral-500',
        orange: 'border-orange-200 bg-orange-50 text-orange-800',
        // Venue
        'gray-strong': 'border-neutral-400 bg-neutral-200 text-neutral-800',
        // Payment
        purple: 'border-purple-200 bg-purple-50 text-purple-800',
      },
      size: {
        sm: 'px-2 py-0 text-[11px]',
        md: '',
      },
    },
    defaultVariants: { tone: 'gray', size: 'md' },
  },
);

type Tone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

/** Chấm màu nhỏ đi kèm nhãn — giúp phân biệt trạng thái cả khi in đen trắng. */
const dotVariants = cva('size-1.5 shrink-0 rounded-full', {
  variants: {
    tone: {
      yellow: 'bg-amber-500',
      'yellow-strong': 'bg-amber-600',
      blue: 'bg-blue-500',
      green: 'bg-primary-600',
      red: 'bg-danger',
      gray: 'bg-neutral-400',
      'gray-light': 'bg-neutral-300',
      orange: 'bg-orange-500',
      'gray-strong': 'bg-neutral-600',
      purple: 'bg-purple-500',
    },
  },
});

/** Booking (7) — docs/07 mục 9, bảng "Trạng thái". */
const BOOKING_TONES: Record<BookingStatus, Tone> = {
  held: 'yellow',
  pending_payment: 'yellow-strong',
  confirmed: 'blue',
  completed: 'green',
  cancelled: 'red',
  expired: 'gray',
  no_show: 'orange',
};

/** Venue (4). */
const VENUE_TONES: Record<VenueStatus, Tone> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  suspended: 'gray-strong',
};

/** Payment (7). */
const PAYMENT_TONES: Record<PaymentStatus, Tone> = {
  pending: 'gray',
  submitted: 'yellow',
  completed: 'green',
  rejected: 'red',
  refunded: 'purple',
  cancelled: 'gray',
  expired: 'gray-light',
};

/** User (3). */
const USER_TONES: Record<UserStatus, Tone> = {
  active: 'green',
  suspended: 'red',
  pending: 'yellow',
};

/** Owner Application (3). */
const APPLICATION_TONES: Record<OwnerApplicationStatus, Tone> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
};

/**
 * Nhãn tiếng Việt. Đọc từ `messages/vi.json` qua `next-intl` ở component cha
 * sẽ tiện hơn, nhưng badge cần chạy được cả trong Server Component không có
 * provider — nên giữ bảng nhãn tại đây và cho phép ghi đè bằng `label`.
 */
const BOOKING_LABELS: Record<BookingStatus, string> = {
  held: 'Đang giữ chỗ',
  pending_payment: 'Chờ duyệt thanh toán',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
  expired: 'Hết hạn',
  no_show: 'Không đến',
};

const VENUE_LABELS: Record<VenueStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  suspended: 'Tạm ngưng',
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: 'Chưa thanh toán',
  submitted: 'Chờ duyệt',
  completed: 'Đã thanh toán',
  rejected: 'Bị từ chối',
  refunded: 'Đã hoàn tiền',
  cancelled: 'Đã huỷ',
  expired: 'Hết hạn',
};

const USER_LABELS: Record<UserStatus, string> = {
  active: 'Hoạt động',
  suspended: 'Đã khoá',
  pending: 'Chờ kích hoạt',
};

const APPLICATION_LABELS: Record<OwnerApplicationStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
};

export type StatusBadgeProps = {
  size?: 'sm' | 'md';
  className?: string;
  /** Ghi đè nhãn hiển thị (ví dụ lấy từ i18n). */
  label?: string;
  /** Ẩn chấm màu. */
  hideDot?: boolean;
} & (
  | { kind: 'booking'; status: BookingStatus }
  | { kind: 'venue'; status: VenueStatus }
  | { kind: 'payment'; status: PaymentStatus }
  | { kind: 'user'; status: UserStatus }
  | { kind: 'application'; status: OwnerApplicationStatus }
);

function resolve(props: StatusBadgeProps): { tone: Tone; label: string } {
  switch (props.kind) {
    case 'booking':
      return { tone: BOOKING_TONES[props.status], label: BOOKING_LABELS[props.status] };
    case 'venue':
      return { tone: VENUE_TONES[props.status], label: VENUE_LABELS[props.status] };
    case 'payment':
      return { tone: PAYMENT_TONES[props.status], label: PAYMENT_LABELS[props.status] };
    case 'user':
      return { tone: USER_TONES[props.status], label: USER_LABELS[props.status] };
    case 'application':
      return { tone: APPLICATION_TONES[props.status], label: APPLICATION_LABELS[props.status] };
  }
}

export function StatusBadge(props: StatusBadgeProps) {
  const { tone, label } = resolve(props);
  const text = props.label ?? label;

  return (
    <span className={cn(badgeVariants({ tone, size: props.size }), props.className)}>
      {!props.hideDot && <span className={cn(dotVariants({ tone }))} aria-hidden="true" />}
      {text}
    </span>
  );
}

export { badgeVariants, BOOKING_TONES, VENUE_TONES, PAYMENT_TONES };
