import { ApiProperty } from "@nestjs/swagger";

export class StartReauthResponseDto {
  @ApiProperty({ description: "Open this URL in a browser and sign in to grant Minerva access again" })
  authUrl: string;
}
