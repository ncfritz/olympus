import { DeleteOutlined, FilterOutlined } from "@ant-design/icons";
import type {
  ListMailFilterProposalsResponse,
  ListMailFiltersResponse,
  MailAccount,
  MailFilter,
  MailFilterProposal,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  message,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import React, { useState } from "react";
import mailApi from "../../../api/mailApi";
import { useFetch } from "../../../hooks/useFetch";
import { apiProblems } from "../../../utils/goals";
import { canMakeFilters } from "./MailAccountsCard";

const { Text } = Typography;

const key = (p: { accountId: string; fromAddress: string; label: string }) =>
  `${p.accountId}:${p.fromAddress}:${p.label}`;

export interface FilterProposalsProps {
  accounts: MailAccount[];
  /** Links the mailbox again, asking for what filters need. */
  onAllow: (account: MailAccount) => void;
}

/**
 * Gmail filters (docs/plans/email-management phase 7 step 4): senders
 * whose approved mail nearly always carries one label, each made a filter
 * on approval (skipping the inbox unless unticked) or declined; and the
 * filters made, each deleted from here. Nothing shows without either.
 */
const FilterProposals: React.FunctionComponent<FilterProposalsProps> = ({
  accounts,
  onAllow,
}) => {
  const [busy, setBusy] = useState<string>();
  /** Proposals whose mail is to stay in the inbox. */
  const [keepInInbox, setKeepInInbox] = useState<Set<string>>(new Set());
  const [proposals, , , refreshProposals] = useFetch<
    object,
    ListMailFilterProposalsResponse | undefined
  >({
    dataType: "filter proposals",
    params: {},
    quiet: true,
    fetchFunction: async () => (await mailApi.listFilterProposals()).data,
  });
  const [filters, , , refreshFilters] = useFetch<
    object,
    ListMailFiltersResponse | undefined
  >({
    dataType: "filters",
    params: {},
    quiet: true,
    fetchFunction: async () => (await mailApi.listFilters()).data,
  });
  const proposed = proposals?.proposals ?? [];
  const made = filters?.filters ?? [];
  if (proposed.length === 0 && made.length === 0) return null;

  const unlinked = accounts.filter(
    (a) =>
      a.linkedTime &&
      !canMakeFilters(a) &&
      proposed.some((p) => p.accountId === a.id),
  );

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await action();
      await Promise.all([refreshProposals(true), refreshFilters(true)]);
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(undefined);
    }
  };

  const create = (p: MailFilterProposal) =>
    run(key(p), async () => {
      const skipInbox = !keepInInbox.has(key(p));
      await mailApi.createFilter(p.accountId, {
        fromAddress: p.fromAddress,
        label: p.label,
        skipInbox,
      });
      message.success(
        `Filter made in Gmail: mail from ${p.fromAddress} gets ${p.label}${skipInbox ? " and skips the inbox" : ""}.`,
      );
    });

  return (
    <Collapse
      size={"small"}
      items={[
        {
          key: "filters",
          label: (
            <Space size={8} wrap={true}>
              <FilterOutlined />
              <Text strong={true}>
                {proposed.length.toLocaleString()} filter{" "}
                {proposed.length === 1 ? "proposal" : "proposals"}
              </Text>
              {made.length > 0 && (
                <Tag>
                  {made.length.toLocaleString()}{" "}
                  {made.length === 1 ? "filter" : "filters"} made
                </Tag>
              )}
            </Space>
          ),
          children: (
            <Space direction={"vertical"} size={12} style={{ width: "100%" }}>
              {unlinked.map((a) => (
                <Alert
                  key={a.id}
                  type={"info"}
                  showIcon={true}
                  message={`Making filters for ${a.email} needs one more permission from Google.`}
                  action={
                    <Button size={"small"} onClick={() => onAllow(a)}>
                      Allow filters
                    </Button>
                  }
                />
              ))}
              {proposed.length > 0 && (
                <Table<MailFilterProposal>
                  size={"small"}
                  rowKey={key}
                  pagination={false}
                  dataSource={proposed}
                  columns={[
                    { title: "From", dataIndex: "fromAddress", ellipsis: true },
                    {
                      title: "Label",
                      key: "label",
                      render: (_, p) => <Tag>{p.label}</Tag>,
                    },
                    {
                      title: "Approved with it",
                      key: "kept",
                      render: (_, p) =>
                        `${p.kept.toLocaleString()} of ${p.decisions.toLocaleString()}`,
                    },
                    {
                      title: "",
                      key: "skip",
                      render: (_, p) => (
                        <Checkbox
                          checked={!keepInInbox.has(key(p))}
                          onChange={(e) => {
                            const next = new Set(keepInInbox);
                            if (e.target.checked) next.delete(key(p));
                            else next.add(key(p));
                            setKeepInInbox(next);
                          }}
                        >
                          Skip the inbox
                        </Checkbox>
                      ),
                    },
                    {
                      title: "",
                      key: "actions",
                      width: 220,
                      render: (_, p) => (
                        <Space>
                          <Popconfirm
                            title={"Make this filter in Gmail?"}
                            description={`Mail from ${p.fromAddress} gets ${p.label} as it arrives${keepInInbox.has(key(p)) ? "" : ", and skips the inbox"}. Mail already here is not changed. It can be deleted from here.`}
                            okText={"Make filter"}
                            onConfirm={() => create(p)}
                          >
                            <Button
                              size={"small"}
                              type={"primary"}
                              loading={busy === key(p)}
                            >
                              Make filter
                            </Button>
                          </Popconfirm>
                          <Button
                            size={"small"}
                            disabled={busy === key(p)}
                            onClick={() =>
                              void run(key(p), () =>
                                mailApi.dismissFilterProposal(
                                  p.accountId,
                                  p.fromAddress,
                                  p.label,
                                ),
                              )
                            }
                          >
                            Decline
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              )}
              {made.length > 0 && (
                <>
                  <Text type={"secondary"}>Filters made</Text>
                  <Table<MailFilter>
                    size={"small"}
                    rowKey={"id"}
                    pagination={false}
                    dataSource={made}
                    columns={[
                      {
                        title: "From",
                        dataIndex: "fromAddress",
                        ellipsis: true,
                      },
                      {
                        title: "Label",
                        key: "label",
                        render: (_, f) => <Tag>{f.label}</Tag>,
                      },
                      {
                        title: "Inbox",
                        key: "inbox",
                        render: (_, f) => (f.skipInbox ? "Skipped" : "Kept"),
                      },
                      {
                        title: "Made",
                        key: "made",
                        render: (_, f) =>
                          DateTime.fromISO(
                            String(f.createdTime),
                          ).toLocaleString(DateTime.DATE_MED),
                      },
                      {
                        title: "",
                        key: "delete",
                        width: 60,
                        render: (_, f) => (
                          <Popconfirm
                            title={"Delete this filter in Gmail?"}
                            description={
                              "Mail it labelled keeps its labels; new mail is reviewed again."
                            }
                            okText={"Delete"}
                            onConfirm={() =>
                              run(f.id, () => mailApi.deleteFilter(f.id))
                            }
                          >
                            <Button
                              size={"small"}
                              icon={<DeleteOutlined />}
                              aria-label={`Delete the filter for ${f.fromAddress}`}
                              loading={busy === f.id}
                            />
                          </Popconfirm>
                        ),
                      },
                    ]}
                  />
                </>
              )}
            </Space>
          ),
        },
      ]}
    />
  );
};

export default FilterProposals;
