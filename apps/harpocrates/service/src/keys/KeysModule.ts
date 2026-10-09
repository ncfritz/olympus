import { Global, Module } from "@nestjs/common";
import { KeyService } from "./services/KeyService";

/** Keys and their uniqueness; no operations of their own. */
@Global()
@Module({ providers: [KeyService], exports: [KeyService] })
export class KeysModule {}
