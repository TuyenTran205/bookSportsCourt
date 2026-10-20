"use client";

import * as React from "react";
import { X } from "lucide-react";
import { AppBrandLogo } from "@/components/common/AppBrandLogo";
import { cn } from "@/lib/utils/cn";

export interface SplashBrandRevealProps {
    /** Thời gian hiển thị hiệu ứng trước khi bắt đầu fade-out (ms). Mặc định 1850ms */
    duration?: number;
    /** Thời gian chuyển tiếp hiệu ứng biến mất (ms). Mặc định 400ms */
    exitDuration?: number;
    /** Callback kích hoạt khi splash screen đã đóng hoàn toàn */
    onFinished?: () => void;
    /** Ép buộc hiển thị bất chấp sessionStorage (dành cho Demo, Review, Testing) */
    forceShow?: boolean;
    /** Cờ báo hiệu client app đã sẵn sàng (Mock / Auth). Nếu chưa sẵn sàng, giữ màn hình mượt mà */
    isAppReady?: boolean;
}

const STORAGE_KEY = "bsc_welcome_splash_shown";

/**
 * Kiểm tra xem có cần hiển thị màn hình chào mừng thương hiệu không
 */
function checkShouldShow(forceShow?: boolean): boolean {
    if (forceShow) return true;
    if (typeof window === "undefined") return false;

    try {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get("splash") === "force" || searchParams.get("welcome") === "1") {
            return true;
        }
    } catch {
        // Không thể đọc searchParams: bỏ qua
    }

    try {
        const hasShown = sessionStorage.getItem(STORAGE_KEY);
        return hasShown !== "true";
    } catch {
        // sessionStorage bị chặn: an toàn bỏ qua
        return false;
    }
}

/**
 * Màn hình chào mừng thương hiệu (Splash Brand Reveal / Welcome Screen)
 * Đồng bộ nhận diện cao cấp từ Mobile Flutter sang Web:
 * - Sóng radar pulse ngọc lục bảo tỏa từ tâm logo.
 * - Khối logo nổi bật với hiệu ứng bung mở êm ái.
 * - Tiêu đề BookSportsCourt và Slogan định vị thương hiệu.
 * - Huy hiệu xác thực hệ thống sân bãi thể thao Việt Nam.
 * - Nút "Bỏ qua" và phím Escape giúp người dùng không bao giờ bị giam giữ.
 */
