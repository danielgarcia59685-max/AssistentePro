import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const key = serviceRoleKey || anonKey

  if (!url || !key) return null
  return createClient(url, key)
}

function normalizePhone(phone: string) {
  return String(phone).replace(/[^\d+]/g, '').trim()
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()

    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase não configurado corretamente' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const phone = normalizePhone(body.phone)
    const email: string | undefined = body.email?.trim() || undefined
    const name: string | undefined = body.name?.trim() || undefined

    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 })
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    let userId: string | null = null

    if (email) {
      const { data: upsertData, error: upsertErr } = await supabase
        .from('users')
        .upsert(
          {
            email,
            name: name || email.split('@')[0],
            whatsapp_number: phone,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        )
        .select('id')
        .maybeSingle()

      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 })
      }

      userId = upsertData?.id || null
    } else {
      const { data: created, error: createErr } = await supabase
        .from('users')
        .insert({
          name: name || 'WhatsApp user',
          email: `${phone}@whatsapp.local`,
          whatsapp_number: phone,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle()

      if (createErr) {
        return NextResponse.json({ error: createErr.message }, { status: 500 })
      }

      userId = created?.id || null
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Could not create or find user' },
        { status: 500 }
      )
    }

    const { error: insertErr } = await supabase.from('phone_verifications').insert({
      user_id: userId,
      whatsapp_number: phone,
      otp_code: otp,
      expires_at: expiresAt,
    })

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_WHATSAPP_NUMBER

    if (!accountSid || !authToken || !from) {
      return NextResponse.json({
        ok: true,
        notice: 'OTP gerado; Twilio não configurado no servidor',
      })
    }

    const client = twilio(accountSid, authToken)

    await client.messages.create({
      from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      to: phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`,
      body: `Seu código de verificação é ${otp}. Vai expirar em 10 minutos.`,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    )
  }
}
