import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'apps/web/public/icons/sports';

const pinPath = 'M 24 52 C 15 42 6 30 6 20 A 18 18 0 1 1 42 20 C 42 30 33 42 24 52 Z';

const sports = [
  // 1. CẦU LÔNG (Badminton) - Shuttlecock
  {
    filename: 'badminton.svg',
    id: 'badminton',
    name: 'Cầu lông',
    gradStart: '#059669',
    gradEnd: '#047857',
    innerSvg: `
      <!-- Shuttlecock Feathers cone -->
      <path d="M 17 14 L 21.5 24 Q 24 25.5 26.5 24 L 31 14 Z" fill="#E2E8F0" stroke="#059669" stroke-width="0.8" stroke-linejoin="round" />
      <!-- Feather vane ribs -->
      <line x1="24" y1="13.5" x2="24" y2="24.5" stroke="#059669" stroke-width="0.8" />
      <line x1="20" y1="14" x2="22.5" y2="24.5" stroke="#059669" stroke-width="0.7" />
      <line x1="28" y1="14" x2="25.5" y2="24.5" stroke="#059669" stroke-width="0.7" />
      <line x1="17.2" y1="14.2" x2="21.5" y2="24.5" stroke="#059669" stroke-width="0.7" />
      <line x1="30.8" y1="14.2" x2="26.5" y2="24.5" stroke="#059669" stroke-width="0.7" />
      <!-- Stitching bands -->
      <path d="M 18.5 17 Q 24 18.5 29.5 17" fill="none" stroke="#059669" stroke-width="0.8" />
      <path d="M 20 20.5 Q 24 22 28 20.5" fill="none" stroke="#059669" stroke-width="0.8" />
      <!-- Feather tips individual arcs -->
      <path d="M 17 14 Q 18.5 13 20 14 Q 22 13 24 14 Q 26 13 28 14 Q 29.5 13 31 14" fill="none" stroke="#059669" stroke-width="0.9" />
      <!-- Cork base -->
      <path d="M 21.5 24.5 Q 24 25.5 26.5 24.5 C 26.8 27.5 21.2 27.5 21.5 24.5 Z" fill="#047857" stroke="#047857" stroke-width="0.5" />
      <!-- Cork stripe -->
      <path d="M 21.7 24.8 Q 24 25.6 26.3 24.8" fill="none" stroke="#F59E0B" stroke-width="0.7" />
    `,
  },

  // 2. BÓNG ĐÁ (Soccer / Football) - Telstar 32-panel ball
  {
    filename: 'soccer.svg',
    id: 'soccer',
    name: 'Bóng đá',
    gradStart: '#16a34a',
    gradEnd: '#15803d',
    innerSvg: `
      <!-- Ball base circle -->
      <circle cx="24" cy="20" r="9" fill="#FFFFFF" stroke="#15803d" stroke-width="1.2" />
      <!-- Center black pentagon -->
      <polygon points="24,17.5 26.4,19.2 25.5,21.8 22.5,21.8 21.6,19.2" fill="#15803d" />
      <!-- Seam lines from center pentagon to perimeter patches -->
      <line x1="24" y1="17.5" x2="24" y2="15" stroke="#15803d" stroke-width="1" />
      <line x1="26.4" y1="19.2" x2="28.8" y2="18.2" stroke="#15803d" stroke-width="1" />
      <line x1="25.5" y1="21.8" x2="27.2" y2="24" stroke="#15803d" stroke-width="1" />
      <line x1="22.5" y1="21.8" x2="20.8" y2="24" stroke="#15803d" stroke-width="1" />
      <line x1="21.6" y1="19.2" x2="19.2" y2="18.2" stroke="#15803d" stroke-width="1" />
      <!-- Top patch -->
      <path d="M 22.2 12.5 Q 24 12 25.8 12.5 L 25.2 14.5 L 22.8 14.5 Z" fill="#15803d" />
      <!-- Top right patch -->
      <path d="M 30.5 15.5 Q 32.2 17.5 32.5 19.5 L 30.2 19 L 29 17 Z" fill="#15803d" />
      <!-- Bottom right patch -->
      <path d="M 29.5 26 Q 27.5 27.8 25.5 28.5 L 25.8 26.5 L 28 25 Z" fill="#15803d" />
      <!-- Bottom left patch -->
      <path d="M 18.5 26 Q 20.5 27.8 22.5 28.5 L 22.2 26.5 L 20 25 Z" fill="#15803d" />
      <!-- Top left patch -->
      <path d="M 17.5 15.5 Q 15.8 17.5 15.5 19.5 L 17.8 19 L 19 17 Z" fill="#15803d" />
    `,
  },

  // 3. PICKLEBALL - Paddle and Perforated Ball
  {
    filename: 'pickleball.svg',
    id: 'pickleball',
    name: 'Pickleball',
    gradStart: '#f59e0b',
    gradEnd: '#d97706',
    innerSvg: `
      <!-- Paddle face (rectangular with rounded corners, tilted) -->
      <g transform="rotate(-25 21 20)">
        <!-- Paddle head -->
        <rect x="16" y="11" width="10" height="12" rx="3" fill="#F59E0B" stroke="#B45309" stroke-width="1" />
        <!-- Inner accent line on paddle -->
        <rect x="17.5" y="12.5" width="7" height="9" rx="2" fill="none" stroke="#FDE68A" stroke-width="0.6" stroke-dasharray="1.5 1" />
        <!-- Handle neck -->
        <path d="M 19.5 23 L 22.5 23 L 22 28 L 20 28 Z" fill="#B45309" stroke="#92400E" stroke-width="0.8" />
        <!-- Handle grip tape wraps -->
        <line x1="20" y1="24.5" x2="22" y2="24.5" stroke="#FFFFFF" stroke-width="0.6" />
        <line x1="20" y1="26" x2="22" y2="26" stroke="#FFFFFF" stroke-width="0.6" />
      </g>
      <!-- Pickleball (perforated ball with signature circular holes) -->
      <g transform="translate(28, 20)">
        <circle cx="0" cy="0" r="5" fill="#FDE047" stroke="#CA8A04" stroke-width="1" />
        <!-- Holes -->
        <circle cx="0" cy="0" r="0.9" fill="#CA8A04" />
        <circle cx="-2.3" cy="-1.5" r="0.8" fill="#CA8A04" />
        <circle cx="2.3" cy="-1.5" r="0.8" fill="#CA8A04" />
        <circle cx="-2.3" cy="1.8" r="0.8" fill="#CA8A04" />
        <circle cx="2.3" cy="1.8" r="0.8" fill="#CA8A04" />
        <circle cx="0" cy="-3.3" r="0.7" fill="#CA8A04" />
        <circle cx="0" cy="3.3" r="0.7" fill="#CA8A04" />
      </g>
    `,
  },

  // 4. TENNIS - Racket and Ball with curved seams
  {
    filename: 'tennis.svg',
    id: 'tennis',
    name: 'Tennis',
    gradStart: '#84cc16',
    gradEnd: '#4d7c0f',
    innerSvg: `
      <!-- Tennis Racket tilted -->
      <g transform="rotate(-30 22 19)">
        <!-- Oval racket head -->
        <ellipse cx="22" cy="15" rx="6.5" ry="7.5" fill="none" stroke="#4D7C0F" stroke-width="1.2" />
        <!-- Cross strings grid -->
        <line x1="18.5" y1="12" x2="18.5" y2="18" stroke="#4D7C0F" stroke-width="0.5" opacity="0.6" />
        <line x1="22" y1="8" x2="22" y2="22" stroke="#4D7C0F" stroke-width="0.5" opacity="0.7" />
        <line x1="25.5" y1="12" x2="25.5" y2="18" stroke="#4D7C0F" stroke-width="0.5" opacity="0.6" />
        <line x1="16.5" y1="13" x2="27.5" y2="13" stroke="#4D7C0F" stroke-width="0.5" opacity="0.6" />
        <line x1="16" y1="16" x2="28" y2="16" stroke="#4D7C0F" stroke-width="0.5" opacity="0.7" />
        <line x1="17" y1="19" x2="27" y2="19" stroke="#4D7C0F" stroke-width="0.5" opacity="0.6" />
        <!-- Throat and handle -->
        <path d="M 20.5 22.5 L 21 28 L 23 28 L 23.5 22.5" fill="#4D7C0F" stroke="#365314" stroke-width="0.8" />
        <!-- Grip wraps -->
        <line x1="21" y1="24.5" x2="23" y2="24.5" stroke="#FFFFFF" stroke-width="0.6" />
        <line x1="21" y1="26.5" x2="23" y2="26.5" stroke="#FFFFFF" stroke-width="0.6" />
      </g>
      <!-- Tennis ball with signature curved seam -->
      <g transform="translate(29, 21)">
        <circle cx="0" cy="0" r="4.5" fill="#BEF264" stroke="#4D7C0F" stroke-width="1" />
        <!-- Curved tennis seams -->
        <path d="M -3 -3 Q 0 0 -3 3" fill="none" stroke="#FFFFFF" stroke-width="0.9" />
        <path d="M 3 -3 Q 0 0 3 3" fill="none" stroke="#FFFFFF" stroke-width="0.9" />
      </g>
    `,
  },

  // 5. BÓNG RỔ (Basketball) - Ribbed Ball
  {
    filename: 'basketball.svg',
    id: 'basketball',
    name: 'Bóng rổ',
    gradStart: '#ea580c',
    gradEnd: '#c2410c',
    innerSvg: `
      <!-- Basketball base -->
      <circle cx="24" cy="20" r="9" fill="#EA580C" stroke="#9A3412" stroke-width="1.2" />
      <!-- Texture highlight -->
      <ellipse cx="21" cy="16" rx="4" ry="2" fill="#FB923C" opacity="0.5" />
      <!-- Horizontal equator seam -->
      <line x1="15" y1="20" x2="33" y2="20" stroke="#7C2D12" stroke-width="0.9" />
      <!-- Vertical meridian seam -->
      <line x1="24" y1="11" x2="24" y2="29" stroke="#7C2D12" stroke-width="0.9" />
      <!-- Left curved seam -->
      <path d="M 18.5 12.5 Q 22 20 18.5 27.5" fill="none" stroke="#7C2D12" stroke-width="0.9" />
      <!-- Right curved seam -->
      <path d="M 29.5 12.5 Q 26 20 29.5 27.5" fill="none" stroke="#7C2D12" stroke-width="0.9" />
    `,
  },

  // 6. BÓNG CHUYỀN (Volleyball) - 3-panel Swirl Ball
  {
    filename: 'volleyball.svg',
    id: 'volleyball',
    name: 'Bóng chuyền',
    gradStart: '#0284c7',
    gradEnd: '#0369a1',
    innerSvg: `
      <!-- Base circle -->
      <circle cx="24" cy="20" r="9" fill="#F8FAFC" stroke="#0369a1" stroke-width="1.2" />
      <!-- Center hub -->
      <!-- Panel 1 (Top / Yellow accent) -->
      <path d="M 24 20 Q 20 14 24 11 A 9 9 0 0 1 31.5 15.5 Q 27 18 24 20 Z" fill="#FDE047" stroke="#0369a1" stroke-width="0.8" />
      <path d="M 24 20 Q 22 15 27.5 13" fill="none" stroke="#0369a1" stroke-width="0.7" />
      <!-- Panel 2 (Bottom Right / Blue accent) -->
      <path d="M 24 20 Q 28 22 32.5 22.5 A 9 9 0 0 1 27 28.5 Q 25 24 24 20 Z" fill="#38BDF8" stroke="#0369a1" stroke-width="0.8" />
      <path d="M 24 20 Q 29 24 30.5 25.5" fill="none" stroke="#0369a1" stroke-width="0.7" />
      <!-- Panel 3 (Bottom Left / White) -->
      <path d="M 24 20 Q 20 24 15.5 22.5 A 9 9 0 0 1 16.5 15.5 Q 20 18 24 20 Z" fill="#FFFFFF" stroke="#0369a1" stroke-width="0.8" />
      <path d="M 24 20 Q 17 21 15.5 18.5" fill="none" stroke="#0369a1" stroke-width="0.7" />
    `,
  },

  // 7. BÓNG BÀN (Table Tennis) - Paddle & Ping Pong Ball
  {
    filename: 'table-tennis.svg',
    id: 'table-tennis',
    name: 'Bóng bàn',
    gradStart: '#dc2626',
    gradEnd: '#b91c1c',
    innerSvg: `
      <!-- Table Tennis Paddle tilted -->
      <g transform="rotate(-30 22 20)">
        <!-- Round blade / rubber -->
        <circle cx="22" cy="16" r="7.5" fill="#DC2626" stroke="#991B1B" stroke-width="1.2" />
        <circle cx="22" cy="16" r="6" fill="#EF4444" opacity="0.6" />
        <!-- Wooden handle -->
        <path d="M 20.5 23.5 L 23.5 23.5 L 23 28.5 L 21 28.5 Z" fill="#D97706" stroke="#B45309" stroke-width="0.8" />
        <line x1="22" y1="23.5" x2="22" y2="28" stroke="#FDE68A" stroke-width="0.6" />
      </g>
      <!-- Small ping pong ball -->
      <circle cx="29" cy="22" r="3.2" fill="#FFFFFF" stroke="#DC2626" stroke-width="0.8" />
    `,
  },

  // 8. BƠI LỘI (Swimming) - Swimmer & Water Waves
  {
    filename: 'swimming.svg',
    id: 'swimming',
    name: 'Bơi lội',
    gradStart: '#0ea5e9',
    gradEnd: '#0284c7',
    innerSvg: `
      <!-- Swimmer head with cap & goggles -->
      <circle cx="21" cy="16" r="2.8" fill="#0284C7" />
      <ellipse cx="22" cy="16" rx="1.5" ry="1" fill="#FFFFFF" />
      <circle cx="22.3" cy="16" r="0.7" fill="#0369A1" />
      <!-- Swimmer forward crawl arm stroke -->
      <path d="M 20 18 Q 23 14 28 15 Q 29 16 26 17" fill="none" stroke="#0284C7" stroke-width="1.6" stroke-linecap="round" />
      <!-- Upper wave -->
      <path d="M 15 21 Q 18 19 21 21 Q 24 23 27 21 Q 30 19 33 21" fill="none" stroke="#0284C7" stroke-width="1.4" stroke-linecap="round" />
      <!-- Lower wave -->
      <path d="M 16 24.5 Q 19 22.5 22 24.5 Q 25 26.5 28 24.5 Q 31 22.5 32 24" fill="none" stroke="#38BDF8" stroke-width="1.2" stroke-linecap="round" />
    `,
  },

  // 9. GYM / THỂ HÌNH (Gym / Fitness) - Dumbbell
  {
    filename: 'gym.svg',
    id: 'gym',
    name: 'Gym / Thể hình',
    gradStart: '#64748b',
    gradEnd: '#475569',
    innerSvg: `
      <!-- Dumbbell tilted -->
      <g transform="rotate(-35 24 20)">
        <!-- Bar handle -->
        <rect x="18" y="19" width="12" height="2" rx="0.5" fill="#CBD5E1" stroke="#334155" stroke-width="0.6" />
        <!-- Left plates -->
        <rect x="15" y="15" width="2.5" height="10" rx="1" fill="#475569" stroke="#1E293B" stroke-width="0.8" />
        <rect x="13.5" y="16.5" width="1.5" height="7" rx="0.7" fill="#64748B" stroke="#1E293B" stroke-width="0.6" />
        <!-- Right plates -->
        <rect x="30.5" y="15" width="2.5" height="10" rx="1" fill="#475569" stroke="#1E293B" stroke-width="0.8" />
        <rect x="33" y="16.5" width="1.5" height="7" rx="0.7" fill="#64748B" stroke="#1E293B" stroke-width="0.6" />
        <!-- Inner stoppers -->
        <rect x="17.5" y="18" width="0.8" height="4" fill="#334155" />
        <rect x="29.7" y="18" width="0.8" height="4" fill="#334155" />
      </g>
    `,
  },

  // 10. ĐIỀN KINH / CHẠY BỘ (Running) - Running Shoe / Sprint
  {
    filename: 'running.svg',
    id: 'running',
    name: 'Điền kinh / Chạy bộ',
    gradStart: '#0d9488',
    gradEnd: '#0f766e',
    innerSvg: `
      <!-- Running Shoe Profile -->
      <g transform="translate(1, 0)">
        <!-- Shoe upper & sole -->
        <path d="M 15 22 C 16 19 18 17 21 17 L 24 19 L 29 20 C 31 20.5 32 22 31 23.5 L 16 23.5 C 15 23.5 14.5 22.8 15 22 Z" fill="#0D9488" stroke="#115E59" stroke-width="0.9" />
        <!-- White foam midsole -->
        <path d="M 15 23.5 L 31 23.5 C 32 23.5 31.5 25 30 25 L 16 25 C 14.8 25 14.5 23.5 15 23.5 Z" fill="#F8FAFC" stroke="#115E59" stroke-width="0.8" />
        <!-- Speed stripes -->
        <path d="M 21 18 L 22.5 22" stroke="#FFFFFF" stroke-width="1" stroke-linecap="round" />
        <path d="M 23.5 18.5 L 25 22.5" stroke="#FFFFFF" stroke-width="1" stroke-linecap="round" />
        <path d="M 26 19 L 27.5 22.5" stroke="#FFFFFF" stroke-width="1" stroke-linecap="round" />
        <!-- Speed wind swooshes -->
        <path d="M 13 18 L 16 18" stroke="#14B8A6" stroke-width="1" stroke-linecap="round" />
        <path d="M 12 21 L 14.5 21" stroke="#14B8A6" stroke-width="1" stroke-linecap="round" />
      </g>
    `,
  },

  // 11. GOLF - Putting Green Flag & Ball
  {
    filename: 'golf.svg',
    id: 'golf',
    name: 'Golf',
    gradStart: '#10b981',
    gradEnd: '#047857',
    innerSvg: `
      <!-- Hole green cup -->
      <ellipse cx="22" cy="25" rx="6" ry="2" fill="#047857" stroke="#064E3B" stroke-width="0.8" />
      <ellipse cx="22" cy="25" rx="3.5" ry="1.2" fill="#0F172A" />
      <!-- Flagstick -->
      <line x1="22" y1="25" x2="22" y2="12" stroke="#475569" stroke-width="1.2" />
      <!-- Triangular Red Flag waving -->
      <path d="M 22 12 L 29 14.5 L 22 17 Z" fill="#EF4444" stroke="#B91C1C" stroke-width="0.7" />
      <!-- Golf ball on right side -->
      <circle cx="28.5" cy="23.5" r="3.2" fill="#FFFFFF" stroke="#047857" stroke-width="0.8" />
      <!-- Dimples -->
      <circle cx="28" cy="23" r="0.4" fill="#94A3B8" />
      <circle cx="29.2" cy="23" r="0.4" fill="#94A3B8" />
      <circle cx="28.5" cy="24.2" r="0.4" fill="#94A3B8" />
    `,
  },

  // 12. BIDA / BILLIARDS - 8-Ball & Cue
  {
    filename: 'billiards.svg',
    id: 'billiards',
    name: 'Bida / Billiards',
    gradStart: '#7c3aed',
    gradEnd: '#5b21b6',
    innerSvg: `
      <!-- Pool Cue stick angled -->
      <line x1="13" y1="27" x2="20" y2="23" stroke="#D97706" stroke-width="2" stroke-linecap="round" />
      <line x1="13" y1="27" x2="16" y2="25.3" stroke="#92400E" stroke-width="2.4" />
      <circle cx="20.5" cy="22.7" r="0.9" fill="#F8FAFC" />
      <!-- 8-Ball -->
      <circle cx="25.5" cy="19.5" r="7.5" fill="#18181B" stroke="#27272A" stroke-width="1" />
      <!-- Highlight shine -->
      <ellipse cx="23.5" cy="16.5" rx="2.5" ry="1.2" fill="#52525B" opacity="0.6" />
      <!-- White central circle -->
      <circle cx="25.5" cy="19.5" r="3.2" fill="#FFFFFF" />
      <!-- Number 8 -->
      <text x="25.5" y="21.8" font-size="6" font-weight="900" font-family="Arial, sans-serif" text-anchor="middle" fill="#18181B">8</text>
    `,
  },

  // 13. VÕ THUẬT / ĐỐI KHÁNG (Martial Arts) - Crossed Swords / Belt
  {
    filename: 'martial-arts.svg',
    id: 'martial-arts',
    name: 'Võ thuật / Tự vệ',
    gradStart: '#e11d48',
    gradEnd: '#be123c',
    innerSvg: `
      <!-- Crossed Bamboo Shinai / Swords -->
      <g stroke-linecap="round">
        <!-- Sword 1 -->
        <line x1="16" y1="26" x2="32" y2="14" stroke="#E2E8F0" stroke-width="1.8" />
        <line x1="15" y1="27" x2="18" y2="24.5" stroke="#991B1B" stroke-width="2.6" />
        <line x1="17.5" y1="23.5" x2="19.5" y2="26" stroke="#FEF08A" stroke-width="1" />
        <!-- Sword 2 -->
        <line x1="32" y1="26" x2="16" y2="14" stroke="#E2E8F0" stroke-width="1.8" />
        <line x1="33" y1="27" x2="30" y2="24.5" stroke="#991B1B" stroke-width="2.6" />
        <line x1="30.5" y1="23.5" x2="28.5" y2="26" stroke="#FEF08A" stroke-width="1" />
      </g>
      <!-- Central shield / yin-yang medallion -->
      <circle cx="24" cy="20" r="3.8" fill="#BE123C" stroke="#FEF08A" stroke-width="0.9" />
      <polygon points="24,17.5 25,19.5 27,19.5 25.5,20.8 26,22.8 24,21.5 22,22.8 22.5,20.8 21,19.5 23,19.5" fill="#FEF08A" />
    `,
  },

  // 14. BOWLING - Bowling Pin & 3-hole Ball
  {
    filename: 'bowling.svg',
    id: 'bowling',
    name: 'Bowling',
    gradStart: '#d946ef',
    gradEnd: '#a21caf',
    innerSvg: `
      <!-- White bowling pin on left -->
      <g transform="translate(14, 11)">
        <!-- Pin silhouette -->
        <path d="M 4 2 C 3.2 2 2.5 2.8 2.5 3.8 C 2.5 4.8 3 5.5 3 6.5 C 2.5 7.5 1 9.5 1 12 C 1 14.5 1.5 16 1.8 17 L 6.2 17 C 6.5 16 7 14.5 7 12 C 7 9.5 5.5 7.5 5 6.5 C 5 5.5 5.5 4.8 5.5 3.8 C 5.5 2.8 4.8 2 4 2 Z" fill="#F8FAFC" stroke="#A21CAF" stroke-width="0.8" />
        <!-- Red neck stripes -->
        <line x1="2.8" y1="6" x2="5.2" y2="6" stroke="#EF4444" stroke-width="0.8" />
        <line x1="2.7" y1="7.2" x2="5.3" y2="7.2" stroke="#EF4444" stroke-width="0.8" />
      </g>
      <!-- Bowling ball on right -->
      <circle cx="28" cy="21" r="6" fill="#1E1B4B" stroke="#A21CAF" stroke-width="1" />
      <!-- Highlight -->
      <ellipse cx="26.5" cy="18" rx="2" ry="1" fill="#6366F1" opacity="0.4" />
      <!-- 3 finger holes -->
      <circle cx="26.5" cy="19.5" r="0.8" fill="#F8FAFC" />
      <circle cx="29" cy="19.5" r="0.8" fill="#F8FAFC" />
      <circle cx="27.8" cy="22" r="0.8" fill="#F8FAFC" />
    `,
  },

  // 15. BẮN CUNG (Archery) - Target Rings & Arrow
  {
    filename: 'archery.svg',
    id: 'archery',
    name: 'Bắn cung',
    gradStart: '#f43f5e',
    gradEnd: '#be123c',
    innerSvg: `
      <!-- Concentric Target rings -->
      <circle cx="21" cy="20" r="8" fill="#38BDF8" stroke="#0284C7" stroke-width="0.7" />
      <circle cx="21" cy="20" r="5.5" fill="#EF4444" stroke="#DC2626" stroke-width="0.7" />
      <circle cx="21" cy="20" r="2.8" fill="#FACC15" stroke="#CA8A04" stroke-width="0.7" />
      <circle cx="21" cy="20" r="0.8" fill="#713F12" />
      <!-- Arrow hitting target center -->
      <line x1="33" y1="12" x2="21" y2="20" stroke="#1E293B" stroke-width="1.3" stroke-linecap="round" />
      <!-- Arrow fletchings -->
      <line x1="32" y1="10" x2="30" y2="12" stroke="#EF4444" stroke-width="1.2" stroke-linecap="round" />
      <line x1="34" y1="12" x2="32" y2="14" stroke="#EF4444" stroke-width="1.2" stroke-linecap="round" />
      <!-- Arrowhead -->
      <polygon points="20.5,20.5 22.5,19 21.5,18" fill="#1E293B" />
    `,
  },

  // 16. XE ĐẠP (Cycling) - Road Bicycle
  {
    filename: 'cycling.svg',
    id: 'cycling',
    name: 'Đua xe đạp',
    gradStart: '#06b6d4',
    gradEnd: '#0891b2',
    innerSvg: `
      <!-- Rear wheel -->
      <circle cx="17.5" cy="21.5" r="4.5" fill="none" stroke="#0891B2" stroke-width="1.2" />
      <circle cx="17.5" cy="21.5" r="0.9" fill="#0891B2" />
      <!-- Front wheel -->
      <circle cx="30.5" cy="21.5" r="4.5" fill="none" stroke="#0891B2" stroke-width="1.2" />
      <circle cx="30.5" cy="21.5" r="0.9" fill="#0891B2" />
      <!-- Bike frame tubes -->
      <!-- Rear hub to seat & BB -->
      <line x1="17.5" y1="21.5" x2="22.5" y2="16" stroke="#06B6D4" stroke-width="1.2" stroke-linecap="round" />
      <line x1="17.5" y1="21.5" x2="23.5" y2="21.5" stroke="#06B6D4" stroke-width="1.2" stroke-linecap="round" />
      <!-- BB to Seat -->
      <line x1="23.5" y1="21.5" x2="22.5" y2="16" stroke="#06B6D4" stroke-width="1.2" stroke-linecap="round" />
      <!-- Seat to Headtube (Top tube) -->
      <line x1="22.5" y1="16" x2="28" y2="16" stroke="#06B6D4" stroke-width="1.2" stroke-linecap="round" />
      <!-- BB to Headtube (Downtube) -->
      <line x1="23.5" y1="21.5" x2="28" y2="16" stroke="#06B6D4" stroke-width="1.2" stroke-linecap="round" />
      <!-- Fork to Front hub -->
      <line x1="28" y1="16" x2="30.5" y2="21.5" stroke="#06B6D4" stroke-width="1.2" stroke-linecap="round" />
      <!-- Saddle -->
      <path d="M 21 15 L 24 15" stroke="#0E7490" stroke-width="1.8" stroke-linecap="round" />
      <!-- Handlebar -->
      <path d="M 27.5 15 L 28.5 14.5 L 29.5 16" fill="none" stroke="#0E7490" stroke-width="1.4" stroke-linecap="round" />
    `,
  },

  // 17. LEO NÚI NHÂN TẠO (Climbing / Bouldering) - Climbing Holds & Wall
  {
    filename: 'climbing.svg',
    id: 'climbing',
    name: 'Leo núi nhân tạo',
    gradStart: '#f97316',
    gradEnd: '#c2410c',
    innerSvg: `
      <!-- Colorful Climbing holds on wall -->
      <polygon points="16,15 19,14 18,17 15,17" fill="#EF4444" />
      <polygon points="28,14 31,16 29,18 26,16" fill="#3B82F6" />
      <polygon points="18,24 21,23 20,26 17,25" fill="#10B981" />
      <polygon points="29,23 32,24 30,26 27,25" fill="#FACC15" />
      <!-- Climber athlete silhouette -->
      <circle cx="23.5" cy="16" r="2.2" fill="#9A3412" />
      <line x1="23.5" y1="18" x2="23.5" y2="23" stroke="#9A3412" stroke-width="1.8" stroke-linecap="round" />
      <!-- Reaching right arm -->
      <path d="M 23.5 19 L 26 17 L 28 15" fill="none" stroke="#9A3412" stroke-width="1.5" stroke-linecap="round" />
      <!-- Left arm on hold -->
      <path d="M 23.5 19 L 20 18 L 18 16" fill="none" stroke="#9A3412" stroke-width="1.5" stroke-linecap="round" />
      <!-- Legs gripping lower holds -->
      <path d="M 23.5 23 L 21 24.5 L 20 25.5" fill="none" stroke="#9A3412" stroke-width="1.5" stroke-linecap="round" />
      <path d="M 23.5 23 L 26 24 L 28 25" fill="none" stroke="#9A3412" stroke-width="1.5" stroke-linecap="round" />
    `,
  },

  // 18. TRƯỢT PATIN / VÁN TRƯỢT (Skating) - Skateboard & Wheels
  {
    filename: 'skating.svg',
    id: 'skating',
    name: 'Trượt patin / Ván trượt',
    gradStart: '#8b5cf6',
    gradEnd: '#6d28d9',
    innerSvg: `
      <!-- Skateboard Deck tilted -->
      <path d="M 14 22.5 Q 13 20.5 15.5 21 L 30.5 16.5 Q 33 16 33 18" fill="none" stroke="#7C3AED" stroke-width="2.2" stroke-linecap="round" />
      <!-- Grip tape highlight -->
      <path d="M 16.5 21 L 29.5 17" stroke="#DDD6FE" stroke-width="0.9" stroke-linecap="round" />
      <!-- Front truck & wheel -->
      <rect x="27" y="18.5" width="2" height="2" fill="#475569" />
      <circle cx="28" cy="22" r="2.3" fill="#F43F5E" stroke="#BE123C" stroke-width="0.7" />
      <circle cx="28" cy="22" r="0.8" fill="#FFFFFF" />
      <!-- Rear truck & wheel -->
      <rect x="17.5" y="22" width="2" height="2" fill="#475569" />
      <circle cx="18.5" cy="25.5" r="2.3" fill="#F43F5E" stroke="#BE123C" stroke-width="0.7" />
      <circle cx="18.5" cy="25.5" r="0.8" fill="#FFFFFF" />
    `,
  },

  // 19. YOGA / PILATES - Lotus Posture & Harmony
  {
    filename: 'yoga.svg',
    id: 'yoga',
    name: 'Yoga / Pilates',
    gradStart: '#14b8a6',
    gradEnd: '#0f766e',
    innerSvg: `
      <!-- Meditating yogi in Lotus Pose -->
      <circle cx="24" cy="14" r="2.4" fill="#0F766E" />
      <!-- Torso -->
      <line x1="24" y1="16.5" x2="24" y2="22.5" stroke="#0F766E" stroke-width="2" stroke-linecap="round" />
      <!-- Left arm in mudra -->
      <path d="M 24 18 L 20 20 L 17 22" fill="none" stroke="#0F766E" stroke-width="1.4" stroke-linecap="round" />
      <!-- Right arm in mudra -->
      <path d="M 24 18 L 28 20 L 31 22" fill="none" stroke="#0F766E" stroke-width="1.4" stroke-linecap="round" />
      <!-- Crossed legs base -->
      <path d="M 16 23.5 C 18 21.5 21 23 24 23 C 27 23 30 21.5 32 23.5 C 30 25.5 18 25.5 16 23.5 Z" fill="#0F766E" />
      <!-- Lotus flower petal base -->
      <path d="M 24 24 C 22 25.5 19 26.5 18 25.5 C 21 27.5 27 27.5 30 25.5 C 29 26.5 26 25.5 24 24 Z" fill="#5EEAD4" />
    `,
  },

  // 20. THỂ THAO CHUNG / ĐA NĂNG (General / Multi-sport) - Trophy & Star
  {
    filename: 'general.svg',
    id: 'general',
    name: 'Thể thao chung',
    gradStart: '#6366f1',
    gradEnd: '#4f46e5',
    innerSvg: `
      <!-- Trophy Cup Body -->
      <path d="M 19 14 L 29 14 L 28 19 C 27.5 22 24.5 23 24 23 C 23.5 23 20.5 22 20 19 Z" fill="#FBBF24" stroke="#D97706" stroke-width="0.8" />
      <!-- Trophy Handles -->
      <path d="M 19 15 C 16.5 15 16.5 19 19 19" fill="none" stroke="#D97706" stroke-width="0.9" stroke-linecap="round" />
      <path d="M 29 15 C 31.5 15 31.5 19 29 19" fill="none" stroke="#D97706" stroke-width="0.9" stroke-linecap="round" />
      <!-- Trophy Stem & Base -->
      <rect x="23" y="23" width="2" height="2" fill="#D97706" />
      <rect x="20.5" y="25" width="7" height="2" rx="0.5" fill="#4F46E5" stroke="#3730A3" stroke-width="0.6" />
      <!-- Star on cup -->
      <polygon points="24,16 24.6,17.2 26,17.3 24.9,18.2 25.3,19.5 24,18.8 22.7,19.5 23.1,18.2 22,17.3 23.4,17.2" fill="#FFFFFF" />
    `,
  },
];

