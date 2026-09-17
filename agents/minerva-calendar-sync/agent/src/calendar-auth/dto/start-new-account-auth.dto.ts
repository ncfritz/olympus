import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class StartNewAccountAuthDto {
  @ApiProperty({ description: "Which provider to authorize a new account with", enum: ["google", "microsoft"] })
  @IsIn(["google", "microsoft"])
  provider: "google" | "microsoft";
}
