import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase'
import axios from 'axios'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return twilio(sid, token)
}

// GET handler para verificação do webhook
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
    
    // Encontrar ou criar usuário
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('whatsapp_number', whatsappNumber)
      .single()

    if (!user) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{
          name: `User ${whatsappNumber}`,
          email: `${whatsappNumber}@whatsapp.local`,
          whatsapp_number: whatsappNumber,
          password_hash: 'whatsapp_user', // Usuários WhatsApp não usam senha
        }])
        .select()
        .single()

      if (createError) {
        console.error('Erro ao criar usuário:', createError)
        return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
      }
      user = newUser

      // Criar categorias padrão
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

    // Se for áudio, transcrever
    if (mediaUrl && mediaType?.includes('audio')) {
      try {
        console.log('Transcrevendo áudio...')
        messageContent = await transcribeAudio(mediaUrl)
        messageType = 'audio'
      } catch (transcribeError) {
        console.error('Erro ao transcrever áudio:', transcribeError)
        // Continuar com mensagem vazia se falhar
        messageContent = '[Áudio não pôde ser transcrito]'
      }
    }

    // Log da mensagem
    await supabase
      .from('messages_log')
      .insert([{
        user_id: user.id,
        whatsapp_number: whatsappNumber,
        message_type: messageType,
        original_message: messageContent,
      }])

    // Processar mensagem com OpenAI
    const response = await processMessage(messageContent, user.id, user.whatsapp_number!)

    // Enviar resposta via WhatsApp (somente se Twilio estiver configurado)
    const twilioClient = getTwilioClient()
    if (twilioClient && process.env.TWILIO_WHATSAPP_NUMBER) {
      try {
        await twilioClient.messages.create({
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: from,
          body: response
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

// Transcrever áudio usando OpenAI Whisper
async function transcribeAudio(mediaUrl: string): Promise<string> {
  try {
    // Baixar arquivo de áudio
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    const auth = sid && token ? { username: sid, password: token } : undefined

    const audioResponse = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      ...(auth ? { auth } : {}),
    })

    const audioBuffer = Buffer.from(audioResponse.data)

    // Usar Whisper API do OpenAI
    const transcription = await openai.audio.transcriptions.create({
      file: new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' }),
      model: 'whisper-1',
      language: 'pt', // Português
    })

    return transcription.text
  } catch (error) {
    console.error('Erro ao transcrever:', error)
    throw error
  }
}

async function processMessage(message: string, userId: string, whatsappNumber: string): Promise<string> {
  try {
    if (!supabase) {
      console.warn('Supabase não está configurado (processMessage)')
      return '❌ Serviço temporariamente indisponível.'
    }
    // Buscar contexto do usuário
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    const { data: categories } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)

    const { data: accountsPayable } = await supabase
      .from('accounts_payable')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .limit(5)

    // Prompt melhorado com contexto
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
${categories?.map(c => `- ${c.name} (${c.type})`).join('\n')}

Contas a pagar próximas:
${accountsPayable?.map(a => `- ${a.supplier_name}: R$ ${a.amount} até ${a.due_date}`).join('\n') || 'Nenhuma pendente'}

Nome do usuário: ${userData?.name || 'Usuário'}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
    })

    const aiResponse = completion.choices[0].message.content || 'Não consegui processar sua mensagem'

    // Tentar extrair dados de transação
    const transactionData = await extractTransactionData(message, userId)
    
    if (transactionData) {
      await saveTransaction(transactionData, userId)
    }

    // Atualizar log com resposta
    await supabase
      .from('messages_log')
      .update({ parsed_data: transactionData, response: aiResponse })
      .eq('whatsapp_number', whatsappNumber)
      .order('created_at', { ascending: false })
      .limit(1)

    return aiResponse
  } catch (error) {
    console.error('Erro ao processar mensagem:', error)
    return '❌ Desculpe, houve um erro ao processar sua mensagem. Tente novamente.'
  }
}

async function extractTransactionData(message: string, userId: string): Promise<any> {
  try {
    if (!supabase) {
      console.warn('Supabase não está configurado (extractTransactionData)')
      return null
    }
    // Usar GPT para extrair dados estruturados
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Analise a mensagem do usuário e extraia dados de transação financeira em JSON.
          
Se for uma transação, retorne JSON assim:
{
  "isTransaction": true,
  "amount": 100.00,
  "type": "expense" ou "income",
  "category": "categoria",
  "description": "descrição",
  "date": "YYYY-MM-DD",
  "payment_method": "pix|card|cash|transfer",
  "supplier_name": "nome da loja/fornecedor" (se expense),
  "client_name": "nome do cliente" (se income)
}

Se NÃO for transação, retorne: { "isTransaction": false }

IMPORTANTE: Retorne APENAS o JSON, sem markdown ou explicações.`
        },
        { role: 'user', content: message }
      ],
      temperature: 0.3,
    })

    const responseText = completion.choices[0].message.content || '{}'
    const parsed = JSON.parse(responseText)

    if (parsed.isTransaction) {
      // Buscar category_id
      const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', userId)
        .eq('name', parsed.category)
        .single()

      return {
        ...parsed,
        category_id: category?.id || null,
        date: parsed.date || new Date().toISOString().split('T')[0],
      }
    }

    return null
  } catch (error) {
    console.error('Erro ao extrair dados da transação:', error)
    return null
  }
}

async function saveTransaction(data: any, userId: string) {
  try {
    if (!supabase) {
      console.warn('Supabase não está configurado (saveTransaction)')
      return
    }
    const insertResult = await supabase
      .from('transactions')
      .insert([{
        user_id: userId,
        amount: data.amount,
        type: data.type,
        category_id: data.category_id,
        description: data.description,
        date: data.date,
        payment_method: data.payment_method,
        supplier_name: data.supplier_name,
        client_name: data.client_name,
      }])

    if (insertResult.error) {
      if (isMissingColumnError(insertResult.error, 'category_id')) {
        await supabase
          .from('transactions')
          .insert([{
            user_id: userId,
            amount: data.amount,
            type: data.type,
            category: data.category,
            description: data.description,
            date: data.date,
            payment_method: data.payment_method,
            supplier_name: data.supplier_name,
            client_name: data.client_name,
          }])
      } else {
        console.error('Erro ao salvar transação:', insertResult.error)
      }
    }
  } catch (error) {
    console.error('Erro ao salvar transação:', error)
  }
}

function isMissingColumnError(error: any, column: string) {
  const message = (error?.message || '').toLowerCase()
  return message.includes(`column \"${column}\"`) || message.includes(`column "${column}"`) || message.includes('does not exist')
}
