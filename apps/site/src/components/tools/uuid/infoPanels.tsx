import { Space } from "antd";
import React from "react";
import {
  CLOCK_HIGH,
  CLOCK_LOW,
  HASH_MD5,
  HASH_SHA1,
  NODE,
  RANDOM,
  TIME_HIGH,
  TIME_LOW,
  TIME_MID,
  UNIX_TS_MS,
  VARIANT,
  VERSION,
} from "./constants";
import UUIDPartRow from "./UUIDPartRow";

export const V1_INFO_PANEL = (
  <Space orientation={"vertical"} size={8}>
    <UUIDPartRow
      label={"time_low"}
      types={[TIME_LOW]}
      description={
        "Timestamp least significant bits (highest change frequency)"
      }
    />
    <UUIDPartRow
      label={"time_mid"}
      types={[TIME_MID]}
      description={"Timestamp middle bits"}
    />
    <UUIDPartRow
      label={"time_high"}
      types={[TIME_HIGH]}
      description={"Timestamp most significant bits"}
    />
    <UUIDPartRow
      label={"timestamp"}
      types={[TIME_LOW, TIME_MID, TIME_HIGH]}
      description={
        "60 bits in total - count of 100ns intervals since 1582-10-15T00:00:00.00Z"
      }
    />
    <UUIDPartRow
      label={"version"}
      types={[VERSION]}
      description={"Should always be 1"}
    />
    <UUIDPartRow
      label={""}
      types={[VERSION, TIME_HIGH]}
      description={
        "version and time_high are labeled together as time_high_and_version in the RFC"
      }
    />
    <UUIDPartRow label={"variant"} types={[VARIANT]} description={""} />
    <UUIDPartRow
      label={"clock_seq_high"}
      types={[CLOCK_HIGH]}
      description={
        "Clock sequence can be incremented to generate UUIDs faster than the timestamp ticks"
      }
    />
    <UUIDPartRow label={"clock_seq_low"} types={[CLOCK_LOW]} description={""} />
    <UUIDPartRow
      label={"node"}
      types={[NODE]}
      description={
        "The IEEE 802 MAC address of the machine generating the UUID"
      }
    />
  </Space>
);

export const V35_INFO_PANEL = (
  <Space orientation={"vertical"} size={8} style={{ marginTop: 16 }}>
    <UUIDPartRow
      label={"hash_md5"}
      types={[HASH_MD5]}
      description={
        "MD5 digest of namespace (UUID) and name.  Only 121 or 122 bits are used from the MD5 digest - the version and variant bits are replaced"
      }
    />
    <UUIDPartRow
      label={"hash_sha1"}
      types={[HASH_SHA1]}
      description={
        "SHA1 digest of namespace (UUID) and name.  The 160-bit SHA1 digest is truncated to 128 bits before the version and variant bits are replaced"
      }
    />
    <UUIDPartRow
      label={"version"}
      types={[VERSION]}
      description={"Should always be 3 (for MD5) or 5 (for SHA1) based UUIDs"}
    />
    <UUIDPartRow label={"variant"} types={[VARIANT]} description={""} />
  </Space>
);

export const V4_INFO_PANEL = (
  <Space orientation={"vertical"} size={8} style={{ marginTop: 16 }}>
    <UUIDPartRow
      label={"random"}
      types={[RANDOM]}
      description={"Truly random, or pseudo-random 122 bits"}
    />
    <UUIDPartRow
      label={"version"}
      types={[VERSION]}
      description={"Should always be 5"}
    />
    <UUIDPartRow label={"variant"} types={[VARIANT]} description={""} />
  </Space>
);

export const V6_INFO_PANEL = (
  <Space orientation={"vertical"} size={8} style={{ marginTop: 16 }}>
    <UUIDPartRow
      label={"time_high"}
      types={[TIME_HIGH]}
      description={"Timestamp most significant bits"}
    />
    <UUIDPartRow
      label={"time_mid"}
      types={[TIME_MID]}
      description={"Timestamp middle bits"}
    />
    <UUIDPartRow
      label={"time_low"}
      types={[TIME_LOW]}
      description={
        "Timestamp least significant bits (highest change frequency)"
      }
    />
    <UUIDPartRow
      label={"timestamp"}
      types={[TIME_LOW, TIME_MID, TIME_HIGH]}
      description={
        "60 bits in total - count of 100ns intervals since 1582-10-15T00:00:00.00Z"
      }
    />
    <UUIDPartRow
      label={"version"}
      types={[VERSION]}
      description={"Should always be 6"}
    />
    <UUIDPartRow
      label={""}
      types={[VERSION, TIME_HIGH]}
      description={
        "version and time_high are labeled together as time_high_and_version in the RFC"
      }
    />
    <UUIDPartRow label={"variant"} types={[VARIANT]} description={""} />
    <UUIDPartRow
      label={"clock_seq_high"}
      types={[CLOCK_HIGH]}
      description={
        "Clock sequence can be incremented to generate UUIDs faster than the timestamp ticks"
      }
    />
    <UUIDPartRow label={"clock_seq_low"} types={[CLOCK_LOW]} description={""} />
    <UUIDPartRow
      label={"node"}
      types={[NODE]}
      description={
        "The IEEE 802 MAC address of the machine generating the UUID"
      }
    />
  </Space>
);

export const V7_INFO_PANEL = (
  <Space orientation={"vertical"} size={8} style={{ marginTop: 16 }}>
    <UUIDPartRow
      label={"unix ts"}
      types={[UNIX_TS_MS]}
      description={"48 bit big-endian unsigned number of Unix epoch timestamp"}
    />
    <UUIDPartRow
      label={"version"}
      types={[VERSION]}
      description={"Should always be 7"}
    />
    <UUIDPartRow
      label={"random A"}
      types={[RANDOM]}
      description={"12 bits pseudo-random data to provide uniqueness"}
    />
    <UUIDPartRow label={"variant"} types={[VARIANT]} description={""} />
    <UUIDPartRow
      label={"random B"}
      types={[RANDOM]}
      description={
        "The final 62 bits of pseudo-random data to provide uniqueness"
      }
    />
  </Space>
);
