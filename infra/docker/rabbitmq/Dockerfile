# RabbitMQ with the plugins Olympus uses (ADR 0019).
#
# The delayed-message exchange carries Olympus's retries and back-offs
# (`x-delay`, packages/messages). Each plugin release targets one RabbitMQ
# series, and the plugin is no longer maintained: RabbitMQ 4.3 removes
# Mnesia, where it keeps delayed messages. Stay on the 4.1 series until
# the delays move off it (docs/roadmap.md).
#
# Changing a version: update the plugin's checksum with it, or the build
# fails on the download.

ARG RABBITMQ_VERSION=4.1.0
ARG DELAYED_MESSAGE_VERSION=4.1.0

FROM rabbitmq:${RABBITMQ_VERSION}-management

ARG DELAYED_MESSAGE_VERSION

ADD --checksum=sha256:567f876378e70af9d949de4066bbb2fc30162b46bcbc9efe2430076b172e4a87 \
    --chown=rabbitmq:rabbitmq \
    https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/v${DELAYED_MESSAGE_VERSION}/rabbitmq_delayed_message_exchange-${DELAYED_MESSAGE_VERSION}.ez \
    ${RABBITMQ_HOME}/plugins/

RUN rabbitmq-plugins enable --offline \
      rabbitmq_delayed_message_exchange \
      rabbitmq_consistent_hash_exchange \
      rabbitmq_prometheus
