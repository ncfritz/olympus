import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { Module } from "@nestjs/common";

const AMQP_PROTOCOL = process.env.AMQP_PROTOCOL || "amqp";
const AMQP_HOST = process.env.AMQP_HOST || "localhost";
const AMQP_PORT = process.env.AMQP_PORT || 5672;
const AMQP_USER = process.env.AMQP_USER || "admin";
const AMQP_PASSWORD = process.env.AMQP_PASSWORD || "admin";
const AMQP_VHOST = process.env.AMQP_VHOST || "/dionysus";

@Module({
  imports: [
    RabbitMQModule.forRoot(RabbitMQModule, {
      exchanges: [
        {
          name: "batchJob.trigger",
          type: "topic",
        },
        {
          name: "metadataJob.trigger",
          type: "topic",
        },
      ],
      connectionInitOptions: { wait: true },
      enableControllerDiscovery: true,
      uri: `${AMQP_PROTOCOL}://${AMQP_USER}:${AMQP_PASSWORD}@${AMQP_HOST}:${AMQP_PORT}/${encodeURIComponent(AMQP_VHOST)}`,
    }),
    RabbitModule,
  ],
  exports: [RabbitMQModule],
  providers: [],
  controllers: [],
})
export class RabbitModule {}
