import {
  Global,
  Inject,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, QueryResultRow } from 'pg';

import * as schema from './schema/index.js';

export const DATABASE_POOL = Symbol('DATABASE_POOL');
export const DATABASE = Symbol('DATABASE');

export type DrizzleDb = NodePgDatabase<typeof schema>;
export const InjectDrizzle = (): ReturnType<typeof Inject> => Inject(DATABASE);

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ) {
    return this.pool.query<T>(text, values);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Pool =>
        new Pool({
          connectionString: configService.getOrThrow<string>('DATABASE_URL'),
        }),
    },
    {
      provide: DATABASE,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool): DrizzleDb => drizzle(pool, { schema }),
    },
    DatabaseService,
  ],
  exports: [DATABASE, DatabaseService],
})
export class DatabaseModule {}
