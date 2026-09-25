import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuditModule } from "./audit/AuditModule";
import { AuthModule } from "./auth/AuthModule";
import { CeremoniesModule } from "./ceremonies/CeremoniesModule";
import { CertificatesModule } from "./certificates/CertificatesModule";
import { ALL_CONFIG } from "./config/configuration";
import { CrlsModule } from "./crls/CrlsModule";
import { IssuersModule } from "./issuers/IssuersModule";
import { KeysModule } from "./keys/KeysModule";
import { MetricsModule } from "./metrics/MetricsModule";
import { ProfilesModule } from "./profiles/ProfilesModule";
import { SignerModule } from "./signer/SignerModule";
import { StoreModule } from "./store/StoreModule";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Typed namespaces (config/configuration.ts); the environment comes
      // from the process (`--env-file=dev.env`), validated by main.ts.
      ignoreEnvFile: true,
      load: ALL_CONFIG,
    }),
    MetricsModule,
    StoreModule,
    AuthModule,
    AuditModule,
    SignerModule,
    KeysModule,
    IssuersModule,
    CeremoniesModule,
    ProfilesModule,
    CertificatesModule,
    CrlsModule,
  ],
})
export class AppModule {}
