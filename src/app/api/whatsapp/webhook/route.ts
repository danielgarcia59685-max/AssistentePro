import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

// GET handler para verificação do webhook (WhatsApp Cloud API)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    console.log('[WA webhook] payload:', JSON.stringify(payload))
    const change = payload?.entry?.[0]?.changes?.[0]?.value
    console.log('[WA webhook] hasMessages/hasStatuses:', {
      hasMessages: Boolean(change?.messages?.length),
      hasStatuses: Boolean(change?.statuses?.length),
    })

    const message = change?.messages?.[0];
    const from = message?.from as string | undefined;
    const text = message?.text?.body as string | undefined;
    // ...

    console.log('[WA webhook] message:', {
  type: message?.type,
  from: message?.from,
  text: message?.text?.body,
  hasAudio: Boolean(message?.audio?.id),
})


    if (!from || (!text && !audioId)) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    if (!supabaseAdmin) {
      console.warn('Supabase não está configurado');
      return new Response(JSON.stringify({ error: 'Supabase not configured' }), { status: 500 });
    }

    // Encontrar ou criar usuário baseado no número
    let { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', from)
      .single();

    if (!user) {
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert([{ name: `User ${from}`, email: from }])
        .select()
        .single();

      if (createError) {
        console.error('Erro ao criar usuário:', createError);
        return new Response(JSON.stringify({ error: 'Erro ao criar usuário' }), { status: 500 });
      }
      user = newUser;
    }

    const content = text || (await transcribeAudio(audioId));
    if (!content) {
      await sendMetaMessage(from, 'Não consegui ler sua mensagem. Tente enviar em texto.');
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const response = await processMessage(content, user.id);
    console.log('[WA webhook] will reply to:', from)
    await sendMetaMessage(from, response);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
// ...restante do código de helpers permanece igual...

async function processMessage(message: string, userId: string): Promise<string> {
  if (!openai) {
    return 'Integração com IA não configurada. Defina OPENAI_API_KEY para habilitar.'
  }
  // Usar OpenAI para entender e processar a mensagem
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `Você é um assistente financeiro. Analise a mensagem do usuário e extraia informações de transações financeiras.
        Responda sempre em português brasileiro e seja conciso.
        Formatos esperados:
        - "Gastei R$ 50 no mercado com cartão" -> tipo: expense, valor: 50, categoria: Alimentação, método: card
        - "Recebi R$ 1000 de salário no PIX" -> tipo: income, valor: 1000, categoria: Salário, método: pix
        - "Paguei a conta de luz R$ 150" -> tipo: expense, valor: 150, categoria: Serviços, método: não especificado
        Retorne apenas um JSON com: { "type": "income|expense", "amount": number, "category": "string", "payment_method": "pix|card|cash|transfer", "description": "string" }
        Se não for uma transação, retorne { "type": "query" }`
      },
      {
        role: 'user',
        content: message
      }
    ]
  })

  const aiResponse = completion.choices[0].message.content

  try {
    const parsed = JSON.parse(aiResponse || '{}')

    if (parsed.type === 'query') {
      // Responder a consultas
      return await handleQuery(message, userId)
    } else if (parsed.type === 'income' || parsed.type === 'expense') {
      // Salvar transação
      await saveTransaction(parsed, userId)
      return `✅ Transação registrada: ${parsed.type === 'income' ? 'Receita' : 'Despesa'} de R$ ${parsed.amount} na categoria ${parsed.category}`
    }
  } catch (error) {
    console.error('Erro ao parsear resposta da IA:', error)
  }

  return 'Mensagem processada. Para registrar transações, diga algo como "Gastei R$ 50 no mercado".'
}

async function saveTransaction(data: any, userId: string) {
  if (!supabaseAdmin) {
    console.warn('Supabase não está configurado')
    return
  }

  try {
    // Criar transação diretamente (sem tabela categories separada)
    const insertResult = await supabaseAdmin
      .from('transactions')
      .insert([{
        amount: data.amount,
        type: data.type,
        category: data.category,
        description: data.description || '',
        payment_method: data.payment_method || 'cash',
        user_id: userId,
        date: new Date().toISOString().split('T')[0]
      }])

    if (insertResult.error) {
      if (isMissingColumnError(insertResult.error, 'category')) {
        const categoryId = await getOrCreateCategory(data.category, data.type, userId)
        await supabaseAdmin
          .from('transactions')
          .insert([{
            amount: data.amount,
            type: data.type,
            category_id: categoryId,
            description: data.description || '',
            payment_method: data.payment_method || 'cash',
            user_id: userId,
            date: new Date().toISOString().split('T')[0]
          }])
      } else {
        console.error('Erro ao salvar transação:', insertResult.error)
      }
    }
  } catch (error) {
    console.error('Erro ao salvar transação:', error)
  }
}

