import type {
  CreateMailLabelFamilyRequest,
  MailLabel,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Checkbox,
  Flex,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Switch,
  Typography,
} from "antd";
import React, { useEffect, useMemo, useState } from "react";
import type { SuggestedFamily } from "../../../../utils/mailLabels";

const { Text } = Typography;

type State = { labelId: string; open: boolean };

/**
 * Creates a family: its name, the topical labels that become its states,
 * each open or closed, the open one messages start in, and the moves
 * allowed (open to closed, by default). Starts from a suggestion when given.
 */
const NewFamilyModal: React.FunctionComponent<{
  open: boolean;
  labels: MailLabel[];
  suggestion?: SuggestedFamily;
  onCancel: () => void;
  onCreate: (request: CreateMailLabelFamilyRequest) => Promise<void>;
}> = ({ open, labels, suggestion, onCancel, onCreate }) => {
  const [name, setName] = useState("");
  const [states, setStates] = useState<State[]>([]);
  const [initial, setInitial] = useState<string>();
  const [moves, setMoves] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(suggestion?.name ?? "");
    setStates(
      suggestion?.states.map(({ labelId, open }) => ({ labelId, open })) ?? [],
    );
    setInitial(suggestion?.initialLabelId);
    setMoves(
      new Set(
        suggestion?.transitions.map((t) => `${t.fromLabelId}>${t.toLabelId}`) ??
          [],
      ),
    );
  }, [open, suggestion]);

  const topical = useMemo(
    () => labels.filter((l) => l.kind === "topical"),
    [labels],
  );
  const nameOf = (id: string) => labels.find((l) => l.id === id)?.name ?? id;
  const pairs = states.flatMap((a) =>
    states
      .filter((b) => b.labelId !== a.labelId)
      .map((b) => ({ from: a.labelId, to: b.labelId })),
  );
  const openStates = states.filter((s) => s.open);
  const valid =
    name.trim().length > 0 &&
    states.length >= 2 &&
    initial !== undefined &&
    openStates.some((s) => s.labelId === initial);

  const pick = (ids: string[]) => {
    const next = ids.map(
      (id) =>
        states.find((s) => s.labelId === id) ?? { labelId: id, open: true },
    );
    setStates(next);
    if (!next.some((s) => s.labelId === initial && s.open)) {
      setInitial(next.find((s) => s.open)?.labelId);
    }
  };

  const toggleOpen = (id: string, isOpen: boolean) => {
    const next = states.map((s) =>
      s.labelId === id ? { ...s, open: isOpen } : s,
    );
    setStates(next);
    if (!isOpen && initial === id) {
      setInitial(next.find((s) => s.open)?.labelId);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        states,
        initialLabelId: initial!,
        transitions: [...moves]
          .map((m) => m.split(">"))
          .filter(
            ([from, to]) =>
              states.some((s) => s.labelId === from) &&
              states.some((s) => s.labelId === to),
          )
          .map(([fromLabelId, toLabelId]) => ({ fromLabelId, toLabelId })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={"New label family"}
      open={open}
      onCancel={onCancel}
      onOk={save}
      okText={"Create"}
      okButtonProps={{ disabled: !valid, loading: saving }}
      width={640}
      destroyOnHidden={true}
    >
      <Form layout={"vertical"}>
        <Form.Item label={"Name"} required={true}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={"Bills"}
          />
        </Form.Item>
        <Form.Item
          label={"States"}
          required={true}
          extra={
            "Two or more labels. The classifier will predict the family, never a state."
          }
        >
          <Select
            mode={"multiple"}
            showSearch={true}
            optionFilterProp={"label"}
            value={states.map((s) => s.labelId)}
            onChange={pick}
            options={topical.map((l) => ({ value: l.id, label: l.name }))}
          />
        </Form.Item>
        {states.length > 0 && (
          <Form.Item label={"Open or closed, and where mail starts"}>
            <Flex vertical={true} gap={6}>
              {states.map((s) => (
                <Flex key={s.labelId} align={"center"} gap={12}>
                  <Radio
                    checked={initial === s.labelId}
                    disabled={!s.open}
                    onChange={() => setInitial(s.labelId)}
                  >
                    initial
                  </Radio>
                  <Switch
                    size={"small"}
                    checked={s.open}
                    onChange={(v) => toggleOpen(s.labelId, v)}
                  />
                  <Text style={{ width: 60 }}>
                    {s.open ? "open" : "closed"}
                  </Text>
                  <Text>{nameOf(s.labelId)}</Text>
                </Flex>
              ))}
            </Flex>
          </Form.Item>
        )}
        {pairs.length > 0 && (
          <Form.Item label={"Moves allowed"}>
            <Flex vertical={true} gap={4}>
              {pairs.map((p) => {
                const key = `${p.from}>${p.to}`;
                return (
                  <Checkbox
                    key={key}
                    checked={moves.has(key)}
                    onChange={(e) => {
                      const next = new Set(moves);
                      if (e.target.checked) next.add(key);
                      else next.delete(key);
                      setMoves(next);
                    }}
                  >
                    {nameOf(p.from)} → {nameOf(p.to)}
                  </Checkbox>
                );
              })}
            </Flex>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default NewFamilyModal;
