import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** MSW cho môi trường test (Vitest) — không dùng service worker. */
export const server = setupServer(...handlers);
