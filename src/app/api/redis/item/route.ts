import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()

export async function POST() {
  const result = await redis.get('item')

  return NextResponse.json({ result })
}
