import { z } from "zod";

export const MailEventPayload = z
  .object({
    bookingId: z.string().uuid(),
    paymentId: z.string().uuid().optional(),
    venueId: z.string().uuid(),
  })
  .strict();

export const mailSubjects: Record<string, string> = {
  booking_confirmed: "Đặt sân đã được xác nhận",
  booking_cancelled: "Đặt sân đã bị huỷ",
  payment_rejected: "Thanh toán đã bị từ chối",
  payment_submitted: "Đã nhận chứng từ thanh toán",
  booking_reminder: "Nhắc lịch đặt sân sắp tới",
};

export interface BookingMailView {
  venueName: string;
  courtName: string;
  start: Date;
  end: Date;
  totalPrice: number;
  depositAmount: number;
}
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );

export function renderBookingMail(
  event: string,
  bookingId: string,
  view: BookingMailView,
) {
  const subject = Object.hasOwn(mailSubjects, event)
    ? mailSubjects[event]
    : undefined;
  if (!subject) throw new Error("UNSUPPORTED_MAIL_EVENT");
  const time = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
    hourCycle: "h23",
  });
  const money = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  });
  const lines = [
    subject,
    `Mã đặt sân: ${bookingId}`,
    `Cơ sở: ${view.venueName}`,
    `Sân: ${view.courtName}`,
    `Thời gian (giờ Việt Nam): ${time.format(view.start)} – ${time.format(view.end)}`,
    `Tổng giá: ${money.format(view.totalPrice)}`,
    `Tiền cọc: ${money.format(view.depositAmount)}`,
    "Đăng nhập BookSportsCourt để xem trạng thái mới nhất và chi tiết đặt sân.",
    "Email ghi nhận sự kiện; trạng thái đặt sân có thể đã được cập nhật sau đó.",
  ];
  return {
    subject,
    text: lines.join("\n"),
    html: lines.map((line) => `<p>${escape(line)}</p>`).join(""),
  };
}
