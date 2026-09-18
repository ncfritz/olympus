// Fixture for apiPropertyChecker.spec.ts. Each property name says whether
// the checker should accept it (ok*) or which rule it should report.
import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../../../src/decorators";

export enum Color {
  Red = "red",
  Blue = "blue",
}
export enum Size {
  Small = "s",
}

export class Other {
  @ApiProperty({ type: String, required: true, description: "d" })
  id: string;
}

export class Cases {
  @ApiProperty({ type: String, required: true, description: "d" })
  okString: string;

  @ApiProperty({ type: Number, required: false, description: "d" })
  okOptionalNumber?: number;

  @ApiProperty({
    type: () => Other,
    isArray: true,
    required: true,
    description: "d",
  })
  okClassArray: Other[];

  @ApiProperty({
    enum: () => Color,
    enumName: "Color",
    required: false,
    description: "d",
  })
  okOptionalEnum?: Color;

  @ApiProperty({ type: String, required: true, description: "d" })
  okMomentAsString: Moment;

  @ApiTimestamp({ required: true, description: "d" })
  okTimestamp: Moment;

  @ApiProperty({
    type: Object,
    additionalProperties: { type: "number" },
    required: true,
    description: "d",
  })
  okMap: Record<string, number>;

  @ApiProperty({
    type: "array",
    items: { type: "array", items: { type: "number" } },
    required: true,
    description: "d",
  })
  okNestedArray: number[][];

  @ApiProperty({ type: String, required: true, description: "d" })
  okLiteralUnion: "a" | "b";

  missingDecorator: string;

  @ApiProperty({ type: String, description: "d" })
  requiredMissing: string;

  @ApiProperty({ type: String, required: true, description: "d" })
  requiredMismatch?: string;

  @ApiProperty({ type: String, required: true })
  descriptionMissing: string;

  @ApiProperty({ type: () => Other, required: true, description: "d" })
  arrayMismatch: Other[];

  @ApiProperty({
    enum: () => Size,
    enumName: "Size",
    required: true,
    description: "d",
  })
  enumMismatch: Color;

  @ApiProperty({ enum: () => Color, required: true, description: "d" })
  enumNameMissing: Color;

  @ApiProperty({
    enum: () => Color,
    enumName: "Colour",
    required: true,
    description: "d",
  })
  enumNameMismatch: Color;

  @ApiProperty({ type: Number, required: true, description: "d" })
  typeMismatchPrimitive: string;

  @ApiProperty({ type: () => Other, required: true, description: "d" })
  typeMismatchClass: Cases;

  @ApiProperty({ type: Object, required: true, description: "d" })
  typeObject: { a: string };

  @ApiProperty({ type: () => Other, required: true, description: "d" })
  mapNotDocumented: Record<string, Other>;

  @ApiProperty({ type: String, required: true, description: "d" })
  unionUnchecked: string | number;

  @ApiTimestamp({ required: true, description: "d" })
  timestampType: string;
}
