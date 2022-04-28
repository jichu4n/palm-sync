#!/bin/bash

cd "$(dirname "$0")"
docker run --rm -it \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  --net host \
  pose "$@"

