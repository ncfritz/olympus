"use client";

import { CheckCircleFilled, CheckCircleOutlined, CloseCircleFilled } from "@ant-design/icons";
import { message, Space, theme } from "antd";
import { useState } from "react";
import type { AvailabilityStatus } from "@/lib/api/queries";
import { AVAILABILITY_STATUSES, statusDotColor, STATUS_LABEL } from "@/lib/availability";

/**
 * A row-per-status override selector, generic over what "setting" and
 * "clearing" actually mean — used for both per-event overrides and
 * standalone override blocks, which have different backing APIs.
 */
export function OverrideStatusPicker({
  currentOverride,
  onOptimisticChange,
  onSelect,
  onClear,
}: {
  currentOverride: AvailabilityStatus | null;
  /** Called synchronously, before the request is sent, so the UI reflects the change immediately. */
  onOptimisticChange: (status: AvailabilityStatus | null) => void;
  /** Called when a non-current row is clicked — should persist the new status. */
  onSelect: (status: AvailabilityStatus) => Promise<void>;
  /** Called when the current row is clicked — should remove the override. */
  onClear: () => Promise<void>;
}) {
  const { token } = theme.useToken();
  const [hovered, setHovered] = useState<AvailabilityStatus | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick(status: AvailabilityStatus) {
    if (pending) return;
    const isCurrent = currentOverride === status;
    onOptimisticChange(isCurrent ? null : status);
    setPending(true);
    try {
      if (isCurrent) {
        await onClear();
      } else {
        await onSelect(status);
      }
    } catch (error) {
      message.error("Failed to update the override status");
      console.error(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {AVAILABILITY_STATUSES.map((status) => {
        const isCurrent = currentOverride === status;
        const isHovered = hovered === status;
        return (
          <div
            key={status}
            onClick={() => handleClick(status)}
            onMouseEnter={() => setHovered(status)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderRadius: 6,
              cursor: pending ? "default" : "pointer",
              background: isHovered ? token.colorFillTertiary : "transparent",
            }}
          >
            <Space size="small">
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  backgroundColor: statusDotColor(status),
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
              />
              <span>{STATUS_LABEL[status]}</span>
            </Space>
            {isCurrent ? (
              isHovered ? (
                <CloseCircleFilled style={{ color: "#bfbfbf", fontSize: 18 }} />
              ) : (
                <CheckCircleFilled style={{ color: "#52c41a", fontSize: 18 }} />
              )
            ) : (
              <CheckCircleOutlined style={{ color: token.colorBorder, fontSize: 18 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