for (const sport of sports) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 56" width="48" height="56" fill="none">
  <defs>
    <!-- Pin shadow filter -->
    <filter id="shadow-${sport.id}" x="0" y="0" width="48" height="56" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#0F172A" flood-opacity="0.28" />
    </filter>
    <!-- Pin gradient -->
    <linearGradient id="grad-${sport.id}" x1="24" y1="2" x2="24" y2="52" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${sport.gradStart}" />
      <stop offset="100%" stop-color="${sport.gradEnd}" />
    </linearGradient>
  </defs>

  <!-- Inverted Teardrop Pin Silhouette (Map Location Pin) -->
  <path
    d="${pinPath}"
    fill="url(#grad-${sport.id})"
    stroke="#FFFFFF"
    stroke-width="1.5"
    filter="url(#shadow-${sport.id})"
  />

  <!-- Circular Badge Surface inside Pin -->
  <circle cx="24" cy="20" r="13.5" fill="#FFFFFF" />
  <circle cx="24" cy="20" r="13.5" fill="none" stroke="${sport.gradEnd}" stroke-width="0.75" stroke-opacity="0.35" />

  <!-- Sport Representation Symbol Inside Pin -->
  <g>
    ${sport.innerSvg.trim()}
  </g>
</svg>
`;

  writeFileSync(join(outDir, sport.filename), svg, 'utf8');
  console.log(`Generated: ${join(outDir, sport.filename)}`);
}
