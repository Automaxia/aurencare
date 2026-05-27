import 'server-only'
import { createClient, type RedisClientType } from 'redis'
import { env, isConfigured } from './env'
import { log } from './log'

const globalAny = globalThis as unknown as { __aurenRedis?: RedisClientType }

export async function redis(): Promise<RedisClientType | null> {
  if (!isConfigured(env.redisUrl)) return null
  if (globalAny.__aurenRedis?.isReady) return globalAny.__aurenRedis
  const client = createClient({ url: env.redisUrl })
  client.on('error', err => log.err('redis', 'connection error', err))
  await client.connect()
  globalAny.__aurenRedis = client as RedisClientType
  return client as RedisClientType
}
