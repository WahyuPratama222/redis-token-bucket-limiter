// Token bucket executed atomically inside Redis.
// KEYS[1] = bucket key
// ARGV[1] = capacity, ARGV[2] = refill rate (tokens per second)
// Returns { allowed (1/0), tokens as read before taking, tokens left after taking }
export const TOKEN_BUCKET_SCRIPT = `
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])

-- Use the Redis clock so every app server agrees on the time
local t = redis.call('TIME')
local now = tonumber(t[1]) + tonumber(t[2]) / 1000000

local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
-- A missing field comes back as false in Lua, so map it to the text 'null' for logging
local seen = data[1] or 'null'
local tokens = tonumber(data[1])
local ts = tonumber(data[2])

-- A new bucket starts full
if tokens == nil then
  tokens = capacity
  ts = now
end

-- Refill based on elapsed time, capped at capacity
local elapsed = math.max(0, now - ts)
tokens = math.min(capacity, tokens + elapsed * refill_rate)

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
-- Let idle buckets expire so they don't pile up in memory
redis.call('EXPIRE', KEYS[1], math.ceil(capacity / refill_rate) * 2)

-- Numbers with decimals would be truncated by Redis, so send the leftover as text
return { allowed, seen, string.format('%.2f', tokens) }
`;