const { Client } = require('pg');

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  throw new Error('Missing SUPABASE_DB_URL. Defina no ambiente antes de rodar este script.');
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function getColumns(table) {
  const { rows } = await client.query(
    `select column_name
     from information_schema.columns
     where table_schema='public' and table_name=$1`,
    [table]
  );
  return new Set(rows.map(r => r.column_name));
}

function monthDay(year, month, day) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

async function insertRow(table, columns, values) {
  const cols = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  await client.query(`insert into public.${table} (${cols}) values (${placeholders})`, values);
}

async function seed() {
  await client.connect();

  const authUser = await client.query(
    `select id, email from auth.users order by created_at desc limit 1`
  );

  if (!authUser.rows.length) {
    throw new Error('Nenhum usuário encontrado em auth.users. Faça login e tente novamente.');
  }

  const userId = authUser.rows[0].id;
  const email = authUser.rows[0].email || `${userId}@local`;
  const name = email.split('@')[0] || 'Usuario';

  await client.query(
    `insert into public.users (id, email, name)
     values ($1, $2, $3)
     on conflict (id) do update set email = excluded.email, name = excluded.name`,
    [userId, email, name]
  );

  const transactionsCols = await getColumns('transactions');
  const goalsCols = await getColumns('financial_goals');
  const remindersCols = await getColumns('reminders');
  const payableCols = await getColumns('accounts_payable');
  const receivableCols = await getColumns('accounts_receivable');

  for (let month = 1; month <= 12; month++) {
    const year = 2026;

    // Transactions: 3 income + 3 expense
    const incomes = [
      { amount: 1200 + month * 10, category: 'Barbearia', description: `Serviços Barbearia ${month}/${year}`, client_name: 'Cliente Barbearia' },
      { amount: 800 + month * 8, category: 'Loja', description: `Vendas Loja ${month}/${year}`, client_name: 'Cliente Loja' },
      { amount: 1500 + month * 12, category: 'Pessoal', description: `Receita Pessoal ${month}/${year}`, client_name: 'Cliente Pessoal' },
    ];
    const expenses = [
      { amount: 500 + month * 6, category: 'Barbearia', description: `Produtos Barbearia ${month}/${year}`, supplier_name: 'Fornecedor Barbearia' },
      { amount: 650 + month * 7, category: 'Loja', description: `Reposição Loja ${month}/${year}`, supplier_name: 'Fornecedor Loja' },
      { amount: 400 + month * 5, category: 'Pessoal', description: `Despesa Pessoal ${month}/${year}`, supplier_name: 'Fornecedor Pessoal' },
    ];

    const txDates = [monthDay(year, month, 5), monthDay(year, month, 10), monthDay(year, month, 15)];

    for (let i = 0; i < incomes.length; i++) {
      const baseCols = ['user_id', 'amount', 'type', 'date', 'description'];
      const baseVals = [userId, incomes[i].amount, 'income', txDates[i], incomes[i].description];

      if (transactionsCols.has('category')) {
        baseCols.push('category');
        baseVals.push(incomes[i].category);
      }
      if (transactionsCols.has('payment_method')) {
        baseCols.push('payment_method');
        baseVals.push('pix');
      }
      if (transactionsCols.has('client_name')) {
        baseCols.push('client_name');
        baseVals.push(incomes[i].client_name);
      }

      await insertRow('transactions', baseCols, baseVals);
    }

    for (let i = 0; i < expenses.length; i++) {
      const baseCols = ['user_id', 'amount', 'type', 'date', 'description'];
      const baseVals = [userId, expenses[i].amount, 'expense', txDates[i], expenses[i].description];

      if (transactionsCols.has('category')) {
        baseCols.push('category');
        baseVals.push(expenses[i].category);
      }
      if (transactionsCols.has('payment_method')) {
        baseCols.push('payment_method');
        baseVals.push('cash');
      }
      if (transactionsCols.has('supplier_name')) {
        baseCols.push('supplier_name');
        baseVals.push(expenses[i].supplier_name);
      }

      await insertRow('transactions', baseCols, baseVals);
    }

    // Accounts: 2 payable + 1 receivable
    const dueDates = [monthDay(year, month, 7), monthDay(year, month, 14), monthDay(year, month, 21)];

    if (payableCols.size) {
      const payableColsList = ['user_id', 'supplier_name', 'amount', 'due_date', 'description', 'status'];
      if (payableCols.has('payment_method')) payableColsList.push('payment_method');

      await insertRow('accounts_payable', payableColsList, [userId, `Fornecedor Barbearia ${month}/${year}`, 350 + month * 3, dueDates[0], `Conta Barbearia ${month}/${year}`, 'pending', ...(payableCols.has('payment_method') ? ['pix'] : [])]);
      await insertRow('accounts_payable', payableColsList, [userId, `Fornecedor Loja ${month}/${year}`, 420 + month * 4, dueDates[1], `Conta Loja ${month}/${year}`, 'pending', ...(payableCols.has('payment_method') ? ['cash'] : [])]);
    }

    if (receivableCols.size) {
      const receivableColsList = ['user_id', 'client_name', 'amount', 'due_date', 'description', 'status'];
      if (receivableCols.has('payment_method')) receivableColsList.push('payment_method');

      await insertRow('accounts_receivable', receivableColsList, [userId, `Cliente ${month}/${year}`, 900 + month * 9, dueDates[2], `Recebimento ${month}/${year}`, 'pending', ...(receivableCols.has('payment_method') ? ['pix'] : [])]);
    }

    // Reminders: 3
    if (remindersCols.size) {
      const reminderColsList = ['user_id', 'title', 'reminder_type', 'due_date', 'status'];
      if (remindersCols.has('description')) reminderColsList.push('description');
      if (remindersCols.has('send_notification')) reminderColsList.push('send_notification');

      const reminderData = [
        { title: `Reunião Barbearia ${month}/${year}`, type: 'meeting', desc: 'Revisar agenda da barbearia' },
        { title: `Entrega Loja ${month}/${year}`, type: 'task', desc: 'Conferir estoque da loja' },
        { title: `Planejamento Pessoal ${month}/${year}`, type: 'review', desc: 'Revisar gastos pessoais' },
      ];

      for (let i = 0; i < reminderData.length; i++) {
        const cols = [...reminderColsList];
        const vals = [userId, reminderData[i].title, reminderData[i].type, monthDay(year, month, 18 + i), 'pending'];
        if (remindersCols.has('description')) vals.push(reminderData[i].desc);
        if (remindersCols.has('send_notification')) vals.push(true);
        await insertRow('reminders', cols, vals);
      }
    }

    // Goals: 2 per month
    if (goalsCols.size) {
      const deadlineField = goalsCols.has('deadline') ? 'deadline' : (goalsCols.has('target_date') ? 'target_date' : null);
      const baseCols = ['user_id', 'name', 'target_amount', 'current_amount', 'category'];
      if (deadlineField) baseCols.push(deadlineField);
      if (goalsCols.has('description')) baseCols.push('description');
      if (goalsCols.has('status')) baseCols.push('status');

      const goalEntries = [
        { name: `Meta Barbearia ${month}/${year}`, amount: 5000 + month * 50, category: 'savings', desc: 'Reserva para expansão' },
        { name: `Meta Loja ${month}/${year}`, amount: 3000 + month * 30, category: 'investment', desc: 'Investimento em estoque' },
      ];

      for (let i = 0; i < goalEntries.length; i++) {
        const cols = [...baseCols];
        const vals = [userId, goalEntries[i].name, goalEntries[i].amount, 0, goalEntries[i].category];
        if (deadlineField) vals.push(monthDay(year, month, 28));
        if (goalsCols.has('description')) vals.push(goalEntries[i].desc);
        if (goalsCols.has('status')) vals.push('not_started');
        await insertRow('financial_goals', cols, vals);
      }
    }
  }

  console.log('Seed 2026 concluído com sucesso.');
}

seed()
  .catch(err => {
    console.error('Erro ao rodar seed:', err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
