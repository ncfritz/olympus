import { Button, Select, Space, Typography } from "antd";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import FilterWrapper from "./FilterWrapper";

type monthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface DateRangeFilterValue {
  start: {
    year: number;
    month: number;
  };
  end: {
    year: number;
    month: number;
  };
}

export interface DateRangeFilterProps {
  label: string;
  onFiltersSet: (value: DateRangeFilterValue | undefined) => void;
  initialValue?: DateRangeFilterValue;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
}

const DateRangeFilter: React.FunctionComponent<DateRangeFilterProps> = ({
  label,
  onFiltersSet,
  initialValue,
}: DateRangeFilterProps) => {
  const now = DateTime.utc();
  let localFilterValue = initialValue;

  const [fromMonth, setFromMonth] = useState<monthNumber>(1);
  const [fromYear, setFromYear] = useState<number>(now.year - 2);
  const [toMonth, setToMonth] = useState<monthNumber>(now.month);
  const [toYear, setToYear] = useState<number>(now.year);
  const [filterValue, setFilterValue] = useState<
    DateRangeFilterValue | undefined
  >();

  useEffect(() => {
    setFilterValue(localFilterValue);
  }, [localFilterValue]);

  useEffect(() => {
    localFilterValue = {
      start: {
        year: fromYear,
        month: fromMonth,
      },
      end: {
        year: toYear,
        month: toMonth,
      },
    };
  }, [fromYear, fromMonth, toYear, toMonth]);

  const setRange = (
    startYear: number,
    startMonth: monthNumber,
    endYear: number,
    endMonth: monthNumber,
  ) => {
    setFromYear(startYear);
    setFromMonth(startMonth);
    setToYear(endYear);
    setToMonth(endMonth);
  };

  const years: { label: string; value: number }[] = [];

  for (let i = 1900; i <= now.year; i++) {
    years.push({ label: i.toString(), value: i });
  }

  const months = [
    { label: "January", value: 1 },
    { label: "February", value: 2 },
    { label: "March", value: 3 },
    { label: "April", value: 4 },
    { label: "May", value: 5 },
    { label: "June", value: 6 },
    { label: "July", value: 7 },
    { label: "August", value: 8 },
    { label: "September", value: 9 },
    { label: "October", value: 10 },
    { label: "November", value: 11 },
    { label: "December", value: 12 },
  ];

  const fromYears = years.filter((year) => year.value <= toYear);
  const fromMonths = months.filter((month) => {
    if (fromYear === now.year) {
      return month.value <= now.month;
    }

    return month;
  });
  const toYears = years.filter((year) => year.value >= fromYear);
  const toMonths = months.filter((month) => {
    if (toYear === fromYear) {
      return month.value >= fromMonth && month.value <= toMonth;
    } else if (toYear === now.year) {
      return month.value <= now.month;
    }
    return month;
  });

  return (
    <FilterWrapper
      label={label}
      initialFiltersPresent={initialValue !== undefined}
      filters={
        <Space orientation={"vertical"} size={0}>
          <Space
            orientation={"horizontal"}
            style={{
              paddingTop: 8,
              paddingLeft: 8,
              paddingRight: 8,
            }}
          >
            <Space
              orientation={"vertical"}
              style={{
                alignItems: "center",
                borderRight: "1px solid #efefef",
                paddingRight: 8,
                paddingBottom: 8,
              }}
            >
              <Typography.Text strong={true}>From</Typography.Text>
              <Space orientation={"horizontal"}>
                <Space orientation={"vertical"} size={0}>
                  <Typography.Text style={{ fontSize: "11px" }}>
                    Month
                  </Typography.Text>
                  <Select
                    disabled={!filterValue}
                    variant={"borderless"}
                    style={{ width: 120 }}
                    value={fromMonth}
                    onChange={(value) => setFromMonth(value)}
                    options={fromMonths}
                  />
                </Space>
                <Space orientation={"vertical"} size={0}>
                  <Typography.Text style={{ fontSize: "11px" }}>
                    Year
                  </Typography.Text>
                  <Select
                    disabled={!filterValue}
                    variant={"borderless"}
                    value={fromYear}
                    onChange={(value) => setFromYear(value)}
                    options={fromYears}
                  />
                </Space>
              </Space>
            </Space>
            <Space
              orientation={"vertical"}
              style={{ alignItems: "center", paddingBottom: 8 }}
            >
              <Typography.Text strong={true}>To</Typography.Text>
              <Space orientation={"horizontal"}>
                <Space orientation={"vertical"} size={0}>
                  <Typography.Text style={{ fontSize: "11px" }}>
                    Month
                  </Typography.Text>
                  <Select
                    disabled={!filterValue}
                    variant={"borderless"}
                    style={{ width: 120 }}
                    value={toMonth}
                    onChange={(value) => setToMonth(value)}
                    options={toMonths}
                  />
                </Space>
                <Space orientation={"vertical"} size={0}>
                  <Typography.Text style={{ fontSize: "11px" }}>
                    Year
                  </Typography.Text>
                  <Select
                    disabled={!filterValue}
                    variant={"borderless"}
                    value={toYear}
                    onChange={(value) => setToYear(value)}
                    options={toYears}
                  />
                </Space>
              </Space>
            </Space>
          </Space>
          <Space
            orientation={"horizontal"}
            size={0}
            style={{ width: "100%", borderTop: "1px solid #efefef" }}
            styles={{ item: { width: "100%" } }}
          >
            <Space
              orientation={"vertical"}
              style={{ width: "100%", padding: 8 }}
            >
              <Button
                size={"small"}
                block={true}
                variant={"filled"}
                color={"primary"}
                onClick={() => {
                  setRange(now.year, 1, now.year, now.month);
                }}
              >
                Year To Date
              </Button>
              <Button
                size={"small"}
                block={true}
                variant={"filled"}
                color={"primary"}
                onClick={() => {
                  const sd = now.minus({ year: 1 });
                  setRange(sd.year, sd.month, now.year, now.month);
                }}
              >
                Last Year
              </Button>
              <Button
                size={"small"}
                block={true}
                variant={"filled"}
                color={"purple"}
                onClick={() => {
                  const sy = now.year - (now.year % 10) - 20;
                  setRange(sy, 1, sy + 9, 12);
                }}
              >
                {now.year - (now.year % 10) - 20}s
              </Button>
              <Button
                size={"small"}
                block={true}
                variant={"filled"}
                color={"purple"}
                onClick={() => {
                  const sy = now.year - (now.year % 10) - 50;
                  setRange(sy, 1, sy + 9, 12);
                }}
              >
                {now.year - (now.year % 10) - 50}s
              </Button>
            </Space>
            <Space
              orientation={"vertical"}
              style={{ width: "100%", padding: 8 }}
            >
              <Button
                size={"small"}
                block={true}
                variant={"filled"}
                color={"primary"}
                onClick={() => {
                  const sd = now.minus({ month: 3 });
                  setRange(sd.year, sd.month, now.year, now.month);
                }}
              >
                Last 3 Months
              </Button>
              <Button
                size={"small"}
                block={true}
                variant={"filled"}
                color={"purple"}
                onClick={() => {
                  const sy = now.year - (now.year % 10);
                  setRange(sy, 1, sy + 9, 12);
                }}
              >
                {now.year - (now.year % 10)}s
              </Button>
              <Button
                size={"small"}
                block={true}
                variant={"filled"}
                color={"purple"}
                onClick={() => {
                  const sy = now.year - (now.year % 10) - 30;
                  setRange(sy, 1, sy + 9, 12);
                }}
              >
                {now.year - (now.year % 10) - 30}s
              </Button>
              <Button
                block={true}
                variant={"filled"}
                color={"purple"}
                onClick={() => {
                  const sy = now.year - (now.year % 10) - 60;
                  setRange(sy, 1, sy + 9, 12);
                }}
              >
                {now.year - (now.year % 10) - 60}s
              </Button>
            </Space>
            <Space orientation={"vertical"} style={{ width: "100%" }}>
              <Space
                orientation={"vertical"}
                style={{ width: "100%", padding: 8 }}
              >
                <Button
                  size={"small"}
                  block={true}
                  variant={"filled"}
                  color={"primary"}
                  onClick={() => {
                    const sd = now.minus({ month: 6 });
                    setRange(sd.year, sd.month, now.year, now.month);
                  }}
                >
                  Last 6 Months
                </Button>
                <Button
                  size={"small"}
                  block={true}
                  variant={"filled"}
                  color={"purple"}
                  onClick={() => {
                    const sy = now.year - (now.year % 10) - 10;
                    setRange(sy, 1, sy + 9, 12);
                  }}
                >
                  {now.year - (now.year % 10) - 10}s
                </Button>
                <Button
                  size={"small"}
                  block={true}
                  variant={"filled"}
                  color={"purple"}
                  onClick={() => {
                    const sy = now.year - (now.year % 10) - 40;
                    setRange(sy, 1, sy + 9, 12);
                  }}
                >
                  {now.year - (now.year % 10) - 40}s
                </Button>
                <Button
                  size={"small"}
                  block={true}
                  variant={"filled"}
                  color={"default"}
                  onClick={() => setRange(1900, 1, now.year, now.month)}
                >
                  All
                </Button>
              </Space>
            </Space>
          </Space>
        </Space>
      }
      onReset={() => {
        setFromMonth(1);
        setFromYear(now.year - 2);
        setToMonth(now.month);
        setToYear(now.year);

        localFilterValue = {
          start: {
            year: now.year - 2,
            month: 1,
          },
          end: {
            year: now.year,
            month: now.month,
          },
        };
      }}
      onClear={() => {
        localFilterValue = undefined;
      }}
      onClose={() => {
        onFiltersSet(localFilterValue);
        return localFilterValue ? 1 : 0;
      }}
    />
  );
};
export default DateRangeFilter;
