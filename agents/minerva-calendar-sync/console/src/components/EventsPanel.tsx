"use client";

import {
  Button,
  Card,
  Checkbox,
  Flex,
  message,
  Segmented,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  clearEventOverride,
  deleteOverrideBlock,
  fetchEventOverrides,
  fetchEvents,
  fetchOverrideBlocks,
  setEventOverride,
  updateOverrideBlock,
  type AvailabilityStatus,
  type CalendarStatus,
  type EventDto,
  type OverrideBlockDto,
} from "@/lib/api/queries";
import {
  availabilityColor,
  combineAvailability,
  mapFreeBusyToAvailability,
  overlaps,
} from "@/lib/availability";
import { EventDetailDrawer } from "./EventDetailDrawer";
import {
  EventsCalendarView,
  type CalendarEntry,
  type CalendarViewMode,
} from "./EventsCalendarView";
import { OverrideBlockDrawer } from "./OverrideBlockDrawer";

const EVENT_LIMIT = 200;
/** The non-synced pseudo-calendar that surfaces override blocks with no underlying tracked-calendar event. */
const OVERRIDES_SOURCE = "Overrides";
const RANGE_PAD_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_BACK_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_FORWARD_MS = 90 * 24 * 60 * 60 * 1000;

type ViewMode = "list" | CalendarViewMode;

const VIEW_OPTIONS: { label: string; value: ViewMode }[] = [
  { label: "List", value: "list" },
  { label: "Month", value: "month" },
  { label: "Week", value: "week" },
  { label: "Day", value: "day" },
];

function overrideRangeFor(events: EventDto[]): { start: string; end: string } {
  if (events.length === 0) {
    const now = Date.now();
    return {
      start: new Date(now - DEFAULT_WINDOW_BACK_MS).toISOString(),
      end: new Date(now + DEFAULT_WINDOW_FORWARD_MS).toISOString(),
    };
  }
  const starts = events.map((e) => Date.parse(e.startTime));
  const ends = events.map((e) => Date.parse(e.endTime));
  return {
    start: new Date(Math.min(...starts) - RANGE_PAD_MS).toISOString(),
    end: new Date(Math.max(...ends) + RANGE_PAD_MS).toISOString(),
  };
}

function overrideBlockLabel(block: OverrideBlockDto): string {
  return block.label?.trim() || `Override — ${block.status}`;
}

