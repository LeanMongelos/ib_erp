import { NextResponse } from 'next/server'

/** Ping liviano — no usa BD. Para dev:status y watchdog. */
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() })
}
