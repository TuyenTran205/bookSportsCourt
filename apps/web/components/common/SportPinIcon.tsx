'use client';

import * as React from 'react';

export interface SportPinIconProps extends React.SVGProps<SVGSVGElement> {
  sport?: string | null;
  size?: number | string;
  className?: string;
  title?: string;
}

const PIN_PATH = 'M 24 52 C 15 42 6 30 6 20 A 18 18 0 1 1 42 20 C 42 30 33 42 24 52 Z';

interface SportPinDef {
  id: string;
  name: string;
  gradStart: string;
  gradEnd: string;
  renderSymbol: () => React.ReactNode;
}

const SPORT_PIN_DEFS: Record<string, SportPinDef> = {
  // 1. Cầu lông
  badminton: {
    id: 'badminton',
    name: 'Cầu lông',
    gradStart: '#059669',
    gradEnd: '#047857',
    renderSymbol: () => (
      <g>
        <path
          d="M 17 14 L 21.5 24 Q 24 25.5 26.5 24 L 31 14 Z"
          fill="#E2E8F0"
          stroke="#059669"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <line x1="24" y1="13.5" x2="24" y2="24.5" stroke="#059669" strokeWidth="0.8" />
        <line x1="20" y1="14" x2="22.5" y2="24.5" stroke="#059669" strokeWidth="0.7" />
        <line x1="28" y1="14" x2="25.5" y2="24.5" stroke="#059669" strokeWidth="0.7" />
        <line x1="17.2" y1="14.2" x2="21.5" y2="24.5" stroke="#059669" strokeWidth="0.7" />
        <line x1="30.8" y1="14.2" x2="26.5" y2="24.5" stroke="#059669" strokeWidth="0.7" />
        <path d="M 18.5 17 Q 24 18.5 29.5 17" fill="none" stroke="#059669" strokeWidth="0.8" />
        <path d="M 20 20.5 Q 24 22 28 20.5" fill="none" stroke="#059669" strokeWidth="0.8" />
        <path
          d="M 17 14 Q 18.5 13 20 14 Q 22 13 24 14 Q 26 13 28 14 Q 29.5 13 31 14"
          fill="none"
          stroke="#059669"
          strokeWidth="0.9"
        />
        <path
          d="M 21.5 24.5 Q 24 25.5 26.5 24.5 C 26.8 27.5 21.2 27.5 21.5 24.5 Z"
          fill="#047857"
          stroke="#047857"
          strokeWidth="0.5"
        />
        <path d="M 21.7 24.8 Q 24 25.6 26.3 24.8" fill="none" stroke="#F59E0B" strokeWidth="0.7" />
      </g>
    ),
  },

  // 2. Bóng đá
  soccer: {
    id: 'soccer',
    name: 'Bóng đá',
    gradStart: '#16a34a',
    gradEnd: '#15803d',
    renderSymbol: () => (
      <g>
        <circle cx="24" cy="20" r="9" fill="#FFFFFF" stroke="#15803d" strokeWidth="1.2" />
        <polygon points="24,17.5 26.4,19.2 25.5,21.8 22.5,21.8 21.6,19.2" fill="#15803d" />
        <line x1="24" y1="17.5" x2="24" y2="15" stroke="#15803d" strokeWidth="1" />
        <line x1="26.4" y1="19.2" x2="28.8" y2="18.2" stroke="#15803d" strokeWidth="1" />
        <line x1="25.5" y1="21.8" x2="27.2" y2="24" stroke="#15803d" strokeWidth="1" />
        <line x1="22.5" y1="21.8" x2="20.8" y2="24" stroke="#15803d" strokeWidth="1" />
        <line x1="21.6" y1="19.2" x2="19.2" y2="18.2" stroke="#15803d" strokeWidth="1" />
        <path d="M 22.2 12.5 Q 24 12 25.8 12.5 L 25.2 14.5 L 22.8 14.5 Z" fill="#15803d" />
        <path d="M 30.5 15.5 Q 32.2 17.5 32.5 19.5 L 30.2 19 L 29 17 Z" fill="#15803d" />
        <path d="M 29.5 26 Q 27.5 27.8 25.5 28.5 L 25.8 26.5 L 28 25 Z" fill="#15803d" />
        <path d="M 18.5 26 Q 20.5 27.8 22.5 28.5 L 22.2 26.5 L 20 25 Z" fill="#15803d" />
        <path d="M 17.5 15.5 Q 15.8 17.5 15.5 19.5 L 17.8 19 L 19 17 Z" fill="#15803d" />
      </g>
    ),
  },

  // 3. Pickleball
  pickleball: {
    id: 'pickleball',
    name: 'Pickleball',
    gradStart: '#f59e0b',
    gradEnd: '#d97706',
    renderSymbol: () => (
      <g>
        <g transform="rotate(-25 21 20)">
          <rect x="16" y="11" width="10" height="12" rx="3" fill="#F59E0B" stroke="#B45309" strokeWidth="1" />
          <rect
            x="17.5"
            y="12.5"
            width="7"
            height="9"
            rx="2"
            fill="none"
            stroke="#FDE68A"
            strokeWidth="0.6"
            strokeDasharray="1.5 1"
          />
          <path d="M 19.5 23 L 22.5 23 L 22 28 L 20 28 Z" fill="#B45309" stroke="#92400E" strokeWidth="0.8" />
          <line x1="20" y1="24.5" x2="22" y2="24.5" stroke="#FFFFFF" strokeWidth="0.6" />
          <line x1="20" y1="26" x2="22" y2="26" stroke="#FFFFFF" strokeWidth="0.6" />
        </g>
        <g transform="translate(28, 20)">
          <circle cx="0" cy="0" r="5" fill="#FDE047" stroke="#CA8A04" strokeWidth="1" />
          <circle cx="0" cy="0" r="0.9" fill="#CA8A04" />
          <circle cx="-2.3" cy="-1.5" r="0.8" fill="#CA8A04" />
          <circle cx="2.3" cy="-1.5" r="0.8" fill="#CA8A04" />
          <circle cx="-2.3" cy="1.8" r="0.8" fill="#CA8A04" />
          <circle cx="2.3" cy="1.8" r="0.8" fill="#CA8A04" />
          <circle cx="0" cy="-3.3" r="0.7" fill="#CA8A04" />
          <circle cx="0" cy="3.3" r="0.7" fill="#CA8A04" />
        </g>
      </g>
    ),
  },

  // 4. Tennis
  tennis: {
    id: 'tennis',
    name: 'Tennis',
    gradStart: '#84cc16',
    gradEnd: '#4d7c0f',
    renderSymbol: () => (
      <g>
        <g transform="rotate(-30 22 19)">
          <ellipse cx="22" cy="15" rx="6.5" ry="7.5" fill="none" stroke="#4D7C0F" strokeWidth="1.2" />
          <line x1="18.5" y1="12" x2="18.5" y2="18" stroke="#4D7C0F" strokeWidth="0.5" opacity="0.6" />
          <line x1="22" y1="8" x2="22" y2="22" stroke="#4D7C0F" strokeWidth="0.5" opacity="0.7" />
          <line x1="25.5" y1="12" x2="25.5" y2="18" stroke="#4D7C0F" strokeWidth="0.5" opacity="0.6" />
          <line x1="16.5" y1="13" x2="27.5" y2="13" stroke="#4D7C0F" strokeWidth="0.5" opacity="0.6" />
          <line x1="16" y1="16" x2="28" y2="16" stroke="#4D7C0F" strokeWidth="0.5" opacity="0.7" />
          <line x1="17" y1="19" x2="27" y2="19" stroke="#4D7C0F" strokeWidth="0.5" opacity="0.6" />
          <path d="M 20.5 22.5 L 21 28 L 23 28 L 23.5 22.5" fill="#4D7C0F" stroke="#365314" strokeWidth="0.8" />
          <line x1="21" y1="24.5" x2="23" y2="24.5" stroke="#FFFFFF" strokeWidth="0.6" />
          <line x1="21" y1="26.5" x2="23" y2="26.5" stroke="#FFFFFF" strokeWidth="0.6" />
        </g>
        <g transform="translate(29, 21)">
          <circle cx="0" cy="0" r="4.5" fill="#BEF264" stroke="#4D7C0F" strokeWidth="1" />
          <path d="M -3 -3 Q 0 0 -3 3" fill="none" stroke="#FFFFFF" strokeWidth="0.9" />
          <path d="M 3 -3 Q 0 0 3 3" fill="none" stroke="#FFFFFF" strokeWidth="0.9" />
        </g>
      </g>
    ),
  },

  // 5. Bóng rổ
  basketball: {
    id: 'basketball',
    name: 'Bóng rổ',
    gradStart: '#ea580c',
    gradEnd: '#c2410c',
    renderSymbol: () => (
      <g>
        <circle cx="24" cy="20" r="9" fill="#EA580C" stroke="#9A3412" strokeWidth="1.2" />
        <ellipse cx="21" cy="16" rx="4" ry="2" fill="#FB923C" opacity="0.5" />
        <line x1="15" y1="20" x2="33" y2="20" stroke="#7C2D12" strokeWidth="0.9" />
        <line x1="24" y1="11" x2="24" y2="29" stroke="#7C2D12" strokeWidth="0.9" />
        <path d="M 18.5 12.5 Q 22 20 18.5 27.5" fill="none" stroke="#7C2D12" strokeWidth="0.9" />
        <path d="M 29.5 12.5 Q 26 20 29.5 27.5" fill="none" stroke="#7C2D12" strokeWidth="0.9" />
      </g>
    ),
  },

  // 6. Bóng chuyền
  volleyball: {
    id: 'volleyball',
    name: 'Bóng chuyền',
    gradStart: '#0284c7',
    gradEnd: '#0369a1',
    renderSymbol: () => (
      <g>
        <circle cx="24" cy="20" r="9" fill="#F8FAFC" stroke="#0369a1" strokeWidth="1.2" />
        <path
          d="M 24 20 Q 20 14 24 11 A 9 9 0 0 1 31.5 15.5 Q 27 18 24 20 Z"
          fill="#FDE047"
          stroke="#0369a1"
          strokeWidth="0.8"
        />
        <path d="M 24 20 Q 22 15 27.5 13" fill="none" stroke="#0369a1" strokeWidth="0.7" />
        <path
          d="M 24 20 Q 28 22 32.5 22.5 A 9 9 0 0 1 27 28.5 Q 25 24 24 20 Z"
          fill="#38BDF8"
          stroke="#0369a1"
          strokeWidth="0.8"
        />
        <path d="M 24 20 Q 29 24 30.5 25.5" fill="none" stroke="#0369a1" strokeWidth="0.7" />
        <path
          d="M 24 20 Q 20 24 15.5 22.5 A 9 9 0 0 1 16.5 15.5 Q 20 18 24 20 Z"
          fill="#FFFFFF"
          stroke="#0369a1"
          strokeWidth="0.8"
        />
        <path d="M 24 20 Q 17 21 15.5 18.5" fill="none" stroke="#0369a1" strokeWidth="0.7" />
      </g>
    ),
  },

  // 7. Bóng bàn
  'table-tennis': {
    id: 'table-tennis',
    name: 'Bóng bàn',
    gradStart: '#dc2626',
    gradEnd: '#b91c1c',
    renderSymbol: () => (
      <g>
        <g transform="rotate(-30 22 20)">
          <circle cx="22" cy="16" r="7.5" fill="#DC2626" stroke="#991B1B" strokeWidth="1.2" />
          <circle cx="22" cy="16" r="6" fill="#EF4444" opacity="0.6" />
          <path d="M 20.5 23.5 L 23.5 23.5 L 23 28.5 L 21 28.5 Z" fill="#D97706" stroke="#B45309" strokeWidth="0.8" />
          <line x1="22" y1="23.5" x2="22" y2="28" stroke="#FDE68A" strokeWidth="0.6" />
        </g>
        <circle cx="29" cy="22" r="3.2" fill="#FFFFFF" stroke="#DC2626" strokeWidth="0.8" />
      </g>
    ),
  },

  // 8. Bơi lội
  swimming: {
    id: 'swimming',
    name: 'Bơi lội',
    gradStart: '#0ea5e9',
    gradEnd: '#0284c7',
    renderSymbol: () => (
      <g>
        <circle cx="21" cy="16" r="2.8" fill="#0284C7" />
        <ellipse cx="22" cy="16" rx="1.5" ry="1" fill="#FFFFFF" />
        <circle cx="22.3" cy="16" r="0.7" fill="#0369A1" />
        <path
          d="M 20 18 Q 23 14 28 15 Q 29 16 26 17"
          fill="none"
          stroke="#0284C7"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M 15 21 Q 18 19 21 21 Q 24 23 27 21 Q 30 19 33 21"
          fill="none"
          stroke="#0284C7"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M 16 24.5 Q 19 22.5 22 24.5 Q 25 26.5 28 24.5 Q 31 22.5 32 24"
          fill="none"
          stroke="#38BDF8"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
    ),
  },

  // 9. Gym / Thể hình
  gym: {
    id: 'gym',
    name: 'Gym / Thể hình',
    gradStart: '#64748b',
    gradEnd: '#475569',
    renderSymbol: () => (
      <g transform="rotate(-35 24 20)">
        <rect x="18" y="19" width="12" height="2" rx="0.5" fill="#CBD5E1" stroke="#334155" strokeWidth="0.6" />
        <rect x="15" y="15" width="2.5" height="10" rx="1" fill="#475569" stroke="#1E293B" strokeWidth="0.8" />
        <rect x="13.5" y="16.5" width="1.5" height="7" rx="0.7" fill="#64748B" stroke="#1E293B" strokeWidth="0.6" />
        <rect x="30.5" y="15" width="2.5" height="10" rx="1" fill="#475569" stroke="#1E293B" strokeWidth="0.8" />
        <rect x="33" y="16.5" width="1.5" height="7" rx="0.7" fill="#64748B" stroke="#1E293B" strokeWidth="0.6" />
        <rect x="17.5" y="18" width="0.8" height="4" fill="#334155" />
        <rect x="29.7" y="18" width="0.8" height="4" fill="#334155" />
      </g>
    ),
  },

  // 10. Điền kinh / Chạy bộ
  running: {
    id: 'running',
    name: 'Điền kinh / Chạy bộ',
    gradStart: '#0d9488',
    gradEnd: '#0f766e',
    renderSymbol: () => (
      <g transform="translate(1, 0)">
        <path
          d="M 15 22 C 16 19 18 17 21 17 L 24 19 L 29 20 C 31 20.5 32 22 31 23.5 L 16 23.5 C 15 23.5 14.5 22.8 15 22 Z"
          fill="#0D9488"
          stroke="#115E59"
          strokeWidth="0.9"
        />
        <path
          d="M 15 23.5 L 31 23.5 C 32 23.5 31.5 25 30 25 L 16 25 C 14.8 25 14.5 23.5 15 23.5 Z"
          fill="#F8FAFC"
          stroke="#115E59"
          strokeWidth="0.8"
        />
        <path d="M 21 18 L 22.5 22" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
        <path d="M 23.5 18.5 L 25 22.5" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
        <path d="M 26 19 L 27.5 22.5" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
        <path d="M 13 18 L 16 18" stroke="#14B8A6" strokeWidth="1" strokeLinecap="round" />
        <path d="M 12 21 L 14.5 21" stroke="#14B8A6" strokeWidth="1" strokeLinecap="round" />
      </g>
    ),
  },

  // 11. Golf
  golf: {
    id: 'golf',
    name: 'Golf',
    gradStart: '#10b981',
    gradEnd: '#047857',
    renderSymbol: () => (
      <g>
        <ellipse cx="22" cy="25" rx="6" ry="2" fill="#047857" stroke="#064E3B" strokeWidth="0.8" />
        <ellipse cx="22" cy="25" rx="3.5" ry="1.2" fill="#0F172A" />
        <line x1="22" y1="25" x2="22" y2="12" stroke="#475569" strokeWidth="1.2" />
        <path d="M 22 12 L 29 14.5 L 22 17 Z" fill="#EF4444" stroke="#B91C1C" strokeWidth="0.7" />
        <circle cx="28.5" cy="23.5" r="3.2" fill="#FFFFFF" stroke="#047857" strokeWidth="0.8" />
        <circle cx="28" cy="23" r="0.4" fill="#94A3B8" />
        <circle cx="29.2" cy="23" r="0.4" fill="#94A3B8" />
        <circle cx="28.5" cy="24.2" r="0.4" fill="#94A3B8" />
      </g>
    ),
  },

  // 12. Bida / Billiards
  billiards: {
    id: 'billiards',
    name: 'Bida / Billiards',
    gradStart: '#7c3aed',
    gradEnd: '#5b21b6',
    renderSymbol: () => (
      <g>
        <line x1="13" y1="27" x2="20" y2="23" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
        <line x1="13" y1="27" x2="16" y2="25.3" stroke="#92400E" strokeWidth="2.4" />
        <circle cx="20.5" cy="22.7" r="0.9" fill="#F8FAFC" />
        <circle cx="25.5" cy="19.5" r="7.5" fill="#18181B" stroke="#27272A" strokeWidth="1" />
        <ellipse cx="23.5" cy="16.5" rx="2.5" ry="1.2" fill="#52525B" opacity="0.6" />
        <circle cx="25.5" cy="19.5" r="3.2" fill="#FFFFFF" />
        <text
          x="25.5"
          y="21.8"
          fontSize="6"
          fontWeight="900"
          fontFamily="Arial, sans-serif"
          textAnchor="middle"
          fill="#18181B"
        >
          8
        </text>
      </g>
    ),
  },

  // 13. Võ thuật / Tự vệ
  'martial-arts': {
    id: 'martial-arts',
    name: 'Võ thuật',
    gradStart: '#e11d48',
    gradEnd: '#be123c',
    renderSymbol: () => (
      <g>
        <g strokeLinecap="round">
          <line x1="16" y1="26" x2="32" y2="14" stroke="#E2E8F0" strokeWidth="1.8" />
          <line x1="15" y1="27" x2="18" y2="24.5" stroke="#991B1B" strokeWidth="2.6" />
          <line x1="17.5" y1="23.5" x2="19.5" y2="26" stroke="#FEF08A" strokeWidth="1" />
          <line x1="32" y1="26" x2="16" y2="14" stroke="#E2E8F0" strokeWidth="1.8" />
          <line x1="33" y1="27" x2="30" y2="24.5" stroke="#991B1B" strokeWidth="2.6" />
          <line x1="30.5" y1="23.5" x2="28.5" y2="26" stroke="#FEF08A" strokeWidth="1" />
        </g>
        <circle cx="24" cy="20" r="3.8" fill="#BE123C" stroke="#FEF08A" strokeWidth="0.9" />
        <polygon
          points="24,17.5 25,19.5 27,19.5 25.5,20.8 26,22.8 24,21.5 22,22.8 22.5,20.8 21,19.5 23,19.5"
          fill="#FEF08A"
        />
      </g>
    ),
  },

  // 14. Bowling
  bowling: {
    id: 'bowling',
    name: 'Bowling',
    gradStart: '#d946ef',
    gradEnd: '#a21caf',
    renderSymbol: () => (
      <g>
        <g transform="translate(14, 11)">
          <path
            d="M 4 2 C 3.2 2 2.5 2.8 2.5 3.8 C 2.5 4.8 3 5.5 3 6.5 C 2.5 7.5 1 9.5 1 12 C 1 14.5 1.5 16 1.8 17 L 6.2 17 C 6.5 16 7 14.5 7 12 C 7 9.5 5.5 7.5 5 6.5 C 5 5.5 5.5 4.8 5.5 3.8 C 5.5 2.8 4.8 2 4 2 Z"
            fill="#F8FAFC"
            stroke="#A21CAF"
            strokeWidth="0.8"
          />
          <line x1="2.8" y1="6" x2="5.2" y2="6" stroke="#EF4444" strokeWidth="0.8" />
          <line x1="2.7" y1="7.2" x2="5.3" y2="7.2" stroke="#EF4444" strokeWidth="0.8" />
        </g>
        <circle cx="28" cy="21" r="6" fill="#1E1B4B" stroke="#A21CAF" strokeWidth="1" />
        <ellipse cx="26.5" cy="18" rx="2" ry="1" fill="#6366F1" opacity="0.4" />
        <circle cx="26.5" cy="19.5" r="0.8" fill="#F8FAFC" />
        <circle cx="29" cy="19.5" r="0.8" fill="#F8FAFC" />
        <circle cx="27.8" cy="22" r="0.8" fill="#F8FAFC" />
      </g>
    ),
  },

  // 15. Bắn cung
  archery: {
    id: 'archery',
    name: 'Bắn cung',
    gradStart: '#f43f5e',
    gradEnd: '#be123c',
    renderSymbol: () => (
      <g>
        <circle cx="21" cy="20" r="8" fill="#38BDF8" stroke="#0284C7" strokeWidth="0.7" />
        <circle cx="21" cy="20" r="5.5" fill="#EF4444" stroke="#DC2626" strokeWidth="0.7" />
        <circle cx="21" cy="20" r="2.8" fill="#FACC15" stroke="#CA8A04" strokeWidth="0.7" />
        <circle cx="21" cy="20" r="0.8" fill="#713F12" />
        <line x1="33" y1="12" x2="21" y2="20" stroke="#1E293B" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="32" y1="10" x2="30" y2="12" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="34" y1="12" x2="32" y2="14" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round" />
        <polygon points="20.5,20.5 22.5,19 21.5,18" fill="#1E293B" />
      </g>
    ),
  },

  // 16. Xe đạp
  cycling: {
    id: 'cycling',
    name: 'Đua xe đạp',
    gradStart: '#06b6d4',
    gradEnd: '#0891b2',
    renderSymbol: () => (
      <g>
        <circle cx="17.5" cy="21.5" r="4.5" fill="none" stroke="#0891B2" strokeWidth="1.2" />
        <circle cx="17.5" cy="21.5" r="0.9" fill="#0891B2" />
        <circle cx="30.5" cy="21.5" r="4.5" fill="none" stroke="#0891B2" strokeWidth="1.2" />
        <circle cx="30.5" cy="21.5" r="0.9" fill="#0891B2" />
        <line x1="17.5" y1="21.5" x2="22.5" y2="16" stroke="#06B6D4" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="17.5" y1="21.5" x2="23.5" y2="21.5" stroke="#06B6D4" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="23.5" y1="21.5" x2="22.5" y2="16" stroke="#06B6D4" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="22.5" y1="16" x2="28" y2="16" stroke="#06B6D4" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="23.5" y1="21.5" x2="28" y2="16" stroke="#06B6D4" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="28" y1="16" x2="30.5" y2="21.5" stroke="#06B6D4" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M 21 15 L 24 15" stroke="#0E7490" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 27.5 15 L 28.5 14.5 L 29.5 16" fill="none" stroke="#0E7490" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    ),
  },

  // 17. Leo núi nhân tạo
  climbing: {
    id: 'climbing',
    name: 'Leo núi nhân tạo',
    gradStart: '#f97316',
    gradEnd: '#c2410c',
    renderSymbol: () => (
      <g>
        <polygon points="16,15 19,14 18,17 15,17" fill="#EF4444" />
        <polygon points="28,14 31,16 29,18 26,16" fill="#3B82F6" />
        <polygon points="18,24 21,23 20,26 17,25" fill="#10B981" />
        <polygon points="29,23 32,24 30,26 27,25" fill="#FACC15" />
        <circle cx="23.5" cy="16" r="2.2" fill="#9A3412" />
        <line x1="23.5" y1="18" x2="23.5" y2="23" stroke="#9A3412" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 23.5 19 L 26 17 L 28 15" fill="none" stroke="#9A3412" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 23.5 19 L 20 18 L 18 16" fill="none" stroke="#9A3412" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 23.5 23 L 21 24.5 L 20 25.5" fill="none" stroke="#9A3412" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 23.5 23 L 26 24 L 28 25" fill="none" stroke="#9A3412" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    ),
  },

  // 18. Trượt patin / Ván trượt
  skating: {
    id: 'skating',
    name: 'Trượt patin / Ván trượt',
    gradStart: '#8b5cf6',
    gradEnd: '#6d28d9',
    renderSymbol: () => (
      <g>
        <path d="M 14 22.5 Q 13 20.5 15.5 21 L 30.5 16.5 Q 33 16 33 18" fill="none" stroke="#7C3AED" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M 16.5 21 L 29.5 17" stroke="#DDD6FE" strokeWidth="0.9" strokeLinecap="round" />
        <rect x="27" y="18.5" width="2" height="2" fill="#475569" />
        <circle cx="28" cy="22" r="2.3" fill="#F43F5E" stroke="#BE123C" strokeWidth="0.7" />
        <circle cx="28" cy="22" r="0.8" fill="#FFFFFF" />
        <rect x="17.5" y="22" width="2" height="2" fill="#475569" />
        <circle cx="18.5" cy="25.5" r="2.3" fill="#F43F5E" stroke="#BE123C" strokeWidth="0.7" />
        <circle cx="18.5" cy="25.5" r="0.8" fill="#FFFFFF" />
      </g>
    ),
  },

  // 19. Yoga / Pilates
  yoga: {
    id: 'yoga',
    name: 'Yoga / Pilates',
    gradStart: '#14b8a6',
    gradEnd: '#0f766e',
    renderSymbol: () => (
      <g>
        <circle cx="24" cy="14" r="2.4" fill="#0F766E" />
        <line x1="24" y1="16.5" x2="24" y2="22.5" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" />
        <path d="M 24 18 L 20 20 L 17 22" fill="none" stroke="#0F766E" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M 24 18 L 28 20 L 31 22" fill="none" stroke="#0F766E" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M 16 23.5 C 18 21.5 21 23 24 23 C 27 23 30 21.5 32 23.5 C 30 25.5 18 25.5 16 23.5 Z" fill="#0F766E" />
        <path d="M 24 24 C 22 25.5 19 26.5 18 25.5 C 21 27.5 27 27.5 30 25.5 C 29 26.5 26 25.5 24 24 Z" fill="#5EEAD4" />
      </g>
    ),
  },

  // 20. Thể thao chung / Khác
  general: {
    id: 'general',
    name: 'Thể thao chung',
    gradStart: '#6366f1',
    gradEnd: '#4f46e5',
    renderSymbol: () => (
      <g>
        <path
          d="M 19 14 L 29 14 L 28 19 C 27.5 22 24.5 23 24 23 C 23.5 23 20.5 22 20 19 Z"
          fill="#FBBF24"
          stroke="#D97706"
          strokeWidth="0.8"
        />
        <path d="M 19 15 C 16.5 15 16.5 19 19 19" fill="none" stroke="#D97706" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M 29 15 C 31.5 15 31.5 19 29 19" fill="none" stroke="#D97706" strokeWidth="0.9" strokeLinecap="round" />
        <rect x="23" y="23" width="2" height="2" fill="#D97706" />
        <rect x="20.5" y="25" width="7" height="2" rx="0.5" fill="#4F46E5" stroke="#3730A3" strokeWidth="0.6" />
        <polygon
          points="24,16 24.6,17.2 26,17.3 24.9,18.2 25.3,19.5 24,18.8 22.7,19.5 23.1,18.2 22,17.3 23.4,17.2"
          fill="#FFFFFF"
        />
      </g>
    ),
  },
};

const SPORT_ALIAS_MAP: Record<string, string> = {
  // Cầu lông
  badminton: 'badminton',
  'cau-long': 'badminton',
  caulong: 'badminton',
  feather: 'badminton',

  // Bóng đá
  soccer: 'soccer',
  'bong-da': 'soccer',
  'bong-da-mini': 'soccer',
  football: 'soccer',
  futsal: 'soccer',
  bongda: 'soccer',
  'circle-dot': 'soccer',
  goal: 'soccer',

  // Pickleball
  pickleball: 'pickleball',
  'table-2': 'pickleball',

  // Tennis
  tennis: 'tennis',
  'quan-vot': 'tennis',
  circle: 'tennis',

  // Bóng rổ
  basketball: 'basketball',
  'bong-ro': 'basketball',
  'circle-dashed': 'basketball',
  dribbble: 'basketball',

  // Bóng chuyền
  volleyball: 'volleyball',
  'bong-chuyen': 'volleyball',

  // Bóng bàn
  'table-tennis': 'table-tennis',
  'bong-ban': 'table-tennis',
  tabletennis: 'table-tennis',
  pingpong: 'table-tennis',

  // Bơi lội
  swimming: 'swimming',
  'boi-loi': 'swimming',
  waves: 'swimming',

  // Gym / Thể hình
  gym: 'gym',
  'the-hinh': 'gym',
  dumbbell: 'gym',

  // Điền kinh / Chạy bộ
  running: 'running',
  'dien-kinh': 'running',
  'chay-bo': 'running',
  footprints: 'running',

  // Golf
  golf: 'golf',
  flag: 'golf',

  // Bida
  billiards: 'billiards',
  bida: 'billiards',

  // Võ thuật
  'martial-arts': 'martial-arts',
  'vo-thuat': 'martial-arts',
  swords: 'martial-arts',
  shield: 'martial-arts',

  // Bowling
  bowling: 'bowling',

  // Bắn cung
  archery: 'archery',
  'ban-cung': 'archery',
  target: 'archery',

  // Xe đạp
  cycling: 'cycling',
  'xe-dap': 'cycling',
  'dua-xe-dap': 'cycling',
  bike: 'cycling',

  // Leo núi
  climbing: 'climbing',
  'leo-nui': 'climbing',
  bouldering: 'climbing',

  // Trượt patin / Ván trượt
  skating: 'skating',
  patin: 'skating',
  'truot-patin': 'skating',
  skateboard: 'skating',
  'van-truot': 'skating',

  // Yoga / Pilates
  yoga: 'yoga',
  pilates: 'yoga',
  heart: 'yoga',

  // Chung / Khác
  general: 'general',
  activity: 'general',
  trophy: 'general',
  medal: 'general',
  sparkles: 'general',
};

export function resolveSportPinDef(sportKey?: string | null): SportPinDef {
  const fallback = SPORT_PIN_DEFS.general as SportPinDef;
  if (!sportKey) return fallback;
  const normalized = sportKey.trim().toLowerCase();
  const canonicalId = SPORT_ALIAS_MAP[normalized] || normalized;
  return SPORT_PIN_DEFS[canonicalId] ?? fallback;
}

export function getSportPinIconUrl(sportKey?: string | null): string {
  const def = resolveSportPinDef(sportKey);
  return `/icons/sports/${def.id}.svg`;
}

export function SportPinIcon({
  sport,
  size = 32,
  className,
  title,
  ...rest
}: SportPinIconProps) {
  const def = resolveSportPinDef(sport);
  const clipId = React.useId();
  const gradId = `grad-${def.id}-${clipId}`;
  const displayTitle = title ?? def.name;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 56"
      width={size}
      height={typeof size === 'number' ? (size * 56) / 48 : size}
      fill="none"
      className={className}
      aria-label={displayTitle}
      role="img"
      {...rest}
    >
      <title>{displayTitle}</title>
      <defs>
        <linearGradient id={gradId} x1="24" y1="2" x2="24" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={def.gradStart} />
          <stop offset="100%" stopColor={def.gradEnd} />
        </linearGradient>
      </defs>

      {/* Inverted Teardrop Pin Silhouette */}
      <path
        d={PIN_PATH}
        fill={`url(#${gradId})`}
        stroke="#FFFFFF"
        strokeWidth="1.5"
      />

      {/* Circular Badge Surface inside Pin */}
      <circle cx="24" cy="20" r="13.5" fill="#FFFFFF" />
      <circle
        cx="24"
        cy="20"
        r="13.5"
        fill="none"
        stroke={def.gradEnd}
        strokeWidth="0.75"
        strokeOpacity="0.35"
      />

      {/* Sport Representation Symbol Inside Pin */}
      {def.renderSymbol()}
    </svg>
  );
}
