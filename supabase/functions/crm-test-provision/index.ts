// Provisioning is complete. This final handler has no privileged operations.
Deno.serve(() => new Response('Provisioning disabled', { status: 410 }));
