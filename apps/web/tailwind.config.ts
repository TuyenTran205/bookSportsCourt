import type { Config } from 'tailwindcss';

/**
 * Tailwind – map token ở globals.css thành class.
 *
 * Nguồn: docs/07-design-system.md mục 4. Tài liệu cảnh báo rõ: nếu khai báo
 * trong `theme.extend` mà KHÔNG map sang `var(--color-*)` thì các class như
 * `bg-primary` sẽ không resolve — nên mọi khoá màu ở đây đều trỏ về biến CSS.
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './mocks/**/*.{ts,tsx}',
  ],
  theme: {
    // Breakpoint chuẩn của Tailwind, KHÔNG override (docs/09 mục Responsive).
    container: {
      center: true,
      padding: { DEFAULT: '1rem', md: '1.5rem', xl: '2rem' },
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        primary: {
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
          // `bg-primary` không hậu tố → mặc định lấy 600, chữ phải font-semibold
          DEFAULT: 'var(--color-primary-600)',
        },
        accent: {
          500: 'var(--color-accent-500)',
          600: 'var(--color-accent-600)',
          700: 'var(--color-accent-700)',
          DEFAULT: 'var(--color-accent-600)',
        },
        neutral: {
          0: 'var(--color-neutral-0)',
          50: 'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          400: 'var(--color-neutral-400)',
          500: 'var(--color-neutral-500)',
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-700)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',

        /* Surfaces & text */
        bg: {
          DEFAULT: 'var(--color-bg)',
          card: 'var(--color-bg-card)',
          subtle: 'var(--color-bg-subtle)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          focus: 'var(--color-border-focus)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
        },

        /* SlotGrid – tách `bg` và `text` cho từng trạng thái (mục 5) */
        slot: {
          available: 'var(--color-slot-available)',
          'available-text': 'var(--color-slot-available-text)',
          held: 'var(--color-slot-held)',
          'held-text': 'var(--color-slot-held-text)',
          booked: 'var(--color-slot-booked)',
          'booked-text': 'var(--color-slot-booked-text)',
          'my-hold': 'var(--color-slot-my-hold)',
          'my-hold-text': 'var(--color-slot-my-hold-text)',
          blocked: 'var(--color-slot-blocked)',
          'blocked-text': 'var(--color-slot-blocked-text)',
          past: 'var(--color-slot-past)',
          'past-text': 'var(--color-slot-past-text)',
        },
      },
      borderRadius: {
        /* docs/07 mục 6 – bo góc theo cấp bậc, không bo tròn đồng loạt */
        DEFAULT: '8px',
        btn: '8px',
        card: '12px',
        input: '8px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      fontFamily: {
        // docs/07 mục 4: Be Vietnam Pro là font chính, Inter là fallback.
        sans: ['var(--font-be-vietnam-pro)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      transitionDuration: {
        hover: '150ms',
        fade: '200ms',
        panel: '300ms',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 200ms ease-out',
        'accordion-up': 'accordion-up 200ms ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
