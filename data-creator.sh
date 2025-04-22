#!/bin/bash

# 動物のリスト
animals=("Cat" "Dog" "Lion" "Tiger" "Elephant" "Fox" "Rabbit" "Wolf" "Dolphin" "Bear"
         "Eagle" "Panda" "Giraffe" "Zebra" "Kangaroo" "Horse" "Penguin" "Otter" "Cheetah" "Leopard")

# 音楽のジャンルリスト
genres=("Rock" "Jazz" "Blues" "Classical" "Funk" "Reggae" "Metal" "HipHop" "Pop" "Folk"
        "Country" "Electro" "R&B" "Soul" "House" "Techno" "Dubstep" "Punk" "Salsa" "Trance")

echo '{'
echo '  "nodes": ['
echo '    { "id": "P0001", "address": "www.project-x.com", "name": "Project X", "type": "project", "links": [] },'
echo '    { "id": "P0002", "address": "www.project-y.com", "name": "Project Y", "type": "project", "links": [] },'
echo '    { "id": "P0003", "address": "www.project-z.com", "name": "Project Z", "type": "project", "links": [] },'
echo '    { "id": "D0001", "address": "", "name": "A domain", "type": "domain", "links": [] },'
echo '    { "id": "D0002", "address": "", "name": "B domain", "type": "domain", "links": [] },'
echo '    { "id": "D0003", "address": "", "name": "C domain", "type": "domain", "links": [] },'
echo '    { "id": "D0004", "address": "", "name": "D domain", "type": "domain", "links": [] },'
echo '    { "id": "D0005", "address": "", "name": "E domain", "type": "domain", "links": [] },'
echo '    { "id": "D0006", "address": "", "name": "F domain", "type": "domain", "links": [] },'
echo '    { "id": "D0007", "address": "", "name": "G domain", "type": "domain", "links": [] },'
echo '    { "id": "D0008", "address": "", "name": "H domain", "type": "domain", "links": [] },'
echo '    { "id": "D0009", "address": "", "name": "I domain", "type": "domain", "links": [] },'
echo '    { "id": "D0010", "address": "", "name": "J domain", "type": "domain", "links": [] },'
echo '    { "id": "S0001", "address": "", "name": "GitLab", "type": "service", "links": ["P0001"] },'
echo '    { "id": "S0002", "address": "", "name": "GitHub", "type": "service", "links": ["P0001"] },'
echo '    { "id": "S0003", "address": "", "name": "Jira", "type": "service", "links": ["P0001"] },'
echo '    { "id": "S0004", "address": "", "name": "Confluence", "type": "service", "links": ["P0001"] },'
echo '    { "id": "S0005", "address": "", "name": "X", "type": "service", "links": ["P0001"] },'
echo '    { "id": "S0006", "address": "", "name": "YouTube", "type": "service", "links": ["P0001"] },'
echo '    { "id": "S0007", "address": "", "name": "Grafana", "type": "service", "links": ["P0001"] },'
echo '    { "id": "S0008", "address": "", "name": "Slack", "type": "service", "links": ["P0001"] },'
echo '    { "id": "S0009", "address": "", "name": "RochetChat", "type": "service", "links": ["P0001"] },'
echo '    { "id": "S0010", "address": "", "name": "Instagram", "type": "service", "links": ["P0001"] },'
# 1000個のデータを生成1
for i in $(seq 1 999); do
    animal=${animals[$RANDOM % ${#animals[@]}]}
    genre=${genres[$RANDOM % ${#genres[@]}]}
    NAME=$(echo "$animal $genre")
    printf '    { "id": "U%04d", "address": "", "name": "%s", "type": "user", "links": ["P%04d", "D%04d"]   },\n' "${i}" "${NAME}" "$(($RANDOM % 3 + 1))" "$(($RANDOM % 10 + 1))"
done

i=$((i + 1))
printf '    { "id": "U%04d", "address": "", "name": "%s", "type": "user", "links": ["P%04d", "D%04d"]   }\n' "${i}" "${NAME}" "$(($RANDOM % 3 + 1))" "$(($RANDOM % 10 + 1))"
echo '  ],'
echo '  "config": { "version": "1.0", "lastUpdated": "2023-11-15", "types": {'
echo '  "project": { "size": 100, "color": "#4285F4" },'
echo '  "domain": { "size": 70, "color": "#DB4437" },'
echo '  "service": { "size": 40, "color": "#F4B400" },'
echo '  "user": { "size": 20, "color": "#0F9D58" } } } }'
