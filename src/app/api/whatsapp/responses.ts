interface TransactionData {
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string
  payment_method: string
}

// =============================
// RESPOSTAS AUTOMÁTICAS
// =============================

const WELCOME_MESSAGES = [
  "👋 Olá! Sou seu assistente financeiro pessoal!",
  "💰 Para registrar uma DESPESA, envie: Gastei R$ 50 no mercado no pix",
  "💵 Para registrar uma RECEITA, envie: Recebi R$ 1000 salário",
  "📊 Para consultar o saldo, envie: saldo",
  "📈 Para relatório mensal, envie: relatório",
  "",
  "🚀 Digite 'ajuda' para ver todos os comandos!"
]

const HELP_MESSAGES = [
  "🔧 COMANDOS DISPONÍVEIS:",
  "",
  "💰 REGISTRAR TRANSAÇÕES:",
  "• Gastei R$ [valor] em [local/categoria] paguei em [forma de pagamento]",
  "• Recebi R$ [valor] de [fonte]",
  "• Paguei R$ [valor] conta de luz",
  "",
  "📊 CONSULTAS:",
  "• saldo - ver saldo atual",
  "• relatório - resumo do mês",
  "• extrato - últimas transações",
  "",
  "⚙️ OUTROS:",
  "• ajuda - ver esta mensagem",
  "• sobre - informações do app"
]

const ABOUT_MESSAGE = `
🤖 ASSISTENTE FINANCEIRO v1.0

Desenvolvido para te ajudar a controlar suas finanças de forma simples e prática pelo WhatsApp.

✅ Registre despesas e receitas
✅ Organiza compromissos e Metas
✅ Gerencia contas a pagar/receber
✅ Consulte saldo em tempo real  
✅ Relatórios mensais automáticos
✅ Categorização inteligente
✅ 100% seguro e privado

💡 Dica: Comece registrando uma despesa agora mesmo!
`

// =============================
// PROCESSAMENTO DE TRANSAÇÕES
// =============================

export async function processTransactionMessage(
  message: string, 
  userId: string, 
  supabaseAdmin: any
): Promise<string | null> {
  const lowerMsg = message.toLowerCase().trim()

  // Detectar padrões de transação
  const transactionData = extractTransactionData(lowerMsg)
  
  if (transactionData) {
    await saveTransaction(transactionData, userId, supabaseAdmin)
    return `✅ Transação registrada com sucesso!
    
💰 ${transactionData.type === 'income' ? 'Receita' : 'Despesa'}: R$ ${transactionData.amount.toFixed(2)}
📂 Categoria: ${transactionData.category}
💳 Método: ${transactionData.payment_method}

Digite "saldo" para ver seu saldo atualizado!`
  }

  return null
}

function extractTransactionData(message: string): TransactionData | null {
  // Padrões de despesa
  const expensePatterns = [
    /gastei\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
    /paguei\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
    /comprei\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
    /despesa\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i
  ]

  // Padrões de receita
  const incomePatterns = [
    /recebi\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
    /ganhei\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
    /receita\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
    /salario\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i
  ]

  // Verificar despesas
  for (const pattern of expensePatterns) {
    const match = message.match(pattern)
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'))
      return {
        type: 'expense',
        amount,
        category: extractCategory(message),
        description: message,
        payment_method: extractPaymentMethod(message)
      }
    }
  }

  // Verificar receitas
  for (const pattern of incomePatterns) {
    const match = message.match(pattern)
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'))
      return {
        type: 'income',
        amount,
        category: extractCategory(message),
        description: message,
        payment_method: extractPaymentMethod(message)
      }
    }
  }

  return null
}

function extractCategory(message: string): string {
  const categoryMap = {
    'mercado': 'Alimentação',
    'supermercado': 'Alimentação',
    'restaurante': 'Alimentação',
    'comida': 'Alimentação',
    'lanche': 'Alimentação',
    
    'combustivel': 'Transporte',
    'gasolina': 'Transporte',
    'uber': 'Transporte',
    'taxi': 'Transporte',
    'onibus': 'Transporte',
    
    'luz': 'Serviços',
    'agua': 'Serviços',
    'internet': 'Serviços',
    'telefone': 'Serviços',
    'conta': 'Serviços',
    
    'salario': 'Salário',
    'freelance': 'Freelance',
    'vendas': 'Vendas',
    
    'farmacia': 'Saúde',
    'medico': 'Saúde',
    'consulta': 'Saúde',
    
    'roupas': 'Vestuário',
    'sapato': 'Vestuário',
    'roupa': 'Vestuário'
  }

  const lowerMsg = message.toLowerCase()
  
  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (lowerMsg.includes(keyword)) {
      return category
    }
  }
  
  return 'Outros'
}

function extractPaymentMethod(message: string): string {
  const lowerMsg = message.toLowerCase()
  
  if (lowerMsg.includes('pix')) return 'pix'
  if (lowerMsg.includes('cartao') || lowerMsg.includes('cartão')) return 'card'
  if (lowerMsg.includes('dinheiro') || lowerMsg.includes('cash')) return 'cash'
  if (lowerMsg.includes('transferencia') || lowerMsg.includes('transferência')) return 'transfer'
  
  return 'cash'
}

// =============================
// RESPOSTAS AUTOMÁTICAS
// =============================

