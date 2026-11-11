import { Module } from "@nestjs/common";
import { ProofStorage } from "./proof-storage.js";
import { ProofCleanupService } from "./proof-cleanup.service.js";
import { PublicStorage } from "./public-storage.js";

@Module({
  providers: [ProofStorage, ProofCleanupService, PublicStorage],
  exports: [ProofStorage, ProofCleanupService, PublicStorage],
})
export class UploadsModule {}
