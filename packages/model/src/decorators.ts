import { applyDecorators } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export type ApiTimestampOptions = {
  required: boolean;
  description?: string;
};

/**
 * A timestamp property: typed `Moment` in the model, an ISO-8601 string on
 * the wire. Equivalent to
 *
 *   @ApiProperty({ type: String, required, description })
 *   @Transform(({ value }) => (value ? value.toISOString() : undefined))
 *
 * The transform only runs when class-transformer serializes the object
 * (not on the current @Res()-based controllers, where Moment's own toJSON
 * already produces ISO-8601). It is null-safe, unlike most of the
 * hand-written transforms it replaces.
 */
export const ApiTimestamp = ({ required, description }: ApiTimestampOptions) =>
  applyDecorators(
    ApiProperty({
      type: String,
      required,
      ...(description === undefined ? {} : { description }),
    }),
    Transform(({ value }) => (value ? value.toISOString() : undefined)),
  );
