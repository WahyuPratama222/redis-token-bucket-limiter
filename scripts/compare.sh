#!/usr/bin/env bash
# Compare naive vs lua over several rounds; prints how many of 100 requests were allowed (200)
ROUNDS=${1:-5}

for ep in naive lua; do
  echo "== $ep =="
  for r in $(seq 1 "$ROUNDS"); do
    # start every round with empty buckets
    docker compose -f docker-compose.dev.yml exec -T redis redis-cli FLUSHALL > /dev/null

    # 100 parallel requests, alternating between port 3001 and 3002
    allowed=$(seq 1 100 | xargs -P 100 -I{} sh -c \
      'p=$((3001 + {} % 2)); curl -s -o /dev/null -w "%{http_code}\n" "localhost:$p/'"$ep"'?user=cmp"' \
      | grep -c 200)

    echo "round $r: $allowed allowed of 100"
  done
done