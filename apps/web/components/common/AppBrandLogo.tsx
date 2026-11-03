'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

export interface AppBrandLogoProps {
  /** Kích thước vuông (px): mặc định 80px */
  size?: number;
  /** Bán kính bo góc (px): mặc định 20px */
  borderRadius?: number;
  /** Hiển thị bóng đổ nhận diện: mặc định true */
  showShadow?: boolean;
  /** Ưu tiên nạp ảnh sớm (LCP optimization) */
  priority?: boolean;
  /** Class tùy biến bổ sung */
  className?: string;
  /** Ép hiển thị chế độ vector fallback (dùng cho test/offline) */
  forceFallback?: boolean;
}

/**
 * Biểu tượng quả bóng thể thao vector SVG sắc nét
 */
function SoccerBallIcon({ size }: { size: number }) {
  return (
    <svg
      data-testid="sports-ball-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="relative z-10 text-neutral-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
      <polygon
        points="12,7 16,10 14.5,15 9.5,15 8,10"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M12 7V2 M16 10l4.5-1.5 M14.5 15l3 4 M9.5 15l-3 4 M8 10l-4.5-1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Logo nhận diện thương hiệu BookSportsCourt
 * Hỗ trợ hiển thị ảnh raster `app_logo.png` và tự động chuyển sang Vector SVG Fallback
 * mô phỏng sân vận động xanh chuẩn xác như phiên bản Mobile Flutter.
 */
export function AppBrandLogo({
  size = 80,
  borderRadius = 20,
  showShadow = true,
  priority = false,
  className,
  forceFallback = false,
}: AppBrandLogoProps) {
  const [hasError, setHasError] = React.useState(false);

  const shadowStyle = showShadow
    ? '0 8px 20px -4px rgba(21, 128, 61, 0.22), 0 2px 6px 0 rgba(0, 0, 0, 0.06)'
    : undefined;

  const isFallback = forceFallback || hasError;

  return (
    <div
      data-testid="app-brand-logo"
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden select-none',
        isFallback ? 'bg-primary-700' : 'bg-neutral-0',
        className
      )}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${borderRadius}px`,
        boxShadow: shadowStyle,
      }}
    >
      {isFallback ? (
        <div
          data-testid="app-brand-logo-fallback"
          className="relative flex h-full w-full items-center justify-center overflow-hidden bg-primary-700"
        >
          {/* Vòng tròn tâm sân */}
          <div
            data-testid="pitch-center-circle"
            className="absolute rounded-full border border-white/30"
            style={{
              width: `${size * 0.65}px`,
              height: `${size * 0.65}px`,
              borderWidth: '1.5px',
            }}
          />
          {/* Vạch kẻ giữa sân */}
          <div
            data-testid="pitch-center-line"
            className="absolute bg-white/25"
            style={{
              width: '1.5px',
              height: `${size}px`,
            }}
          />
          {/* Biểu tượng thể thao trung tâm */}
          <SoccerBallIcon size={size * 0.45} />
        </div>
      ) : (
        <Image
          src="/images/app_logo.png"
          alt="BookSportsCourt Logo"
          width={size}
          height={size}
          priority={priority}
          onError={() => setHasError(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
