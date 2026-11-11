import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

declare const process: { env: Record<string, string | undefined> };

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
dotenv.config({ path: '../../.env.local' });
dotenv.config({ path: '../../.env' });

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./apps/api/src/database/schema/schema.ts', './src/database/schema/schema.ts'],
  out: './apps/api/src/database/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
