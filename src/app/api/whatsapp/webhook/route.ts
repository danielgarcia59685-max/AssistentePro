// src/app/api/whatsapp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID

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
    console.log('[WA webhook] payload:', JSON.stringify(payload))

    const change = payload?.entry?.[0]?.changes?.[0]?.value

    if (!change?.messages?.length) {
      return NextResponse.json({ ok: true })
    }

    const message = change?.messages?.[0]
    const from = (message?.from as string | undefined) || undefined
    const text = (message?.text?.body as string | undefined) || undefined

    console.log('[WA webhook] message:', {
      type: message?.type,
      from: message?.from,
      text: message?.text?.body,
    })

    if (!from || !text) {
      await sendMetaMessage(
        from || '',
        'No momento consigo processar apenas mensagens de texto.'
      )
      return NextResponse.json({ ok: true })
    }

    if (!supabaseAdmin) {
      console.warn('Supabase não está configurado')
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    let { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', from)
      .single()

    if (!user) {
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert([{ name: `User ${from}`, email: from }])
        .select()
        .single()

      if (createError) {
        console.error('Erro ao criar usuário:', createError)
        return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
      }

      user = newUser
    }

    const response = await processMessage(text, user.id)

    await sendMetaMessage(from, response)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao processar webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function processMessage(message: string, userId: string): Promise<string> {
  const parsed = parseTransaction(message)

  if (parsed.type === 'query') {
    return await handleQuery(message, userId)
  }

  if (parsed.type === 'income' || parsed.type === 'expense') {
    await saveTransaction(parsed, userId)
    return `Transação registrada: ${
      parsed.type === 'income' ? 'Receita' : 'Despesa'
    } de R$ ${Number(parsed.amount).toFixed(2)} na categoria ${parsed.category}`
  }

  return 'Envie algo como: "Gastei 50 no mercado", "Recebi 1200 de salário", "saldo" ou "resumo".'
}

function parseTransaction(message: string): {
  type: 'income' | 'expense' | 'query'
  amount?: number
  category?: string
  payment_method?: 'pix' | 'card' | 'cash' | 'transfer'
  description?: string
} {
  const original = message.trim()
  const text = original.toLowerCase()

  if (
    text.includes('saldo') ||
    text.includes('quanto tenho') ||
    text.includes('relatório') ||
    text.includes('relatorio') ||
    text.includes('resumo')
  ) {
    return { type: 'query' }
  }

  const amountMatch = text.match(/(\d+[.,]?\d{0,2})/)
  const amount = amountMatch
    ? Number(amountMatch[1].replace('.', '').replace(',', '.'))
    : undefined

  const isIncome =
    text.includes('recebi') ||
    text.includes('ganhei') ||
    text.includes('entrou') ||
    text.includes('salário') ||
    text.includes('salario')

  const isExpense =
    text.includes('gastei') ||
    text.includes('paguei') ||
    text.includes('comprei') ||
    text.includes('gasto') ||
    text.includes('despesa')

  if (!amount || (!isIncome && !isExpense)) {
    return { type: 'query' }
  }

  const payment_method = detectPaymentMethod(text)
  const category = detectCategory(text, isIncome ? 'income' : 'expense')

  return {
    type: isIncome ? 'income' : 'expense',
    amount,
    category,
    payment_method,
    description: original,
  }
}

function detectPaymentMethod(
  text: string
): 'pix' | 'card' | 'cash' | 'transfer' {
  if (text.includes('pix')) return 'pix'
  if (text.includes('cartão') || text.includes('cartao') || text.includes('débito') || text.includes('debito') || text.includes('crédito') || text.includes('credito')) {
    return 'card'
  }
  if (text.includes('transferência') || text.includes('transferencia') || text.includes('ted')) {
    return 'transfer'
  }
  return 'cash'
}

function detectCategory(text: string, type: 'income' | 'expense'): string {
  if (type === 'income') {
    if (text.includes('salário') || text.includes('salario')) return 'Salário'
    if (text.includes('freela') || text.includes('freelance')) return 'Freelance'
    if (text.includes('venda')) return 'Vendas'
    return 'Receitas'
  }

  if (text.includes('mercado') || text.includes('supermercado')) return 'Alimentação'
  if (text.includes('restaurante') || text.includes('lanche') || text.includes('ifood')) return 'Alimentação'
  if (text.includes('uber') || text.includes('99') || text.includes('combustível') || text.includes('combustivel')) return 'Transporte'
  if (text.includes('luz') || text.includes('água') || text.includes('agua') || text.includes('internet')) return 'Serviços'
  if (text.includes('farmácia') || text.includes('farmacia') || text.includes('remédio') || text.includes('remedio')) return 'Saúde'

  return 'Outros'
}

async function saveTransaction(data: any, userId: string) {
  if (!supabaseAdmin) {
    console.warn('Supabase não está configurado')
    return
  }

  try {
    const insertResult = await supabaseAdmin.from('transactions').insert([
      {
        amount: data.amount,
        type: data.type,
        category: data.category,
        description: data.description || '',
        payment_method: data.payment_method || 'cash',
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
      },
    ])

    if (insertResult.error) {
      if (isMissingColumnError(insertResult.error, 'category')) {
        const categoryId = await getOrCreateCategory(data.category, data.type, userId)
        await supabaseAdmin.from('transactions').insert([
          {
            amount: data.amount,
            type: data.type,
            category_id: categoryId,
            description: data.description || '',
            payment_method: data.payment_method || 'cash',
            user_id: userId,
            date: new Date().toISOString().split('T')[0],
          },
        ])
      } else {
        console.error('Erro ao salvar transação:', insertResult.error)
      }
    }
  } catch (error) {
    console.error('Erro ao salvar transação:', error)
  }
}

async function getOrCreateCategory(
  name: string,
  type: 'income' | 'expense',
  userId: string
) {
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
  return (
    message.includes(`column "${column}"`) ||
    message.includes(`column \"${column}\"`) ||
    message.includes('does not exist')
  )
}

async function handleQuery(message: string, userId: string): Promise<string> {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('saldo') || lowerMessage.includes('quanto tenho')) {
    if (!supabaseAdmin) return 'Erro: Supabase não está configurado.'

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

    const totalIncome =
      incomes?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0
    const totalExpense =
      expenses?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0
    const balance = totalIncome - totalExpense

    return `Seu saldo atual é R$ ${balance.toFixed(2)}. Receitas: R$ ${totalIncome.toFixed(
      2
    )}. Despesas: R$ ${totalExpense.toFixed(2)}.`
  }

  if (lowerMessage.includes('relatório') || lowerMessage.includes('relatorio') || lowerMessage.includes('resumo')) {
    const currentMonth = new Date().toISOString().slice(0, 7)

    if (!supabaseAdmin) return 'Erro: Supabase não está configurado.'

    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('amount, type, date')
      .eq('user_id', userId)
      .gte('date', `${currentMonth}-01`)
      .lt('date', `${currentMonth}-32`)

    const income =
      transactions
        ?.filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0

    const expense =
      transactions
        ?.filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0

    return `Resumo do mês: Receitas R$ ${income.toFixed(2)}, Despesas R$ ${expense.toFixed(
      2
    )}, Saldo R$ ${(income - expense).toFixed(2)}`
  }

  return 'Posso registrar transações e informar saldo ou resumo do mês.'
}

async function sendMetaMessage(to: string, body: string) {
  if (!to) return

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
