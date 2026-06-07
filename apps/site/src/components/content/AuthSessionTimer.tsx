import { CloseCircleFilled } from "@ant-design/icons";
import { Button, Progress, Space, Typography } from "antd";
import prettyMilliseconds from "pretty-ms";
import { useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import { decodeJwt } from "jose";
import { Events, publish } from "../../utils/events";

export interface AuthSessionTimerProps {}

const GRADIENTS = [
  "#eb0000",
  "#eb0900",
  "#eb1100",
  "#eb1600",
  "#ec1b00",
  "#ec1f00",
  "#ec2300",
  "#ec2700",
  "#ed2a00",
  "#ed2d00",
  "#ed3000",
  "#ed3300",
  "#ed3500",
  "#ee3800",
  "#ee3b00",
  "#ee3d00",
  "#ee4000",
  "#ee4200",
  "#ee4500",
  "#ee4700",
  "#ee4900",
  "#ed4c00",
  "#ed4e00",
  "#ed5000",
  "#ed5300",
  "#ed5500",
  "#ec5700",
  "#ec5900",
  "#ec5c00",
  "#eb5e00",
  "#eb6000",
  "#eb6200",
  "#ea6400",
  "#e96700",
  "#e96900",
  "#e86b00",
  "#e86d00",
  "#e76f00",
  "#e67100",
  "#e67300",
  "#e57500",
  "#e47800",
  "#e37a00",
  "#e27c00",
  "#e17e00",
  "#e08000",
  "#df8200",
  "#de8400",
  "#dd8600",
  "#dc8800",
  "#db8a00",
  "#da8c00",
  "#d98e00",
  "#d79000",
  "#d69200",
  "#d59400",
  "#d39600",
  "#d29800",
  "#d09a00",
  "#cf9c00",
  "#cd9e00",
  "#cb9f00",
  "#caa100",
  "#c9a300",
  "#c8a400",
  "#c7a600",
  "#c6a800",
  "#c4a900",
  "#c3ab00",
  "#c1ad00",
  "#c0ae00",
  "#beb000",
  "#bcb200",
  "#bab400",
  "#b8b600",
  "#b6b700",
  "#b3b900",
  "#b1bb00",
  "#aebd00",
  "#abbf00",
  "#a8c100",
  "#a5c200",
  "#a2c400",
  "#9ec600",
  "#9bc800",
  "#97ca00",
  "#92cc00",
  "#8ece00",
  "#89d000",
  "#84d200",
  "#7ed400",
  "#78d600",
  "#71d800",
  "#6ada08",
  "#61dc11",
  "#58de18",
  "#4ce01e",
  "#3fe223",
  "#2be429",
  "#00e62e",
];

const AuthSessionTimer: React.FunctionComponent<
  AuthSessionTimerProps
> = ({}: AuthSessionTimerProps) => {
  const [cookies, setCookie, removeCookie] = useCookies([
    "x-dionysus-content-auth",
  ]);
  const [percent, setPercent] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);

  let timer: NodeJS.Timeout | undefined = undefined;

  const destroy = () => {
    setRemainingMs(0);
    setPercent(0);

    clearTimeout(timer);
    timer = undefined;
    removeCookie("x-dionysus-content-auth", {
      path: "/",
      secure: true,
    });
    publish(Events.DIONYSUS_BLACK_CURTAIN_LOCK);
  };

  useEffect(() => {
    const authPresent = cookies["x-dionysus-content-auth"] !== undefined;
    console.log("Auth Present: ", authPresent);

    if (authPresent) {
      const jwt = decodeJwt(cookies["x-dionysus-content-auth"]);
      console.log(jwt);

      if (!timer && jwt) {
        console.log("Creating timer...");

        const expirationTime = jwt.exp;
        const lifetime = jwt.exp! - jwt.iat!;

        timer = setInterval(() => {
          const now = Date.now() / 1000;
          const newPercent = ((expirationTime! - now) / lifetime!) * 100;
          const remainingTime = (expirationTime! - now) * 1000;
          console.log(
            `Now: ${now}, Exp: ${expirationTime}, Lifetime: ${lifetime}, Remaining: ${expirationTime! - now}, Percent: ${newPercent}, Remaining: ${remainingTime}`,
          );

          if (remainingTime <= 0) {
            destroy();
          }

          setPercent(newPercent);
          setRemainingMs((expirationTime! - now) * 1000);
        }, 1000);
      }
    } else {
      if (timer) {
        console.log("Auth not present, clearing timer...");
        destroy();
      }
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
  }, [cookies]);

  if (percent <= 0 || remainingMs <= 0) {
    return undefined;
  }

  const color = GRADIENTS[Math.floor(percent)];

  return (
    <Space
      direction={"vertical"}
      size={0}
      style={{ width: 350, justifyContent: "center" }}
      styles={{ item: { height: 16, display: "flex" } }}
    >
      <Space orientation={"horizontal"} size={4}>
        <Typography.Text
          style={{
            fontSize: "11px",
            color: "#efefef99",
            lineHeight: "20px",
            display: "flex",
          }}
        >
          Content session remaining:
        </Typography.Text>
        <Typography.Text
          style={{
            fontSize: "11px",
            color: "#efefef",
            lineHeight: "20px",
            display: "flex",
          }}
          strong={true}
        >
          {remainingMs
            ? prettyMilliseconds(remainingMs, { secondsDecimalDigits: 0 })
            : "Unknown"}
        </Typography.Text>
      </Space>
      <Space
        direction={"horizontal"}
        size={2}
        style={{ display: "flex", alignItems: "center" }}
      >
        <Progress
          percent={percent}
          size={"small"}
          style={{ width: 300 }}
          trailColor={"#efefef33"}
          strokeColor={{ from: color, to: `${color}66` }}
          format={() => ""}
        />
        <Button
          size={"small"}
          icon={<CloseCircleFilled />}
          type={"link"}
          danger={true}
          onClick={() => {
            destroy();
          }}
        />
      </Space>
    </Space>
  );
};
export default AuthSessionTimer;
