(async () => {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const routes = [
    "/",
    "/login",
    "/register",
    "/dashboard",
    "/transactions",
    "/analytics",
    "/bills",
    "/reminders",
    "/goals",
  ];

  for (const route of routes) {
    try {
      const res = await fetch(baseUrl + route, { redirect: "follow" });
      const text = await res.text();

      const titleMatch =
        text.match(/<title>(.*?)<\/title>/i) ||
        text.match(/<h1[^>]*>(.*?)<\/h1>/i) ||
        text.match(/🤖 AssistentePro|Página inicial/i);

      const snippet = Array.isArray(titleMatch)
        ? titleMatch[1]?.trim().replace(/\s+/g, " ") || titleMatch[0]
        : text.slice(0, 200).replace(/\s+/g, " ");

      console.log(`${route} -> ${res.status} - ${snippet}`);
    } catch (err) {
      console.error(`${route} -> ERROR`, err.message || err);
    }
  }
})();
