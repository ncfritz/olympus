import { PaperClipOutlined } from "@ant-design/icons";
import type { MovieReleaseDate, Country } from "@ncfritz/olympus-sdk/dionysus";
import { Empty, Space, Tag, Typography } from "antd";
import { DateTime } from "luxon";
import { type ReactNode, useEffect, useState } from "react";
import ReactCountryFlag from "react-country-flag/src";
import { getReleaseTypeName } from "./util";

export interface MovieReleaseDateListProps {
  releaseDates: MovieReleaseDate[];
}

const MovieReleaseDateList: React.FunctionComponent<
  MovieReleaseDateListProps
> = ({ releaseDates }: MovieReleaseDateListProps) => {
  const [countryData, setCountryData] = useState<Map<string, Country>>(
    new Map(),
  );
  const [data, setData] = useState<Map<string, MovieReleaseDate[]>>(new Map());

  useEffect(() => {
    const newCountryData: Map<string, Country> = new Map();
    const newData: Map<string, MovieReleaseDate[]> = new Map();

    if (releaseDates && releaseDates.length > 0) {
      releaseDates.forEach((item) => {
        // Grouped by country: a release the API sent without one has no bucket.
        if (!item.country) return;
        if (!newData.has(item.country.id)) {
          newCountryData.set(item.country.id, item.country);
          newData.set(item.country.id, []);
        }

        newData.get(item.country.id)!.push(item);
      });

      setCountryData(newCountryData);
      setData(newData);
    }
  }, [releaseDates]);

  const content: ReactNode[] = [];

  if (data.size > 0) {
    data.entries().forEach(([countryCode, item]) => {
      const country = countryData.get(countryCode);

      content.push(
        <Space
          direction={"vertical"}
          size={4}
          style={{ marginBottom: 8, width: "100%" }}
        >
          <Space size={8} direction={"horizontal"}>
            <ReactCountryFlag
              countryCode={country!.id}
              cdnUrl={"/flags/"}
              cdnSuffix={"svg"}
              svg={true}
            />
            <Typography.Text>{country!.name}</Typography.Text>
          </Space>
          <Space
            size={0}
            style={{
              paddingLeft: 8,
              borderLeft: "3px solid #cccccc",
              width: "100%",
            }}
            direction={"vertical"}
          >
            {item.map((release) => {
              // `???` is what this component already shows for a certification
              // it was not given; an absent date reads the same way, and
              // `fromISO(undefined)` would print "Invalid DateTime".
              const releaseDate = release.releaseDate
                ? DateTime.fromISO(release.releaseDate).toLocaleString()
                : "???";

              return (
                <Space
                  direction={"horizontal"}
                  style={{ width: "100%", justifyContent: "space-between" }}
                  size={0}
                >
                  <Space size={4} direction={"horizontal"}>
                    <Tag
                      color={release.certification ? "#2c3b49" : "#949EA8FF"}
                      style={{
                        fontSize: "9px",
                        margin: 0,
                        lineHeight: "15px",
                        width: 48,
                        textAlign: "center",
                      }}
                    >
                      {release.certification?.certification || "???"}
                    </Tag>
                    <Typography.Text style={{ fontSize: "11px" }}>
                      {getReleaseTypeName(release.type)}
                    </Typography.Text>
                    <Typography.Text
                      style={{ fontSize: "11px", color: "#666666" }}
                    >
                      ({releaseDate})
                    </Typography.Text>
                  </Space>
                  {release.note && (
                    <Space style={{ width: "100%" }} size={4}>
                      <Typography.Text
                        style={{ fontSize: "9px", color: "#333333" }}
                      >
                        {release.note}
                      </Typography.Text>
                      <PaperClipOutlined
                        style={{ color: "#333333", height: 8 }}
                      />
                    </Space>
                  )}
                </Space>
              );
            })}
          </Space>
        </Space>,
      );
    });
  } else {
    content.push(<Empty />);
  }

  return (
    <Space orientation={"vertical"} style={{ width: "100%" }} size={8}>
      {content}
    </Space>
  );
};
export default MovieReleaseDateList;
