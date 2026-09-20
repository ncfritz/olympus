import { ApiProperty } from "@nestjs/swagger";
import { AuthUser } from "../authUser";

export class CurrentUserDto implements AuthUser {
  @ApiProperty()
  email: string;
}
