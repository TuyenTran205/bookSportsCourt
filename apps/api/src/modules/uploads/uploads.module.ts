import { Module } from "@nestjs/common";
import { ProofStorage } from "./proof-storage.js";
import { ProofCleanupService } from "./proof-cleanup.service.js";
@Module({
  providers: [ProofStorage, ProofCleanupService],
  exports: [ProofStorage, ProofCleanupService],
})
export class UploadsModule {}