async function getOrCreateCategory(name: string, type: 'income' | 'expense', userId: string) {
  if (!supabaseAdmin) return null
  const trimmed = (name || '').trim()
  if (!trimmed) return null

  try {
    const { data: existing } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .eq('name', trimmed)
      .eq('type', type)
      .single()

    if (existing?.id) return existing.id

    const { data: created } = await supabaseAdmin
      .from('categories')
      .insert([{ user_id: userId, name: trimmed, type }])
      .select('id')
      .single()

    return created?.id || null
  } catch (error) {
    console.warn('Categorias não disponíveis:', error)
    return null
  }
}

function isMissingColumnError(error: any, column: string) {
  const message = (error?.message || '').toLowerCase()
  return message.includes(`column \"${column}\"`) || message.includes(`column "${column}"`) || message.includes('does not exist')
}

async function handleQuery(message: string, userId: string): Promise<string> {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('saldo') || lowerMessage.includes('quanto tenho')) {
    // Calcular saldo
    if (!supabaseAdmin) return 'Erro: Supabase não está configurado.';
    const { data: incomes } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'income')

    const { data: expenses } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'expense')

    const totalIncome = incomes?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0
    const totalExpense = expenses?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0
    const balance = totalIncome - totalExpense

    return `💰 Seu saldo atual é R$ ${balance.toFixed(2)} (Receitas: R$ ${totalIncome.toFixed(2)}, Despesas: R$ ${totalExpense.toFixed(2)})`
  }

  if (lowerMessage.includes('relatório') || lowerMessage.includes('resumo')) {
    // Resumo mensal
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    if (!supabaseAdmin) return 'Erro: Supabase não está configurado.';
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('amount, type')
      .eq('user_id', userId)
      .gte('date', `${currentMonth}-01`)
      .lt('date', `${currentMonth}-32`)

    const income = transactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0
    const expense = transactions?.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0

    return `📊 Resumo do mês: Receitas R$ ${income.toFixed(2)}, Despesas R$ ${expense.toFixed(2)}, Lucro R$ ${(income - expense).toFixed(2)}`
  }

  return 'Olá! Sou seu assistente financeiro. Posso registrar transações como "Gastei R$ 50 no mercado" ou responder perguntas sobre seu saldo e relatórios.'
}

async function sendMetaMessage(to: string, body: string) {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    console.warn('Meta WhatsApp não configurado', {
      hasAccessToken: Boolean(META_ACCESS_TOKEN),
      hasPhoneNumberId: Boolean(META_PHONE_NUMBER_ID),
    })
    return
  }

  const url = `https://graph.facebook.com/v22.0/${META_PHONE_NUMBER_ID}/messages`

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

  const resText = await res.text()
  console.log('[WA send] status:', res.status, 'body:', resText)

  if (!res.ok) {
    throw new Error(`[WA send] Meta error ${res.status}: ${resText}`)
  }
}


async function transcribeAudio(audioId?: string): Promise<string | null> {
  if (!audioId || !META_ACCESS_TOKEN || !openai) return null

  // 1) Buscar URL da mídia
  const mediaRes = await fetch(`https://graph.facebook.com/v20.0/${audioId}`, {
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` }
  })
  if (!mediaRes.ok) return null
  const mediaJson = await mediaRes.json()
  const mediaUrl = mediaJson?.url as string | undefined
  if (!mediaUrl) return null

  // 2) Baixar o áudio
  const audioRes = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` }
  })
  if (!audioRes.ok) return null
  const buffer = Buffer.from(await audioRes.arrayBuffer())

  // 3) Transcrever com OpenAI
  const file = new File([buffer], 'audio.ogg', { type: 'audio/ogg' })
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1'
  })

  return transcription.text || null
}
