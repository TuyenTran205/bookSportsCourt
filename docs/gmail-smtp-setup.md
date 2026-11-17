# Gmail SMTP cho BookSportsCourt

> **Phiên bản:** 1.0.0 | **Cập nhật lần cuối:** 2026-11-17

## Phạm vi

Bổ sung transport cho BSC-045, dùng chung với xác thực email CUS-01 và khôi phục mật khẩu CUS-16. Mặc định vẫn là Resend. Không thay đổi endpoint, schema DB hoặc nghiệp vụ booking. Dependency được ghi trong ADR-032 trước khi cài đặt.

## Cấu hình

Gmail cần bật xác minh hai bước và tạo App Password. Không dùng mật khẩu đăng nhập Google. Đặt cấu hình trong `.env.local` ở gốc repo (không commit), hoặc biến môi trường backend khi deploy:

```dotenv
MAIL_PROVIDER=gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-team@gmail.com
SMTP_PASS=your-16-letter-app-password
MAIL_FROM="BookSportsCourt <your-team@gmail.com>"
AUTH_FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
BUSINESS_MAIL_ENABLED=false
```

Thay SMTP_USER/SMTP_PASS bằng thông tin thật; MAIL_FROM phải chứa đúng SMTP_USER. Mật khẩu ứng dụng gồm 16 chữ cái; có thể dán dạng Google hiển thị có khoảng trắng. Không gửi secret qua chat/log. Backend chỉ chấp nhận smtp.gmail.com; cổng 465 dùng TLS ngay, hoặc cổng 587 với SMTP_SECURE=false và bắt buộc STARTTLS. Kiểm tra chứng chỉ TLS luôn bật. Không cần RESEND_API_KEY khi chọn Gmail.

Khởi động lại `pnpm --filter @bsc/api dev`. Email xác thực và đặt lại mật khẩu hoạt động độc lập với BUSINESS_MAIL_ENABLED; chỉ bật true khi muốn worker gửi email nghiệp vụ. Khi deploy, AUTH_FRONTEND_URL và ALLOWED_ORIGINS phải là origin HTTPS của frontend thực tế. Render Free chặn các cổng SMTP, nên dùng Resend HTTP API trên môi trường đó.

Thử đăng ký bằng một email khác và thử quên mật khẩu; kiểm tra Inbox/Spam, đường dẫn và xác thực token. SMTP chấp nhận thư không đồng nghĩa đã vào Inbox. Test tự động dùng transport giả, không gửi thư thật.

## Retry và chuyển provider

- Resend giữ retry bằng body/key đã đóng băng, tối đa 5 lần trong cửa sổ hiện có.
- Gmail gửi từng người nhận. Phản hồi SMTP 4xx rõ ràng có thể retry, 5xx chuyển failed. Mất kết nối/timeout/kết quả không rõ chuyển delivery_unknown ngay, không tự retry.
- Snapshot email_request lưu provider, thiếu field trên dữ liệu cũ hiểu là Resend. Đây là metadata trong JSONB hiện có, không thay đổi schema DB. Provider không được đưa vào HTTP body Resend hay nội dung SMTP.
- Worker Gmail mất lease sau khi freeze snapshot sẽ chuyển delivery_unknown khi phục hồi, kể cả crash trước network. Chấp nhận cần kiểm tra thủ công để tránh gửi trùng sau crash/ACK DB thất bại. Không cam kết exactly-once SMTP.
- Trước khi đổi provider hoặc cập nhật từ worker cũ: dừng/drain worker, kiểm tra processing/pending/unknown rồi mới khởi động phiên bản mới. Snapshot khác provider sẽ dừng với PROVIDER_CHANGED_RECONCILE; không tự chuyển sang nhà cung cấp khác. Không rolling deploy lẫn worker cũ/mới.
- `mail:retry <UUID>` chỉ áp dụng job failed trong cửa sổ an toàn. Job delivery_unknown cần đối soát; không tự đổi trạng thái hoặc xoá snapshot để ép gửi lại.

## Kiểm thử

`pnpm --filter @bsc/api test:business-mail` bao gồm kiểm tra cấu hình, Auth qua SMTP giả, TLS/STARTTLS, lỗi được làm sạch và PostgreSQL concurrency/retry/crash/provider-switch. Các test DB cần VENUE_TEST_DATABASE_URL trỏ PostgreSQL local và tự tạo schema cô lập. Chạy thêm test:auth, test:password-recovery, typecheck và build của @bsc/api.

Kiểm chứng local 2026-11-17: test email/worker, Auth/guards và password recovery đạt; API typecheck/build và kiểm tra định dạng các file TypeScript thay đổi đạt. Dùng PostgreSQL 18 riêng trên loopback, cài extension btree_gist/pg_trgm/unaccent trong public trước khi chạy các suite đồng thời. Fixture password recovery đặt rõ provider Resend và giới hạn 10 request, giữ kiểm tra cấu hình thật khi thay network bằng transport giả. Chưa gửi Gmail thật hoặc nghiệm thu môi trường deploy; cần App Password và smoke inbox riêng.

Tài liệu tham khảo: [Google App Password](https://support.google.com/accounts/answer/185833), [Nodemailer SMTP](https://nodemailer.com/smtp), [Render Free](https://render.com/docs/free#other-limitations).
