import { Redis } from '@upstash/redis';

// Works with whichever env var names the Vercel Marketplace "Upstash" (Redis)
// integration injects — it uses KV_REST_API_URL / KV_REST_API_TOKEN on most
// setups, and falls back to UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const kv = new Redis({ url, token });

export default kv;
