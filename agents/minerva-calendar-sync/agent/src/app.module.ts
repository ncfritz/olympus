import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { StoreModule } from "./store/store.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), StoreModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
