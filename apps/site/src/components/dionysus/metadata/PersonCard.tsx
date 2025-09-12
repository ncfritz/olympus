import type { BasePerson } from "@ncfritz/olympus-sdk/dionysus";
import { Card, Space, Typography } from "antd";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  getPersonCardImageHorizontal,
  getPersonCardImageVertical,
} from "./util";

interface BasePersonCardProps {
  person: BasePerson;
  children?: ReactNode | ReactNode[];
  titleExtra?: ReactNode;
}

interface PersonCardProps extends BasePersonCardProps {
  direction: "vertical" | "horizontal";
}

const PersonVerticalCard: React.FunctionComponent<BasePersonCardProps> = ({
  person,
  children,
}: BasePersonCardProps) => {
  return (
    <Card
      variant={"borderless"}
      hoverable={true}
      styles={{
        body: {
          margin: 0,
          padding: 0,
          flexDirection: "column",
          justifyContent: "start",
          display: "flex",
        },
        actions: { margin: 0, padding: 0 },
      }}
      cover={getPersonCardImageVertical(person)}
    >
      <Space
        size={3}
        direction={"vertical"}
        style={{ padding: 8, width: "100%" }}
        styles={{ item: { width: "100%", lineHeight: 1 } }}
      >
        <Link href={`/dionysus/person/${person.id}`}>
          <Typography.Text
            strong={true}
            style={{
              fontSize: "10px",
              lineHeight: 1,
            }}
          >
            {person.name}
          </Typography.Text>
        </Link>
        {children}
      </Space>
    </Card>
  );
};

const PersonHorizontalCard: React.FunctionComponent<BasePersonCardProps> = ({
  person,
  children,
  titleExtra,
}: BasePersonCardProps) => {
  console.log(titleExtra);

  return (
    <Card
      variant={"borderless"}
      hoverable={true}
      styles={{
        body: {
          margin: 0,
          padding: 0,
          flexDirection: "column",
          justifyContent: "start",
          display: "flex",
        },
        actions: { margin: 0, padding: 0 },
      }}
    >
      <Space
        direction={"horizontal"}
        className={"person-fix"}
        size={16}
        style={{ alignItems: "start", width: "100%" }}
      >
        {getPersonCardImageHorizontal(person)}
        <Space
          size={3}
          direction={"vertical"}
          style={{ padding: 8, width: "100%" }}
          styles={{ item: { width: "100%", lineHeight: 1 } }}
        >
          <Space
            direction={"horizontal"}
            style={{
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Link href={`/dionysus/person/${person.id}`}>
              <Typography.Text
                strong={true}
                style={{
                  fontSize: "14px",
                  lineHeight: 1,
                }}
              >
                {person.name}
              </Typography.Text>
            </Link>
            {titleExtra}
          </Space>
          {children}
        </Space>
      </Space>
    </Card>
  );
};

const PersonCard: React.FunctionComponent<PersonCardProps> = ({
  direction,
  person,
  children,
  titleExtra,
}: PersonCardProps) => {
  return direction === "horizontal" ? (
    <PersonHorizontalCard person={person} titleExtra={titleExtra}>
      {children}
    </PersonHorizontalCard>
  ) : (
    <PersonVerticalCard person={person} titleExtra={titleExtra}>
      {children}
    </PersonVerticalCard>
  );
};
export default PersonCard;
