#!/bin/bash
while true; do node discovery_gateway; done &
while true; do node cli.js --launch-visualizer 10000; done &
