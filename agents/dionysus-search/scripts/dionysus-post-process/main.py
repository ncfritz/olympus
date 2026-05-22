#!/usr/bin/env python3
import os
import time
import sys

from pathlib import Path

# Add to the beginning of the search path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.common import publish_message, run_script_harness

###################################################################
### NZBGET POST-PROCESSING SCRIPT                               ###

# Publishes all POST-PROCESSING events to a RabbbitMQ exchange.
#
# NOTE: This script requires https://github.com/pika/pika to be installed and available to to local Python environment

### NZBGET POST-PROCESSING SCRIPT                               ###
###################################################################
def do_work():
    publish_message({
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
    }, "download.update", "update.queue")


if __name__ == "__main__":
    run_script_harness(do_work)