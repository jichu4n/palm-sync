#!/bin/bash

cd "$(dirname "$0")"
set -ex

xhost +
docker run --rm -it \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v "$PWD/data":/opt/data \
  --net host \
  pose "$@"

