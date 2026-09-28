import type { TypedImage } from "@ncfritz/olympus-sdk/dionysus";
import { Empty, List, Space } from "antd";
import type { ReactNode } from "react";
import MovieImageBackdropCard from "./MovieImageBackdropCard";
import MovieLogoCard from "./MovieImageLogoCard";
import MovieImagePosterCard from "./MovieImagePosterCard";

export interface MovieImageListProps {
  images: TypedImage[];
  imageBackgroundColor?: string;
}

type MovieImageRenderer = (
  img: TypedImage,
  backgroundColor?: string,
) => ReactNode;

const posterRenderer: MovieImageRenderer = (img) => {
  return <MovieImagePosterCard image={img} />;
};

const backdropRenderer: MovieImageRenderer = (img) => {
  return <MovieImageBackdropCard image={img} />;
};

const logoRenderer: MovieImageRenderer = (img, backgroundColor) => {
  return <MovieLogoCard image={img} backgroundColor={backgroundColor} />;
};

const MovieImageList: React.FunctionComponent<MovieImageListProps> = ({
  images,
  imageBackgroundColor,
}: MovieImageListProps) => {
  let content = (
    <Space style={{ width: "100%", padding: 32 }}>
      <Empty />
    </Space>
  );

  if (images && images?.length > 0) {
    let columns = 5;
    let renderer = posterRenderer;

    if (images[0].type === "backdrop") {
      renderer = backdropRenderer;
      columns = 3;
    } else if (images[0].type === "logo") {
      renderer = logoRenderer;
    }

    content = (
      <List
        grid={{ gutter: 16, column: columns }}
        dataSource={images}
        renderItem={(item) => {
          return <List.Item>{renderer(item, imageBackgroundColor)}</List.Item>;
        }}
      />
    );
  }

  return content;
};
export default MovieImageList;
