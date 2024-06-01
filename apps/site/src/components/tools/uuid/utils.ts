import { v1 as uuidv1, v3 as uuidv3, v4 as uuidv4, v5 as uuidv5 } from "uuid";
import { UUID_UNKNOWN, UUID_V1, UUID_V3, UUID_V4, UUID_V5 } from "./constants";
import type { DigitType } from "./interfaces";

export const generate = (
  version: number,
  namespace?: string,
  name?: string,
): string => {
  switch (version) {
    case 1:
      return uuidv1();
    case 3:
      return uuidv3(namespace!, name!);
    case 4:
      return uuidv4();
    case 5:
      return uuidv5(namespace!, name!);
    default:
      return "Error";
  }
};

export const getDefinitionForVersion = (version: number): DigitType[] => {
  switch (version) {
    case 1:
      return UUID_V1;
    case 3:
      return UUID_V3;
    case 4:
      return UUID_V4;
    case 5:
      return UUID_V5;
    default:
      return UUID_UNKNOWN;
  }
};

export const getByteString = (
  arr: Uint16Array | number[],
  start: number,
  end: number,
  separator?: string,
): string => {
  const ret: string[] = [];

  arr.slice(start, end).forEach((value) => {
    ret.push(value.toString(16));
  });

  return ret.join(separator || "");
};

export const getVariant = (rawUuid: number[]) => {
  const variant = rawUuid[16];

  switch (variant.toString(16)) {
    case "0":
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
    case "7":
      return "reserved (NCS backward compatible)";
    case "8":
    case "9":
    case "a":
    case "b":
      return "DCE 1.1, ISO/IEC 11578:1996";
    case "c":
    case "d":
      return "reserved (Microsoft GUID)";
    case "e":
      return "reserved (future use)";
    case "f":
    default:
      return "unknown / invalid";
  }
};
