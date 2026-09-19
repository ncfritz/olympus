import type { EnvReader } from "./EnvReader";

export type AmqpConfig = {
  host: string;
  uri: string;
  /** `uri` with the password masked: log this, never `uri`. */
  redactedUri: string;
};

/**
 * AMQP_PROTOCOL, AMQP_HOST, AMQP_PORT, AMQP_USER, AMQP_PASSWORD and
 * AMQP_VHOST (default `defaultVhost`).
 */
export const readAmqpConfig = (
  read: EnvReader,
  defaultVhost: string,
): AmqpConfig => {
  const protocol = read.oneOf("AMQP_PROTOCOL", ["amqp", "amqps"], "amqp");
  const host = read.string("AMQP_HOST", "localhost");
  const port = read.port("AMQP_PORT", 5672);
  const user = read.string("AMQP_USER", "admin");
  const password = read.string("AMQP_PASSWORD", "admin");
  const vhost = encodeURIComponent(read.string("AMQP_VHOST", defaultVhost));
  const address = `${host}:${port}/${vhost}`;
  return {
    host,
    uri: `${protocol}://${user}:${password}@${address}`,
    redactedUri: `${protocol}://${user}:***@${address}`,
  };
};
