import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import {
  getAutomaticResponse,
  processTransactionMessage,
} from '@/app/api/whatsapp/responses'

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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
    console.log('[WA webhook] payload:', JSON.stringify(payload))

    const change = payload?.entry?.[0]?.changes?.[0]?.value

    if (!change?.messages?.length) {
      return NextResponse.json({ ok: true })
    }

    const message = change?.messages?.[0]
    const from = message?.from as string | undefined
    const text = message?.text?.body as string | undefined
    const audioId = message?.audio?.id as string | undefined

    console.log('[WA webhook] message:', {
      type: message?.type,
      from,
      text,
      hasAudio: Boolean(audioId),
    })

    if (!from || (!text && !audioId)) {
      return NextResponse.json({ ok: true })
    }

    const supabaseAdmin = getSupabaseAdmin()

    if (!supabaseAdmin) {
      console.warn('Supabase não está configurado')
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    let { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('whatsapp_number', from)
      .maybeSingle()

    if (!user) {
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert([
          {
            name: `User ${from}`,
            email: `${from}@whatsapp.local`,
            whatsapp_number: from,
          },
        ])
        .select()
        .single()

      if (createError) {
        console.error('Erro ao criar usuário:', createError)
        return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
      }

      user = newUser
    }

    const content = text || (await transcribeAudio(audioId))

    if (!content?.trim()) {
      await sendMetaMessage(from, 'Não consegui entender sua mensagem. Tente enviar em texto.')
      return NextResponse.json({ ok: true })
    }

    const response = await processMessage(content, user.id, supabaseAdmin)

    console.log('[WA webhook] will reply to:', from)
    await sendMetaMessage(from, response)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao processar webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function processMessage(
  message: string,
  userId: string,
  supabaseAdmin: any
): Promise<string> {
  const automaticTransactionResponse = await processTransactionMessage(
    message,
    userId,
    supabaseAdmin
  )

  if (automaticTransactionResponse) {
    return automaticTransactionResponse
  }

  if (!openai) {
    return await getAutomaticResponse(message, userId, supabaseAdmin)
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um assistente financeiro.
Responda sempre em português brasileiro, de forma curta e útil.
Ajude com saldo, relatório, extrato e educação financeira básica.
Se o usuário pedir algo simples, responda sem JSON.`,
        },
        { role: 'user', content: message },
      ],
    })

    const aiResponse = completion.choices?.[0]?.message?.content?.trim()

    if (aiResponse) {
      return aiResponse
    }
  } catch (error) {
    console.error('Erro ao gerar resposta com IA:', error)
  }

  return await getAutomaticResponse(message, userId, supabaseAdmin)
}

async function sendMetaMessage(to: string, body: string) {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    console.warn('Meta WhatsApp não configurado', {
      hasAccessToken: Boolean(META_ACCESS_TOKEN),
      hasPhoneNumberId: Boolean(META_PHONE_NUMBER_ID),
    })
    return
  }

  const toDigits = String(to).replace(/\D/g, '')
  const url = `https://graph.facebook.com/v20.0/${META_PHONE_NUMBER_ID}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${META_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toDigits,
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
      to: toDigits,
      phoneNumberId: META_PHONE_NUMBER_ID,
    })
  } else {
    console.log('Meta send message OK', responseText)
  }
}

async function transcribeAudio(audioId?: string): Promise<string | null> {
  if (!audioId || !META_ACCESS_TOKEN || !openai) return null

  const mediaRes = await fetch(`https://graph.facebook.com/v20.0/${audioId}`, {
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` },
  })

  if (!mediaRes.ok) return null

  const mediaJson = await mediaRes.json()
  const mediaUrl = mediaJson?.url as string | undefined

  if (!mediaUrl) return null

  const audioRes = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` },
  })

  if (!audioRes.ok) return null

  const buffer = Buffer.from(await audioRes.arrayBuffer())
  const file = new File([buffer], 'audio.ogg', { type: 'audio/ogg' })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'pt',
  })

  return transcription.text || null
}
