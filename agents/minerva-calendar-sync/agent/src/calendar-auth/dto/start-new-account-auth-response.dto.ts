import { ApiProperty } from "@nestjs/swagger";

export class StartNewAccountAuthResponseDto {
  @ApiProperty({
    description:
      "Opaque id — poll GET /calendar-accounts/new/{transactionId} with this to learn the outcome",
  })
  transactionId: string;

  @ApiProperty({
    description:
      "Open this URL in a browser and sign in to authorize a new account",
  })
  authUrl: string;
}
