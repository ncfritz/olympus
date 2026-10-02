import {
  RocketOutlined,
  BulbOutlined,
  CarOutlined,
  CoffeeOutlined,
  CameraOutlined,
  GiftOutlined,
  GlobalOutlined,
  MedicineBoxOutlined,
  ShoppingOutlined,
  ToolOutlined,
  ExperimentOutlined,
  FireOutlined,
  ThunderboltOutlined,
  ReadOutlined,
  CustomerServiceOutlined,
  DollarOutlined,
  BankOutlined,
  BuildOutlined,
  CodeOutlined,
  CloudOutlined,
  CrownOutlined,
  EnvironmentOutlined,
  SunOutlined,
  MoonOutlined,
  UserOutlined,
  SafetyOutlined,
  ScheduleOutlined,
  AimOutlined,
  VideoCameraOutlined,
  BookOutlined,
  CheckCircleFilled,
  CompassOutlined,
  ExclamationCircleFilled,
  FlagOutlined,
  HeartOutlined,
  HomeOutlined,
  LaptopOutlined,
  RiseOutlined,
  SmileOutlined,
  StarOutlined,
  SyncOutlined,
  TeamOutlined,
  TrophyOutlined,
  WalletOutlined,
  WarningFilled,
} from "@ant-design/icons";
import type {
  Goal,
  GoalCategoryIcon,
  GoalHealth,
  GoalType,
} from "@ncfritz/olympus-sdk/minerva";
import { Progress, Tag, Tooltip } from "antd";
import React from "react";
import { HEALTH, TYPE_LABEL, formatValue } from "../../../utils/goals";

const TYPE_ICONS: Record<GoalType, React.ComponentType> = {
  outcome: RiseOutlined,
  milestone: FlagOutlined,
  habit: SyncOutlined,
  achievement: TrophyOutlined,
};

/** A goal type's icon, named for screen readers. */
export const GoalTypeIcon: React.FunctionComponent<{ type: GoalType }> = ({
  type,
}) => {
  const Icon = TYPE_ICONS[type];
  return (
    <span role={"img"} aria-label={TYPE_LABEL[type]} title={TYPE_LABEL[type]}>
      <Icon />
    </span>
  );
};

export const CATEGORY_ICONS: Record<GoalCategoryIcon, React.ComponentType> = {
  heart: HeartOutlined,
  laptop: LaptopOutlined,
  team: TeamOutlined,
  wallet: WalletOutlined,
  book: BookOutlined,
  home: HomeOutlined,
  star: StarOutlined,
  compass: CompassOutlined,
  trophy: TrophyOutlined,
  smile: SmileOutlined,
  rocket: RocketOutlined,
  bulb: BulbOutlined,
  car: CarOutlined,
  coffee: CoffeeOutlined,
  camera: CameraOutlined,
  gift: GiftOutlined,
  global: GlobalOutlined,
  "medicine-box": MedicineBoxOutlined,
  shopping: ShoppingOutlined,
  tool: ToolOutlined,
  experiment: ExperimentOutlined,
  fire: FireOutlined,
  thunderbolt: ThunderboltOutlined,
  read: ReadOutlined,
  "customer-service": CustomerServiceOutlined,
  dollar: DollarOutlined,
  bank: BankOutlined,
  build: BuildOutlined,
  code: CodeOutlined,
  cloud: CloudOutlined,
  crown: CrownOutlined,
  environment: EnvironmentOutlined,
  flag: FlagOutlined,
  sun: SunOutlined,
  moon: MoonOutlined,
  user: UserOutlined,
  safety: SafetyOutlined,
  schedule: ScheduleOutlined,
  aim: AimOutlined,
  "video-camera": VideoCameraOutlined,
};

export const CategoryIcon: React.FunctionComponent<{
  icon: GoalCategoryIcon;
  color?: string;
}> = ({ icon, color }) => {
  const Icon = CATEGORY_ICONS[icon] ?? StarOutlined;
  return (
    <span style={{ color }} aria-hidden={true}>
      <Icon />
    </span>
  );
};

const HEALTH_ICONS: Record<GoalHealth, React.ReactNode> = {
  on_track: <CheckCircleFilled />,
  at_risk: <ExclamationCircleFilled />,
  off_track: <WarningFilled />,
};

