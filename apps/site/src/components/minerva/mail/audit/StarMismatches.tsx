import { StarOutlined } from "@ant-design/icons";
import type {
  ListMailStarMismatchesResponse,
  MailStarFix,
  MailStarMismatch,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Alert,
  Button,
  Flex,
  message,
  Popconfirm,
  Segmented,
  Table,
  Tag,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { useState } from "react";
import mailApi from "../../../../api/mailApi";
import { useFetch } from "../../../../hooks/useFetch";
import { apiProblems } from "../../../../utils/goals";
import { gmailLink } from "../../../../utils/mailAudit";
import { chunks } from "../../../../utils/mailClusters";
import { fixText, starChanges, starName } from "../../../../utils/mailStars";
import tableStyles from "../MailTable.module.css";

const { Text } = Typography;

const PAGE_SIZE = 50;
/** Messages one change batch takes (ApplyMailChanges). */
const APPLY_BATCH = 10_000;
/** Mismatches one page of the API brings. */
const FETCH_PAGE = 500;

/**
 * Messages whose state and star disagree (docs/plans/email-management
 * phase 7, M12 case 3): an open state without the attention star, a closed
 * one still carrying it. Starring is written to Gmail as a batch; an icon
 * is set in Gmail by hand, as its API sets none, and the next sync records
 * it.
 */
const StarMismatches: React.FunctionComponent = () => {
  const [fix, setFix] = useState<MailStarFix>("star");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<MailStarMismatch[]>([]);
  const [busy, setBusy] = useState(false);

  const [found, loading, , refresh] = useFetch<
    { fix: MailStarFix; page: number },
    ListMailStarMismatchesResponse | undefined
  >({
    dataType: "star mismatches",
    params: { fix, page },
    watch: [fix, page],
    fetchFunction: async (p) =>
      (
        await mailApi.listStarMismatches({
          fix: p.fix,
          offset: p.page * PAGE_SIZE,
          limit: PAGE_SIZE,
        })
      ).data,
  });
  const counts = found?.counts;

  /** Stars in Gmail, as batches by account; the number of messages. */
  const star = async (mismatches: MailStarMismatch[]) => {
    let messages = 0;
    for (const [accountId, changes] of starChanges(mismatches)) {
      for (const batch of chunks(changes, APPLY_BATCH)) {
        messages += (await mailApi.applyChanges(accountId, batch)).data.batch
          .messages;
      }
    }
    return messages;
  };

  const run = async (all: boolean) => {
    setBusy(true);
    try {
      let mismatches = selected;
      if (all) {
        mismatches = [];
        for (let offset = 0; ; offset += FETCH_PAGE) {
          const p = (
            await mailApi.listStarMismatches({
              fix: "star",
              offset,
              limit: FETCH_PAGE,
            })
          ).data;
          mismatches.push(...p.mismatches);
          if (p.mismatches.length < FETCH_PAGE) break;
        }
      }
      const messages = await star(mismatches);
      message.success(
        <span>
          Starring {messages.toLocaleString()} messages in Gmail.{" "}
          <Link href={"/minerva/mail/changes"}>
            Follow it in the change log
          </Link>
        </span>,
      );
      setSelected([]);
      setTimeout(() => void refresh(true), 5000);
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(false);
    }
  };

  const wanted = found?.mismatches[0]?.wanted;

  return (
    <div className={tableStyles.column}>
      <Flex justify={"space-between"} align={"center"} wrap={true} gap={8}>
        <Segmented<MailStarFix>
          value={fix}
          onChange={(v) => {
            setFix(v);
            setPage(0);
            setSelected([]);
          }}
          options={[
            { label: `To star · ${counts?.star ?? 0}`, value: "star" },
            {
              label: `Attention star · ${counts?.attentionIcon ?? 0}`,
              value: "attention-icon",
            },
            {
              label: `Done star · ${counts?.doneIcon ?? 0}`,
              value: "done-icon",
            },
          ]}
        />
        {fix === "star" && (counts?.star ?? 0) > 0 && (
          <Flex gap={8} wrap={true}>
            {selected.length > 0 && (
              <Popconfirm
                title={`Star ${selected.length.toLocaleString()} in Gmail?`}
                description={
                  "Gmail stars them with the first star in its settings. It can be undone from the change log."
                }
                okText={"Star"}
                onConfirm={() => run(false)}
              >
                <Button type={"primary"} icon={<StarOutlined />} loading={busy}>
                  Star selected
                </Button>
              </Popconfirm>
            )}
            <Popconfirm
              title={`Star all ${(counts?.star ?? 0).toLocaleString()} in Gmail?`}
              description={
                "Every message in an open state without a star. Gmail stars them with the first star in its settings. It can be undone from the change log."
              }
              okText={"Star all"}
              onConfirm={() => run(true)}
            >
              <Button icon={<StarOutlined />} loading={busy}>
                Star all
              </Button>
            </Popconfirm>
          </Flex>
        )}
      </Flex>
      <Alert
        type={"info"}
        showIcon={true}
        message={
          fix === "star"
            ? "Open states want the attention star. Gmail's API sets a plain star; if your first star is not the attention star, set it in Gmail afterwards and the next sync records it."
            : `Gmail's API cannot set a star's icon. Open each in Gmail and set the ${starName(wanted)}; the next sync records it and it leaves this list.`
        }
      />
      <div className={tableStyles.fill}>
        <Table<MailStarMismatch>
          size={"small"}
          rowKey={(m) => `${m.accountId}:${m.gmailId}`}
          loading={loading}
          dataSource={found?.mismatches ?? []}
          rowSelection={
            fix === "star"
              ? {
                  selectedRowKeys: selected.map(
                    (m) => `${m.accountId}:${m.gmailId}`,
                  ),
                  onChange: (_, rows) => setSelected(rows),
                }
              : undefined
          }
          scroll={{ y: 1 }}
          pagination={{
            current: page + 1,
            pageSize: PAGE_SIZE,
            total: found?.count ?? 0,
            showSizeChanger: false,
            onChange: (p) => setPage(p - 1),
          }}
          locale={{ emptyText: "Every message's star matches its state." }}
          columns={[
            {
              title: "From",
              key: "from",
              ellipsis: true,
              render: (_, m) => m.fromAddress,
            },
            {
              title: "Received",
              key: "received",
              width: 120,
              render: (_, m) =>
                DateTime.fromISO(m.receivedTime).toLocaleString(
                  DateTime.DATE_MED,
                ),
            },
            {
              title: "Subject",
              key: "subject",
              ellipsis: true,
              render: (_, m) => (
                <a
                  href={gmailLink(m.gmailId)}
                  target={"_blank"}
                  rel={"noreferrer"}
                >
                  {m.subject ?? "(no subject)"}
                </a>
              ),
            },
            {
              title: "State",
              key: "state",
              render: (_, m) => (
                <Tag color={m.stateOpen ? "volcano" : "green"}>{m.label}</Tag>
              ),
            },
            {
              title: "Star now",
              key: "star",
              render: (_, m) =>
                m.starred ? (
                  starName(m.starIcon)
                ) : (
                  <Text type={"secondary"}>none</Text>
                ),
            },
            { title: "Fix", key: "fix", render: (_, m) => fixText(m) },
          ]}
        />
      </div>
    </div>
  );
};

export default StarMismatches;
