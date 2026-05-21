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

RABBITMQ_HOST = os.environ["NZBOP_RABBITMQ_HOST"]
RABBITMQ_PORT = os.environ["NZBOP_RABBITMQ_PORT"]
RABBITMQ_USERNAME = os.environ["NZBOP_RABBITMQ_USERNAME"]
RABBITMQ_PASSWORD = os.environ["NZBOP_RABBITMQ_PASSWORD"]
RABBITMQ_VHOST = os.environ["NZBOP_RABBITMQ_VIRTUAL_HOST"]

EXCHANGE_NAME = "download.update"
EXCHANGE_TYPE = "topic"
ROUTING_KEY = "update.queue"

###################################################################
### NZBGET QUEUE SCRIPT                                         ###

# Publishes all QUEUE events to a RabbbitMQ exchange.
#
# NOTE: This script requires https://github.com/pika/pika to be installed and available to local Python environment

### NZBGET QUEUE SCRIPT                                         ###
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
        "type": "queue",
        "ts": time.time_ns(),
        "destDirectory": os.getenv("NZBNA_DIRECTORY"),
        "nzbFilename": os.getenv("NZBNA_FILENAME"),
        "nzbName": os.getenv("NZBNA_NZBNAME"),
        "nzbUrl": os.getenv("NZBNA_URL"),
        "category": os.getenv("NZBNA_CATEGORY"),
        "priority": os.getenv("NZBNA_PRIORITY"),
        "nzbId": os.getenv("NZBNA_NZBID"),
        "event": os.getenv("NZBNA_EVENT"),
        "status": os.getenv("NZBNA_URLSTATUS"),
        "deleteStatus": os.getenv("NZBNA_DELETESTATUS"),
    }
    publish_message(message)

    sys.exit(POSTPROCESS_SUCCESS)
