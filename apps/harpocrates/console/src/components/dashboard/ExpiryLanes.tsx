import { Card, Empty, Flex, Tag, Tooltip, Typography } from "antd";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { ExpiringCertificate, Issuer } from "@/lib/api/types";
import {
  band,
  LANE_DAYS,
  LANE_ROWS,
  placeChips,
  shortName,
  timeUntil,
} from "@/lib/dashboard";
import { formatDate } from "@/lib/labels";
import { shortCaName } from "@/lib/tree";
import styles from "./Dashboard.module.css";

const ROW_HEIGHT = 26;
const LANE_CLASS = [styles.lane1, styles.lane2, styles.lane3];

/** A chip's place on its lane: the only values set from code. */
const chipPlace = (left: number, row: number) =>
  ({
    "--left": `${left}%`,
    "--top": `${4 + row * ROW_HEIGHT}px`,
  }) as CSSProperties;
const TICKS = [0, 30, 60, 90];

/**
 * What expires within 90 days and has not been replaced, one lane per CA:
 * red past its renewal point, orange when a person must renew it, blue
 * when something renews it.
 */
export function ExpiryLanes({
  expiring,
  issuers,
  now,
}: {
  expiring: ExpiringCertificate[];
  issuers: Issuer[];
  now: number;
}) {
  const lanes = issuers
    .map((issuer) => ({
      issuer,
      chips: placeChips(
        expiring.filter((e) => e.issuerId === issuer.id),
        now,
      ),
    }))
    .filter((lane) => lane.chips.length > 0);

  return (
    <Card
      title={`Expiring in the next ${LANE_DAYS} days`}
      extra={
        <Flex gap={4} wrap>
          <Tag color="red">Past its renewal point</Tag>
          <Tag color="orange">Needs a person</Tag>
          <Tag color="blue">Renews itself</Tag>
        </Flex>
      }
    >
      {lanes.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`Nothing expires in the next ${LANE_DAYS} days that has not been replaced`}
        />
      ) : (
        <Flex vertical gap="small">
          <div className={styles.laneRow}>
            <span />
            <Flex justify="space-between">
              {TICKS.map((day) => (
                <Typography.Text
                  key={day}
                  type="secondary"
                  className={styles.small}
                >
                  {day === 0 ? "Today" : `+${day} days`}
                </Typography.Text>
              ))}
            </Flex>
          </div>
          {lanes.map(({ issuer, chips }) => {
            const rows = Math.min(
              Math.max(...chips.map((chip) => chip.row)) + 1,
              LANE_ROWS,
            );
            return (
              <div key={issuer.id} className={styles.laneRow}>
                <Flex vertical className={styles.shrink}>
                  <Link href={`/ca?id=${issuer.id}`}>
                    <Typography.Text ellipsis className={styles.laneName}>
                      {shortCaName(issuer)}
                    </Typography.Text>
                  </Link>
                  <Typography.Text type="secondary" className={styles.small}>
                    {chips.length} expiring
                    {issuer.status === "closed" ? " · closed" : ""}
                  </Typography.Text>
                </Flex>
                <div className={`${styles.lane} ${LANE_CLASS[rows - 1]}`}>
                  {chips.map(({ certificate, left, row }) => {
                    const { color, label } = band(certificate, now);
                    return (
                      <Tooltip
                        key={certificate.certificateId}
                        title={`${certificate.name}: expires ${formatDate(certificate.notAfter)} (${timeUntil(certificate.notAfter, now)}). ${label}.`}
                      >
                        <Link
                          href={`/certificates?certificateId=${certificate.certificateId}`}
                          aria-label={`${certificate.name}, expires in ${timeUntil(certificate.notAfter, now)}, ${label.toLowerCase()}`}
                          className={styles.chip}
                          style={chipPlace(left, row)}
                        >
                          <Tag color={color} className={styles.chipTag}>
                            {shortName(certificate.name)}
                          </Tag>
                        </Link>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </Flex>
      )}
    </Card>
  );
}
