import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID
const REMINDER_CRON_SECRET = process.env.REMINDER_CRON_SECRET

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (REMINDER_CRON_SECRET && auth !== `Bearer ${REMINDER_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: reminders, error } = await supabaseAdmin
    .from('reminders')
    .select('id, user_id, title, description, due_date, due_time, send_notification, notification_sent_at, users(whatsapp_number, name)')
    .eq('due_date', today)
    .eq('status', 'pending')
    .eq('send_notification', true)
    .is('notification_sent_at', null)

  if (error) {
    console.error('Erro ao buscar lembretes:', error)
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 })
  }

  let sent = 0

  for (const reminder of reminders || []) {
    const userRow = Array.isArray(reminder.users) ? reminder.users[0] : reminder.users
    const whatsappNumber = userRow?.whatsapp_number as string | undefined
    if (whatsappNumber && META_ACCESS_TOKEN && META_PHONE_NUMBER_ID) {
      const body = buildReminderMessage(reminder)
      await sendMetaMessage(whatsappNumber, body)
    }

    await supabaseAdmin
      .from('reminders')
      .update({ notification_sent_at: new Date().toISOString() })
      .eq('id', reminder.id)

    sent += 1
  }

  return NextResponse.json({ success: true, sent })
}

function buildReminderMessage(reminder: any) {
  const time = reminder.due_time ? ` às ${reminder.due_time}` : ''
  const title = reminder.title || 'Compromisso'
  const description = reminder.description ? `\n${reminder.description}` : ''
  return `🔔 Lembrete do AssistentePro\n\n${title}${description}\n🗓️ ${reminder.due_date}${time}`
}

async function sendMetaMessage(to: string, body: string) {
  const url = `https://graph.facebook.com/v20.0/${META_PHONE_NUMBER_ID}/messages`

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${META_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body }
    })
  })
}
