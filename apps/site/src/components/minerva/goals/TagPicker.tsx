import type { Tag } from "@ncfritz/olympus-sdk/minerva";
import { message, Select } from "antd";
import React, { useState } from "react";
import tagsApi from "../../../api/tagsApi";

export interface TagPickerProps {
  value?: string[];
  onChange?: (tagIds: string[]) => void;
  tags: Tag[];
  /** A tag was created inline; the caller adds it to its list. */
  onCreated?: (tag: Tag) => void;
}

/**
 * Picks the caller's tags by name; typing a name that is not a tag yet
 * and pressing Enter creates it.
 */
const TagPicker: React.FunctionComponent<TagPickerProps> = ({
  value = [],
  onChange,
  tags,
  onCreated,
}) => {
  const [creating, setCreating] = useState(false);

  const change = async (picked: string[]) => {
    const known = new Set(tags.map((t) => t.id));
    const ids: string[] = [];
    for (const entry of picked) {
      if (known.has(entry)) {
        ids.push(entry);
        continue;
      }
      const existing = tags.find(
        (t) => t.name.toLowerCase() === entry.trim().toLowerCase(),
      );
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      setCreating(true);
      try {
        const tag = await tagsApi.createTag(entry.trim());
        onCreated?.(tag);
        ids.push(tag.id);
      } catch {
        message.error(`Could not create the tag ${entry}`);
      } finally {
        setCreating(false);
      }
    }
    onChange?.([...new Set(ids)]);
  };

  return (
    <Select
      mode={"tags"}
      value={value}
      onChange={change}
      loading={creating}
      placeholder={"Pick tags, or type a new one"}
      tokenSeparators={[","]}
      optionFilterProp={"label"}
      options={tags.map((t) => ({ value: t.id, label: `#${t.name}` }))}
      aria-label={"Tags"}
    />
  );
};

export default TagPicker;
