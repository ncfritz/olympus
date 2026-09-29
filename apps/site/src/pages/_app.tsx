import "../styles/globals.css";
import "../styles/onair.css";
import "../styles/themis.css";
import "../styles/dionysus.css";
import "../styles/breadcrumbs.css";
import "antd/dist/reset.css";
import "antd-css-utilities/utility.min.css";
import "react-day-picker/dist/style.css";
import "plyr-react/plyr.css";
import { APIProvider } from "@vis.gl/react-google-maps";
import type { AppProps } from "next/app";
import { CookiesProvider } from "react-cookie";
import { Provider } from "react-redux";
import { AuthProvider } from "../auth/AuthProvider";
import AuthWrapper from "../components/layout/AuthWrapper";
import { store } from "../redux/store";
import { GOOGLE_MAPS_API_KEY } from "../utils/constants";

const App = ({ Component, pageProps }: AppProps) => {
  return (
    <CookiesProvider>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Provider store={store}>
          <AuthProvider>
            <AuthWrapper>
              <Component {...pageProps} />
            </AuthWrapper>
          </AuthProvider>
        </Provider>
      </APIProvider>
    </CookiesProvider>
  );
};
export default App;
