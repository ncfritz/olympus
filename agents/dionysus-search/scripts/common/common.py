import os
import sys
import pika
import json

# Exit codes used by NZBGet
COMMAND_SUCCESS = 93
COMMAND_ERROR = 94
COMMAND_SKIP = 95

def run_script_harness(worker):
    try:
        command = os.environ.get("NZBCP_COMMAND")
        test_mode = command == "ConnectionTest"

        if command is not None and not test_mode:
            print(f"[ERROR] Invalid command {command}")
            sys.exit(COMMAND_ERROR)

        if test_mode:
            print("Attempt to connect to RabbitMQ broker:")
            print(f"          Host: {os.environ['NZBPO_RABBITMQ_HOST']}")
            print(f"          Port: {os.environ['NZBPO_RABBITMQ_PORT']}")
            print(f"  Virtual Host: {os.environ['NZBPO_RABBITMQ_VHOST']}")

            connection = get_connection()
            print("Connection successful... disconnecting...")
            connection.close()

            sys.exit(COMMAND_SUCCESS)
        else:
            worker()
            sys.exit(COMMAND_SUCCESS)
    except Exception as e:
        print(f"Failed to publish message: {e}")
        sys.exit(COMMAND_ERROR)

def get_connection():
    rabbitmq_host = os.environ["NZBPO_RABBITMQ_HOST"]
    rabbitmq_port = os.environ["NZBPO_RABBITMQ_PORT"]
    rabbitmq_username = os.environ["NZBPO_RABBITMQ_USERNAME"]
    rabbitmq_password = os.environ["NZBPO_RABBITMQ_PASSWORD"]
    rabbitmq_vhost = os.environ["NZBPO_RABBITMQ_VHOST"]

    # Create credentials
    credentials = pika.PlainCredentials(rabbitmq_username, rabbitmq_password)

    return pika.BlockingConnection(
        pika.ConnectionParameters(
            host=rabbitmq_host,
            port=rabbitmq_port,
            virtual_host=rabbitmq_vhost,
            credentials=credentials
        )
    )

def publish_message(message, exchange, routing_key):
    # Connect to RabbitMQ
    connection = get_connection()
    channel = connection.channel()

    # Declare the exchange (safe even if it already exists)
    channel.exchange_declare(
        exchange=exchange,
        exchange_type="topic",
        durable=True
    )

    # Publish the message
    channel.basic_publish(
        exchange=exchange,
        routing_key=routing_key,
        body=json.dumps(message),
        properties=pika.BasicProperties(
            content_type="application/json",
            delivery_mode=2  # make message persistent
        )
    )

    print("Message published to exchange:", exchange)

    connection.close()