export function EventsPanel({ calendars }: { calendars: CalendarStatus[] }) {
  const [view, setView] = useState<ViewMode>("week");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const knownSources = useRef<Set<string>>(new Set());
  const [showCancelled, setShowCancelled] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selected, setSelected] = useState<EventDto | null>(null);
  const [overrideDrawer, setOverrideDrawer] = useState<{
    range: { start: string; end: string };
    block: OverrideBlockDto | null;
  } | null>(null);
  // A placeholder entry shown on the calendar while creating a brand-new
  // override block (drawer open, block: null) — before the block exists
  // server-side, there's nothing in `overrideBlocks` yet to render. Tracks
  // its own status so it can follow the drawer's picker live; once the real
  // block appears in `overrideBlocks` (same start/end, sent verbatim to and
  // echoed back by the API), the dedup in `entries` below drops this in
  // favor of the real, server-backed entry.
  const [pendingOverride, setPendingOverride] = useState<{
    range: { start: string; end: string };
    status: AvailabilityStatus;
  } | null>(null);

  const availableSources = useMemo(
    () => [...calendars.map((c) => c.source), OVERRIDES_SOURCE],
    [calendars],
  );

  // Auto-select newly-seen sources (including the initial load) without
  // clobbering sources the user has already unchecked.
  useEffect(() => {
    const newSources = availableSources.filter(
      (s) => !knownSources.current.has(s),
    );
    if (newSources.length > 0) {
      newSources.forEach((s) => knownSources.current.add(s));
      setSelectedSources((prev) => [...prev, ...newSources]);
    }
  }, [availableSources]);

  const filters = { showCancelled, showDeleted, limit: EVENT_LIMIT };
  const {
    data: events = [],
    isLoading,
    mutate,
  } = useSWR(["/events", filters], ([, f]) => fetchEvents(f));

  // Overrides are fetched over the span of currently-loaded events (padded),
  // not scoped by the sources checkboxes below — an override's association
  // with a tracked event shouldn't change just because that event's source
  // is temporarily hidden.
  const overrideRange = useMemo(() => overrideRangeFor(events), [events]);
  const { data: overrideBlocks = [], mutate: mutateOverrideBlocks } = useSWR(
    ["/overrides", overrideRange],
    ([, r]) => fetchOverrideBlocks(r.start, r.end),
  );

  const eventIds = useMemo(() => events.map((e) => e.id), [events]);
  const { data: eventOverrides = [], mutate: mutateEventOverrides } = useSWR(
    eventIds.length > 0 ? ["/events/overrides", eventIds] : null,
    () => fetchEventOverrides(eventIds),
  );

  const entries = useMemo(() => {
    const eventOverrideByEventId = new Map(
      eventOverrides.map((o) => [o.eventId, o.status]),
    );
    const blockStatusesByEventId = new Map<string, AvailabilityStatus[]>();
    const orphanBlocks: OverrideBlockDto[] = [];

    for (const block of overrideBlocks) {
      const overlappingEvents = events.filter((e) =>
        overlaps(e.startTime, e.endTime, block.startTime, block.endTime),
      );
      if (overlappingEvents.length === 0) {
        orphanBlocks.push(block);
        continue;
      }
      for (const event of overlappingEvents) {
        const list = blockStatusesByEventId.get(event.id) ?? [];
        list.push(block.status);
        blockStatusesByEventId.set(event.id, list);
      }
    }

    const realEntries: CalendarEntry[] = events.map((event) => {
      const blockStatuses = blockStatusesByEventId.get(event.id);
      const overrideStatus =
        blockStatuses && blockStatuses.length > 0
          ? combineAvailability(blockStatuses)
          : eventOverrideByEventId.get(event.id);
      return {
        id: event.id,
        subject: event.subject,
        source: event.source,
        startTime: event.startTime,
        endTime: event.endTime,
        allDay: event.allDay,
        cancelled: event.cancelled,
        deleted: event.deleted,
        type: event.type,
        freeBusyStatus: event.status,
        isOverrideBlock: false,
        overrideStatus,
      };
    });

    const orphanEntries: CalendarEntry[] = orphanBlocks.map((block) => ({
      id: `override:${block.id}`,
      subject: overrideBlockLabel(block),
      source: OVERRIDES_SOURCE,
      startTime: block.startTime,
      endTime: block.endTime,
      allDay: false,
      cancelled: false,
      deleted: false,
      type: "override",
      isOverrideBlock: true,
      overrideStatus: block.status,
    }));

    // Once the real block this placeholder stands in for has come back from
    // the server (same range, sent verbatim and echoed back unchanged), drop
    // the placeholder — the real entry above already covers it.
    const pendingAlreadyPersisted =
      pendingOverride &&
      overrideBlocks.some(
        (b) =>
          b.startTime === pendingOverride.range.start &&
          b.endTime === pendingOverride.range.end,
      );
    const placeholderEntries: CalendarEntry[] =
      pendingOverride && !pendingAlreadyPersisted
        ? [
            {
              id: "override:pending",
              subject: `Override — ${pendingOverride.status}`,
              source: OVERRIDES_SOURCE,
              startTime: pendingOverride.range.start,
              endTime: pendingOverride.range.end,
              allDay: false,
              cancelled: false,
              deleted: false,
              type: "override",
              isOverrideBlock: true,
              overrideStatus: pendingOverride.status,
            },
          ]
        : [];

    return [...realEntries, ...orphanEntries, ...placeholderEntries];
  }, [events, overrideBlocks, eventOverrides, pendingOverride]);

  const filteredEntries = entries.filter((e) =>
    selectedSources.includes(e.source),
  );

  function handleSelect(entry: CalendarEntry) {
    if (entry.isOverrideBlock) {
      const block = overrideBlocks.find((b) => `override:${b.id}` === entry.id);
      if (block) {
        setOverrideDrawer({
          range: { start: block.startTime, end: block.endTime },
          block,
        });
      }
      return;
    }
    const event = events.find((e) => e.id === entry.id);
    if (event) setSelected(event);
  }

  function handleSelectRange(range: { start: string; end: string }) {
    setOverrideDrawer({ range, block: null });
    setPendingOverride({ range, status: "none" });
  }

  async function handleContextSetStatus(
    entry: CalendarEntry,
    status: AvailabilityStatus,
  ) {
    try {
      if (entry.isOverrideBlock) {
        const block = overrideBlocks.find(
          (b) => `override:${b.id}` === entry.id,
        );
        if (!block) return;
        await updateOverrideBlock(block.id, status);
        mutateOverrideBlocks();
      } else {
        const event = events.find((e) => e.id === entry.id);
        if (!event) return;
        await setEventOverride(event.source, event.uid, status);
        mutateEventOverrides();
      }
    } catch (error) {
      message.error("Failed to update the status");
      console.error(error);
    }
  }

  async function handleContextDelete(entry: CalendarEntry) {
    if (!entry.isOverrideBlock) return;
    const block = overrideBlocks.find((b) => `override:${b.id}` === entry.id);
    if (!block) return;
    try {
      await deleteOverrideBlock(block.id);
      mutateOverrideBlocks();
    } catch (error) {
      message.error("Failed to delete the override");
      console.error(error);
    }
  }

  // Derived rather than snapshotted at selection time, so the drawer stays
  // in sync as overrides are added/removed while it's open.
  const selectedEntry = selected
    ? entries.find((e) => e.id === selected.id)
    : undefined;
  const selectedStatus = selectedEntry
    ? (selectedEntry.overrideStatus ??
      mapFreeBusyToAvailability(selectedEntry.freeBusyStatus!))
    : null;
  const selectedHasOverride = selectedEntry?.overrideStatus !== undefined;
  const selectedEventOverride = selected
    ? (eventOverrides.find((o) => o.eventId === selected.id)?.status ?? null)
    : null;

  // Updates the local cache synchronously (no network round trip) so the
  // picker's checkmark and the overall status circle reflect a click the
  // instant it happens; the caller still reconciles with the server
  // afterward via onOverrideChanged.
  function handleOptimisticOverrideChange(
    eventId: string,
    status: AvailabilityStatus | null,
  ) {
    mutateEventOverrides(
      (current) => {
        const filtered = (current ?? []).filter((o) => o.eventId !== eventId);
        return status === null ? filtered : [...filtered, { eventId, status }];
      },
      { revalidate: false },
    );
  }

  return (
    <Card
      title="Events"
      extra={
        <Space>
          <Segmented
            options={VIEW_OPTIONS}
            value={view}
            onChange={(value) => setView(value as ViewMode)}
          />
          <Space size="small">
            <Switch
              checked={showCancelled}
              onChange={setShowCancelled}
              size="small"
            />
            <span>Cancelled</span>
          </Space>
          <Space size="small">
            <Switch
              checked={showDeleted}
              onChange={setShowDeleted}
              size="small"
            />
            <span>Deleted</span>
          </Space>
          <Button onClick={() => mutate()} loading={isLoading}>
            Refresh
          </Button>
        </Space>
      }
    >
      <Flex gap="large" align="flex-start">
        <div style={{ width: 180, flexShrink: 0 }}>
          <Flex
            justify="space-between"
            align="center"
            style={{ marginBottom: 8 }}
          >
            <Typography.Text strong>Sources</Typography.Text>
            <Space size="small">
              <Typography.Link
                style={{ fontSize: 12 }}
                onClick={() => setSelectedSources(availableSources)}
              >
                All
              </Typography.Link>
              <Typography.Link
                style={{ fontSize: 12 }}
                onClick={() => setSelectedSources([])}
              >
                None
              </Typography.Link>
            </Space>
          </Flex>
          <Checkbox.Group
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
            value={selectedSources}
            onChange={(values) => setSelectedSources(values as string[])}
            options={availableSources.map((s) => ({ label: s, value: s }))}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {view === "list" ? (
            <Table<CalendarEntry>
              rowKey="id"
              loading={isLoading}
              dataSource={filteredEntries}
              size="small"
              pagination={{ pageSize: 20, showSizeChanger: true }}
              onRow={(record) => ({ onClick: () => handleSelect(record) })}
              rowClassName={() => "clickable-row"}
              columns={[
                {
                  title: "Subject",
                  dataIndex: "subject",
                  render: (value: string, record) => (
                    <Space size="small">
                      {!record.isOverrideBlock && record.overrideStatus && (
                        <Tag color={availabilityColor(record.overrideStatus)}>
                          {record.overrideStatus}
                        </Tag>
                      )}
                      {value}
                    </Space>
                  ),
                },
                { title: "Source", dataIndex: "source" },
                {
                  title: "Start",
                  dataIndex: "startTime",
                  render: (value: string) => new Date(value).toLocaleString(),
                  sorter: (a, b) =>
                    Date.parse(a.startTime) - Date.parse(b.startTime),
                  defaultSortOrder: "descend",
                },
                {
                  title: "Status",
                  key: "status",
                  render: (_, record) =>
                    record.isOverrideBlock ? (
                      <Tag color={availabilityColor(record.overrideStatus!)}>
                        {record.overrideStatus}
                      </Tag>
                    ) : (
                      <Space size="small">
                        {record.cancelled && (
                          <Tag color="orange">Cancelled</Tag>
                        )}
                        {record.deleted && <Tag color="red">Deleted</Tag>}
                        {!record.cancelled && !record.deleted && (
                          <Tag color="blue">{record.freeBusyStatus}</Tag>
                        )}
                      </Space>
                    ),
                },
                { title: "Type", dataIndex: "type" },
              ]}
            />
          ) : (
            <EventsCalendarView
              mode={view}
              events={filteredEntries}
              onSelectEvent={handleSelect}
              onSelectRange={handleSelectRange}
              onSetStatus={handleContextSetStatus}
              onDelete={handleContextDelete}
            />
          )}
          {events.length >= EVENT_LIMIT && (
            <p style={{ marginTop: 8, color: "#888" }}>
              Showing the first {EVENT_LIMIT} matching events — narrow the
              filters above to see more specific results.
            </p>
          )}
        </div>
      </Flex>
      <EventDetailDrawer
        event={selected}
        status={selectedStatus}
        hasOverride={selectedHasOverride}
        currentOverride={selectedEventOverride}
        onOptimisticOverrideChange={(status) =>
          selected && handleOptimisticOverrideChange(selected.id, status)
        }
        onSelectOverride={async (status) => {
          if (!selected) return;
          try {
            await setEventOverride(selected.source, selected.uid, status);
          } finally {
            mutateEventOverrides();
          }
        }}
        onClearOverride={async () => {
          if (!selected) return;
          try {
            await clearEventOverride(selected.source, selected.uid);
          } finally {
            mutateEventOverrides();
          }
        }}
        onClose={() => setSelected(null)}
      />
      <OverrideBlockDrawer
        key={
          overrideDrawer
            ? (overrideDrawer.block?.id ?? `new:${overrideDrawer.range.start}`)
            : "closed"
        }
        range={overrideDrawer?.range ?? null}
        block={overrideDrawer?.block ?? null}
        onClose={() => {
          setOverrideDrawer(null);
          setPendingOverride(null);
        }}
        onChanged={() => mutateOverrideBlocks()}
        onPreviewChange={(status) =>
          setPendingOverride((prev) => (prev ? { ...prev, status } : prev))
        }
        onDeleted={() => setPendingOverride(null)}
      />
    </Card>
  );
}
