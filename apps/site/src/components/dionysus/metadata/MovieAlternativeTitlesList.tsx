import type { AlternativeTitle, Country } from "@ncfritz/olympus-sdk/dionysus";
import { Empty, Space, Typography } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import ReactCountryFlag from "react-country-flag/src";

export interface MovieAlternativeTitlesListProps {
  alternativeTitles: AlternativeTitle[];
}

const MovieAlternativeTitlesList: React.FunctionComponent<
  MovieAlternativeTitlesListProps
> = ({ alternativeTitles }: MovieAlternativeTitlesListProps) => {
  const [countryData, setCountryData] = useState<Map<string, Country>>(
    new Map(),
  );
  const [data, setData] = useState<Map<string, AlternativeTitle[]>>(new Map());

  useEffect(() => {
    const newCountryData: Map<string, Country> = new Map();
    const newData: Map<string, AlternativeTitle[]> = new Map();

    if (alternativeTitles && alternativeTitles.length > 0) {
      alternativeTitles.forEach((item) => {
        if (!newData.has(item.country.id)) {
          newCountryData.set(item.country.id, item.country);
          newData.set(item.country.id, []);
        }

        newData.get(item.country.id)!.push(item);
      });

      setCountryData(newCountryData);
      setData(newData);
    }
  }, [alternativeTitles]);

  const content: ReactNode[] = [];

  if (data.size > 0) {
    data.entries().forEach(([countryCode, item]) => {
      const country = countryData.get(countryCode);

      content.push(
        <Space orientation={"vertical"} size={4} style={{ marginBottom: 8 }}>
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
            style={{ paddingLeft: 8, borderLeft: "3px solid #cccccc" }}
            direction={"vertical"}
          >
            {item.map((title) => {
              return (
                <Space style={{ width: "100%" }} size={4}>
                  <Typography.Text style={{ fontSize: "11px" }}>
                    {title.title}
                  </Typography.Text>
                  {title.type && (
                    <Typography.Text
                      style={{ fontSize: "11px", color: "#666666" }}
                    >
                      ({title.type})
                    </Typography.Text>
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
export default MovieAlternativeTitlesList;
