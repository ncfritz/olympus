#!/bin/sh
# Reloads nginx when Harpocrates deploys a certificate (ADR 0020, Renewal
# and delivery: deploy targets). Harpocrates writes each target's files
# into its own directory under /srv/harpocrates/deployed, its `deployed`
# file last; this watches those files and, when any changes, reloads nginx
# if its configuration still tests. Run once by the nginx image's
# entrypoint, it leaves the watch running in the background.
#
# Polling, not inotify: the image has no inotify tools, and a bind mount
# from macOS does not pass events through. Comparing the files' contents
# rather than their times does not miss two deploys in the same second.

set -eu

dir=${HARPOCRATES_DEPLOYED_DIR:-/srv/harpocrates/deployed}
interval=${HARPOCRATES_RELOAD_POLL_SECONDS:-10}
me=$(basename "$0")

if [ ! -d "$dir" ]; then
  echo "$me: no $dir: not watching for deployed certificates"
  exit 0
fi

state() {
  cat "$dir"/*/deployed 2>/dev/null | cksum
}

watch() {
  last=$(state)
  while sleep "$interval"; do
    now=$(state)
    [ "$now" = "$last" ] && continue
    last=$now
    if nginx -t -q; then
      nginx -s reload
      echo "$me: a certificate was deployed: reloaded"
    else
      echo "$me: a certificate was deployed, but the configuration does not test: not reloaded" >&2
    fi
  done
}

watch &
echo "$me: watching $dir every ${interval}s"
