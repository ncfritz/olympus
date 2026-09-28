import type { Language, Video } from "@ncfritz/olympus-sdk/dionysus";
import { Badge, Empty, Radio, Select, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import { labelRenderer } from "./MovieImagesPanel";
import MovieVideoList from "./MovieVideoList";

export interface MovieVideoPanelProps {
  videos: Video[];
}

const MovieVideoPanel: React.FunctionComponent<MovieVideoPanelProps> = ({
  videos,
}: MovieVideoPanelProps) => {
  const [language, setLanguage] = useState("en");
  const [languages, setLanguages] = useState<Map<string, Language>>(new Map());
  const [videoType, setVideoType] = useState<
    | "Behind the Scenes"
    | "Bloopers"
    | "Clip"
    | "Featurette"
    | "Teaser"
    | "Trailer"
  >("Trailer");
  const [videoTypeMap, setVideoTypeMap] = useState<
    Map<string, Map<string, Video[]>>
  >(new Map());

  useEffect(() => {
    const newVideoTypeMap: Map<string, Map<string, Video[]>> = new Map();
    const newLanguages: Map<string, Language> = new Map();

    videos.forEach((item) => {
      if (!newVideoTypeMap.has(item.type)) {
        newVideoTypeMap.set(item.type, new Map());
      }

      const videoLanguageMap = newVideoTypeMap.get(item.type);

      if (!videoLanguageMap?.has(item.language.id)) {
        videoLanguageMap!.set(item.language.id, []);
      }

      videoLanguageMap!.get(item.language.id)!.push(item);

      if (!newLanguages.has(item.language.id)) {
        newLanguages.set(item.language.id, item.language);
      }
    });

    setVideoTypeMap(newVideoTypeMap);
    setLanguages(newLanguages);
  }, videos);

  const TypeRadioButton: React.FunctionComponent<{
    type: string;
    label: string;
  }> = ({ type, label }) => {
    return (
      <Radio.Button value={type}>
        <Space orientation={"horizontal"}>
          <Typography.Text>{label}</Typography.Text>
          <Badge
            size={"small"}
            color={"#999999"}
            showZero={true}
            count={videoTypeMap.get(type)?.get(language)?.length || 0}
          />
        </Space>
      </Radio.Button>
    );
  };

  let content = (
    <Space style={{ width: "100%", padding: 64, justifyContent: "center" }}>
      <Empty />
    </Space>
  );

  if (videoTypeMap.size > 0) {
    let videoContent = (
      <Space style={{ width: "100%", padding: 64, justifyContent: "center" }}>
        <Empty />
      </Space>
    );

    if (
      videoTypeMap.get(videoType) &&
      videoTypeMap.get(videoType)!.get(language)
    ) {
      videoContent = (
        <MovieVideoList videos={videoTypeMap.get(videoType)!.get(language)!} />
      );
    }

    content = (
      <Space orientation={"vertical"} size={0} style={{ width: "100%" }}>
        <Space
          direction={"horizontal"}
          style={{
            width: "100%",
            justifyContent: "space-between",
            padding: 8,
            borderBottom: "1px solid #ededed",
          }}
        >
          <Radio.Group
            onChange={(e) => {
              setVideoType(e.target.value);
            }}
            defaultValue="Trailer"
            buttonStyle="solid"
          >
            <TypeRadioButton type={"Trailer"} label={"Trailers"} />
            <TypeRadioButton type={"Teaser"} label={"Teasers"} />
            <TypeRadioButton type={"Featurette"} label={"Featurettes"} />
            <TypeRadioButton type={"Clip"} label={"Clips"} />
            <TypeRadioButton type={"Bloopers"} label={"Bloopers"} />
            <TypeRadioButton
              type={"Behind the Scenes"}
              label={"Behind the Scenes"}
            />
          </Radio.Group>
          <Space orientation={"horizontal"} size={8}>
            <Select
              style={{ minWidth: 250 }}
              value={language}
              onSelect={(value, option) => {
                setLanguage(option.language.id);
              }}
              options={languages
                .values()
                .toArray()
                .map((value) => {
                  return {
                    label: value.name,
                    value: value.id,
                    language: value,
                  };
                })}
              optionRender={(option) => {
                return labelRenderer(option.data.language);
              }}
              labelInValue={true}
              labelRender={(label) => {
                return labelRenderer(label.label as unknown as Language);
              }}
              optionLabelProp={"language"}
            />
          </Space>
        </Space>
        <Space
          style={{ width: "100%", padding: 16 }}
          styles={{ item: { width: "100%" } }}
        >
          {videoContent}
        </Space>
      </Space>
    );
  }

  return content;
};
export default MovieVideoPanel;
