import { Collapse, Flex } from "antd";
import React from "react";

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
  if (!collapsible) {
    return (
      <div style={{ marginBottom: 8 }}>
        <Flex
          justify={"space-between"}
          align={"center"}
          style={{ paddingBlock: 12 }}
        >
          <Heading>{title}</Heading>
          {aside}
        </Flex>
        {children}
      </div>
    );
  }
  return (
    <Collapse
      ghost={true}
      defaultActiveKey={["section"]}
      items={[
        {
          key: "section",
          label: <Heading>{title}</Heading>,
          extra: aside,
          children,
          styles: { header: { paddingInline: 0 }, body: { paddingInline: 0 } },
        },
      ]}
    />
  );
};

export default GoalSection;
