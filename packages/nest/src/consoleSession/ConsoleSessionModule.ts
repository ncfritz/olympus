import {
  type DynamicModule,
  Module,
  type ModuleMetadata,
} from "@nestjs/common";
import { CONSOLE_SESSION_CONFIG, type ConsoleSessionConfig } from "./config";
import { ConsoleSession } from "./ConsoleSession";
import { ConsoleSignIn } from "./ConsoleSignIn";
import { OlympusAuthApi } from "./OlympusAuthApi";

export interface ConsoleSessionModuleOptions {
  imports?: ModuleMetadata["imports"];
  // Nest's own type for factory providers' injections.
  inject?: (string | symbol | (abstract new (...args: never[]) => unknown))[];
  useFactory: (
    ...args: never[]
  ) => ConsoleSessionConfig | Promise<ConsoleSessionConfig>;
}

/**
 * A console's sign-in through Olympus (ADR 0029), for the service behind
 * the console: the API client, the sign-in and its refresh, and the
 * session read from the cookies. The routes and the guard stay the
 * service's own, since they belong to its OpenAPI document and its rules
 * about who may call what.
 */
@Module({})
export class ConsoleSessionModule {
  static forRootAsync(options: ConsoleSessionModuleOptions): DynamicModule {
    return {
      module: ConsoleSessionModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: CONSOLE_SESSION_CONFIG,
          inject: options.inject ?? [],
          useFactory: options.useFactory,
        },
        OlympusAuthApi,
        ConsoleSignIn,
        ConsoleSession,
      ],
      exports: [
        CONSOLE_SESSION_CONFIG,
        OlympusAuthApi,
        ConsoleSignIn,
        ConsoleSession,
      ],
    };
  }
}
