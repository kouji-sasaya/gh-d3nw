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
echo '    { "id": "C0001", "address": "", "name": "A company", "type": "company", "links": [] },'
echo '    { "id": "C0002", "address": "", "name": "B company", "type": "company", "links": [] },'
echo '    { "id": "C0003", "address": "", "name": "C company", "type": "company", "links": [] },'
echo '    { "id": "C0004", "address": "", "name": "D company", "type": "company", "links": [] },'
echo '    { "id": "C0005", "address": "", "name": "E company", "type": "company", "links": [] },'
echo '    { "id": "C0006", "address": "", "name": "F company", "type": "company", "links": [] },'
echo '    { "id": "C0007", "address": "", "name": "G company", "type": "company", "links": [] },'
echo '    { "id": "C0008", "address": "", "name": "H company", "type": "company", "links": [] },'
echo '    { "id": "C0009", "address": "", "name": "I company", "type": "company", "links": [] },'
echo '    { "id": "C0010", "address": "", "name": "J company", "type": "company", "links": [] },'
echo '    { "id": "S0001", "address": "", "name": "GitLab", "type": "service", "links": ["P0001"] },'
echo '    { "id": "S0002", "address": "", "name": "GitHub", "type": "service", "links": ["P0001"] },'
echo '    { "id": "S0003", "address": "", "name": "Jira", "type": "service", "links": ["P0001"] },'
echo '    { "id": "S0004", "address": "", "name": "Confluence", "type": "service", "links": ["P0001"] },'
# 1000個のデータを生成
for i in $(seq 1 1999); do
    animal=${animals[$RANDOM % ${#animals[@]}]}
    genre=${genres[$RANDOM % ${#genres[@]}]}
    NAME=$(echo "$animal $genre")
    printf '    {"id": "E%04d", "address" : "", "name" :"%s", "type" : "employee", "links" : ["P%04d", "C%04d"]   },\n' "${i}" "${NAME}" "$(($RANDOM % 3 + 1))" "$(($RANDOM % 10 + 1))"
done
echo '    {"id": "E2000", "address" : "", "name" :"Eagle Pop", "type" : "employee", "links" : ["P0003", "C0010"]   }'
echo '  ],'
echo '  "config": { "version": "1.0", "lastUpdated": "2023-11-15", "types": {'
echo '  "project": { "size": 100, "color": "#4285F4" },'
echo '  "company": { "size": 70, "color": "#DB4437" },'
echo '  "service": { "size": 40, "color": "#F4B400" },'
echo '  "employee": { "size": 20, "color": "#0F9D58" } } } }'
