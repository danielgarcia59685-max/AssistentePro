import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase'
import axios from 'axios'
import {
  getAutomaticResponse,
  processTransactionMessage,
} from '@/app/api/whatsapp/responses'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return twilio(sid, token)
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const hubChallenge = searchParams.get('hub.challenge')

  if (hubChallenge) {
    return new NextResponse(hubChallenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const from = formData.get('From') as string
    const body = formData.get('Body') as string
    const mediaUrl = formData.get('MediaUrl0') as string
    const mediaType = formData.get('MediaContentType0') as string

    if (!from) {
      return NextResponse.json({ error: 'Missing From field' }, { status: 400 })
    }

    if (!supabase) {
      console.warn('Supabase não está configurado')
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const whatsappNumber = from.replace('whatsapp:', '')

    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('whatsapp_number', whatsappNumber)
      .maybeSingle()

    if (!user) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            name: `User ${whatsappNumber}`,
            email: `${whatsappNumber}@whatsapp.local`,
            whatsapp_number: whatsappNumber,
          },
        ])
        .select()
        .single()

      if (createError) {
        console.error('Erro ao criar usuário:', createError)
        return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
      }

      user = newUser

      const defaultCategories = [
        { name: 'Salário', type: 'income', user_id: user.id },
        { name: 'Vendas', type: 'income', user_id: user.id },
        { name: 'Alimentação', type: 'expense', user_id: user.id },
        { name: 'Aluguel', type: 'expense', user_id: user.id },
        { name: 'Internet', type: 'expense', user_id: user.id },
        { name: 'Transporte', type: 'expense', user_id: user.id },
        { name: 'Outros', type: 'expense', user_id: user.id },
      ]

      await supabase.from('categories').insert(defaultCategories)
    }

    let messageContent = body || ''
    let messageType = 'text'

    if (mediaUrl && mediaType?.includes('audio')) {
      try {
        console.log('Transcrevendo áudio...')
        messageContent = await transcribeAudio(mediaUrl)
        messageType = 'audio'
      } catch (transcribeError) {
        console.error('Erro ao transcrever áudio:', transcribeError)
        messageContent = ''
      }
    }

    if (!messageContent?.trim()) {
      messageContent = 'ajuda'
    }

    await supabase.from('messages_log').insert([
      {
        user_id: user.id,
        whatsapp_number: whatsappNumber,
        message_type: messageType,
        original_message: messageContent,
      },
    ])

    const response = await processMessage(messageContent, user.id)

    const twilioClient = getTwilioClient()
    if (twilioClient && process.env.TWILIO_WHATSAPP_NUMBER) {
      try {
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:')
            ? process.env.TWILIO_WHATSAPP_NUMBER
            : `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: from,
          body: response,
        })
      } catch (err) {
        console.error('Erro ao enviar via Twilio:', err)
      }
    } else {
      console.warn('Twilio não configurado, pulando envio de mensagem')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao processar webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function transcribeAudio(mediaUrl: string): Promise<string> {
  if (!openai) {
    return ''
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const auth = sid && token ? { username: sid, password: token } : undefined

  const audioResponse = await axios.get(mediaUrl, {
    responseType: 'arraybuffer',
    ...(auth ? { auth } : {}),
  })

  const audioBuffer = Buffer.from(audioResponse.data)
  const file = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'pt',
  })

  return transcription.text
}

async function processMessage(message: string, userId: string): Promise<string> {
  if (!supabase) {
    return '❌ Serviço temporariamente indisponível.'
  }

  const directTransactionResponse = await processTransactionMessage(message, userId, supabase)
  if (directTransactionResponse) {
    return directTransactionResponse
  }

  if (!openai) {
    return await getAutomaticResponse(message, userId, supabase)
  }

  try {
    const { data: userData } = await supabase.from('users').select('*').eq('id', userId).single()

    const { data: categories } = await supabase.from('categories').select('*').eq('user_id', userId)

    const { data: accountsPayable } = await supabase
      .from('accounts_payable')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .limit(5)

    const systemPrompt = `Você é um assistente financeiro inteligente. Seu nome é Lasy Finance.

Você ajuda a gerenciar:
✅ Receitas e despesas
✅ Contas a pagar e receber
✅ Lembretes e compromissos
✅ Relatórios financeiros

IMPORTANTE:
1. Responda SEMPRE em português brasileiro
2. Seja conciso mas informativo
3. Se o usuário disser uma transação, extraia: valor, tipo (receita/despesa), categoria, data (se informada)
4. Use emojis para deixar mais visual
5. Ao identificar uma transação, responda confirmando o registro

Categorias disponíveis:
${categories?.map((c: any) => `- ${c.name} (${c.type})`).join('\n') || 'Nenhuma'}

Contas a pagar próximas:
${accountsPayable?.map((a: any) => `- ${a.supplier_name}: R$ ${a.amount} até ${a.due_date}`).join('\n') || 'Nenhuma pendente'}

Nome do usuário: ${userData?.name || 'Usuário'}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
    })

    const aiResponse =
      completion.choices[0]?.message?.content || 'Não consegui processar sua mensagem.'

    await supabase
      .from('messages_log')
      .update({ response: aiResponse })
      .eq('whatsapp_number', userData?.whatsapp_number || '')
      .order('created_at', { ascending: false })

    return aiResponse
  } catch (error) {
    console.error('Erro ao processar mensagem:', error)
    return await getAutomaticResponse(message, userId, supabase)
  }
}