export async function getAutomaticResponse(
  message: string, 
  userId: string, 
  supabaseAdmin: any
): Promise<string> {
  const lowerMsg = message.toLowerCase().trim()

  // Mensagens de boas-vindas
  if (lowerMsg.includes('oi') || lowerMsg.includes('olá') || lowerMsg.includes('ola') || 
      lowerMsg.includes('hey') || lowerMsg.includes('inicio') || lowerMsg === 'começar') {
    return WELCOME_MESSAGES.join('\n')
  }

  // Ajuda
  if (lowerMsg.includes('ajuda') || lowerMsg.includes('help') || lowerMsg.includes('comandos')) {
    return HELP_MESSAGES.join('\n')
  }

  // Sobre
  if (lowerMsg.includes('sobre') || lowerMsg.includes('info')) {
    return ABOUT_MESSAGE
  }

  // Saldo
  if (lowerMsg.includes('saldo') || lowerMsg.includes('quanto tenho')) {
    return await getBalance(userId, supabaseAdmin)
  }

  // Relatório
  if (lowerMsg.includes('relatório') || lowerMsg.includes('relatorio') || lowerMsg.includes('resumo')) {
    return await getMonthlyReport(userId, supabaseAdmin)
  }

  // Extrato
  if (lowerMsg.includes('extrato') || lowerMsg.includes('histórico') || lowerMsg.includes('historico')) {
    return await getTransactionHistory(userId, supabaseAdmin)
  }

  // Resposta padrão
  return `❓ Não entendi sua mensagem.

💡 Dicas:
• Para registrar gastos: "Gastei R$ 50 no mercado paguei no pix"
• Para ver saldo: "saldo" 
• Para ajuda: "ajuda"

🤖 Estou aqui para ajudar com suas finanças!`
}

// =============================
// FUNÇÕES AUXILIARES
// =============================

async function saveTransaction(data: TransactionData, userId: string, supabaseAdmin: any) {
  if (!supabaseAdmin) return

  try {
    const { error } = await supabaseAdmin.from('transactions').insert([
      {
        amount: data.amount,
        type: data.type,
        category: data.category,
        description: data.description,
        payment_method: data.payment_method,
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
      },
    ])

    if (error) {
      console.error('Erro ao salvar transação:', error)
    }
  } catch (error) {
    console.error('Erro ao salvar transação:', error)
  }
}

async function getBalance(userId: string, supabaseAdmin: any): Promise<string> {
  if (!supabaseAdmin) return 'Erro: Sistema não configurado.'

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

  const totalIncome = incomes?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0
  const totalExpense = expenses?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0
  const balance = totalIncome - totalExpense

  return `💰 SEU SALDO ATUAL

🟢 Receitas: R$ ${totalIncome.toFixed(2)}
🔴 Despesas: R$ ${totalExpense.toFixed(2)}
💰 Saldo: R$ ${balance.toFixed(2)}

${balance > 0 ? '✅ Você está no positivo!' : balance < 0 ? '⚠️ Atenção: saldo negativo!' : '⚖️ Você está em equilíbrio.'}`
}

async function getMonthlyReport(userId: string, supabaseAdmin: any): Promise<string> {
  const currentMonth = new Date().toISOString().slice(0, 7)
  
  if (!supabaseAdmin) return 'Erro: Sistema não configurado.'

  const { data: transactions } = await supabaseAdmin
    .from('transactions')
    .select('amount, type, category, date')
    .eq('user_id', userId)
    .gte('date', `${currentMonth}-01`)
    .lt('date', `${currentMonth}-32`)

  const income = transactions?.filter((t: any) => t.type === 'income')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0
  
  const expense = transactions?.filter((t: any) => t.type === 'expense')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0

  const profit = income - expense

  return `📊 RELATÓRIO MENSAL

📅 Período: ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}

🟢 Receitas: R$ ${income.toFixed(2)}
🔴 Despesas: R$ ${expense.toFixed(2)}
💰 Resultado: R$ ${profit.toFixed(2)}

📈 Total de transações: ${transactions?.length || 0}

${profit > 0 ? '✅ Mês positivo!' : profit < 0 ? '⚠️ Mês no vermelho!' : '⚖️ Mês equilibrado!'}`
}

async function getTransactionHistory(userId: string, supabaseAdmin: any): Promise<string> {
  if (!supabaseAdmin) return 'Erro: Sistema não configurado.'

  const { data: transactions } = await supabaseAdmin
    .from('transactions')
    .select('amount, type, category, date, description')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(10)

  if (!transactions?.length) {
    return '📝 Nenhuma transação encontrada.\n\nComece registrando: "Gastei R$ 50 no mercado"'
  }

  let history = '📝 ÚLTIMAS TRANSAÇÕES\n\n'
  
  transactions.forEach((t: any, index: number) => {
    const emoji = t.type === 'income' ? '🟢' : '🔴'
    const signal = t.type === 'income' ? '+' : '-'
    history += `${emoji} ${signal}R$ ${Number(t.amount).toFixed(2)} | ${t.category}\n`
    history += `📅 ${new Date(t.date).toLocaleDateString('pt-BR')}\n\n`
  })

  return history + '💡 Digite "relatório" para ver resumo mensal!'
}
