#!/usr/bin/env python3
import os
import time
import sys

from pathlib import Path

# Add to the beginning of the search path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.common import publish_message, run_script_harness

###################################################################
### NZBGET QUEUE SCRIPT                                         ###

# Publishes all QUEUE events to a RabbbitMQ exchange.
#
# NOTE: This script requires https://github.com/pika/pika to be installed and available to local Python environment

### NZBGET QUEUE SCRIPT                                         ###
###################################################################
def do_work():
    publish_message({
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
    }, "download.update", "update.queue")

if __name__ == "__main__":
    run_script_harness(do_work)
