let protocolosCache = null;
let produtosCache = null;
const CORES = ['c1','c2','c3','c4','c5','c6','c7','c8'];

function parseBrDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (s.includes('/')) {
    const [datePart, timePart] = s.split(' ');
    const [d, m, y] = datePart.split('/');
    const [h, min] = timePart ? timePart.split(':') : ['0','0'];
    if (!d || !m || !y || isNaN(+d) || isNaN(+m) || isNaN(+y)) return null;
    return new Date(+y, +m - 1, +d, +(h||0), +(min||0));
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

function isPromoAtiva(p) {
  if (!p.promo_preco || !p.promo_fim) return false;
  const now = new Date();
  const fim   = parseBrDate(p.promo_fim);
  const inicio = p.promo_inicio ? parseBrDate(p.promo_inicio) : new Date(0);
  if (!fim) return false;
  return now >= (inicio || new Date(0)) && now <= fim;
}

async function carregarProdutosLanding() {
  if (produtosCache) return produtosCache;
  try {
    const res = await fetch(SHEETS_URL + '?action=produtos');
    produtosCache = await res.json();
    return produtosCache;
  } catch(e) { return null; }
}

async function renderProdutosLanding() {
  const grid = document.getElementById('prod-grid');
  const [produtos, protocolos] = await Promise.all([
    carregarProdutosLanding(),
    carregarProtocolos()
  ]);
  if (!produtos) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#4A6278">⚠️ Erro ao carregar produtos.</div>';
    return;
  }
  grid.innerHTML = produtos.map((p, i) => {
    const cor = CORES[i % CORES.length];
    const tags = (Array.isArray(p.tags) ? p.tags : []).slice(0,3);
    const temProto = protocolos && protocolos[p.id];
    const promo = isPromoAtiva(p);
    const promoBadge = promo ? `<div style="display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,#e74c3c,#c0392b);color:white;font-size:.62rem;font-weight:800;padding:3px 9px;border-radius:20px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">🔥 PROMOÇÃO</div>` : '';
    const waText = encodeURIComponent(`Olá! Tenho interesse no produto ${p.nome} (${p.conc}). Podem me passar mais informações?`);
    return `
      <div class="prod-card">
        <div class="prod-card-top ${cor}">
          <div class="pc-icon">${p.icone || '💊'}</div>
          <div class="pc-conc">${p.conc}</div>
          <div class="pc-name">${p.nome}</div>
          <div class="pc-sub">${p.lab || ''}</div>
        </div>
        <div class="prod-card-body">
          ${promoBadge}
          <div class="pb-tags">${tags.map(t=>`<span class="pb-tag">${t}</span>`).join('')}</div>
          ${temProto ? `<button class="btn-protocolo" onclick="verProtocolo('${p.id}','${p.nome}','${p.icone || '💊'}','${p.conc}')">🔬 Ver Protocolo</button>` : ''}
          <a href="https://wa.me/12142049853?text=${waText}" class="btn-prod" target="_blank">💬 Solicitar Informações</a>
        </div>
      </div>`;
  }).join('');
}

async function carregarProtocolos() {
  if (protocolosCache) return protocolosCache;
  try {
    const res = await fetch(SHEETS_URL + '?action=protocolos');
    protocolosCache = await res.json();
    return protocolosCache;
  } catch(e) { return null; }
}

window.addEventListener('DOMContentLoaded', renderProdutosLanding);

async function verProtocolo(id, nome, icone, conc) {
  document.getElementById('proto-icon').textContent = icone;
  document.getElementById('proto-name').textContent = nome;
  document.getElementById('proto-conc').textContent = conc;
  document.getElementById('proto-body').innerHTML = '<div class="proto-loading">⏳ Carregando protocolo...</div>';
  document.getElementById('proto-overlay').classList.add('open');

  const protocolos = await carregarProtocolos();

  if (!protocolos || !protocolos[id]) {
    document.getElementById('proto-body').innerHTML = '<div class="proto-loading">⚠️ Protocolo não encontrado. Verifique a planilha.</div>';
    return;
  }

  const p = protocolos[id];

  document.getElementById('proto-body').innerHTML = `
    <div class="proto-section">
      <div class="proto-section-title">⚗️ Mecanismo de Ação</div>
      <div class="proto-section-text">${p.mecanismo}</div>
    </div>
    <div class="proto-section">
      <div class="proto-section-title">💉 Reconstituição</div>
      <div class="proto-section-text">${p.reconstituicao}</div>
    </div>
    <div class="proto-section">
      <div class="proto-section-title">📊 Dosagem</div>
      <div class="proto-section-text">${p.dosagem}</div>
    </div>
    <div class="proto-section">
      <div class="proto-section-title">🗂️ Protocolos Clínicos</div>
      <div class="proto-protocols">
        ${[p.protocolo1, p.protocolo2, p.protocolo3].filter(Boolean).map(prot => {
          const parts = prot.split(':');
          const pname = parts[0] || '';
          const pdesc = parts.slice(1).join(':').trim();
          return `<div class="proto-protocol-item">
            <div class="proto-protocol-name">${pname}</div>
            ${pdesc ? `<div class="proto-protocol-desc">${pdesc}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="proto-section">
      <div class="proto-section-title">⚠️ Cuidados e Contraindicações</div>
      <div class="proto-warning">${p.cuidados}</div>
    </div>`;
}

function fecharProtocolo(e) {
  if (e.target === document.getElementById('proto-overlay')) {
    document.getElementById('proto-overlay').classList.remove('open');
  }
}
