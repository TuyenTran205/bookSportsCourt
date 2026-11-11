import { Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import { courts, venues } from "../../database/schema/index.js";
import type { OwnershipResource } from "../../common/decorators/check-ownership.decorator.js";
import type { AuthTransaction } from "./auth.repository.js";

@Injectable()
export class OwnershipRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}
  async owner(resource: OwnershipResource, id: string, tx?: AuthTransaction) {
    const db = tx ?? this.db;
    if (resource === "venue") {
      const query = db
        .select({ ownerId: venues.ownerId })
        .from(venues)
        .where(and(eq(venues.id, id), isNull(venues.deletedAt)));
      const [row] = await (tx ? query.for("share") : query);
      return row;
    }
    const query = db
      .select({ ownerId: venues.ownerId })
      .from(courts)
      .innerJoin(venues, eq(courts.venueId, venues.id))
      .where(
        and(
          eq(courts.id, id),
          isNull(courts.deletedAt),
          isNull(venues.deletedAt),
        ),
      );
    const [row] = await (tx ? query.for("share") : query);
    return row;
  }
}
