import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ''

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const change = payload?.entry?.[0]?.changes?.[0]?.value
    const message = change?.messages?.[0]

    const from = message?.from as string | undefined
    const text = (message?.text?.body as string | undefined)?.trim()
    const audioId = message?.audio?.id as string | undefined

    if (!from || (!text && !audioId)) {
      return Response.json({ success: true }, { status: 200 })
    }

    if (!supabaseAdmin) {
      console.warn('Supabase não está configurado')
      return Response.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    let { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('whatsapp_number', from)
      .maybeSingle()

    if (userError) {
      console.error('Erro ao buscar usuário:', userError)
      return Response.json({ error: 'Erro ao buscar usuário' }, { status: 500 })
    }

    if (!user) {
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert([
          {
            name: `User ${from}`,
            whatsapp_number: from,
            currency: 'BRL',
            is_active: true,
          },
        ])
        .select()
        .single()

      if (createError) {
        console.error('Erro ao criar usuário:', createError)
        return Response.json({ error: 'Erro ao criar usuário' }, { status: 500 })
      }

      user = newUser
    }

    if (audioId) {
      await sendMetaMessage(
        from,
        'Recebi seu áudio, mas a transcrição ainda não está ativada. Por enquanto, envie em texto.'
      )
      return Response.json({ success: true }, { status: 200 })
    }

    const content = text?.trim()
    if (!content) {
      await sendMetaMessage(from, 'Não consegui ler sua mensagem. Tente enviar em texto.')
      return Response.json({ success: true }, { status: 200 })
    }

    const response = await processMessage(content, user.id)
    await sendMetaMessage(from, response)

    return Response.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Erro ao processar webhook:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function processMessage(message: string, userId: string): Promise<string> {
  return 'TESTE NOVO WEBHOOK 123'
}

async function sendMetaMessage(to: string, body: string) {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    console.warn('Meta WhatsApp não configurado', {
      hasAccessToken: Boolean(META_ACCESS_TOKEN),
      hasPhoneNumberId: Boolean(META_PHONE_NUMBER_ID),
    })
    return
  }

  console.log('ENVIANDO RESPOSTA PARA META:', body)

  const url = `https://graph.facebook.com/v20.0/${META_PHONE_NUMBER_ID}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${META_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  })

  const responseText = await res.text()

  if (!res.ok) {
    console.error('Meta send message ERROR', {
      status: res.status,
      statusText: res.statusText,
      responseText,
      to,
      phoneNumberId: META_PHONE_NUMBER_ID,
    })
  } else {
    console.log('Meta send message OK', responseText)
  }
}
