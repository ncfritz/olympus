import { Collapse } from "antd";
import React from "react";

/** The space below each section, apart from the heading's own padding. */
const SECTION_GAP = 16;

/** A section heading in the mocks' style: small capitals. */
export const Heading: React.FunctionComponent<{
  children: React.ReactNode;
}> = ({ children }) => (
  <span
    style={{
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "#595959",
    }}
  >
    {children}
  </span>
);

export interface GoalSectionProps {
  title: React.ReactNode;
  /** Shown at the heading's right; clicking it does not fold the section. */
  extra?: React.ReactNode;
  /** False for a section that always shows, such as the check-in form. */
  collapsible?: boolean;
  children: React.ReactNode;
}

/**
 * A borderless section of a goal's page: a small-capital heading that
 * folds the section away, as the Focus view's sections do.
 */
const GoalSection: React.FunctionComponent<GoalSectionProps> = ({
  title,
  extra,
  collapsible = true,
  children,
}) => {
  const aside = extra && (
    // A button in the heading acts without folding the section.
    <span onClick={(e) => e.stopPropagation()}>{extra}</span>
  );
  return (
    // A section that always shows is still a Collapse, without the arrow
    // and fixed open, so its heading lines up with the ones beside it.
    <Collapse
      ghost={true}
      style={{ marginBottom: SECTION_GAP }}
      defaultActiveKey={["section"]}
      {...(collapsible ? {} : { activeKey: ["section"] })}
      items={[
        {
          key: "section",
          label: <Heading>{title}</Heading>,
          extra: aside,
          children,
          ...(collapsible
            ? {}
            : { showArrow: false, collapsible: "disabled" as const }),
          styles: {
            header: {
              paddingInline: 0,
              ...(collapsible ? {} : { cursor: "default" }),
            },
            body: { paddingInline: 0 },
          },
        },
      ]}
    />
  );
};

export default GoalSection;