/** Health as a tag: a word and an icon, never colour alone. */
export const HealthTag: React.FunctionComponent<{
  health?: GoalHealth;
  suffix?: string;
}> = ({ health, suffix }) =>
  health ? (
    <Tag
      color={HEALTH[health].color}
      icon={HEALTH_ICONS[health]}
      style={{ marginInlineEnd: 0 }}
    >
      {HEALTH[health].label}
      {suffix}
    </Tag>
  ) : null;

/**
 * A goal's progress bar with a tick where pace says it should be. The
 * bar's label says both, for screen readers.
 */
export const GoalProgress: React.FunctionComponent<{
  goal: Pick<Goal, "progress" | "expectedProgress" | "health">;
  size?: "small" | "default";
}> = ({ goal, size = "small" }) => {
  const status =
    goal.health === "off_track"
      ? "exception"
      : goal.health === "at_risk"
        ? "normal"
        : "success";
  const label =
    goal.expectedProgress === undefined
      ? `${formatValue(goal.progress)}% done`
      : `${formatValue(goal.progress)}% done; pace says ${formatValue(goal.expectedProgress)}%`;
  return (
    <div
      style={{ position: "relative", width: "100%" }}
      role={"progressbar"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={goal.progress}
      aria-label={label}
    >
      <Progress
        percent={goal.progress}
        showInfo={false}
        size={size}
        status={goal.health ? status : "normal"}
        strokeColor={goal.health === "at_risk" ? "#faad14" : undefined}
      />
      {goal.expectedProgress !== undefined && (
        <Tooltip title={`Pace: ${formatValue(goal.expectedProgress)}%`}>
          <span
            aria-hidden={true}
            style={{
              position: "absolute",
              left: `${goal.expectedProgress}%`,
              top: size === "small" ? 2 : 4,
              width: 2,
              height: size === "small" ? 12 : 16,
              marginLeft: -1,
              background: "#262626",
              borderRadius: 1,
            }}
          />
        </Tooltip>
      )}
    </div>
  );
};

/** Health's dot and text colours, as the design board draws them. */
export const HEALTH_COLORS: Record<GoalHealth, { dot: string; text: string }> =
  {
    on_track: { dot: "#52c41a", text: "#237804" },
    at_risk: { dot: "#fa8c16", text: "#ad4e00" },
    off_track: { dot: "#f5222d", text: "#a8071a" },
  };

/** A small round dot in a health's colour; its meaning is said beside it. */
export const HealthDot: React.FunctionComponent<{ health: GoalHealth }> = ({
  health,
}) => (
  <span
    aria-hidden={true}
    style={{
      display: "inline-block",
      width: 8,
      height: 8,
      borderRadius: 4,
      background: HEALTH_COLORS[health].dot,
      flexShrink: 0,
    }}
  />
);

/** Health as a dot and its word, in the health's colour. */
export const HealthLabel: React.FunctionComponent<{ health?: GoalHealth }> = ({
  health,
}) =>
  health ? (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: HEALTH_COLORS[health].text,
        whiteSpace: "nowrap",
      }}
    >
      <HealthDot health={health} />
      {HEALTH[health].label}
    </span>
  ) : null;

/**
 * The board's slim progress bar: filled to progress, a tick where pace
 * says the goal should be; one label says both for screen readers.
 */
export const PaceBar: React.FunctionComponent<{
  goal: Pick<Goal, "progress" | "expectedProgress" | "health">;
  width?: number;
}> = ({ goal, width = 120 }) => {
  const fill =
    goal.health === "off_track"
      ? "#f5222d"
      : goal.health === "at_risk"
        ? "#fa8c16"
        : "#4096ff";
  const label =
    goal.expectedProgress === undefined
      ? `${formatValue(goal.progress)}% done`
      : `${formatValue(goal.progress)}% done, pace ${formatValue(goal.expectedProgress)}%`;
  return (
    <span
      role={"img"}
      aria-label={label}
      title={label}
      style={{
        position: "relative",
        display: "block",
        width,
        height: 6,
        borderRadius: 6,
        background: "#f0f0f0",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${Math.min(100, goal.progress)}%`,
          borderRadius: 6,
          background: fill,
        }}
      />
      {goal.expectedProgress !== undefined && (
        <span
          aria-hidden={true}
          style={{
            position: "absolute",
            left: `calc(${goal.expectedProgress}% - 1px)`,
            top: -4,
            width: 2,
            height: 14,
            background: "#1f1f1f",
            borderRadius: 1,
          }}
        />
      )}
    </span>
  );
};
