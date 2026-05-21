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
### NZBGET POST-PROCESSING SCRIPT                               ###

# Publishes all scan events to a RabbbitMQ exchange.
#
# <@NZBGET-VERSION:21.1>
#
# --- NZBGET SCRIPT: Dionysus-Queue-Publisher ---

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
    print("dionysus-post-process.py` is running.")
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
