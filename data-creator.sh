#!/bin/bash

# 動物のリスト
animals=("Cat" "Dog" "Lion" "Tiger" "Elephant" "Fox" "Rabbit" "Wolf" "Dolphin" "Bear"
         "Eagle" "Panda" "Giraffe" "Zebra" "Kangaroo" "Horse" "Penguin" "Otter" "Cheetah" "Leopard")

# 音楽のジャンルリスト
genres=("Rock" "Jazz" "Blues" "Classical" "Funk" "Reggae" "Metal" "HipHop" "Pop" "Folk"
        "Country" "Electro" "R&B" "Soul" "House" "Techno" "Dubstep" "Punk" "Salsa" "Trance")

echo '['
echo '  { "id": "P0001", "status": "", "address": "www.project-x.com", "name": "Project X", "type": "project", "links": [] },'
echo '  { "id": "P0002", "status": "", "address": "www.project-y.com", "name": "Project Y", "type": "project", "links": [] },'
echo '  { "id": "P0003", "status": "", "address": "www.project-z.com", "name": "Project Z", "type": "project", "links": [] },'
echo '  { "id": "D0001", "status": "", "address": "", "name": "A domain", "type": "domain", "links": [] },'
echo '  { "id": "D0002", "status": "", "address": "", "name": "B domain", "type": "domain", "links": [] },'
echo '  { "id": "D0003", "status": "", "address": "", "name": "C domain", "type": "domain", "links": [] },'
echo '  { "id": "D0004", "status": "", "address": "", "name": "D domain", "type": "domain", "links": [] },'
echo '  { "id": "D0005", "status": "", "address": "", "name": "E domain", "type": "domain", "links": [] },'
echo '  { "id": "D0006", "status": "", "address": "", "name": "F domain", "type": "domain", "links": [] },'
echo '  { "id": "D0007", "status": "", "address": "", "name": "G domain", "type": "domain", "links": [] },'
echo '  { "id": "D0008", "status": "", "address": "", "name": "H domain", "type": "domain", "links": [] },'
echo '  { "id": "D0009", "status": "", "address": "", "name": "I domain", "type": "domain", "links": [] },'
echo '  { "id": "D0010", "status": "", "address": "", "name": "J domain", "type": "domain", "links": [] },'
echo '  { "id": "S0001", "status": "", "address": "", "name": "GitLab", "type": "service", "links": ["P0001"] },'
echo '  { "id": "S0002", "status": "", "address": "", "name": "GitHub", "type": "service", "links": ["P0001"] },'
echo '  { "id": "S0004", "status": "", "address": "", "name": "DockerHub", "type": "service", "links": ["P0001"] },'
echo '  { "id": "S0005", "status": "", "address": "", "name": "AWS", "type": "service", "links": ["P0001"] },'
echo '  { "id": "S0006", "status": "", "address": "", "name": "Azure", "type": "service", "links": ["P0001"] },'
# 1000個のデータを生成1
for i in $(seq 1 999); do
    animal=${animals[$RANDOM % ${#animals[@]}]}
    genre=${genres[$RANDOM % ${#genres[@]}]}
    NAME=$(echo "$animal $genre")

    # ランダムにstatusを設定
    rand=$((RANDOM % 10))
    if [ $rand -lt 7 ]; then
        STATUS="pass"
    elif [ $rand -lt 9 ]; then
        STATUS="warning"
    else
        STATUS="error"
    fi

    printf '  { "id": "U%04d", "status": "%s", "address": "", "name": "%s", "type": "user", "links": ["P%04d", "D%04d"]   },\n' "${i}" "${STATUS}" "${NAME}" "$(($RANDOM % 3 + 1))" "$(($RANDOM % 10 + 1))"
done

i=$((i + 1))
printf '  { "id": "U%04d", "status": "pass", "address": "", "name": "%s", "type": "user", "links": ["P%04d", "D%04d"]   }\n' "${i}" "${NAME}" "$(($RANDOM % 3 + 1))" "$(($RANDOM % 10 + 1))"
echo ']'
