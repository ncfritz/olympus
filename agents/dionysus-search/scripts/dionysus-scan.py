#!/usr/bin/env python3
import os

import sys
import pika
import json
import time

# Exit codes used by NZBGet
POSTPROCESS_SUCCESS = 93
POSTPROCESS_ERROR = 94
POSTPROCESS_SKIP = 95

RABBITMQ_HOST = "snowball.desktop.ncfritz.net"
RABBITMQ_PORT = 5672
RABBITMQ_USERNAME = "admin"
RABBITMQ_PASSWORD = "admin"
RABBITMQ_VHOST="/dionysus-dev"

EXCHANGE_NAME = "download.update"
EXCHANGE_TYPE = "topic"  # change if your exchange uses a different type
ROUTING_KEY = "update.queue"

###################################################################
### NZBGET SCAN SCRIPT                                          ###

# Publishes all scan events to a RabbbitMQ exchange.
#
# <@NZBGET-VERSION:21.1>
#
# --- NZBGET SCRIPT: Dionysus-Queue-Publisher ---

### NZBGET SCAN SCRIPT                                          ###
###################################################################
def publish_message(message):
    # Create credentials
    credentials = pika.PlainCredentials(RABBITMQ_USERNAME, RABBITMQ_PASSWORD)

    # Connect to RabbitMQ
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host=RABBITMQ_HOST,
            port=RABBITMQ_PORT,
            virtual_host=RABBITMQ_VHOST,
            credentials=credentials)
    )
    channel = connection.channel()

    # Declare the exchange (safe even if it already exists)
    channel.exchange_declare(
        exchange=EXCHANGE_NAME,
        exchange_type=EXCHANGE_TYPE,
        durable=True
    )

    # Publish the message
    channel.basic_publish(
        exchange=EXCHANGE_NAME,
        routing_key=ROUTING_KEY,
        body=json.dumps(message),
        properties=pika.BasicProperties(
            content_type="application/json",
            delivery_mode=2  # make message persistent
        )
    )

    print("Message published to exchange:", EXCHANGE_NAME)

    connection.close()

if __name__ == "__main__":
    message = {
        "type": "scan",
        "ts": time.time_ns(),
        "nzbDirectory": os.getenv("NZBNP_DIRECTORY"),
        "nzbFilename": os.getenv("NZBNP_FILENAME"),
        "nzbName": os.getenv("NZBNP_NZBNAME"),
        "nzbUrl": os.getenv("NZBNP_URL"),
        "category": os.getenv("NZBNP_CATEGORY"),
        "priority": os.getenv("NZBNA_PRIORITY"),
        "top": os.getenv("NZBNP_TOP"),
        "paused": os.getenv("NZBNP_PAUSED"),
        "dupeKey": os.getenv("NZBNP_DUPEKEY"),
        "dupeScore": os.getenv("NZBNP_DUPESCORE"),
        "dupeMode": os.getenv("NZBNP_DUPEMODE"),
    }
    publish_message(message)

    sys.exit(POSTPROCESS_SUCCESS)
