import { ArrowRightOutlined } from "@ant-design/icons";
import type { ReviewPrompt } from "@ncfritz/olympus-sdk/minerva";
import { Badge, Button, Rate, Skeleton, Tabs, Tag } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import {
  dailyReviewPath,
  itemsOf,
  RATING_FIELDS,
} from "../../../utils/reviews";
import {
  loadFromLocalStorage,
  storeToLocalStorage,
} from "../../../utils/storage";
import PromptAnswer from "../../minerva/review/PromptAnswer";
import { answersOf } from "../../minerva/review/reviewHooks";
import TriageList from "../../minerva/review/TriageList";
import {
  type DailyReviewData,
  useDailyReview,
} from "../../minerva/review/useDailyReview";
import styles from "./ReviewWidget.module.css";

type TabKey = "today" | "reflect" | "else";

const TAB_KEY = "review.widget.tab";
/** Checks now and then for midnight, so the widget moves on to the new day. */
const ROLLOVER_MS = 15 * 60 * 1000;

const today = () => DateTime.now().toISODate()!;

/**
 * The home page's daily review: today's, filled in as the day goes. Three
 * tabs: how the day is going and what becomes of its plan; the list
 * prompts (going well, not going well, on your mind); and the text ones
 * (anything else). Every change saves into today's review, started on the
 * first, so the full review opens already filled in; its button is at the
 * foot.
 */
const ReviewWidget: React.FunctionComponent = () => {
  const auth = useAuth();
  if (auth.status !== "signed-in") {
    return (
      <Frame>
        {auth.status === "loading" ? (
          <Loading />
        ) : (
          <div className={styles.state}>Sign in to review your day.</div>
        )}
      </Frame>
    );
  }
  return <SignedInReview />;
};

const SignedInReview = () => {
  const [day, setDay] = useState(today);
  useEffect(() => {
    const timer = setInterval(() => setDay(today()), ROLLOVER_MS);
    return () => clearInterval(timer);
  }, []);
  // Keyed by day, so a new day starts from a fresh load.
  return <DayReview key={day} day={day} />;
};

const DayReview = ({ day }: { day: string }) => {
  const date = DateTime.fromISO(day);
  const data = useDailyReview(date, { light: true });
  const [tab, setTab] = useState<TabKey>("today");
  // Read after mounting: the server render has no local storage.
  useEffect(() => {
    const stored = loadFromLocalStorage<unknown>(TAB_KEY, "today");
    if (stored === "today" || stored === "reflect" || stored === "else") {
      setTab(stored);
    }
  }, []);
  const choose = (next: TabKey) => {
    setTab(next);
    storeToLocalStorage(TAB_KEY, next);
  };

  const { review } = data;
  const answers = review?.answers ?? [];
  // Archived prompts are no longer asked, unless today's review answered them.
  const reflect = data.prompts.filter(
    (p) =>
      p.section === "reflect" &&
      (!p.archived || answers.some((a) => a.promptId === p.id)),
  );
  const lists = reflect.filter((p) => p.style === "list");
  const texts = reflect.filter((p) => p.style !== "list");
  const count = (prompts: ReviewPrompt[]) =>
    answers.filter((a) => prompts.some((p) => p.id === a.promptId)).length;

  const status = review?.completed ? (
    <Tag color={"green"}>Complete</Tag>
  ) : review ? (
    <Tag color={"orange"}>Draft</Tag>
  ) : (
    <Tag>Not started</Tag>
  );

  const label = (text: string, n?: number) => (
    <span>
      {text}
      {n !== undefined && n > 0 && (
        <Badge
          count={n}
          size={"small"}
          color={"#f0f0f0"}
          className={styles.badge}
        />
      )}
    </span>
  );

  return (
    <Frame date={date} status={status}>
      {data.loading ? (
        <Loading />
      ) : (
        <Tabs
          id={"review"}
          className={styles.tabs}
          activeKey={tab}
          onChange={(key) => choose(key as TabKey)}
          destroyOnHidden={true}
          items={[
            {
              key: "today",
              label: label("Today"),
              children: <TodayTab data={data} />,
            },
            {
              key: "reflect",
              label: label("Reflect", count(lists)),
              children: <PromptsTab data={data} prompts={lists} />,
            },
            {
              key: "else",
              label: label("Anything else", count(texts)),
              children: <PromptsTab data={data} prompts={texts} />,
            },
          ]}
        />
      )}
      <div className={styles.foot}>
        <Link href={dailyReviewPath(date)}>
          <Button
            type={"primary"}
            block={true}
            icon={<ArrowRightOutlined />}
            iconPlacement={"end"}
          >
            Open today&apos;s review
          </Button>
        </Link>
      </div>
    </Frame>
  );
};

