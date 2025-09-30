import {
  DribbbleOutlined,
  FacebookFilled,
  GlobalOutlined,
  InstagramOutlined,
  QuestionCircleOutlined,
  TwitterOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type {
  BaseImage,
  BasePerson,
  BaseTvSeries,
  SparseMovie,
  TypedImage,
} from "@ncfritz/olympus-sdk/dionysus";
import { Image, type MenuProps, Space, Typography } from "antd";

export const getReleaseStatusForMovie = (
  movie: SparseMovie,
): [string, string] => {
  let statusColor = "#efefef";
  let statusText = "Unknown";

  if (movie.status) {
    statusText = movie.status;

    switch (statusText) {
      case "Canceled":
        statusColor = "#7d0000";
        break;
      case "In Production":
        statusColor = "#c5981c";
        break;
      case "Planned":
        statusColor = "#2657a8";
        break;
      case "Post Production":
        statusColor = "#a3d622";
        break;
      case "Released":
        statusColor = "#488633";
        break;
      case "Rumored":
        statusColor = "#672a67";
        break;
    }
  }

  return [statusText, statusColor];
};

export const getStatusForTvSeries = (
  tvSeries: BaseTvSeries,
): [string, string] => {
  let statusColor = "#efefef";
  let statusText = "Unknown";

  if (tvSeries.status) {
    statusText = tvSeries.status;

    switch (statusText) {
      case "Canceled":
        statusColor = "#7d0000";
        break;
      case "Ended":
        statusColor = "#2657a8";
        break;
      case "In Production":
        statusColor = "#c5981c";
        break;
      case "Pilot":
        statusColor = "#a3d622";
        break;
      case "Returning Series":
        statusColor = "#488633";
        break;
      case "Planned":
        statusColor = "#672a67";
        break;
    }
  }

  return [statusText, statusColor];
};

export const getExternalIdIcon = (type: string) => {
  switch (type) {
    case "facebook":
      return <FacebookFilled />;
    case "imdb":
      return <DribbbleOutlined />;
    case "instagram":
      return <InstagramOutlined />;
    case "twitter":
      return <TwitterOutlined />;
    case "wikidata":
      return <GlobalOutlined />;
    default:
      return <QuestionCircleOutlined />;
  }
};

export const getReleaseTypeName = (type: number) => {
  switch (type) {
    case 1:
      return "Premiere";
    case 2:
      return "Theatrical (limited)";
    case 3:
      return "Theatrical";
    case 4:
      return "Digital";
    case 5:
      return "Physical";
    case 6:
      return "TV";
    default:
      return "Unknown";
  }
};

export const getProgressColor = (value: number) => {
  if (value >= 100) return "#57bb8a";
  if (value >= 95) return "#63b682";
  if (value >= 90) return "#73b87e";
  if (value >= 85) return "#84bb7b";
  if (value >= 80) return "#94bd77";
  if (value >= 75) return "#a4c073";
  if (value >= 70) return "#b0be6e";
  if (value >= 65) return "#c4c56d";
  if (value >= 60) return "#d4c86a";
  if (value >= 55) return "#e2c965";
  if (value >= 50) return "#f5ce62";
  if (value >= 45) return "#f3c563";
  if (value >= 40) return "#e9b861";
  if (value >= 35) return "#e6ad61";
  if (value >= 30) return "#ecac67";
  if (value >= 25) return "#e9a268";
  if (value >= 20) return "#e5926b";
  if (value >= 15) return "#e2886c";
  if (value >= 10) return "#e0816d";
  if (value >= 5) return "#e0816d";

  return "#dd776e";
};

export const getImageDropdownOptions = (
  resolutions: Map<string, number>,
  image: TypedImage | BaseImage,
) => {
  const items: MenuProps["items"] = [];

  resolutions.entries().forEach((e) => {
    items.push({
      key: e[0],
      label: (
        <Typography.Text
          style={{ fontSize: "11px" }}
          copyable={{
            text: `https://image.tmdb.org/t/p/${e[0]}${image.filePath}`,
          }}
        >{`${e[1]}px x ${Math.floor((e[1] / image.width) * image.height)}px`}</Typography.Text>
      ),
    });
  });

  items.push({
    key: "original",
    label: (
      <Typography.Text
        style={{ fontSize: "11px" }}
        copyable={{
          text: `https://image.tmdb.org/t/p/original${image.filePath}`,
        }}
      >
        {`${image.width}px x ${image.height}px`}
      </Typography.Text>
    ),
  });

  return items;
};

export const getPersonCardImageHorizontal = (person: BasePerson) => {
  return person.profilePath ? (
    <Image
      width={75}
      src={`https://image.tmdb.org/t/p/h632/${person.profilePath}}`}
      alt={"Poster"}
      preview={false}
      style={{ borderRadius: 8, aspectRatio: "calc(2 / 3)", margin: 8 }}
    />
  ) : (
    <Space
      style={{
        width: 75,
        aspectRatio: "calc(2 / 3)",
        backgroundColor: "#eeeeee",
        borderRadius: 8,
        margin: 8,
        justifyContent: "center",
      }}
      styles={{
        item: {
          display: "flex",
          alignContent: "center",
          justifyContent: "center",
          height: "100%",
        },
      }}
    >
      <UserOutlined style={{ fontSize: "64px", color: "#dddddd" }} />
    </Space>
  );
};

export const getPersonCardImageVertical = (person: BasePerson) => {
  return person.profilePath ? (
    <Image
      src={`https://image.tmdb.org/t/p/h632/${person.profilePath}}`}
      alt={"Profile"}
      style={{
        borderTopRightRadius: "inherit",
        borderTopLeftRadius: "inherit",
      }}
      preview={false}
    />
  ) : (
    <Space
      style={{
        aspectRatio: "calc(2 / 3)",
        backgroundColor: "#eeeeee",
      }}
      styles={{
        item: {
          display: "flex",
          alignContent: "center",
          justifyContent: "center",
          height: "100%",
        },
      }}
    >
      <UserOutlined style={{ fontSize: "64px", color: "#dddddd" }} />
    </Space>
  );
};
