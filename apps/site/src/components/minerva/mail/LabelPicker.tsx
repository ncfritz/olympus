import {
  CloseCircleFilled,
  PlusCircleFilled,
  PlusOutlined,
} from "@ant-design/icons";
import { Checkbox, Flex, Select, Space, Tag, Typography } from "antd";
import React, { useMemo, useState } from "react";
import {
  type ChangeRow,
  changeRows,
  countOn,
  describeWant,
  effectiveWant,
  labelEffects,
  labelsOn,
  nextWant,
  pickLabel,
  type LabelWants,
  type PickerMessage,
  type PickerOption,
  type PickerSuggestion,
  searchLabels,
  toggleRow,
  validNewPath,
} from "../../../utils/labelPicker";
import { BLOCK, CUT } from "./InboxLabels";

const { Text } = Typography;

type OptionItem = { value: string; label: React.ReactNode };
type OptionGroup = { label: string; title: string; options: OptionItem[] };

/** The value of the option that creates the typed path. */
const CREATE = "\u0000create:";

export interface LabelPickerProps {
  /** The messages changed: one, or a table's selection. */
  messages: PickerMessage[];
  options: PickerOption[];
  suggestions: PickerSuggestion[];
  /** Recently picked labels, newest first. */
  recent: string[];
  wants: LabelWants;
  onChange: (wants: LabelWants) => void;
  /** Labels created here, to make in Gmail on apply. */
  created: string[];
  onCreated: (created: string[]) => void;
  /**
   * One message's labels stacked under the select (the Inbox's Changes
   * column), the select showing none of them: those it keeps solid gold,
   * those going on green, each with a cross to take it off; those coming
   * off struck through, with a plus to put them back.
   */
  stacked?: boolean;
}

/**
 * The label picker (docs/plans/email-management/design.md): an AntD
 * Select in multiple mode over the mailbox's labels, then, for a
 * selection, each label in play with a three-state checkbox and what
 * applying changes.
 */
