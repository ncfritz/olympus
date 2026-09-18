import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { PaginatedResults } from "../../common";

export enum DogType {
  STANDARD = "standard",
  CUSTOM = "custom",
  CUSTOMER = "customer",
}

export enum GroupType {
  FOUNDATION_STOCK_SERVICE = "FS",
  HERDING = "HD",
  HOUND = "HN",
  MISCELLANEOUS_CLASS = "MC",
  NON_SPORTING = "NS",
  SPORTING = "SP",
  TERRIER = "TR",
  TOY = "TY",
  WORKING = "WK",
}

export class BaseDog {
  @ApiProperty({
    type: String,
    required: true,
    description: "The name of the dog",
  })
  name: string;

  @ApiProperty({
    enum: () => DogType,
    enumName: "DogType",
    required: true,
    description: "The type of dog",
  })
  type: DogType;

  @ApiProperty({
    enum: () => GroupType,
    enumName: "GroupType",
    required: true,
    description: "The group the dog belongs to",
  })
  groupType: GroupType;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Grooming frequency",
  })
  groomingFrequency: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Shedding amount",
  })
  sheddingAmount: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Energy level",
  })
  energyLevel: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Trainability",
  })
  trainability: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Demeanor",
  })
  demeanor: number;
}

export class Dog extends BaseDog {
  @ApiProperty({
    type: String,
    required: true,
    description: "The primary ID of the dog",
  })
  id: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the dog was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the dog was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialDog extends PartialType(
  OmitType(Dog, ["id", "createdTime", "lastUpdatedTime"]),
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateDogRequest {
  @ApiProperty({
    type: () => PartialDog,
    required: true,
    description: "The dog to create",
  })
  dog: PartialDog;
}

export class UpdateDogRequest {
  @ApiProperty({
    type: () => PartialDog,
    required: true,
    description: "The dog to update",
  })
  dog: PartialDog;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class SingleDogResponse {
  @ApiProperty({
    type: () => Dog,
    required: true,
    description: "A dog that has been created, updated, or queried",
  })
  dog: Dog;
}

export class ListDogsResponse extends PaginatedResults {
  @ApiProperty({
    type: () => Dog,
    isArray: true,
    required: true,
    description: "A list of dogs",
  })
  dogs: Dog[];
}
