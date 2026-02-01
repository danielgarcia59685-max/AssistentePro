import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE || SUPABASE_ANON;
const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phone: string = body.phone;
    const email: string | undefined = body.email;
    const name: string | undefined = body.name;

    if (!phone) return NextResponse.json({ error: 'phone is required' }, { status: 400 });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Upsert user by email if provided, otherwise create placeholder user row
    let userId: string | null = null;
    if (email) {
      const { data: upsertData, error: upsertErr } = await supabase
        .from('users')
        .upsert({ email, name, updated_at: new Date().toISOString() }, { onConflict: 'email' })
        .select('id')
        .maybeSingle();
      if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      userId = upsertData?.id || null;
    } else {
      // create a minimal anonymous user
      const { data: created, error: createErr } = await supabase
        .from('users')
        .insert({ name: name || 'WhatsApp user', created_at: new Date().toISOString() })
        .select('id')
        .maybeSingle();
      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
      userId = created?.id || null;
    }

    if (!userId) return NextResponse.json({ error: 'Could not create or find user' }, { status: 500 });

    const { error: insertErr } = await supabase.from('phone_verifications').insert({
      user_id: userId,
      whatsapp_number: phone,
      otp_code: otp,
      expires_at: expiresAt
    });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. 'whatsapp:+1415XXXXXXX'

    if (!accountSid || !authToken || !from) {
      return NextResponse.json({ ok: true, notice: 'OTP generated; Twilio not configured on server' });
    }

    const client = twilio(accountSid, authToken);
    await client.messages.create({
      from,
      to: `whatsapp:${phone}`,
      body: `Seu código de verificação é ${otp}. Vai expirar em 10 minutos.`
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