const LabelPicker: React.FunctionComponent<LabelPickerProps> = ({
  messages,
  options,
  suggestions,
  recent,
  wants,
  onChange,
  created,
  onCreated,
  stacked = false,
}) => {
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const total = messages.length;
  const byName = useMemo(
    () => new Map(options.map((o) => [o.name, o])),
    [options],
  );
  const current = useMemo(() => labelsOn(messages), [messages]);

  /** Every label in play: on some message now, or picked. */
  const inPlay = useMemo(
    () => [...new Set([...current, ...Object.keys(wants)])],
    [current, wants],
  );

  /** What the Select shows as chosen: labels not coming off every message. */
  const value = inPlay.filter(
    (l) => effectiveWant(wants[l], countOn(messages, l), total) !== "none",
  );

  const pick = (name: string) => {
    const path = name.startsWith(CREATE) ? name.slice(CREATE.length) : name;
    if (name.startsWith(CREATE) && !created.includes(path)) {
      onCreated([...created, path]);
    }
    const result = pickLabel(wants, path, options);
    setNotes(
      name.startsWith(CREATE)
        ? [`${path} is created in Gmail on apply`, ...result.notes]
        : result.notes,
    );
    onChange(result.wants);
    setSearch("");
  };

  const unpick = (name: string) => {
    setNotes([]);
    if (created.includes(name)) onCreated(created.filter((c) => c !== name));
    onChange({ ...wants, [name]: "none" });
  };

  const optionOf = (name: string, extra?: string) => {
    const o = byName.get(name);
    const parts = name.split("/");
    return {
      value: name,
      label: (
        <Flex justify={"space-between"} gap={8}>
          <span>
            {parts.length > 1 && (
              <Text type={"secondary"}>{parts.slice(0, -1).join("/")}/</Text>
            )}
            {parts[parts.length - 1]}
            {o?.kind === "retired" && o.mergeTargetName && (
              <Text type={"secondary"}> → {o.mergeTargetName}</Text>
            )}
          </span>
          <Text type={"secondary"}>
            {extra ?? (o ? o.messages.toLocaleString() : "new")}
          </Text>
        </Flex>
      ),
    };
  };

  const groups = useMemo<(OptionItem | OptionGroup)[]>(() => {
    if (search.trim()) {
      const found = searchLabels(search, options).map((o) => optionOf(o.name));
      const path = search.trim();
      const exists =
        byName.has(path) || created.includes(path) || current.includes(path);
      const parent = path.includes("/")
        ? path.slice(0, path.lastIndexOf("/"))
        : undefined;
      return [
        ...(!exists && validNewPath(path)
          ? [
              {
                value: `${CREATE}${path}`,
                label: (
                  <Space size={6}>
                    <PlusOutlined />
                    <span>
                      Create <b>{path}</b>
                    </span>
                    <Text type={"secondary"}>
                      {parent
                        ? byName.has(parent)
                          ? `under ${parent}`
                          : `under ${parent}, also new`
                        : "at the top level"}
                    </Text>
                  </Space>
                ),
              },
            ]
          : []),
        ...found,
      ];
    }
    const shown = new Set<string>();
    const group = (
      title: string,
      names: string[],
      extra?: (n: string) => string,
    ) => {
      const fresh = names.filter((n) => !shown.has(n));
      fresh.forEach((n) => shown.add(n));
      return fresh.length
        ? [
            {
              label: title,
              title,
              options: fresh.map((n) => optionOf(n, extra?.(n))),
            },
          ]
        : [];
    };
    const confidence = new Map(suggestions.map((s) => [s.label, s]));
    return [
      ...group(
        "Suggested",
        suggestions.map((s) => s.label),
        (n) => {
          const s = confidence.get(n);
          if (!s) return "";
          const pct = `${Math.round(s.confidence * 100)}%`;
          return total > 1 ? `${pct} · ${s.messages} of ${total}` : pct;
        },
      ),
      ...group(
        total > 1 ? "On these messages" : "On this message",
        [...current, ...created],
        (n) => (total > 1 ? `on ${countOn(messages, n)}` : ""),
      ),
      ...group(
        "Recent",
        recent.filter((n) => byName.has(n)),
      ),
    ];
  }, [search, options, suggestions, recent, current, created, messages]);

  const effects = labelEffects(messages, wants);
  const list = stacked && total === 1;

  /** A change list's icon: off, back on, or dropped. */
  const flip = (row: ChangeRow) => {
    setNotes([]);
    if (row.state === "added" && created.includes(row.label)) {
      onCreated(created.filter((c) => c !== row.label));
    }
    onChange(toggleRow(wants, row));
  };

  if (list) {
    return (
      <Flex vertical={true} gap={8} style={{ width: "100%" }}>
        <Select<string>
          style={{ width: "100%" }}
          placeholder={"Add a label, or type a path"}
          value={null}
          searchValue={search}
          onSearch={setSearch}
          filterOption={false}
          options={groups}
          onSelect={pick}
          showSearch={true}
          aria-label={"Add a label"}
          onKeyDown={(e) => {
            if (e.key === "Escape" && search) {
              e.preventDefault();
              e.stopPropagation();
              setSearch("");
            }
          }}
        />
        {notes.map((n) => (
          <Text key={n} type={"secondary"} style={{ fontSize: 12 }}>
            {n}
          </Text>
        ))}
        <div>
          {changeRows(messages[0], wants).map((row) => {
            const Icon =
              row.state === "removed" ? PlusCircleFilled : CloseCircleFilled;
            const action =
              row.state === "removed"
                ? `Put ${row.label} back`
                : `Take ${row.label} off`;
            return (
              <Tag
                key={row.label}
                color={
                  row.state === "kept"
                    ? "gold"
                    : row.state === "added"
                      ? "green"
                      : undefined
                }
                variant={row.state === "removed" ? "filled" : "solid"}
                style={BLOCK}
                title={
                  row.state === "added"
                    ? `${row.label}, going on`
                    : row.state === "removed"
                      ? `${row.label}, coming off`
                      : row.label
                }
              >
                <span
                  style={{
                    ...CUT,
                    ...(row.state === "removed"
                      ? { textDecoration: "line-through", opacity: 0.6 }
                      : {}),
                  }}
                >
                  {row.label}
                </span>
                <Icon
                  role={"button"}
                  tabIndex={0}
                  aria-label={action}
                  style={{ cursor: "pointer", flex: "none" }}
                  onClick={() => flip(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      flip(row);
                    }
                  }}
                />
              </Tag>
            );
          })}
        </div>
      </Flex>
    );
  }

  return (
    <Space direction={"vertical"} style={{ width: "100%" }} size={8}>
      <Select
        mode={"multiple"}
        style={{ width: "100%" }}
        placeholder={"Add a label, or type a path"}
        value={value}
        searchValue={search}
        onSearch={setSearch}
        filterOption={false}
        options={groups}
        onSelect={pick}
        onDeselect={unpick}
        autoClearSearchValue={true}
        showSearch={true}
        aria-label={"Labels"}
        onKeyDown={(e) => {
          // Esc clears what was typed first, then closes.
          if (e.key === "Escape" && search) {
            e.preventDefault();
            e.stopPropagation();
            setSearch("");
          }
        }}
        tagRender={({ value: name, closable, onClose }) => {
          const label = String(name);
          const on = countOn(messages, label);
          const now = effectiveWant(wants[label], on, total);
          const adding = now === "all" && on < total;
          const o = byName.get(label);
          return (
            <Tag
              color={
                adding ? "green" : o?.kind === "state" ? "gold" : undefined
              }
              style={{
                marginInlineEnd: 4,
                ...(o?.kind === "state" ? { borderStyle: "dashed" } : {}),
              }}
              closable={closable}
              onClose={onClose}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {adding ? "+ " : ""}
              {label}
              {now === "keep" ? ` (${on} of ${total})` : ""}
            </Tag>
          );
        }}
      />
      {notes.map((n) => (
        <Text key={n} type={"secondary"}>
          {n}
        </Text>
      ))}
      {total > 1 && inPlay.length > 0 && (
        <Flex vertical={true} gap={4}>
          {inPlay.map((label) => {
            const on = countOn(messages, label);
            const now = effectiveWant(wants[label], on, total);
            return (
              <Flex key={label} justify={"space-between"} gap={12}>
                <Checkbox
                  checked={now === "all"}
                  indeterminate={now === "keep"}
                  onChange={() =>
                    onChange({
                      ...wants,
                      [label]: nextWant(wants[label], on, total),
                    })
                  }
                >
                  {label}
                </Checkbox>
                <Text type={"secondary"}>
                  {describeWant(wants[label], on, total)}
                </Text>
              </Flex>
            );
          })}
        </Flex>
      )}
      <Text>
        <Text strong>Changes: </Text>
        {effects.length
          ? effects.map((e, i) => (
              <React.Fragment key={e.label}>
                {i ? " · " : ""}
                {e.adding ? (
                  <Text type={"success"}>
                    + {e.label}
                    {total > 1 ? ` (${e.adding})` : ""}
                  </Text>
                ) : (
                  <Text type={"danger"} delete={true}>
                    {e.label}
                    {total > 1 ? ` (${e.removing})` : ""}
                  </Text>
                )}
              </React.Fragment>
            ))
          : "none yet"}
      </Text>
    </Space>
  );
};

export default LabelPicker;
