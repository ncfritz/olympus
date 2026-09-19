/**
 * Exchanges, routes and the helpers that publish and subscribe with them.
 * A route binds an exchange, a routing key and the payload type, so a
 * publisher can't send a payload the consumers don't expect.
 */

export type ExchangeType =
  "topic" | "direct" | "fanout" | "headers" | "x-delayed-message";

/** An exchange as @golevelup/nestjs-rabbitmq declares it. */
export interface ExchangeDefinition {
  readonly name: string;
  readonly type: ExchangeType;
  readonly options?: { arguments?: Record<string, unknown> };
}

export const exchange = (
  name: string,
  type: Exclude<ExchangeType, "x-delayed-message">,
): ExchangeDefinition => ({ name, type });

/**
 * An exchange of the delayed-message plugin: messages carry an `x-delay`
 * header (milliseconds; see delayed()) and are routed like `delayedType`.
 */
export const delayedExchange = (
  name: string,
  delayedType: "topic" | "direct" | "fanout",
): ExchangeDefinition => ({
  name,
  type: "x-delayed-message",
  options: { arguments: { "x-delayed-type": delayedType } },
});

/** Where a message of type P goes. */
export interface MessageRoute<P> {
  readonly exchange: ExchangeDefinition;
  readonly routingKey: string;
  /** Type marker only; never set. */
  readonly __payload?: P;
}

export const route = <P>(
  exchange: ExchangeDefinition,
  routingKey: string,
): MessageRoute<P> => ({ exchange, routingKey });

/** Anything that publishes like @golevelup's AmqpConnection. */
export interface MessagePublisher {
  publish(
    exchange: string,
    routingKey: string,
    message: unknown,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
}

/** Publishes a message on its route. `options` are amqplib publish options. */
export const publishMessage = <P>(
  publisher: MessagePublisher,
  route: MessageRoute<P>,
  message: P,
  options?: Record<string, unknown>,
): Promise<unknown> =>
  options === undefined
    ? publisher.publish(route.exchange.name, route.routingKey, message)
    : publisher.publish(
        route.exchange.name,
        route.routingKey,
        message,
        options,
      );

/** Publish options for a persistent message delayed by `ms`. */
export const delayed = (ms: number) => ({
  persistent: true,
  headers: { "x-delay": ms },
});

/** @RabbitSubscribe options for consuming a route from `queue`. */
export const subscription = <P>(route: MessageRoute<P>, queue: string) => ({
  exchange: route.exchange.name,
  routingKey: route.routingKey,
  queue,
});

/** Exchange declarations for RabbitMQModule's `exchanges`. */
export const declare = (...exchanges: ExchangeDefinition[]) =>
  exchanges.map(({ name, type, options }) => ({ name, type, options }));
