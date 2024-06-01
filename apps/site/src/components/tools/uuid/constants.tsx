import React from "react";
import type { DigitType } from "./interfaces";

export const NAMESPACE = "f5efdc6c-f5e9-4547-8126-6e394c4998aa";
export const NAMESPACE_CUSTOM = "custom";
export const NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
export const NAMESPACE_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
export const NAMESPACE_OID = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";
export const NAMESPACE_X_500_DN = "6ba7b814-9dad-11d1-80b4-00c04fd430c8";

export const TIME_LOW: DigitType = { label: "tl", color: "#5f4690" };
export const TIME_MID: DigitType = { label: "tm", color: "#1e6996" };
export const TIME_HIGH: DigitType = { label: "th", color: "#37a6a5" };
export const CLOCK_LOW: DigitType = { label: "cl", color: "#0e8554" };
export const CLOCK_HIGH: DigitType = { label: "ch", color: "#73af48" };
export const NODE: DigitType = { label: "n", color: "#888888" };
export const HASH_MD5: DigitType = { label: "h5", color: "#704070" };
export const HASH_SHA1: DigitType = { label: "h1", color: "#a94481" };
export const RANDOM: DigitType = { label: "ra", color: "#8c4c00" };
export const VARIANT: DigitType = { label: "x", color: "#000000" };
export const VERSION: DigitType = { label: "v", color: "#cc503e" };
export const UNKNOWN: DigitType = { label: "u", color: "#ffcc33" };

export const UUID_V1: DigitType[] = new Array(32)
  .fill(TIME_LOW, 0, 8)
  .fill(TIME_MID, 8, 12)
  .fill(VERSION, 12, 13)
  .fill(TIME_HIGH, 13, 16)
  .fill(VARIANT, 16, 17)
  .fill(CLOCK_HIGH, 17, 18)
  .fill(CLOCK_LOW, 18, 20)
  .fill(NODE, 20, 32);

export const UUID_V3: DigitType[] = new Array(32)
  .fill(HASH_MD5, 0, 12)
  .fill(VERSION, 12, 13)
  .fill(HASH_MD5, 13, 16)
  .fill(VARIANT, 16, 17)
  .fill(HASH_MD5, 17, 32);

export const UUID_V4: DigitType[] = new Array(32)
  .fill(RANDOM, 0, 12)
  .fill(VERSION, 12, 13)
  .fill(RANDOM, 13, 16)
  .fill(VARIANT, 16, 18)
  .fill(RANDOM, 17, 32);

export const UUID_V5: DigitType[] = new Array(32)
  .fill(HASH_SHA1, 0, 12)
  .fill(VERSION, 12, 13)
  .fill(HASH_SHA1, 13, 16)
  .fill(VARIANT, 16, 17)
  .fill(HASH_SHA1, 17, 32);

export const UUID_UNKNOWN: DigitType[] = new Array(32).fill(UNKNOWN, 0, 32);

export const DASH = (
  <div
    style={{
      minWidth: 16,
      maxWidth: 16,
      height: 24,
      background: "#ffffff",
      borderRadius: 6,
      color: "#000000",
      justifyContent: "center",
      alignItems: "center",
      display: "flex",
      fontFamily: "monospace",
      fontSize: "18px",
    }}
  >
    -
  </div>
);

export const formItemLayout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

export const buttonItemLayout = {
  wrapperCol: { span: 20, offset: 4 },
};
