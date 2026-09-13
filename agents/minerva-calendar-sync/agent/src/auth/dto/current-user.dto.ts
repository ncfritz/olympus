import { ApiProperty } from "@nestjs/swagger";
import { AuthUser } from "../auth-user";

export class CurrentUserDto implements AuthUser {
  @ApiProperty()
  email: string;
}
