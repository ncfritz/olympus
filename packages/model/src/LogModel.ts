import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";

export enum LogLevel {
  TRACE = "TRACE",
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  FATAL = "FATAL",
}

export class LogLine {
  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  timestamp: Moment;

  @ApiProperty({
    enum: () => LogLevel,
    enumName: "LogLevel",
  })
  level: LogLevel;

  @ApiProperty({ type: String })
  data: string;
}
