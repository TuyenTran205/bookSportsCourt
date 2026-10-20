import Link from 'next/link';
import { Calendar, Mail, MapPin, Phone } from 'lucide-react';

/**
 * Footer – Chân trang chuẩn dùng chung toàn hệ thống (docs/07-design-system.md).
 * Trình bày thông tin doanh nghiệp, chính sách, hỗ trợ và thông tin tiền tệ/múi giờ.
 */
export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50 text-neutral-600">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Cột 1 & 2: Thương hiệu & giới thiệu */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-bold text-primary-700 transition-colors hover:text-primary-800"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary-700 text-white">
                <Calendar className="size-5" />
              </div>
              <span>BookSportsCourt</span>
            </Link>
            <p className="max-w-sm text-sm text-neutral-500">
              Nền tảng đặt sân thể thao trực tuyến hàng đầu Việt Nam. Kết nối người chơi với hơn 500+ cơ sở thể thao
              toàn quốc. Cập nhật lịch trống thời gian thực, giữ chỗ 10 phút.
            </p>
            <div className="flex flex-col gap-2 pt-2 text-xs text-neutral-500">
              <div className="flex items-center gap-2">
                <MapPin className="size-3.5 text-neutral-400" />
                <span>Hà Nội, Việt Nam</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-3.5 text-neutral-400" />
                <span>Hotline: 1900 xxxx (08:00 – 22:00)</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-3.5 text-neutral-400" />
                <span>Hỗ trợ: support@booksportscourt.vn</span>
              </div>
            </div>
          </div>

          {/* Cột 3: Dành cho người chơi */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">Người chơi</h3>
            <ul className="flex flex-col gap-2 text-sm text-neutral-500">
              <li>
                <Link href="/venues" className="transition-colors hover:text-primary-700">
                  Tìm sân thể thao
                </Link>
              </li>
              <li>
                <Link href="/bookings" className="transition-colors hover:text-primary-700">
                  Lịch đặt của tôi
                </Link>
              </li>
              <li>
                <Link href="/favorites" className="transition-colors hover:text-primary-700">
                  Sân yêu thích
                </Link>
              </li>
              <li>
                <span className="text-neutral-400">Hướng dẫn đặt sân</span>
              </li>
            </ul>
          </div>

          {/* Cột 4: Dành cho chủ sân */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">Dành cho chủ sân</h3>
            <ul className="flex flex-col gap-2 text-sm text-neutral-500">
              <li>
                <Link href="/owner/timeline" className="transition-colors hover:text-primary-700">
                  Kênh quản lý lịch sân
                </Link>
              </li>
              <li>
                <Link href="/owner/apply" className="transition-colors hover:text-primary-700">
                  Đăng ký mở cơ sở
                </Link>
              </li>
              <li>
                <span className="text-neutral-400">Quy trình duyệt thanh toán</span>
              </li>
              <li>
                <span className="text-neutral-400">Chính sách phí đối tác (0đ)</span>
              </li>
            </ul>
          </div>

          {/* Cột 5: Quy định & Chính sách */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">Quy định & Chính sách</h3>
            <ul className="flex flex-col gap-2 text-sm text-neutral-500">
              <li>
                <span className="text-neutral-400">Điều khoản dịch vụ</span>
              </li>
              <li>
                <span className="text-neutral-400">Chính sách bảo mật</span>
              </li>
              <li>
                <span className="text-neutral-400">Chính sách huỷ & hoàn cọc</span>
              </li>
              <li>
                <span className="text-neutral-400">Quy chế hoạt động</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Dòng chân trang */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-6 text-xs text-neutral-400 sm:flex-row">
          <p>© 2026 BookSportsCourt. Mọi quyền được bảo lưu.</p>
          <div className="flex items-center gap-4">
            <span>Tiền tệ: VND (₫)</span>
            <span>•</span>
            <span>Múi giờ: Asia/Ho_Chi_Minh (GMT+7)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
