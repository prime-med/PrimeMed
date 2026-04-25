const CACHE = 'pharmafit-admin-v2';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── NOTIFICATION CLICK ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const orderId  = e.notification.data?.orderId;
  const baseUrl  = self.registration.scope + 'painel.html';
  const targetUrl = orderId ? `${baseUrl}?openOrder=${orderId}` : baseUrl;

  e.waitUntil((async () => {
    const all      = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = all.find(c => c.url.includes('painel.html'));
    if (existing) {
      await existing.focus();
      if (orderId) existing.postMessage({ type: 'OPEN_ORDER', orderId });
    } else {
      clients.openWindow(targetUrl);
    }
  })());
});

// ── PERIODIC BACKGROUND SYNC ──────────────────────────────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-pedidos') e.waitUntil(checkNewOrdersBg());
});

async function checkNewOrdersBg() {
  let state;
  try {
    const cache = await caches.open('pharmafit-sw-state');
    const resp  = await cache.match('sw-state');
    if (!resp) return;
    state = await resp.json();
    if (!state?.token) return;
  } catch(_) { return; }

  try {
    const url = new URL(state.sheetsUrl);
    url.searchParams.set('action', 'painel_pedidos');
    url.searchParams.set('email',  state.email);
    url.searchParams.set('token',  state.token);
    const data = await fetch(url.toString()).then(r => r.json());
    if (!data.ok) return;

    const known = new Set(state.knownIds.map(String));
    const novos = data.pedidos.filter(p => !known.has(String(p.id)) && p.status === 'Novo');

    for (const order of novos) {
      const corpo = (order.produtos || '').split('\n')[0]?.replace(/^\d+x\s*/, '') || '';
      await self.registration.showNotification(`📦 Novo pedido — ${order.clinica || ''}`, {
        body: corpo,
        icon: './icons/icon-192.svg',
        tag:  `pedido-${order.id}`,
        data: { orderId: order.id },
      });
    }

    // Atualiza IDs conhecidos no cache para o próximo ciclo
    const newState = { ...state, knownIds: data.pedidos.map(p => String(p.id)) };
    const cache2 = await caches.open('pharmafit-sw-state');
    await cache2.put('sw-state', new Response(JSON.stringify(newState), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch(_) {}
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // não cacheia CDN externo

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
