import {
  sendAmqpTestMessage,
  type TestRequest,
} from "@ncfritz/olympus-sdk/olympus";
import { client } from "@ncfritz/olympus-sdk/minerva";

class AdminApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  async sendAmqpTestMessage(
    exchange: string,
    payload: Record<string, unknown>,
    routingKey?: string,
  ) {
    await sendAmqpTestMessage({
      path: {
        exchange: exchange,
      },
      query: {
        routingKey: routingKey,
      },
      // The endpoint publishes the request body verbatim, so a consumer sees
      // exactly what is sent here. The spec declares a { payload } envelope
      // that nothing unwraps, hence the cast; see the roadmap.
      body: payload as TestRequest,
    });
  }
}

const adminaApi = new AdminApi();
export default adminaApi;
