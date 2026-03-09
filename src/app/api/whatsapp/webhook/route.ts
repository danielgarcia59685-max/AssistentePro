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
    sendMetaMessage(from, response).catch(console.error)

    return Response.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Erro ao processar webhook:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function processMessage(message: string, userId: string): Promise<string> {
  return 'TESTE NOVO WEBHOOK 123'
}


function extractPaymentMethod(text: string) {
  if (text.includes('pix')) return 'Pix'
  if (text.includes('boleto')) return 'Boleto'
  if (text.includes('debito') || text.includes('débito')) return 'Débito'
  if (text.includes('credito') || text.includes('crédito') || text.includes('cartao') || text.includes('cartão')) {
    return 'Crédito'
  }
  if (text.includes('dinheiro')) return 'Dinheiro'
  return 'Pix'
}

function extractCategory(text: string, type: 'income' | 'expense') {
  if (type === 'income') {
    if (text.includes('salario') || text.includes('salário')) return 'Salário'
    if (text.includes('cliente')) return 'Receita'
    if (text.includes('venda')) return 'Vendas'
    return 'Receita'
  }

  if (text.includes('mercado') || text.includes('supermercado') || text.includes('janta') || text.includes('almoco') || text.includes('almoço') || text.includes('lanche')) {
    return 'Alimentação'
  }

  if (text.includes('uber') || text.includes('gasolina') || text.includes('combustivel') || text.includes('combustível') || text.includes('onibus') || text.includes('ônibus')) {
    return 'Transporte'
  }

  if (text.includes('aluguel') || text.includes('condominio') || text.includes('condomínio')) {
    return 'Moradia'
  }

  if (text.includes('farmacia') || text.includes('farmácia') || text.includes('medico') || text.includes('médico') || text.includes('consulta')) {
    return 'Saúde'
  }

  if (text.includes('internet') || text.includes('agua') || text.includes('água') || text.includes('luz') || text.includes('telefone')) {
    return 'Contas e Serviços'
  }

  return 'Outros'
}

async function saveTransaction(
  data: {
    type: 'income' | 'expense'
    amount: number
    category: string
    payment_method: string
    description: string
  },
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabaseAdmin) {
    return { ok: false, error: 'Supabase não está configurado.' }
  }

  try {
    const { error } = await supabaseAdmin.from('transactions').insert([
      {
        user_id: userId,
        amount: data.amount,
        currency: 'BRL',
        category: data.category,
        description: data.description,
        inserted_at: new Date().toISOString(),
        date: formatDateISO(new Date()),
        type: data.type,
        payment_method: data.payment_method,
        payment_details: null,
      },
    ])

    if (error) {
      console.error('Erro ao salvar transação:', error)
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (error) {
    console.error('Erro ao salvar transação:', error)
    return { ok: false, error: 'Erro interno ao salvar transação.' }
  }
}

async function handleBalance(userId: string): Promise<string> {
  if (!supabaseAdmin) return 'Erro: Supabase não está configurado.'

  const { data: incomes, error: incomesError } = await supabaseAdmin
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'income')

  const { data: expenses, error: expensesError } = await supabaseAdmin
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'expense')

  if (incomesError || expensesError) {
    console.error('Erro ao consultar saldo:', { incomesError, expensesError })
    return 'Não consegui consultar seu saldo agora.'
  }

  const totalIncome = incomes?.reduce((sum, t) => sum + Number(t.amount), 0) || 0
  const totalExpense = expenses?.reduce((sum, t) => sum + Number(t.amount), 0) || 0
  const balance = totalIncome - totalExpense

  return `💰 SALDO ATUAL
Receitas: R$ ${formatCurrency(totalIncome)}
Gastos: R$ ${formatCurrency(totalExpense)}
Saldo: R$ ${formatCurrency(balance)}
${SITE_URL ? `📊 Ver detalhes completos:\n${SITE_URL}` : ''}`.trim()
}

async function handleStatement(userId: string): Promise<string> {
  if (!supabaseAdmin) return 'Erro: Supabase não está configurado.'

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('amount, type, category, description, date')
    .eq('user_id', userId)
    .order('inserted_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Erro ao consultar extrato:', error)
    return 'Não consegui consultar seu extrato agora.'
  }

  if (!data?.length) {
    return 'Você ainda não tem movimentações registradas.'
  }

  const lines = data.map((t) => {
    const signal = t.type === 'income' ? '+' : '-'
    return `${formatDateFromString(t.date)} - ${t.description || t.category} (${t.category}) ${signal} R$ ${formatCurrency(Number(t.amount))}`
  })

  return `📋 EXTRATO - ÚLTIMAS ${data.length} MOVIMENTAÇÕES
${lines.join('\n')}
${SITE_URL ? `📊 Ver extrato completo:\n${SITE_URL}` : ''}`.trim()
}

async function handleSummary(userId: string): Promise<string> {
  if (!supabaseAdmin) return 'Erro: Supabase não está configurado.'

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('amount, type, category, date')
    .eq('user_id', userId)
    .gte('date', `${year}-${month}-01`)
    .lt('date', `${year}-${month}-32`)

  if (error) {
    console.error('Erro ao consultar resumo:', error)
    return 'Não consegui consultar seu resumo agora.'
  }

  const income =
    data?.filter((t) => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0) || 0

  const expense =
    data?.filter((t) => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0) || 0

  return `📈 RESUMO DO MÊS
Total receitas: R$ ${formatCurrency(income)}
Total gastos: R$ ${formatCurrency(expense)}
Resultado: R$ ${formatCurrency(income - expense)}
${SITE_URL ? `📊 Ver relatório completo:\n${SITE_URL}` : ''}`.trim()
}

function isBalanceQuery(text: string) {
  return text.includes('saldo') || text.includes('quanto tenho')
}

function isStatementQuery(text: string) {
  return text.includes('extrato') || text.includes('movimentacao') || text.includes('movimentação')
}

function isSummaryQuery(text: string) {
  return text.includes('resumo') || text.includes('relatorio') || text.includes('relatório')
}

function isWebsiteLinkQuery(text: string) {
  return text.includes('site') || text.includes('web') || text.includes('link')
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function formatCurrency(value: number) {
  return value.toFixed(2).replace('.', ',')
}

function formatDateISO(date: Date) {
  return date.toISOString().split('T')[0]
}

function formatDateBR(date: Date) {
  return date.toLocaleDateString('pt-BR')
}

function formatTimeBR(date: Date) {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateFromString(value: string) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

async function sendMetaMessage(to: string, body: string) {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    console.warn('Meta WhatsApp não configurado', {
      hasAccessToken: Boolean(META_ACCESS_TOKEN),
      hasPhoneNumberId: Boolean(META_PHONE_NUMBER_ID),
    })
    return
  }

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
