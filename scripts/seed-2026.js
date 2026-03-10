const { Client } = require("pg");

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  throw new Error("Missing SUPABASE_DB_URL. Defina no ambiente antes de rodar este script.");
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function getColumns(table) {
  const { rows } = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    [table]
  );

  return new Set(rows.map((row) => row.column_name));
}

function monthDay(year, month, day) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

async function insertRow(table, columns, values) {
  const cols = columns.map((col) => `"${col}"`).join(", ");
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");

  await client.query(
    `INSERT INTO public.${table} (${cols}) VALUES (${placeholders})`,
    values
  );
}

async function seed() {
  await client.connect();

  const authUser = await client.query(`
    SELECT id, email
    FROM auth.users
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (!authUser.rows.length) {
    throw new Error("Nenhum usuário encontrado em auth.users. Faça login e tente novamente.");
  }

  const userId = authUser.rows[0].id;
  const email = authUser.rows[0].email || `${userId}@local`;
  const name = email.split("@")[0] || "Usuario";

  await client.query(
    `
      INSERT INTO public.users (id, email, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (id)
      DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name
    `,
    [userId, email, name]
  );

  const transactionsCols = await getColumns("transactions");
  const goalsCols = await getColumns("financial_goals");
  const remindersCols = await getColumns("reminders");
  const payableCols = await getColumns("accounts_payable");
  const receivableCols = await getColumns("accounts_receivable");

  for (let month = 1; month <= 12; month++) {
    const year = 2026;

    const incomes = [
      {
        amount: 1200 + month * 10,
        category: "Barbearia",
        description: `Serviços Barbearia ${month}/${year}`,
        client_name: "Cliente Barbearia",
      },
      {
        amount: 800 + month * 8,
        category: "Loja",
        description: `Vendas Loja ${month}/${year}`,
        client_name: "Cliente Loja",
      },
      {
        amount: 1500 + month * 12,
        category: "Pessoal",
        description: `Receita Pessoal ${month}/${year}`,
        client_name: "Cliente Pessoal",
      },
    ];

    const expenses = [
      {
        amount: 500 + month * 6,
        category: "Barbearia",
        description: `Produtos Barbearia ${month}/${year}`,
        supplier_name: "Fornecedor Barbearia",
      },
      {
        amount: 650 + month * 7,
        category: "Loja",
        description: `Reposição Loja ${month}/${year}`,
        supplier_name: "Fornecedor Loja",
      },
      {
        amount: 400 + month * 5,
        category: "Pessoal",
        description: `Despesa Pessoal ${month}/${year}`,
        supplier_name: "Fornecedor Pessoal",
      },
    ];

    const txDates = [
      monthDay(year, month, 5),
      monthDay(year, month, 10),
      monthDay(year, month, 15),
    ];

    for (let i = 0; i < incomes.length; i++) {
      const columns = ["user_id", "amount", "type", "date", "description"];
      const values = [
        userId,
        incomes[i].amount,
        "income",
        txDates[i],
        incomes[i].description,
      ];

      if (transactionsCols.has("category")) {
        columns.push("category");
        values.push(incomes[i].category);
      }

      if (transactionsCols.has("payment_method")) {
        columns.push("payment_method");
        values.push("pix");
      }

      if (transactionsCols.has("client_name")) {
        columns.push("client_name");
        values.push(incomes[i].client_name);
      }

      await insertRow("transactions", columns, values);
    }

    for (let i = 0; i < expenses.length; i++) {
      const columns = ["user_id", "amount", "type", "date", "description"];
      const values = [
        userId,
        expenses[i].amount,
        "expense",
        txDates[i],
        expenses[i].description,
      ];

      if (transactionsCols.has("category")) {
        columns.push("category");
        values.push(expenses[i].category);
      }

      if (transactionsCols.has("payment_method")) {
        columns.push("payment_method");
        values.push("cash");
      }

      if (transactionsCols.has("supplier_name")) {
        columns.push("supplier_name");
        values.push(expenses[i].supplier_name);
      }

      await insertRow("transactions", columns, values);
    }

    const dueDates = [
      monthDay(year, month, 7),
      monthDay(year, month, 14),
      monthDay(year, month, 21),
    ];

    if (payableCols.size > 0) {
      const payableColumns = [
        "user_id",
        "supplier_name",
        "amount",
        "due_date",
        "description",
        "status",
      ];

      const payableValues1 = [
        userId,
        `Fornecedor Barbearia ${month}/${year}`,
        350 + month * 3,
        dueDates[0],
        `Conta Barbearia ${month}/${year}`,
        "pending",
      ];

      const payableValues2 = [
        userId,
        `Fornecedor Loja ${month}/${year}`,
        420 + month * 4,
        dueDates[1],
        `Conta Loja ${month}/${year}`,
        "pending",
      ];

      if (payableCols.has("payment_method")) {
        payableColumns.push("payment_method");
        payableValues1.push("pix");
        payableValues2.push("cash");
      }

      await insertRow("accounts_payable", payableColumns, payableValues1);
      await insertRow("accounts_payable", payableColumns, payableValues2);
    }

    if (receivableCols.size > 0) {
      const receivableColumns = [
        "user_id",
        "client_name",
        "amount",
        "due_date",
        "description",
        "status",
      ];

      const receivableValues = [
        userId,
        `Cliente ${month}/${year}`,
        900 + month * 9,
        dueDates[2],
        `Recebimento ${month}/${year}`,
        "pending",
      ];

      if (receivableCols.has("payment_method")) {
        receivableColumns.push("payment_method");
        receivableValues.push("pix");
      }

      await insertRow("accounts_receivable", receivableColumns, receivableValues);
    }

    if (remindersCols.size > 0) {
      const reminderData = [
        {
          title: `Reunião Barbearia ${month}/${year}`,
          type: "meeting",
          desc: "Revisar agenda da barbearia",
        },
        {
          title: `Entrega Loja ${month}/${year}`,
          type: "task",
          desc: "Conferir estoque da loja",
        },
        {
          title: `Planejamento Pessoal ${month}/${year}`,
          type: "review",
          desc: "Revisar gastos pessoais",
        },
      ];

      for (let i = 0; i < reminderData.length; i++) {
        const columns = ["user_id", "title", "reminder_type", "due_date", "status"];
        const values = [
          userId,
          reminderData[i].title,
          reminderData[i].type,
          monthDay(year, month, 18 + i),
          "pending",
        ];

        if (remindersCols.has("description")) {
          columns.push("description");
          values.push(reminderData[i].desc);
        }

        if (remindersCols.has("send_notification")) {
          columns.push("send_notification");
          values.push(true);
        }

        await insertRow("reminders", columns, values);
      }
    }

    if (goalsCols.size > 0) {
      const deadlineField = goalsCols.has("deadline")
        ? "deadline"
        : goalsCols.has("target_date")
          ? "target_date"
          : null;

      const goalEntries = [
        {
          name: `Meta Barbearia ${month}/${year}`,
          amount: 5000 + month * 50,
          category: "savings",
          desc: "Reserva para expansão",
        },
        {
          name: `Meta Loja ${month}/${year}`,
          amount: 3000 + month * 30,
          category: "investment",
          desc: "Investimento em estoque",
        },
      ];

      for (let i = 0; i < goalEntries.length; i++) {
        const columns = ["user_id", "name", "target_amount", "current_amount", "category"];
        const values = [
          userId,
          goalEntries[i].name,
          goalEntries[i].amount,
          0,
          goalEntries[i].category,
        ];

        if (deadlineField) {
          columns.push(deadlineField);
          values.push(monthDay(year, month, 28));
        }

        if (goalsCols.has("description")) {
          columns.push("description");
          values.push(goalEntries[i].desc);
        }

        if (goalsCols.has("status")) {
          columns.push("status");
          values.push("not_started");
        }

        await insertRow("financial_goals", columns, values);
      }
    }
  }

  console.log("Seed 2026 concluído com sucesso.");
}

seed()
  .catch((err) => {
    console.error("Erro ao rodar seed:", err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
