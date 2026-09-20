import { AVAILABILITY_STATUS_VALUES } from "../domain/availability";

/*
 * Schema pieces shared by the management API's shapes (see
 * docs/conventions/model.md). Enums are the domain's string-literal arrays;
 * each is one named schema, described once.
 */

export const AVAILABILITY_STATUS_ENUM = {
  enum: [...AVAILABILITY_STATUS_VALUES],
  enumName: "AvailabilityStatus",
  enumSchema: {
    description:
      "An availability status, lowest precedence first: none, free, interruptable, busy",
  },
};

export const CALENDAR_PROVIDER_VALUES = ["google", "microsoft"] as const;

export const CALENDAR_PROVIDER_ENUM = {
  enum: [...CALENDAR_PROVIDER_VALUES],
  enumName: "CalendarProviderName",
  enumSchema: { description: "A calendar provider" },
};
