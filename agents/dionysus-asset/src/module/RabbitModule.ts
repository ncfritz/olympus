import { RabbitMQConfig, RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Module({
  imports: [
    RabbitMQModule.forRootAsync(RabbitMQModule, {
      inject: [ConfigService],
      useFactory: (config: ConfigService): RabbitMQConfig => {
        const amqpProtocol = config.get<string>("AMQP_PROTOCOL", "amqp");
        const amqpHost = config.get<string>("AMQP_HOST", "localhost");
        const amqpPort = config.get<string>("AMQP_PORT", "5672");
        const amqpUser = config.get<string>("AMQP_USER", "admin");
        const amqpPassword = config.get<string>("AMQP_PASSWORD", "admin");
        const amqpVhost = config.get<string>("AMQP_VHOST", "/dionysus");

        const amqpEndpoint = `${amqpProtocol}://${amqpUser}:${amqpPassword}@${amqpHost}:${amqpPort}/${encodeURIComponent(
          amqpVhost
        )}`;

        console.log(amqpEndpoint);

        return {
          exchanges: [
            {
              name: "content.trigger",
              type: "topic",
            },
          ],
          connectionInitOptions: { wait: true },
          enableControllerDiscovery: true,
          uri: amqpEndpoint,
        };
      },
    }),
  ],
  exports: [RabbitMQModule],
  providers: [],
  controllers: [],
})
export class RabbitModule {}
