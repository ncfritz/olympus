#!/usr/bin/env python3
import os
import time
import sys

from pathlib import Path

# Add to the beginning of the search path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.common import publish_message, run_script_harness

###################################################################
### NZBGET SCAN SCRIPT                                          ###

# Publishes all SCAN events to a RabbbitMQ exchange.
#
# NOTE: This script requires https://github.com/pika/pika to be installed and available to local Python environment

### NZBGET SCAN SCRIPT                                          ###
###################################################################
def do_work():
    publish_message({
        "type": "scan",
        "ts": time.time_ns(),
        "nzbDirectory": os.getenv("NZBNP_DIRECTORY"),
        "nzbFilename": os.getenv("NZBNP_FILENAME"),
        "nzbName": os.getenv("NZBNP_NZBNAME"),
        "nzbUrl": os.getenv("NZBNP_URL"),
        "category": os.getenv("NZBNP_CATEGORY"),
        "priority": os.getenv("NZBNP_PRIORITY"),
        "top": os.getenv("NZBNP_TOP"),
        "paused": os.getenv("NZBNP_PAUSED"),
        "dupeKey": os.getenv("NZBNP_DUPEKEY"),
        "dupeScore": os.getenv("NZBNP_DUPESCORE"),
        "dupeMode": os.getenv("NZBNP_DUPEMODE"),
    }, "download.update", "update.queue")

if __name__ == "__main__":
    run_script_harness(do_work)
