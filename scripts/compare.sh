#!/usr/bin/env bash
# Compare naive vs lua over several rounds; prints how many of 100 requests were allowed (200)
ROUNDS=${1:-5}

# Target settings. Override from the terminal, e.g.: COMPOSE_FILE=docker-compose.dev.yml ./scripts/compare.sh 3
# (Docker Compose reads COMPOSE_FILE by itself, so no -f flag is needed below)
export COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.yml}
PORT_A=${APP_A_PORT:-3001}
PORT_B=${APP_B_PORT:-3002}

# Exported so the subshells started by xargs can read them
export PORT_A PORT_B

for ep in naive lua; do
  export ep
  echo "== $ep =="
  for r in $(seq 1 "$ROUNDS"); do
    # start every round with empty buckets
    docker compose exec -T redis redis-cli FLUSHALL > /dev/null

    # 100 parallel requests, alternating between server A and server B
    allowed=$(seq 1 100 | xargs -P 100 -I{} sh -c '
      if [ $(( {} % 2 )) -eq 0 ]; then p=$PORT_A; else p=$PORT_B; fi
      curl -s -o /dev/null -w "%{http_code}\n" "localhost:$p/$ep?user=cmp"
    ' | grep -c 200)

    echo "round $r: $allowed allowed of 100"
  done
done