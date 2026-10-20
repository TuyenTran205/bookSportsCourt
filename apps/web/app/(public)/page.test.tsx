// @vitest-environment jsdom
/**
 * Kiểm thử trang chủ theo SPEC-HOME-003 (docs/specs/homepage-layout-anti-ai-spec.md).
 *
 * Ba nhóm hồi quy chính:
 *  - Emoji bị cấm làm icon UI (CẤM-04) → chip môn thể thao phải dùng Lucide.
 *  - Cấm căn giữa tràn lan (CẤM-02, CẤM-09) → không còn `text-center`.
 *  - Cấm hard-code chuỗi tiếng Việt → mọi chữ đi qua namespace `home`.
 */
import * as React from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import HomePage from './page';

const pushSpy = vi.hoisted(() => vi.fn());

vi.mock('next-intl', () => ({
  // Bản dịch giả lập trả về chính key: test cấu trúc, không phụ thuộc nội dung.
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/navigation/navigate', () => ({
  useAppRouter: () => ({
    push: pushSpy,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

/** Đọc file thật từ đĩa thay vì import — test i18n phải kiểm tra nguồn gốc. */
function readRepoFile(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

const HOME_MESSAGES = (
  JSON.parse(readRepoFile('../../messages/vi.json')) as {
    home: Record<string, string>;
  }
).home;

const PAGE_SOURCE = readRepoFile('./page.tsx');

/** Dải emoji biểu tượng + pictograph — dùng để chặn tái phát CẤM-04. */
const EMOJI_PATTERN =
  /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{FE0F}]/u;

const EXPECTED_SPORT_SLUGS = [
  'cau-long',
  'pickleball',
  'bong-da',
  'tennis',
  'bong-ro',
];

afterEach(() => {
  cleanup();
  pushSpy.mockClear();
});

describe('A — Chip môn thể thao dùng icon, không dùng emoji', () => {
  it('A1: không còn ký tự emoji nào trong nội dung trang', () => {
    const { container } = render(<HomePage />);
    expect(container.textContent ?? '').not.toMatch(EMOJI_PATTERN);
  });

  it('A2: mỗi chip môn thể thao chứa đúng một icon Lucide', () => {
    const { container } = render(<HomePage />);

    for (const slug of EXPECTED_SPORT_SLUGS) {
      const chip = container.querySelector(`a[href="/venues?sport=${slug}"]`);
      expect(chip).not.toBeNull();
      // Đúng một icon, không kèm emoji hay ảnh nào khác.
      expect(chip?.querySelectorAll('svg.lucide')).toHaveLength(1);
      expect(chip?.querySelectorAll('img')).toHaveLength(0);
    }
  });

  it('A3: có đúng 5 chip môn thể thao', () => {
    const { container } = render(<HomePage />);
    const chips = container.querySelectorAll('a[href^="/venues?sport="]');
    expect(chips).toHaveLength(5);

    for (const slug of EXPECTED_SPORT_SLUGS) {
      expect(
        container.querySelector(`a[href="/venues?sport=${slug}"]`),
      ).not.toBeNull();
    }
  });
});

describe('B — Layout Anti-AI: không căn giữa tràn lan', () => {
  it('B1: không phần tử nào dùng class text-center', () => {
    const { container } = render(<HomePage />);
    expect(container.querySelectorAll('.text-center')).toHaveLength(0);
  });

  it('B2: hero dùng grid 12 cột trên desktop', () => {
    const { container } = render(<HomePage />);
    const hero = container.firstElementChild?.querySelector('.lg\\:grid-cols-12');
    expect(hero).not.toBeNull();
  });

  it('B3: cụm chip canh trái bằng justify-start', () => {
    const { container } = render(<HomePage />);
    const chipGroup = container.querySelector('.justify-start');
    expect(chipGroup).not.toBeNull();
    expect(chipGroup?.querySelectorAll('a[href^="/venues?sport="]')).toHaveLength(5);
  });

  it('B4: số liệu thống kê dùng tabular-nums', () => {
    const { container } = render(<HomePage />);
    expect(container.querySelectorAll('.tabular-nums').length).toBeGreaterThan(0);
  });

  it('B5: khối CTA chủ sân chia hai cột bằng md:justify-between', () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector('.md\\:justify-between')).not.toBeNull();
  });
});

describe('C — Toàn bộ chuỗi hiển thị đi qua next-intl', () => {
  const REQUIRED_KEYS = [
    'heroBadge',
    'whySubtitle',
    'ctaTitle',
    'ctaDesc',
    'ctaRegisterOwner',
    'ctaExploreOwner',
  ];

  it('C1: namespace home có đủ 6 khoá mới', () => {
    for (const key of REQUIRED_KEYS) {
      expect(HOME_MESSAGES).toHaveProperty(key);
    }
  });

  it('C2: các khoá mới đều là chuỗi không rỗng', () => {
    for (const key of REQUIRED_KEYS) {
      const value = HOME_MESSAGES[key];
      expect(typeof value).toBe('string');
      expect((value ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('C2b: tiêu đề khối preview và tên sân là hai khoá riêng biệt', () => {
    // Trước đây hai chỗ dùng chung một key nên tiêu đề bị lặp lại ở mọi dòng lịch.
    expect(HOME_MESSAGES.heroPreviewTitle).toBeTruthy();
    expect(HOME_MESSAGES.heroPreviewVenueName).toBeTruthy();
    expect(HOME_MESSAGES.heroPreviewTitle).not.toBe(
      HOME_MESSAGES.heroPreviewVenueName,
    );
  });

  it('C3: source trang chủ không còn chuỗi tiếng Việt hard-code', () => {
    const forbidden = [
      'Bạn là chủ sân thể thao?',
      'Gia nhập mạng lưới',
      'Đăng ký mở cơ sở ngay',
      'Xem thử kênh quản lý',
      'Nền tảng đặt sân thể thao hàng đầu Việt Nam',
      'Công nghệ tiên tiến',
    ];

    for (const literal of forbidden) {
      expect(PAGE_SOURCE).not.toContain(literal);
    }
  });
});

describe('D — Hành vi tìm kiếm và điều hướng', () => {
  it('D1: submit ô tìm kiếm điều hướng tới /venues?q=...', () => {
    render(<HomePage />);

    const input = screen.getByPlaceholderText('searchPlaceholder');
    fireEvent.change(input, { target: { value: '  Quận 1  ' } });

    const form = input.closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith('/venues?q=Qu%E1%BA%ADn%201');
  });

  it('D1b: submit khi ô tìm kiếm rỗng thì về /venues', () => {
    render(<HomePage />);

    const input = screen.getByPlaceholderText('searchPlaceholder');
    const form = input.closest('form');
    fireEvent.submit(form as HTMLFormElement);

    expect(pushSpy).toHaveBeenCalledWith('/venues');
  });

  it('D2: chip môn thể thao trỏ đúng query sport', () => {
    const { container } = render(<HomePage />);

    for (const slug of EXPECTED_SPORT_SLUGS) {
      const chip = container.querySelector(`a[href="/venues?sport=${slug}"]`);
      expect(chip).not.toBeNull();
    }
  });

  it('D3: CTA đăng ký chủ sân trỏ /owner/apply', () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector('a[href="/owner/apply"]')).not.toBeNull();
  });

  it('D4: CTA xem kênh quản lý trỏ /owner/timeline', () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector('a[href="/owner/timeline"]')).not.toBeNull();
  });

  it('D5: trang có đúng một thẻ h1', () => {
    const { container } = render(<HomePage />);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });
});

describe('E — Tương phản nút trên banner CTA nền tối', () => {
  it('E1: nút outline không giữ nền sáng bg-bg (chữ trắng trên nền trắng)', () => {
    const { container } = render(<HomePage />);
    const cta = container.querySelector('a[href="/owner/timeline"]');
    expect(cta).not.toBeNull();

    const classes = Array.from(cta?.classList ?? []);
    // Variant `outline` mặc định mang bg-bg + text-neutral-900; trên banner
    // primary-800 phải bị ghi đè thành nền trong suốt, nếu không chữ trắng
    // sẽ chìm hẳn vào nền trắng của nút.
    expect(classes).not.toContain('bg-bg');
    expect(classes).toContain('bg-transparent');
    expect(classes).toContain('text-white');
  });
});
