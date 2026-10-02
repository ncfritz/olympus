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
  DAILY_STEPS,
  dailyListPath,
  dailyReviewPath,
  stepToOpen,
} from "../../../utils/reviews";
import LookBackStep from "./LookBackStep";
import PlanTomorrowStep from "./PlanTomorrowStep";
import ReflectStep from "./ReflectStep";
import ReviewBreadcrumbs from "./ReviewBreadcrumbs";
import styles from "./Review.module.css";
import { useFillHeight } from "./reviewHooks";
import { useDailyReview } from "./useDailyReview";
import WrapUpStep from "./WrapUpStep";

const INTROS = [
  "Here's what happened today. Decide what happens to anything planned for it; what goes to tomorrow shows up in step 3.",
  "Score the day, then answer what's useful. Skip any prompt; an empty one isn't saved.",
  "Map out tomorrow. Give a priority a block of open time; what you plan here opens tomorrow's review.",
  "This is how the review reads later, in the day's history and the weekly review.",
];

export interface DailyReviewProps {
  /** The day reviewed, in the browser's zone. */
  date: DateTime;
}

/**
 * A day's review as guided steps (ADR 0027; option B on the design
 * canvas): Look back, Reflect, Plan tomorrow, Wrap up. Every change saves
 * as it is made; the step is kept in the address as `?step=`.
 */
const DailyReview: React.FunctionComponent<DailyReviewProps> = ({ date }) => {
  const router = useRouter();
  const data = useDailyReview(date);
  const [screenRef, screenHeight] = useFillHeight();
  const [step, setStep] = useState(1);
  const [opened, setOpened] = useState(false);
  const label = date.toFormat("cccc, LLLL d");

  // Opens at ?step=, else where the review got to, once it has loaded.
  useEffect(() => {
    if (data.loading || opened) return;
    setStep(
      stepToOpen(router.query.step, DAILY_STEPS.length, data.review?.step),
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
      what={"Daily review"}
      listHref={dailyListPath(date)}
      label={date.toFormat("cccc, LLLL d, yyyy")}
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
          title={`${label} hasn't happened yet`}
          subTitle={"A day is reviewed once it has begun."}
          extra={
            <Link href={dailyReviewPath(DateTime.now())}>
              Review today instead
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
  const last = step === DAILY_STEPS.length;

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
        <Link href={dailyListPath(date)}>
          <Button>Save and exit</Button>
        </Link>
        {!last ? (
          <Button
            type={"primary"}
            icon={<ArrowRightOutlined />}
            iconPlacement={"end"}
            onClick={() => go(step + 1)}
          >
            Next: {DAILY_STEPS[step]}
          </Button>
        ) : review?.completed ? (
          <Link href={dailyListPath(date)}>
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
              <h1 className={styles.title}>Daily review</h1>
              <span className={styles.subtitle}>
                {date.toFormat("cccc, LLLL d")}
              </span>
              {status}
            </Flex>
          </div>
          <Steps
            current={step - 1}
            onChange={(index) => go(index + 1)}
            items={DAILY_STEPS.map((title) => ({ title }))}
          />
        </div>
        {step === 1 ? (
          <LookBackStep data={data} intro={INTROS[0]} footer={footer} />
        ) : step === 2 ? (
          <ReflectStep data={data} intro={INTROS[1]} footer={footer} />
        ) : (
          // Keyed by step, so each step opens at its top.
          <div key={step} className={styles.scroller}>
            <div className={styles.body}>
              <p className={styles.intro}>{INTROS[step - 1]}</p>
              {step === 3 && <PlanTomorrowStep data={data} />}
              {step === 4 && <WrapUpStep data={data} onEdit={go} />}
            </div>
            <div className={styles.stickyFooter}>{footer}</div>
          </div>
        )}
      </div>
    </>
  );
};

export default DailyReview;
