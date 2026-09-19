# @ncfritz/olympus-messages

The RabbitMQ contracts between the API and the agents: exchange names,
routing keys and message payload types. The publisher and every consumer
compile against the same definitions, so a renamed field or key fails the
build instead of silently dropping messages.

- `notifications.ts`: the API's SendNotification → the notification agent.

Types only describe the wire format; they use string unions rather than
the model's enums so agents don't depend on the model.