export function SplashBrandReveal({
    duration = 1850,
    exitDuration = 400,
    onFinished,
    forceShow = false,
    isAppReady = true,
}: SplashBrandRevealProps) {
    const [mounted, setMounted] = React.useState(false);
    // Xác định ngay trong lần render đầu tiên để tránh chớp giật layout
    const shouldShow = React.useMemo(() => checkShouldShow(forceShow), [forceShow]);
    const [isVisible, setIsVisible] = React.useState(shouldShow);
    const [isExiting, setIsExiting] = React.useState(false);
    const [isDismissed, setIsDismissed] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const isExitingRef = React.useRef(false);
    const isDismissedRef = React.useRef(false);
    const durationPassedRef = React.useRef(false);

    // Kiểm tra giảm chuyển động (prefers-reduced-motion)
    const prefersReducedMotion = React.useMemo(() => {
        if (typeof window === "undefined") return false;
        try {
            return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
        } catch {
            return false;
        }
    }, []);

    const actualDuration = prefersReducedMotion ? Math.min(duration, 600) : duration;

    // Hàm kích hoạt hiệu ứng thoát và đóng Splash
    const handleDismiss = React.useCallback(() => {
        if (isExitingRef.current || isDismissedRef.current) return;
        isExitingRef.current = true;
        setIsExiting(true);

        try {
            document.body.style.overflow = "";
        } catch {
            // bỏ qua
        }

        setTimeout(() => {
            isDismissedRef.current = true;
            setIsDismissed(true);
            onFinished?.();
        }, exitDuration);
    }, [exitDuration, onFinished]);

    // Đánh dấu đã hiển thị vào sessionStorage ngay khi mở
    React.useEffect(() => {
        if (!shouldShow) return;

        try {
            sessionStorage.setItem(STORAGE_KEY, "true");
        } catch {
            // bỏ qua nếu bị chặn lưu trữ
        }
    }, [shouldShow]);

    // Khóa cuộn trang khi Splash đang hiển thị để tránh xô lệch layout
    React.useEffect(() => {
        if (!isVisible || isDismissed) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isVisible, isDismissed]);

    // Lắng nghe phím Escape để bỏ qua tức thì
    React.useEffect(() => {
        if (!isVisible || isDismissed) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                handleDismiss();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isVisible, isDismissed, handleDismiss]);

    // Bộ đếm thời gian hiển thị & Watchdog an toàn
    React.useEffect(() => {
        if (!isVisible || isExiting || isDismissed) return;

        let timer: NodeJS.Timeout | null = null;
        let watchdogTimer: NodeJS.Timeout | null = null;

        // Watchdog an toàn tối đa 4000ms: chống kẹt vô hạn trong mọi tình huống
        watchdogTimer = setTimeout(() => {
            handleDismiss();
        }, 4000);

        timer = setTimeout(() => {
            durationPassedRef.current = true;
            if (isAppReady) {
                handleDismiss();
            }
        }, actualDuration);

        return () => {
            if (timer) clearTimeout(timer);
            if (watchdogTimer) clearTimeout(watchdogTimer);
        };
    }, [isVisible, isExiting, isDismissed, actualDuration, isAppReady, handleDismiss]);

    // Khi app sẵn sàng sau khi thời gian hoạt cảnh đã trôi qua
    React.useEffect(() => {
        if (isAppReady && durationPassedRef.current && !isExiting && !isDismissed) {
            handleDismiss();
        }
    }, [isAppReady, isExiting, isDismissed, handleDismiss]);

    // Không hiển thị nếu chưa mount ở client (tránh hydration mismatch), đã từng xem trong session hoặc đã đóng
    if (!mounted || !isVisible || isDismissed) {
        return null;
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Chào mừng đến với BookSportsCourt"
            data-testid="splash-brand-reveal"
            className={cn(
                "fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden bg-neutral-0 p-6 select-none transition-opacity ease-out",
                isExiting ? "opacity-0 pointer-events-none" : "opacity-100",
            )}
            style={{
                transitionDuration: `${exitDuration}ms`,
            }}
        >
            {/* Vùng phát sáng ngọc lục bảo tinh tế ở đỉnh (Subtle Emerald Wash) */}
            <div
                className="pointer-events-none absolute -top-[30vw] left-1/2 -translate-x-1/2 h-[80vw] w-[80vw] max-w-[850px] max-h-[850px] rounded-full"
                style={{
                    background: "radial-gradient(circle, rgba(240, 253, 244, 0.85) 0%, rgba(255, 255, 255, 0) 70%)",
                }}
                aria-hidden="true"
            />

            {/* Nút Bỏ qua ở góc phải trên (Touch target >= 44x44px) */}
            <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-20">
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="Bỏ qua màn hình chào"
                    data-testid="splash-skip-button"
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-btn border border-neutral-200/80 bg-neutral-0/90 hover:bg-neutral-100 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-primary-600"
                >
                    <X className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    <span>Bỏ qua</span>
                </button>
            </div>

            {/* Khoảng đệm đỉnh */}
            <div className="h-10 w-full" aria-hidden="true" />

            {/* Khu vực trung tâm: Logo + Sóng radar + Tiêu đề & Slogan */}
            <div className="relative flex flex-col items-center justify-center text-center">
                {/* Khối Logo và Vòng sóng Radar */}
                <div className="relative flex items-center justify-center">
                    {/* Vòng sóng Radar Pulse ngọc lục bảo (Tắt khi prefers-reduced-motion) */}
                    {!prefersReducedMotion && (
                        <div
                            data-testid="radar-pulse-ring"
                            className="pointer-events-none absolute h-[104px] w-[104px] sm:h-[120px] sm:w-[120px] rounded-full border-2 border-primary-400 animate-bsc-radar-pulse"
                            style={{
                                animationDelay: "350ms",
                            }}
                            aria-hidden="true"
                        />
                    )}

                    {/* Logo nhận diện thương hiệu */}
                    <div className={cn(!prefersReducedMotion && "animate-bsc-logo-entrance")}>
                        <AppBrandLogo size={96} borderRadius={22} showShadow={true} priority={true} />
                    </div>
                </div>

                {/* Khoảng cách */}
                <div className="h-6" aria-hidden="true" />

                {/* Tiêu đề thương hiệu & Khẩu hiệu */}
                <div
                    className={cn(
                        "flex flex-col items-center text-center",
                        !prefersReducedMotion && "animate-bsc-slide-up-fade",
                    )}
                >
                    <div className="flex items-center text-2xl sm:text-3xl font-extrabold tracking-tight">
                        <span className="text-neutral-900">BookSports</span>
                        <span className="text-primary-700">Court</span>
                    </div>
                    <p className="mt-1.5 text-xs sm:text-sm font-medium text-neutral-600 tracking-wide">
                        Đặt sân tức thì • Kết nối đam mê
                    </p>
                </div>
            </div>

            {/* Chân trang: Huy hiệu xác thực hệ thống sân bãi Việt Nam */}
            <div
                data-testid="splash-footer-badge"
                className={cn(
                    "flex flex-col items-center gap-2 mb-6 sm:mb-8",
                    !prefersReducedMotion && "animate-bsc-badge-fade",
                )}
            >
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary-50 border border-primary-200 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-primary-600 ring-2 ring-primary-100" aria-hidden="true" />
                    <span className="text-xs font-semibold text-primary-800 tracking-tight">
                        Hệ thống sân bãi thể thao Việt Nam
                    </span>
                </div>
                <span className="text-[11px] sm:text-xs text-neutral-400 font-normal">
                    Phiên bản 2.2.0 • Pioneering In Technology
                </span>

                {/* Thanh chỉ báo nạp mảnh khi app chưa hoàn tất chuẩn bị ngầm */}
                {!isAppReady && (
                    <div
                        role="progressbar"
                        aria-label="Đang nạp dữ liệu"
                        className="mt-1 h-0.5 w-28 overflow-hidden rounded-full bg-primary-100"
                    >
                        <div className="h-full w-full bg-primary-600 animate-pulse" />
                    </div>
                )}
            </div>
        </div>
    );
}
