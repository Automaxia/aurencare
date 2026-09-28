import 'server-only'
import { createClient, type RedisClientType } from 'redis'
import { env, isConfigured } from './env'
import { log } from './log'

const globalAny = globalThis as unknown as { __audereRedis?: RedisClientType }

export async function redis(): Promise<RedisClientType | null> {
  if (!isConfigured(env.redisUrl)) return null
  if (globalAny.__audereRedis?.isReady) return globalAny.__audereRedis
  const client = createClient({ url: env.redisUrl })
  client.on('error', err => log.err('redis', 'connection error', err))
  await client.connect()
  globalAny.__audereRedis = client as RedisClientType
  return client as RedisClientType
}
