'use client';

import * as React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="vi">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-sans text-slate-900 antialiased">
        <div
          role="alert"
          className="flex w-full max-w-md flex-col items-center rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg
              className="size-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          <h1 className="mt-4 text-lg font-semibold text-slate-900">
            Đã xảy ra sự cố không mong muốn
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Hệ thống gặp lỗi nghiêm trọng khi tải giao diện. Vui lòng thử lại hoặc tải lại trang.
          </p>

          {error.digest && (
            <p className="mt-2 text-xs text-slate-400">Mã lỗi: {error.digest}</p>
          )}

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full inline-flex items-center justify-center h-10 px-4 rounded-lg bg-emerald-700 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
              className="w-full inline-flex items-center justify-center h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
