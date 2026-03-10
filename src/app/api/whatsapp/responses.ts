interface TransactionData {
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string
  payment_method: string
}

const WELCOME_MESSAGES = [
  '👋 Olá! Sou seu assistente financeiro pessoal!',
  '💰 Para registrar uma DESPESA, envie: Gastei R$ 50 no mercado no pix',
  '💵 Para registrar uma RECEITA, envie: Recebi R$ 1000 de salário',
  '📊 Para consultar o saldo, envie: saldo',
  '📈 Para relatório mensal, envie: relatório',
  '',
  "🚀 Digite 'ajuda' para ver todos os comandos!",
]

const HELP_MESSAGES = [
  '🔧 COMANDOS DISPONÍVEIS:',
  '',
  '💰 REGISTRAR TRANSAÇÕES:',
  '• Gastei R$ [valor] em [local/categoria] paguei em [forma de pagamento]',
  '• Recebi R$ [valor] de [fonte]',
  '• Paguei R$ [valor] conta de luz',
  '',
  '📊 CONSULTAS:',
  '• saldo - ver saldo atual',
  '• relatório - resumo do mês',
  '• extrato - últimas transações',
  '',
  '⚙️ OUTROS:',
  '• ajuda - ver esta mensagem',
  '• sobre - informações do app',
]

const ABOUT_MESSAGE = `🤖 ASSISTENTE FINANCEIRO v1.0

Desenvolvido para te ajudar a controlar suas finanças de forma simples e prática pelo WhatsApp.

✅ Registre despesas e receitas
✅ Organiza compromissos e metas
✅ Gerencia contas a pagar/receber
✅ Consulte saldo em tempo real
✅ Relatórios mensais automáticos
✅ Categorização inteligente
✅ 100% seguro e privado

💡 Dica: Comece registrando uma despesa agora mesmo!`

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export async function processTransactionMessage(
  message: string,
  userId: string,
  supabaseAdmin: any
): Promise<string | null> {
  const lowerMsg = message.toLowerCase().trim()
  const transactionData = extractTransactionData(lowerMsg)

  if (!transactionData) return null

  await saveTransaction(transactionData, userId, supabaseAdmin)

  return `✅ Transação registrada com sucesso!

💰 ${transactionData.type === 'income' ? 'Receita' : 'Despesa'}: ${formatCurrency(transactionData.amount)}
📂 Categoria: ${transactionData.category}
💳 Método: ${transactionData.payment_method}

Digite "saldo" para ver seu saldo atualizado!`
}

function extractTransactionData(message: string): TransactionData | null {
  const expensePatterns = [
    /gastei\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
    /paguei\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
    /comprei\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
    /despesa\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
  ]

  const incomePatterns = [
    /recebi\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
    /ganhei\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
    /receita\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
    /salario\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
    /salário\s+r?\$?\s*(\d+(?:[,.]?\d+)?)/i,
  ]

  for (const pattern of expensePatterns) {
    const match = message.match(pattern)
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'))
      if (Number.isNaN(amount)) return null

      return {
        type: 'expense',
        amount,
        category: extractCategory(message),
        description: message,
        payment_method: extractPaymentMethod(message),
      }
    }
  }

  for (const pattern of incomePatterns) {
    const match = message.match(pattern)
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'))
      if (Number.isNaN(amount)) return null

      return {
        type: 'income',
        amount,
        category: extractCategory(message),
        description: message,
        payment_method: extractPaymentMethod(message),
      }
    }
  }

  return null
}

