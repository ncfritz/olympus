"use client";

import { useSession } from "next-auth/react";
import Head from "next/head";
import { useCallback, useEffect } from "react";
import { useCookies } from "react-cookie";
import SignInPage from "../../pages/auth/signin";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setCurtain } from "../../redux/slices/blackCurtainSlice";
import { Events, publish } from "../../utils/events";
import AuthLayout from "./AuthLayout";
import NoAuthLayout from "./NoAuthLayout";

export interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FunctionComponent<AuthWrapperProps> = ({
  children,
}) => {
  const dispatch = useAppDispatch();
  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );
  const [cookies, setCookie, removeCookie] = useCookies([
    "x-ncfritz-dionysus-content-bc",
    "x-dionysus-content-auth",
  ]);

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (event.metaKey && event.shiftKey && event.key === "k") {
      console.log("Deploying BlackCurtain");
      dispatch(setCurtain(true));
      removeCookie("x-dionysus-content-auth", { path: "/", secure: true });
      publish(Events.DIONYSUS_BLACK_CURTAIN_LOCK);
    }
  }, []);

  useEffect(() => {
    const parsedVale =
      String(cookies["x-ncfritz-dionysus-content-bc"]) === "true";
    console.log(
      `Reading value from x-ncfritz-dionysus-content-bc[${cookies["x-ncfritz-dionysus-content-bc"]}]: ${parsedVale}`,
    );
    dispatch(setCurtain(parsedVale));
  }, []);

  useEffect(() => {
    if (blackCurtainEnabled !== undefined) {
      console.log(
        `Setting x-ncfritz-dionysus-content-bc=${blackCurtainEnabled}`,
      );
      setCookie("x-ncfritz-dionysus-content-bc", blackCurtainEnabled, {
        path: "/",
        secure: true,
      });
    }
  }, [blackCurtainEnabled]);

  useEffect(() => {
    // attach the event listener
    document.addEventListener("keydown", handleKeyPress);

    // remove the event listener
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  const { data: session } = useSession();
  let content;

  if (session) {
    content = <AuthLayout>{children}</AuthLayout>;
  } else {
    content = (
      <NoAuthLayout>
        <SignInPage />
      </NoAuthLayout>
    );
  }

  return (
    <div>
      <Head>
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="/favicon/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon/favicon-16x16.png"
        />
        <link rel="manifest" href="/favicon/site.webmanifest" />
        <link
          rel="mask-icon"
          href="/favicon/safari-pinned-tab.svg"
          color="#5bbad5"
        />
        <link rel="shortcut icon" href="/favicon/favicon.ico" />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta
          name="msapplication-config"
          content="/favicon/browserconfig.xml"
        />
        <meta name="theme-color" content="#ffffff" />
      </Head>
      {content}
    </div>
  );
};
export default AuthWrapper;
