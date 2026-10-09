import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import { Button, Flex, Result, Space, Spin, Steps, Tag } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import {
  monthOfWeek,
  WEEKLY_STEPS,
  weeklyListPath,
  weeklyReviewPath,
  stepToOpen,
} from "../../../utils/reviews";
import HighlightsStep from "./HighlightsStep";
import PlanWeekStep from "./PlanWeekStep";
import ReviewBreadcrumbs from "./ReviewBreadcrumbs";
import styles from "./Review.module.css";
import { useFillHeight } from "./reviewHooks";
import { useWeeklyReview } from "./useWeeklyReview";
import WeekLookBackStep from "./WeekLookBackStep";
import WeekReflectStep from "./WeekReflectStep";
import WeekWrapUpStep from "./WeekWrapUpStep";

const INTROS = [
  "Here's the week as it happened. Score a day you missed, and decide what happens to what slipped; what goes to next week shows up in step 4.",
  "The week's daily answers and notes, by day. Pin what's worth keeping; pins sit beside Reflect and stay with the week.",
  "Score the week, then answer what's useful. Skip any prompt; an empty one isn't saved.",
  "Map out next week. Drag a priority or to-do onto the calendar to block time for it; move a block to another day or time, or drag its foot to change its length.",
  "This is how the review reads later, in the weekly list and on Monday's daily review.",
];

export interface WeeklyReviewProps {
  /** The week reviewed, by its Monday in the browser's zone. */
  week: DateTime;
}

/**
 * A week's review as guided steps (ADR 0027; option B on the design
 * canvas): Look back, Highlights, Reflect, Plan next week, Wrap up. Every
 * change saves as it is made; the step is kept in the address as `?step=`.
 */
const WeeklyReview: React.FunctionComponent<WeeklyReviewProps> = ({ week }) => {
  const router = useRouter();
  const data = useWeeklyReview(week);
  const [screenRef, screenHeight] = useFillHeight();
  const [step, setStep] = useState(1);
  const [opened, setOpened] = useState(false);
  const label = `Week ${week.toFormat("W")}`;
  const dates = `${week.toFormat("LLL d")} – ${week.plus({ days: 6 }).toFormat("LLL d, yyyy")}`;

  // Opens at ?step=, else where the review got to, once it has loaded.
  useEffect(() => {
    if (data.loading || opened) return;
    setStep(
      stepToOpen(router.query.step, WEEKLY_STEPS.length, data.review?.step),
    );
    setOpened(true);
  }, [data.loading, opened, data.review?.step, router.query.step]);

  const go = (next: number) => {
    setStep(next);
    void data.setStep(next);
    void router.replace(
      { pathname: router.pathname, query: { ...router.query, step: next } },
      undefined,
      { shallow: true },
    );
  };

  const breadcrumbs = (
    <ReviewBreadcrumbs
      what={"Weekly review"}
      listHref={weeklyListPath(monthOfWeek(week))}
      label={`Week ${week.toFormat("W, kkkk")}`}
    />
  );

  if (data.loading && !opened) {
    return (
      <>
        {breadcrumbs}
        <Flex justify={"center"} className={styles.page}>
          <Spin />
        </Flex>
      </>
    );
  }

  if (!data.started) {
    return (
      <>
        {breadcrumbs}
        <Result
          status={"info"}
          title={`${label} hasn't begun yet`}
          subTitle={"A week is reviewed once it has begun."}
          extra={
            <Link href={weeklyReviewPath(DateTime.now())}>
              Review this week instead
            </Link>
          }
        />
      </>
    );
  }

  const { review } = data;
  const status = review?.completed ? (
    <Tag color={"green"}>Complete</Tag>
  ) : review ? (
    <Tag color={"orange"}>Draft</Tag>
  ) : (
    <Tag>Not started</Tag>
  );
  const last = step === WEEKLY_STEPS.length;

  const listHref = weeklyListPath(monthOfWeek(week));
  const footer = (
    <div className={styles.footerBar}>
      {step > 1 ? (
        <Button icon={<ArrowLeftOutlined />} onClick={() => go(step - 1)}>
          Back
        </Button>
      ) : (
        <span />
      )}
      <Space>
        <Link href={listHref}>
          <Button>Save and exit</Button>
        </Link>
        {!last ? (
          <Button
            type={"primary"}
            icon={<ArrowRightOutlined />}
            iconPlacement={"end"}
            onClick={() => go(step + 1)}
          >
            Next: {WEEKLY_STEPS[step]}
          </Button>
        ) : review?.completed ? (
          <Link href={listHref}>
            <Button type={"primary"}>Done</Button>
          </Link>
        ) : (
          <Button
            type={"primary"}
            icon={<CheckOutlined />}
            onClick={() => void data.complete()}
          >
            Complete review
          </Button>
        )}
      </Space>
    </div>
  );

  return (
    <>
      {breadcrumbs}
      <div
        ref={screenRef}
        className={styles.screen}
        style={{ height: screenHeight }}
      >
        <div className={styles.top}>
          <div className={styles.header}>
            <Flex align={"center"} gap={12} wrap={true}>
              <h1 className={styles.title}>Weekly review</h1>
              <span className={styles.subtitle}>
                {label} · {dates}
              </span>
              {status}
            </Flex>
          </div>
          <Steps
            current={step - 1}
            onChange={(index) => go(index + 1)}
            items={WEEKLY_STEPS.map((title) => ({ title }))}
          />
        </div>
        {step === 1 ? (
          <WeekLookBackStep data={data} intro={INTROS[0]} footer={footer} />
        ) : step === 2 ? (
          <HighlightsStep data={data} intro={INTROS[1]} footer={footer} />
        ) : step === 3 ? (
          <WeekReflectStep data={data} intro={INTROS[2]} footer={footer} />
        ) : step === 4 ? (
          <PlanWeekStep data={data} intro={INTROS[3]} footer={footer} />
        ) : (
          <WeekWrapUpStep data={data} intro={INTROS[4]} footer={footer} />
        )}
      </div>
    </>
  );
};

export default WeeklyReview;
