import { ApiProperty } from "@nestjs/swagger";

export type NewAccountAuthStatus = "pending" | "success" | "error";

const STATUS_VALUES: NewAccountAuthStatus[] = ["pending", "success", "error"];

export class NewAccountAuthStatusDto {
  @ApiProperty({
    description:
      "pending: waiting on the user to finish signing in. success: the account is connected — see accountLabel. error: the flow failed — see error.",
    enum: STATUS_VALUES,
  })
  status: NewAccountAuthStatus;

  @ApiProperty({
    description:
      "The newly authorized account's label (its email address), once status is 'success'",
    required: false,
  })
  accountLabel?: string;

  @ApiProperty({
    description: "Human-readable detail when status is 'error'",
    required: false,
  })
  error?: string;
}
