import type { TypedImage, Language } from "@ncfritz/olympus-sdk/dionysus";
import { Badge, Empty, Radio, Select, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import ReactCountryFlag from "react-country-flag/src";
import CollectionImageList from "./CollectionImageList";

export interface CollectionImagesPanelProps {
  images: TypedImage[];
}

export const labelRenderer = (language: Language) => {
  return (
    <Space direction={"horizontal"} size={8}>
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

const CollectionImagesPanel: React.FunctionComponent<
  CollectionImagesPanelProps
> = ({ images }: CollectionImagesPanelProps) => {
  const [language, setLanguage] = useState("en");
  const [languages, setLanguages] = useState<Map<string, Language>>(new Map());
  const [imageType, setImageType] = useState<"backdrop" | "poster">("poster");
  const [imageTypeMap, setImageTypeMap] = useState<
    Map<string, Map<string, TypedImage[]>>
  >(new Map());

  useEffect(() => {
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
  }, images);

  let content = <Empty />;

  if (imageTypeMap.size > 0) {
    content = (
      <Space direction={"vertical"} size={0} style={{ width: "100%" }}>
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
            defaultValue="poster"
            buttonStyle="solid"
          >
            <Radio.Button value={"poster"}>
              <Space direction={"horizontal"}>
                <Typography.Text>Posters</Typography.Text>
                <Badge
                  size={"small"}
                  color={"#999999"}
                  showZero={true}
                  count={imageTypeMap.get("poster")?.get(language)?.length || 0}
                />
              </Space>
            </Radio.Button>
            <Radio.Button value={"backdrop"}>
              <Space direction={"horizontal"}>
                <Typography.Text>Backdrops</Typography.Text>
                <Badge
                  size={"small"}
                  color={"#999999"}
                  showZero={true}
                  count={
                    imageTypeMap.get("backdrop")?.get(language)?.length || 0
                  }
                />
              </Space>
            </Radio.Button>
          </Radio.Group>
          <Space direction={"horizontal"} size={8}>
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
        <Space style={{ width: "100%", padding: 16 }}>
          <CollectionImageList
            images={imageTypeMap.get(imageType)!.get(language)!}
          />
        </Space>
      </Space>
    );
  }

  return content;
};
export default CollectionImagesPanel;
