#!/bin/bash
for ((i=1000; i>=1; i--)); do
  n=$(printf "%04d" $i)
  sed -i "s/e${i}/E$n/g" data.json
done
