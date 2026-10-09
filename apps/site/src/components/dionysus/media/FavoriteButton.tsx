import { HeartFilled, HeartOutlined } from "@ant-design/icons";
import type { MediaAssetSearchType } from "@ncfritz/olympus-sdk/dionysus";
import { Button } from "antd";
import React, { useState } from "react";
import mediaApi from "../../../api/mediaApi";
import { Events, publish } from "../../../utils/events";

export interface FavoritButtonProps {
  favorite: boolean;
  mediaType: MediaAssetSearchType;
  mediaId: number;
  afterUpdate?: (favorite: boolean) => Promise<void>;
}

const FavoriteButton: React.FunctionComponent<FavoritButtonProps> = ({
  favorite,
  mediaType,
  mediaId,
  afterUpdate,
}) => {
  const [value, setValue] = useState(favorite);
  const [updating, setUpdating] = useState(false);

  const toggleFavorite = async () => {
    try {
      setUpdating(true);

      if (value) {
        await mediaApi.deleteMediaFavorite(mediaType, mediaId);
      } else {
        await mediaApi.createMediaFavorite(mediaType, mediaId);
      }

      if (afterUpdate) {
        await afterUpdate(!value);
      }

      publish(Events.DIONYSUS_MEDIA_FAVORITE_UPDATED, !value);

      setValue(!value);
    } finally {
      setUpdating(false);
    }
  };
  return (
    <Button
      className={"dionysus-action-button"}
      shape={"circle"}
      size={"large"}
      icon={
        value ? (
          <HeartFilled style={{ color: value ? "#ff4d4f" : undefined }} />
        ) : (
          <HeartOutlined />
        )
      }
      loading={updating}
      onClick={toggleFavorite}
    />
  );
};
export default FavoriteButton;
