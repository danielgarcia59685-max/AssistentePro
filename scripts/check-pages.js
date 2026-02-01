(async () => {
  const routes = ['/', '/login', '/register', '/dashboard', '/transactions', '/analytics', '/bills', '/reminders', '/goals']
  for (const r of routes) {
    try {
      const res = await fetch('http://localhost:3000' + r, { redirect: 'follow' })
      const text = await res.text()
      const titleMatch = text.match(/<title>(.*?)<\/title>/i) || text.match(/<h1[^>]*>(.*?)<\/h1>/i) || text.match(/🤖 AssistentePro|Página inicial/)
      const snippet = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : text.slice(0, 200).replace(/\s+/g, ' ')
      console.log(r, '->', res.status, '-', snippet)
    } catch (err) {
      console.error(r, '-> ERROR', err.message || err)
    }
  }
})();