function extractCategory(message: string): string {
  const categoryMap: Record<string, string> = {
    mercado: 'Alimentação',
    supermercado: 'Alimentação',
    restaurante: 'Alimentação',
    comida: 'Alimentação',
    lanche: 'Alimentação',
    combustivel: 'Transporte',
    combustível: 'Transporte',
    gasolina: 'Transporte',
    uber: 'Transporte',
    taxi: 'Transporte',
    táxi: 'Transporte',
    onibus: 'Transporte',
    ônibus: 'Transporte',
    luz: 'Serviços',
    agua: 'Serviços',
    água: 'Serviços',
    internet: 'Serviços',
    telefone: 'Serviços',
    conta: 'Serviços',
    salario: 'Salário',
    salário: 'Salário',
    freelance: 'Freelance',
    vendas: 'Vendas',
    farmacia: 'Saúde',
    farmácia: 'Saúde',
    medico: 'Saúde',
    médico: 'Saúde',
    consulta: 'Saúde',
    roupas: 'Vestuário',
    roupa: 'Vestuário',
    sapato: 'Vestuário',
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

export async function getAutomaticResponse(
  message: string,
  userId: string,
  supabaseAdmin: any
): Promise<string> {
  const lowerMsg = message.toLowerCase().trim()

  if (
    lowerMsg === 'oi' ||
    lowerMsg === 'olá' ||
    lowerMsg === 'ola' ||
    lowerMsg === 'hey' ||
    lowerMsg === 'inicio' ||
    lowerMsg === 'início' ||
    lowerMsg === 'começar'
  ) {
    return WELCOME_MESSAGES.join('\n')
  }

  if (
    lowerMsg.includes('ajuda') ||
    lowerMsg.includes('help') ||
    lowerMsg.includes('comandos')
  ) {
    return HELP_MESSAGES.join('\n')
  }

  if (lowerMsg.includes('sobre') || lowerMsg.includes('info')) {
    return ABOUT_MESSAGE
  }

  if (lowerMsg.includes('saldo') || lowerMsg.includes('quanto tenho')) {
    return await getBalance(userId, supabaseAdmin)
  }

  if (
    lowerMsg.includes('relatório') ||
    lowerMsg.includes('relatorio') ||
    lowerMsg.includes('resumo')
  ) {
    return await getMonthlyReport(userId, supabaseAdmin)
  }

  if (
    lowerMsg.includes('extrato') ||
    lowerMsg.includes('histórico') ||
    lowerMsg.includes('historico')
  ) {
    return await getTransactionHistory(userId, supabaseAdmin)
  }

  return `❓ Não entendi sua mensagem.

💡 Dicas:
• Para registrar gastos: "Gastei R$ 50 no mercado paguei no pix"
• Para ver saldo: "saldo"
• Para ajuda: "ajuda"

🤖 Estou aqui para ajudar com suas finanças!`
}

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

  const totalIncome =
    incomes?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0
  const totalExpense =
    expenses?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0
  const balance = totalIncome - totalExpense

  return `💰 SEU SALDO ATUAL

🟢 Receitas: ${formatCurrency(totalIncome)}
🔴 Despesas: ${formatCurrency(totalExpense)}
💰 Saldo: ${formatCurrency(balance)}

${
  balance > 0
    ? '✅ Você está no positivo!'
    : balance < 0
      ? '⚠️ Atenção: saldo negativo!'
      : '⚖️ Você está em equilíbrio.'
}`
}

async function getMonthlyReport(userId: string, supabaseAdmin: any): Promise<string> {
  if (!supabaseAdmin) return 'Erro: Sistema não configurado.'

  const currentMonth = new Date().toISOString().slice(0, 7)

  const { data: transactions } = await supabaseAdmin
    .from('transactions')
    .select('amount, type, category, date')
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

  const profit = income - expense

  return `📊 RELATÓRIO MENSAL

📅 Período: ${new Date().toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })}

🟢 Receitas: ${formatCurrency(income)}
🔴 Despesas: ${formatCurrency(expense)}
💰 Resultado: ${formatCurrency(profit)}

📈 Total de transações: ${transactions?.length || 0}

${
  profit > 0
    ? '✅ Mês positivo!'
    : profit < 0
      ? '⚠️ Mês no vermelho!'
      : '⚖️ Mês equilibrado!'
}`
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

  transactions.forEach((transaction: any) => {
    const emoji = transaction.type === 'income' ? '🟢' : '🔴'
    const signal = transaction.type === 'income' ? '+' : '-'

    history += `${emoji} ${signal}${formatCurrency(Number(transaction.amount))} | ${transaction.category || 'Sem categoria'}\n`
    history += `📅 ${new Date(transaction.date).toLocaleDateString('pt-BR')}\n\n`
  })

  return history + '💡 Digite "relatório" para ver resumo mensal!'
}
