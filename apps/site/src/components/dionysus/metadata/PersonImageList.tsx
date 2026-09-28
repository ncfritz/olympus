import type { BaseImage } from "@ncfritz/olympus-sdk/dionysus";
import { Empty, List, Space } from "antd";
import PersonProfileCard from "./PersonProfileCard";

export interface PersonImageListProps {
  images: BaseImage[];
}

const MovieImageList: React.FunctionComponent<PersonImageListProps> = ({
  images,
}: PersonImageListProps) => {
  let content = (
    <Space style={{ width: "100%", padding: 32 }}>
      <Empty />
    </Space>
  );

  if (images?.length > 0) {
    content = (
      <List
        grid={{ gutter: 16, column: 8 }}
        dataSource={images}
        renderItem={(item) => {
          return (
            <List.Item>
              <PersonProfileCard image={item} />
            </List.Item>
          );
        }}
      />
    );
  }

  return content;
};
export default MovieImageList;