/** How the day is going, in small circles, and a decision on its plan. */
const TodayTab = ({ data }: { data: DailyReviewData }) => {
  const { review } = data;
  const locked = review?.completed ?? false;
  const planned = itemsOf(data.items, data.day);
  const decided = planned.filter((i) => i.status !== "open").length;
  return (
    <div className={styles.body}>
      <section className={styles.section} aria-label={"How's the day going?"}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>How&apos;s the day going?</h3>
          <span className={styles.meta}>
            {locked ? "set when completed" : "0.5 to 5"}
          </span>
        </div>
        {RATING_FIELDS.daily.map((field) => {
          const value = review?.[field.key];
          return (
            <div key={field.key} className={styles.rating}>
              <span id={`widget-rating-${field.key}`}>{field.label}</span>
              <Rate
                className={styles.rate}
                allowHalf={true}
                disabled={locked}
                value={value ?? 0}
                character={<span className={styles.dot} />}
                aria-labelledby={`widget-rating-${field.key}`}
                onChange={(rating) =>
                  void data.setRating(field.key, rating || null)
                }
              />
              <span className={styles.value}>{value?.toFixed(1) ?? "–"}</span>
            </div>
          );
        })}
      </section>
      <section
        className={`${styles.section} ${styles.plan}`}
        aria-label={"Today's plan"}
      >
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Today&apos;s plan</h3>
          {planned.length > 0 && (
            <span className={styles.meta}>
              {decided} of {planned.length} decided
            </span>
          )}
        </div>
        <TriageList
          items={planned}
          iconOnly={true}
          onDecide={data.triage}
          empty={"Nothing was planned for today"}
        />
      </section>
    </div>
  );
};

/** Prompts and their answers, each saved as it changes. */
const PromptsTab = ({
  data,
  prompts,
}: {
  data: DailyReviewData;
  prompts: ReviewPrompt[];
}) => (
  <div className={styles.body}>
    {prompts.length === 0 ? (
      <div className={styles.state}>No prompts here.</div>
    ) : (
      prompts.map((prompt) => (
        <PromptAnswer
          key={prompt.id}
          prompt={prompt}
          answers={answersOf(data.review, prompt.id)}
          actions={data}
          todoFor={"tomorrow"}
          rows={5}
          size={"small"}
        />
      ))
    )}
  </div>
);

/** The card: its heading, today's date and the review's status. */
const Frame = ({
  date,
  status,
  children,
}: {
  date?: DateTime;
  status?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className={styles.card} aria-label={"Daily review"}>
    <div className={styles.header}>
      <div className={styles.heading}>
        <h2 className={styles.title}>Daily review</h2>
        {date && (
          <span className={styles.meta}>{date.toFormat("cccc, LLLL d")}</span>
        )}
      </div>
      {status}
    </div>
    {children}
  </section>
);

const Loading = () => (
  <div className={styles.skeleton}>
    <Skeleton active={true} paragraph={{ rows: 4 }} title={false} />
  </div>
);

export default ReviewWidget;
