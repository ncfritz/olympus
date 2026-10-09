import {
  v1 as uuidv1,
  v3 as uuidv3,
  v4 as uuidv4,
  v5 as uuidv5,
  v6 as uuidv6,
  v7 as uuidv7,
} from "uuid";
import {
  UUID_UNKNOWN,
  UUID_V1,
  UUID_V3,
  UUID_V4,
  UUID_V5,
  UUID_V6,
  UUID_V7,
} from "./constants";
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
    case 6:
      return uuidv6();
    case 7:
      return uuidv7();
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
    case 6:
      return UUID_V6;
    case 7:
      return UUID_V7;
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

const parseUuid = (s: string, buf?: number[], offset?: number): number[] => {
  let i;
  const byteToHex: string[] = [];
  const hexToByte: Record<string, number> = {};

  for (i = 0; i < 256; i++) {
    byteToHex[i] = (i + 0x100).toString(16).substring(1);
    hexToByte[byteToHex[i]] = i;
  }

  i = (buf && offset) || 0;
  let ii = 0;

  const bytes = buf || [];
  s.toLowerCase().replace(/[0-9a-f]{2}/g, function (oct: string) {
    if (ii < 16) {
      // Don't overflow!
      bytes[i + ii++] = hexToByte[oct];
    }

    // The rewritten string is discarded; this is a walk, not a substitution.
    return oct;
  });

  // Zero out remaining bytes if string was short
  while (ii < 16) {
    bytes[i + ii++] = 0;
  }

  return bytes;
};

export const v1time = (uuid: string | ArrayLike<number>, offset?: number) => {
  if (typeof uuid === "string" && offset) {
    throw new Error("Offset in string v1 uuid not valid.");
  }

  let msec = 0;
  let nsec = 0;
  const b = typeof uuid === "string" ? parseUuid(uuid) : uuid;
  let i = offset || 0;

  // inspect version at offset 6
  if ((b[i + 6] & 0x10) != 0x10) {
    throw new Error("uuid version 1 expected");
  }

  // 'time_low'
  let tl = 0;
  tl |= (b[i++] & 0xff) << 24;
  tl |= (b[i++] & 0xff) << 16;
  tl |= (b[i++] & 0xff) << 8;
  tl |= b[i++] & 0xff;

  // `time_mid`
  let tmh = 0;
  tmh |= (b[i++] & 0xff) << 8;
  tmh |= b[i++] & 0xff;

  // `time_high_minus_version`
  tmh |= (b[i++] & 0xf) << 24;
  tmh |= (b[i++] & 0xff) << 16;

  // account for the sign bit
  msec = ((tl >>> 1) * 2 + ((tl & 0x7fffffff) % 2)) / 10000.0;
  msec +=
    (((tmh >>> 1) * 2 + ((tmh & 0x7fffffff) % 2)) * 0x100000000) / 10000.0;

  // Per 4.1.4 - Convert from Gregorian epoch to unix epoch
  msec -= 12219292800000;

  // getting the nsec. they are not needed now though
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nsec = (tl & 0xfffffff) % 10000;

  return msec;
};

export const v6time = (uuid: string | ArrayLike<number>, offset?: number) => {
  if (typeof uuid === "string" && offset) {
    throw new Error("Offset in string v1 uuid not valid.");
  }

  let msec = 0;
  let nsec = 0;
  const b = typeof uuid === "string" ? parseUuid(uuid) : uuid;
  let i = offset || 0;

  // inspect version at offset 6
  if ((b[i + 6] & 0x60) != 0x60) {
    throw new Error("uuid version 1 expected");
  }

  // 'time_high'
  let th = 0;
  th |= (b[i++] & 0xff) << 24;
  th |= (b[i++] & 0xff) << 16;
  th |= (b[i++] & 0xff) << 8;
  th |= b[i++] & 0xff;

  // `time_mid`
  let tmh = 0;
  tmh |= (b[i++] & 0xff) << 8;
  tmh |= b[i++] & 0xff;

  // `time_low_minus_version`
  tmh |= (b[i++] & 0xf) << 24;
  tmh |= (b[i++] & 0xff) << 16;

  // account for the sign bit
  msec = ((th >>> 1) * 2 + ((th & 0x7fffffff) % 2)) / 10000.0;
  msec +=
    (((tmh >>> 1) * 2 + ((tmh & 0x7fffffff) % 2)) * 0x100000000) / 10000.0;

  // Per 4.1.4 - Convert from Gregorian epoch to unix epoch
  msec -= 12219292800000;

  // getting the nsec. they are not needed now though
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nsec = (th & 0xfffffff) % 10000;

  return msec;
};
