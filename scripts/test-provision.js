(async () => {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/provision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: "+5511999999999",
        email: "test@example.com",
        name: "Test User",
      }),
    });

    const text = await res.text();

    console.log("Response status:", res.status);
    console.log("Response body:", text);
  } catch (err) {
    console.error("Request failed:", err.message || err);
    process.exit(1);
  }
})();
