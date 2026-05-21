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
### NZBGET POST-PROCESSING SCRIPT                               ###

# Publishes all POST-PROCESSING events to a RabbbitMQ exchange.
#
# NOTE: This script requires https://github.com/pika/pika to be installed and available to to local Python environment

### NZBGET POST-PROCESSING SCRIPT                               ###
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
        "type": "post-process",
        "ts": time.time_ns(),
        "destDirectory": os.getenv("NZBPP_DIRECTORY"),
        "nzbDirectory": os.getenv("NZBPP_FINALDIR"),
        "nzbFilename": os.getenv("NZBPP_NZBFILENAME"),
        "nzbName": os.getenv("NZBPP_NZBNAME"),
        "category": os.getenv("NZBPP_CATEGORY"),
        "status": os.getenv("NZBPP_STATUS"),
        "nzbId": os.getenv("NZBPP_NZBID"),
        "scriptStatus": os.getenv("NZBPP_SCRIPTSTATUS"),
        "parStatus": os.getenv("NZBPP_PARSTATUS"),
        "unpackStatus": os.getenv("NZBPP_UNPACKSTATUS"),
    }
    publish_message(message)

    sys.exit(POSTPROCESS_SUCCESS)
