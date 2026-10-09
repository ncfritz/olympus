import { EditOutlined } from "@ant-design/icons";
import { Space } from "antd";
import { DateTime, Interval } from "luxon";
import Link from "next/link";
import { useParams } from "next/navigation";
import React from "react";
import NotesPage from "../../../components/notes/NotesPage";

const IndexPage: React.FunctionComponent = () => {
  const params = useParams<{ date: string[] }>();

  let startDate: DateTime = DateTime.now().plus({
    days: 1,
  });
  let endDate: DateTime = startDate.minus({
    days: 30,
  });
  const breadcrumbs = [
    {
      title: (
        <Link href={"/minerva/notes/"}>
          <Space>
            <EditOutlined />
            <span>Notes</span>
          </Space>
        </Link>
      ),
    },
  ];

  if (params.date) {
    if (params.date.length === 2) {
      startDate = DateTime.fromObject({
        year: parseInt(params.date[0]),
        month: parseInt(params.date[1]),
      }).endOf("month");
      endDate = startDate.startOf("month");
      const interval = Interval.fromDateTimes(endDate, startDate);

      breadcrumbs.push({
        title: (
          <Link href={`/minerva/notes/${startDate.year}`}>
            <Space>
              <EditOutlined />
              <span>{startDate.year}</span>
            </Space>
          </Link>
        ),
      });
      breadcrumbs.push({
        title: (
          <Space>
            <EditOutlined />
            <span>{startDate.toFormat("MMMM")}</span>
          </Space>
        ),
      });

      return (
        <NotesPage
          startDate={startDate}
          days={interval.length("days")}
          breadcrumbs={breadcrumbs}
        />
      );
    } else if (params.date.length === 1) {
      return (
        <NotesPage startDate={startDate} days={30} breadcrumbs={breadcrumbs} />
      );
    }
  }

  return (
    <NotesPage startDate={startDate} days={30} breadcrumbs={breadcrumbs} />
  );
};

export default IndexPage;
