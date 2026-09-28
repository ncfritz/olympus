import type { Language, TypedImage } from "@ncfritz/olympus-sdk/dionysus";
import {
  Badge,
  ColorPicker,
  Empty,
  Radio,
  Select,
  Space,
  Typography,
} from "antd";
import { type ReactNode, useEffect, useState } from "react";
import ReactCountryFlag from "react-country-flag/src";
import LoadingWrapper from "../../common/LoadingWrapper";
import MovieImageList from "./MovieImageList";

export type ImageType = "logo" | "backdrop" | "poster" | "still";
const ImageTypeLabels: Map<ImageType, string> = new Map([
  ["poster", "Posters"],
  ["backdrop", "Backdrops"],
  ["logo", "Logos"],
  ["still", "Stills"],
]);

export interface MovieImagesPanelProps {
  images: TypedImage[];
  imageTypes?: ImageType[];
}

export const labelRenderer = (language: Language) => {
  return (
    <Space orientation={"horizontal"} size={8}>
      <ReactCountryFlag
        countryCode={language.id}
        cdnUrl={"/flags/"}
        cdnSuffix={"svg"}
        svg={true}
      />
      <Typography.Text>{language.name}</Typography.Text>
      {language.nativeName && (
        <Typography.Text style={{ fontSize: "11px" }}>
          ({language.nativeName})
        </Typography.Text>
      )}
    </Space>
  );
};

const MovieImagesPanel: React.FunctionComponent<MovieImagesPanelProps> = ({
  images,
  imageTypes = ["poster", "backdrop", "logo"],
}: MovieImagesPanelProps) => {
  const [language, setLanguage] = useState("en");
  const [languages, setLanguages] = useState<Map<string, Language>>(new Map());
  const [imageType, setImageType] = useState<
    "logo" | "backdrop" | "poster" | "still"
  >(imageTypes[0]);
  const [logoBackground, setLogoBackground] = useState("#999999");
  const [imageTypeMap, setImageTypeMap] = useState<
    Map<string, Map<string, TypedImage[]>>
  >(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);

    try {
      const newImageTypeMap: Map<string, Map<string, TypedImage[]>> = new Map();
      const newLanguages: Map<string, Language> = new Map();

      images.forEach((item) => {
        if (!newImageTypeMap.has(item.type)) {
          newImageTypeMap.set(item.type, new Map());
        }

        const imageLanguageMap = newImageTypeMap.get(item.type);

        if (!imageLanguageMap?.has(item.language.id)) {
          imageLanguageMap!.set(item.language.id, []);
        }

        imageLanguageMap!.get(item.language.id)!.push(item);

        if (!newLanguages.has(item.language.id)) {
          newLanguages.set(item.language.id, item.language);
        }
      });

      setImageTypeMap(newImageTypeMap);
      setLanguages(newLanguages);
    } finally {
      setLoading(false);
    }
  }, images);

  let content = <Empty />;

  if (imageTypeMap.size > 0) {
    const options: ReactNode[] = [];

    ImageTypeLabels.entries().forEach((item) => {
      if (!imageTypes.includes(item[0])) {
        return;
      }

      options.push(
        <Radio.Button value={item[0]} disabled={imageTypes?.length <= 1}>
          <Space orientation={"horizontal"}>
            <Typography.Text>{item[1]}</Typography.Text>
            <Badge
              size={"small"}
              color={"#999999"}
              showZero={true}
              count={imageTypeMap.get(item[0])?.get(language)?.length || 0}
            />
          </Space>
        </Radio.Button>,
      );
    });

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
              setImageType(e.target.value);
            }}
            defaultValue={imageTypes[0]}
            buttonStyle={"solid"}
          >
            {options}
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
            {imageType === "logo" && (
              <ColorPicker
                value={logoBackground}
                onChange={(value) => {
                  setLogoBackground(value.toHexString());
                }}
              />
            )}
          </Space>
        </Space>
        <Space style={{ width: "100%", padding: 16 }}>
          <MovieImageList
            images={
              imageTypeMap.get(imageType)?.has(language)
                ? imageTypeMap.get(imageType)?.get(language) || []
                : []
            }
            imageBackgroundColor={logoBackground}
          />
        </Space>
      </Space>
    );
  }

  return <LoadingWrapper loading={loading}>{content}</LoadingWrapper>;
};
export default MovieImagesPanel;
