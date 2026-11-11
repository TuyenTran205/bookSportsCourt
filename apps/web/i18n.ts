import { getRequestConfig } from 'next-intl/server';

/**
 * Cấu hình i18n.
 *
 * MVP chỉ có tiếng Việt (docs/09-frontend-conventions.md), nhưng mọi chuỗi hiển
 * thị vẫn phải đi qua `t()` ngay từ đầu — thêm ngôn ngữ sau chỉ là thêm file
 * `messages/*.json`, không phải đi lùng chuỗi hard-code trong component.
 *
 * Không dùng tiền tố locale trên URL (`/vi/venues`) vì tài liệu quy định route
 * là `/venues`, `/dashboard`… nên chỉ có một locale duy nhất.
 */
export default getRequestConfig(async () => {
  const locale = 'vi';

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    // Định dạng ngày/giờ/số theo chuẩn Việt Nam.
    formats: {
      dateTime: {
        short: { day: '2-digit', month: '2-digit', year: 'numeric' },
        long: { day: '2-digit', month: 'long', year: 'numeric' },
      },
      number: {
        currency: { style: 'currency', currency: 'VND', maximumFractionDigits: 0 },
      },
    },
    timeZone: 'Asia/Ho_Chi_Minh',
  };
});
