// Retired. Card payments ended in October 2026; the last Worldpay webhook
// arrived on 1 August 2026. This endpoint now records nothing and marks
// nothing paid (see AGENTS.md: never mark money received without proof).

Deno.serve(() =>
  new Response(JSON.stringify({ error: "worldpay_retired" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  })
);
