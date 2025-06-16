import "../styles/globals.css";
import "../styles/onair.css";
import "../styles/themis.css";
import "antd/dist/reset.css";
import "antd-css-utilities/utility.min.css";
import "react-day-picker/dist/style.css";
import { APIProvider } from "@vis.gl/react-google-maps";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import { CookiesProvider } from "react-cookie";
import { Provider } from "react-redux";
import { IoProvider } from "socket.io-react-hook";
import AuthWrapper from "../components/layout/AuthWrapper";
import { store } from "../redux/store";

const App = ({ Component, pageProps: { session, ...pageProps } }: AppProps) => {
  return (
    <IoProvider>
      <CookiesProvider>
        <APIProvider apiKey={"AIzaSyC9lBe6ekSrwsw5QUVoGzmM80vxB509SXM"}>
          <Provider store={store}>
            <SessionProvider session={session}>
              <AuthWrapper>
                <Component {...pageProps} />
              </AuthWrapper>
            </SessionProvider>
          </Provider>
        </APIProvider>
      </CookiesProvider>
    </IoProvider>
  );
};
export default App;
