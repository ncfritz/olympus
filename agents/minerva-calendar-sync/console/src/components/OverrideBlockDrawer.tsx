"use client";

import { Button, Divider, Drawer, message, Typography } from "antd";
import { useState } from "react";
import {
  createOverrideBlock,
  deleteOverrideBlock,
  updateOverrideBlock,
  type AvailabilityStatus,
  type OverrideBlockDto,
} from "@/lib/api/queries";
import { OverrideStatusPicker } from "./OverrideStatusPicker";

/**
 * Create or edit a standalone override block — a time range that isn't
 * tied to any synced meeting (see EventsPanel's "Overrides" pseudo-source).
 * Unlike EventDetailDrawer there's no underlying event data to show, just
 * the time range and a status picker.
 */
export function OverrideBlockDrawer({
  range,
  block,
  onClose,
  onChanged,
  onPreviewChange,
  onDeleted,
}: {
  /** The time range being created (drag-select) or the existing block's range (editing). Drawer is open iff non-null. */
  range: { start: string; end: string } | null;
  /** The existing block, if editing one from the "Overrides" calendar; null when creating a new one. */
  block: OverrideBlockDto | null;
  onClose: () => void;
  /** Called after any create/update/delete, to revalidate the override blocks list. */
  onChanged: () => void;
  /** Fired on every status pick, before the request resolves — lets the calendar's placeholder entry track the picker live. */
  onPreviewChange?: (status: AvailabilityStatus) => void;
  /** Fired after a successful delete — lets the calendar drop its placeholder rather than reviving it as a "ghost" once the block it stood in for no longer exists. */
  onDeleted?: () => void;
}) {
  // Tracks the block across the "doesn't exist yet" -> "created" transition
  // within one drawer session, so a second click updates/deletes it instead
  // of creating a duplicate. Initialized from props (not synced via effect)
  // — the parent gives this component a fresh `key` per range/block so a
  // new session gets a genuinely fresh instance instead of stale state.
  const [activeId, setActiveId] = useState<string | null>(block?.id ?? null);
  const [localStatus, setLocalStatus] = useState<AvailabilityStatus | null>(
    block?.status ?? null,
  );
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!activeId || deleting) return;
    setLocalStatus(null);
    setDeleting(true);
    try {
      await deleteOverrideBlock(activeId);
      setActiveId(null);
      onDeleted?.();
    } catch (error) {
      message.error("Failed to delete the override");
      console.error(error);
    } finally {
      onChanged();
      setDeleting(false);
    }
  }

  return (
    <Drawer title="Override" open={range !== null} onClose={onClose} size={400}>
      {range && (
        <>
          <Typography.Text type="secondary">
            {new Date(range.start).toLocaleString()} –{" "}
            {new Date(range.end).toLocaleString()}
          </Typography.Text>
          <Divider style={{ margin: "12px 0" }} />
          <OverrideStatusPicker
            currentOverride={localStatus}
            onOptimisticChange={(status) => {
              setLocalStatus(status);
              if (status) onPreviewChange?.(status);
            }}
            onSelect={async (status) => {
              try {
                if (activeId) {
                  await updateOverrideBlock(activeId, status);
                } else {
                  const created = await createOverrideBlock({
                    startTime: range.start,
                    endTime: range.end,
                    status,
                  });
                  setActiveId(created.id);
                }
              } finally {
                onChanged();
              }
            }}
            onClear={handleDelete}
          />
          {activeId && (
            <Button
              danger
              type="primary"
              block
              loading={deleting}
              onClick={handleDelete}
              style={{ marginTop: 16 }}
            >
              Delete
            </Button>
          )}
        </>
      )}
    </Drawer>
  );
}
