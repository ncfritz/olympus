import {
  EyeOutlined,
  HeartOutlined,
} from "@ant-design/icons";
import type { SparseMovie } from "@ncfritz/olympus-sdk/dionysus";
import { Badge, List } from "antd";
import Link from "next/link";
import MoviePosterCard from "./MoviePosterCard";

export interface MovieListProps {
  movies: SparseMovie[];
  loading: boolean;
  showReleaseYear?: boolean;
  showReleaseStatus?: boolean;
  columns?: number;
}

const MovieList: React.FunctionComponent<MovieListProps> = ({
  movies,
  loading,
  showReleaseYear = true,
  showReleaseStatus = true,
  columns = 12,
}: MovieListProps) => {
  return (
    <List
      grid={{ gutter: 16, column: columns }}
      dataSource={movies}
      loading={loading}
      renderItem={(item) => {
        return (
          <List.Item>
            <Badge.Ribbon style={{ fontSize: "9px" }} text={"In Library"}>
              <Link href={`/dionysus/movies/${item.id}`}>
                <MoviePosterCard
                  movie={item}
                  showReleaseYear={showReleaseYear}
                  showReleaseStatus={showReleaseStatus}
                  showTitle={true}
                  hoverable={true}
                  className={"compact"}
                  actions={[
                    <HeartOutlined
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    />,
                    <EyeOutlined
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    />,
                  ]}
                />
              </Link>
            </Badge.Ribbon>
          </List.Item>
        );
      }}
    />
  );
};
export default MovieList;
