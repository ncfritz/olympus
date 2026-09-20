"use client";

import { ReloadOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Checkbox,
  ColorPicker,
  Flex,
  message,
  Segmented,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import Image from "next/image";
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
  combineAvailability,
  flagFor,
  mapFreeBusyToAvailability,
  overlaps,
  statusLabelFor,
} from "@/lib/availability";
import { ProviderIcon, type Provider } from "@/lib/providerMeta";
import { useTimelineSettings } from "@/lib/TimelineSettingsContext";
import { loadViewPreference, saveViewPreference } from "@/lib/viewPreference";
import { EventDetailDrawer } from "./EventDetailDrawer";
import {
  EventsCalendarView,
  type CalendarEntry,
  type CalendarViewMode,
} from "./EventsCalendarView";
import { OverrideBlockDrawer } from "./OverrideBlockDrawer";
import { StatusChip } from "./StatusChip";

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

export function EventsPanel({
  calendars,
  colorForSource,
  onSetSourceColor,
}: {
  calendars: CalendarStatus[];
  colorForSource: (source: string) => string;
  onSetSourceColor: (source: string, color: string) => void;
}) {
  // Lazy-initialized the same way as timelineSettings below: this panel only
  // ever renders meaningfully once auth/data have loaded client-side.
  const [view, setView] = useState<ViewMode>(() =>
    typeof window === "undefined" ? "week" : loadViewPreference(),
  );

  function changeView(next: ViewMode) {
    setView(next);
    saveViewPreference(next);
  }
  // Only meaningful for the Month/Week/Day views — List browses everything
  // by recency instead (see `filters` below) and never sets this.
  const [calendarVisibleRange, setCalendarVisibleRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
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
  // Day-start/day-end window, weekend handling, and timezone for the
  // calendar's status timeline strip — persisted to localStorage (see
  // lib/settings) and edited via the Settings drawer in the page header
  // (see AppLayout), so it's shared app-wide rather than owned here.
  const { settings: timelineSettings } = useTimelineSettings();

  const availableSources = useMemo(
    () => [OVERRIDES_SOURCE, ...calendars.map((c) => c.source)],
    [calendars],
  );
  const providerBySource = useMemo(
    () => new Map(calendars.map((c) => [c.source, c.provider as Provider])),
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

  // List view browses everything by recency (no date bounds, just the
  // EVENT_LIMIT cap below); Month/Week/Day scope the fetch to whatever
  // FullCalendar currently has on screen (see calendarVisibleRange) instead
  // — otherwise a flat top-200-across-all-sources cut can crowd out a
  // calendar's own events well before reaching whichever month is actually
  // being viewed, particularly once recurring series are involved.
  const isDateScoped = view !== "list";
  const filters = {
    showCancelled,
    showDeleted,
    limit: EVENT_LIMIT,
    ...(isDateScoped && calendarVisibleRange
      ? { startsAfter: calendarVisibleRange.start, startsBefore: calendarVisibleRange.end }
      : {}),
  };
  // Withholds the fetch (rather than falling back to the unscoped query)
  // until the calendar view has reported its actual initial range via
  // onVisibleRangeChange, so switching into Month/Week/Day never shows a
  // flash of the wrong (recency-ordered, unbounded) data first.
  const canFetchEvents = !isDateScoped || calendarVisibleRange !== null;
  const {
    data: events = [],
    isLoading,
    mutate,
  } = useSWR(canFetchEvents ? ["/events", filters] : null, ([, f]) => fetchEvents(f));

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
      const hasBlockOverride = !!blockStatuses && blockStatuses.length > 0;
      const overrideStatus = hasBlockOverride
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
        hasEventOverride:
          !hasBlockOverride && eventOverrideByEventId.has(event.id),
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

  async function handleContextClear(entry: CalendarEntry) {
    if (entry.isOverrideBlock) return;
    const event = events.find((e) => e.id === entry.id);
    if (!event) return;
    try {
      await clearEventOverride(event.source, event.uid);
      mutateEventOverrides();
    } catch (error) {
      message.error("Failed to clear the override");
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
            onChange={(value) => changeView(value as ViewMode)}
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
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => mutate()}
            loading={isLoading}
            aria-label="Refresh"
          />
        </Space>
      }
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 0,
      }}
      styles={{
        body: {
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Flex gap="large" align="stretch" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ width: 240, flexShrink: 0, overflow: "auto" }}>
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
          <Flex vertical gap={8}>
            {availableSources.map((source) => (
              <Flex key={source} justify="space-between" align="center" gap={8}>
                <Checkbox
                  checked={selectedSources.includes(source)}
                  onChange={(e) =>
                    setSelectedSources((prev) =>
                      e.target.checked
                        ? [...prev, source]
                        : prev.filter((s) => s !== source),
                    )
                  }
                >
                  <Space size={6} align="center">
                    {source === OVERRIDES_SOURCE ? (
                      <Image
                        src="/minerva.webp"
                        alt="Overrides"
                        width={16}
                        height={16}
                        style={{ flexShrink: 0, objectFit: "contain" }}
                      />
                    ) : providerBySource.has(source) ? (
                      <ProviderIcon provider={providerBySource.get(source)!} size={16} />
                    ) : (
                      // Keeps the same icon-width slot reserved so this
                      // row's text lines up with the ones that do have a
                      // provider icon, instead of starting flush left.
                      <span style={{ display: "inline-block", width: 16 }} />
                    )}
                    {source}
                  </Space>
                </Checkbox>
                <ColorPicker
                  value={colorForSource(source)}
                  onChange={(color) =>
                    onSetSourceColor(source, color.toHexString())
                  }
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      flexShrink: 0,
                      borderRadius: 6,
                      backgroundColor: colorForSource(source),
                      border: "1px solid rgba(0, 0, 0, 0.15)",
                      cursor: "pointer",
                    }}
                  />
                </ColorPicker>
              </Flex>
            ))}
          </Flex>
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
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
                  onCell: () => ({ style: { padding: 0 } }),
                  render: (value: string, record) => (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "stretch",
                        minHeight: 32,
                      }}
                    >
                      <div
                        style={{ width: 4, flexShrink: 0, ...flagFor(record) }}
                      />
                      <span
                        style={{
                          padding: "0 8px",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {value}
                      </span>
                    </div>
                  ),
                },
                {
                  title: "Source",
                  dataIndex: "source",
                  render: (value: string) => (
                    <Space size="small">
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: 6,
                          backgroundColor: colorForSource(value),
                          flexShrink: 0,
                        }}
                      />
                      {value}
                    </Space>
                  ),
                },
                {
                  title: "Start",
                  dataIndex: "startTime",
                  render: (value: string, record) =>
                    record.allDay ? value.slice(0, 10) : new Date(value).toLocaleString(),
                  sorter: (a, b) =>
                    Date.parse(a.startTime) - Date.parse(b.startTime),
                  defaultSortOrder: "descend",
                },
                {
                  title: "Status",
                  key: "status",
                  render: (_, record) => (
                    <Space size="small">
                      {record.cancelled && <Tag color="orange">Cancelled</Tag>}
                      {record.deleted && <Tag color="red">Deleted</Tag>}
                      {!record.cancelled && !record.deleted && (
                        <StatusChip
                          flag={flagFor(record)}
                          label={statusLabelFor(record)}
                        />
                      )}
                    </Space>
                  ),
                },
                { title: "Type", dataIndex: "type" },
              ]}
            />
          ) : (
            <div style={{ flex: 1, minHeight: 0 }}>
              <EventsCalendarView
                mode={view}
                events={filteredEntries}
                onSelectEvent={handleSelect}
                onSelectRange={handleSelectRange}
                onSetStatus={handleContextSetStatus}
                onDelete={handleContextDelete}
                onClear={handleContextClear}
                colorForSource={colorForSource}
                timelineSettings={timelineSettings}
                onVisibleRangeChange={setCalendarVisibleRange}
              />
            </div>
          )}
          {events.length >= EVENT_LIMIT && (
            <p style={{ marginTop: 8, color: "#888", flexShrink: 0 }}>
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
