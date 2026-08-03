export const config = { runtime: 'edge' }

const TARGET = 'https://script.google.com/macros/s/AKfycbzZW4UAeiZxub1c5q8-dBvl5l7FcgQqzzexpNlkJYUEpYocdFfJSkLRSxztfvK0G4yN/exec'

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  try {
    const body = await request.text()
    const upstream = await fetch(TARGET, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    })
    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String((err && err.message) || err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
