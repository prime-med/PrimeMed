let protocolosCache = null;
let produtosCache = null;
const CORES = ['c1','c2','c3','c4','c5','c6','c7','c8'];

// ─── IMAGEM DE PRODUTO / PLACEHOLDER ────────────────────────────────────────
function _imgHashTone(str) {
  let h = 0; const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 10;
}
window.imgFallback = function(imgEl) {
  const tone = imgEl.dataset.tone || '0';
  const icon = imgEl.dataset.icon || '📦';
  const sizeClass = imgEl.dataset.sizeClass || '';
  const div = document.createElement('div');
  div.className = `img-placeholder ${sizeClass} tone-${tone}`;
  div.innerHTML = `<span class="ph-icon">${icon}</span>`;
  imgEl.replaceWith(div);
};
function productImageHTML(p, sizeClass) {
  const tone = _imgHashTone(p.categoria || p.id || p.nome || '');
  const icon = p.icone || '📦';
  const cls = sizeClass || '';
  if (p.imagem) {
    const src = `assets/img/produtos/${p.imagem}`;
    return `<img class="product-img ${cls}" src="${escAttr(src)}" alt="${escAttr(p.nome)}" loading="lazy"
      data-tone="${tone}" data-icon="${escAttr(icon)}" data-size-class="${escAttr(cls)}"
      onerror="imgFallback(this)"/>`;
  }
  return `<div class="img-placeholder ${cls} tone-${tone}"><span class="ph-icon">${esc(icon)}</span></div>`;
}

// ── ESCAPE HTML ──
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return String(s || '').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

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

// Paginação landing: mostra primeiros N produtos, botão "Ver mais"
const _LANDING_PROD_LIMIT = 12;
let _landingProdutosCache = null;
let _landingProdutosShown = _LANDING_PROD_LIMIT;

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
  _landingProdutosCache = produtos;
  _landingProdutosShown = _LANDING_PROD_LIMIT;
  _renderLandingProdutosBatch();
}

function _renderLandingProdutosBatch() {
  const grid = document.getElementById('prod-grid');
  const produtos = _landingProdutosCache || [];
  const protocolos = protocolosCache || {};
  const showCount = Math.min(_landingProdutosShown, produtos.length);
  const visiveis = produtos.slice(0, showCount);
  const restantes = produtos.length - showCount;

  grid.innerHTML = visiveis.map((p, i) => {
    const cor = CORES[i % CORES.length];
    const tags = (Array.isArray(p.tags) ? p.tags : []).slice(0,3);
    const temProto = protocolos && protocolos[p.id];
    const promo = isPromoAtiva(p);
    const promoBadge = promo ? `<div style="display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,#e74c3c,#c0392b);color:white;font-size:.62rem;font-weight:800;padding:3px 9px;border-radius:20px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">🔥 PROMOÇÃO</div>` : '';
    const waText = encodeURIComponent(`Olá! Tenho interesse no produto ${p.nome} (${p.conc}). Podem me passar mais informações?`);
    const waHref = WA_NUMBER
      ? `https://wa.me/${WA_NUMBER}?text=${waText}`
      : '#';
    return `
      <div class="prod-card">
        <div class="prod-card-top ${cor}">
          ${productImageHTML(p, 'prod-card-img')}
          <div class="pc-conc">${esc(p.conc)}</div>
          <div class="pc-name">${esc(p.nome)}</div>
          <div class="pc-sub">${esc(p.lab || '')}</div>
        </div>
        <div class="prod-card-body">
          ${promoBadge}
          <div class="pb-tags">${tags.map(t=>`<span class="pb-tag">${esc(t)}</span>`).join('')}</div>
          ${temProto ? `<button class="btn-protocolo" onclick="verProtocolo('${escAttr(p.id)}','${escAttr(p.nome)}','${escAttr(p.icone || '📦')}','${escAttr(p.conc)}')">🔬 Ver Detalhes</button>` : ''}
          <a href="${waHref}" class="btn-prod" target="_blank">💬 Solicitar Informações</a>
        </div>
      </div>`;
  }).join('');

  // Botão "Ver mais" se ainda há produtos não exibidos
  if (restantes > 0) {
    const moreBtn = document.createElement('div');
    moreBtn.className = 'prod-more-wrap';
    moreBtn.innerHTML = `
      <button class="prod-more-btn" onclick="verMaisProdutos()">
        Ver mais ${restantes} produto${restantes !== 1 ? 's' : ''} ↓
      </button>`;
    grid.parentNode.insertBefore(moreBtn, grid.nextSibling);
  } else {
    // Remove botão se já mostrou tudo
    const old = document.querySelector('.prod-more-wrap');
    if (old) old.remove();
  }
}

function verMaisProdutos() {
  _landingProdutosShown += _LANDING_PROD_LIMIT;
  // Remove botão antigo antes de re-renderizar
  const old = document.querySelector('.prod-more-wrap');
  if (old) old.remove();
  _renderLandingProdutosBatch();
}

async function carregarProtocolos() {
  if (protocolosCache) return protocolosCache;
  try {
    const res = await fetch(SHEETS_URL + '?action=protocolos');
    protocolosCache = await res.json();
    return protocolosCache;
  } catch(e) { return null; }
}

window.addEventListener('DOMContentLoaded', () => {
  renderProdutosLanding();
  initHeroLogado();
  initStickyCta();
});

// ─── HERO: BOAS-VINDAS + ATALHOS PARA CLIENTE LOGADO ───────────────────────
function initHeroLogado() {
  try {
    const sess = (typeof getClienteSession === 'function') ? getClienteSession() : null;
    if (!sess || !sess.token) return;
    const greet  = document.getElementById('welcome-greet');
    const quick  = document.getElementById('quick-actions');
    const name   = document.getElementById('greet-name');
    const nome   = sess.apelido || sess.nome || sess.responsavel || 'cliente';
    const primeiro = String(nome).trim().split(' ')[0];
    if (name)  name.textContent = primeiro;
    if (greet) greet.style.display = 'inline-flex';
    if (quick) quick.style.display = 'grid';
  } catch(e) { /* sem sessão */ }
}

// ─── STICKY CTA: aparece após o hero, sobe junto quando o footer entra ─────
function initStickyCta() {
  const cta    = document.getElementById('sticky-cta');
  const hero   = document.querySelector('.hero');
  const footer = document.querySelector('footer');
  if (!cta || !hero) return;
  let ticking = false;
  function check() {
    const heroBottom = hero.offsetTop + hero.offsetHeight * 0.7;
    const passedHero = window.scrollY > heroBottom;
    cta.classList.toggle('visible', passedHero);
    // Quando footer entra na viewport, empurra o sticky pra cima dele.
    // Clamp pela altura do footer pra não ultrapassar.
    if (footer) {
      const r = footer.getBoundingClientRect();
      const raw = window.innerHeight - r.top;
      const overlap = Math.max(0, Math.min(raw, footer.offsetHeight));
      cta.style.bottom = overlap + 'px';
    }
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(check); ticking = true; }
  }, { passive: true });
  window.addEventListener('resize', check, { passive: true });
  check();
}

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
      <div class="proto-section-text">${esc(p.mecanismo)}</div>
    </div>
    <div class="proto-section">
      <div class="proto-section-title">💉 Reconstituição</div>
      <div class="proto-section-text">${esc(p.reconstituicao)}</div>
    </div>
    <div class="proto-section">
      <div class="proto-section-title">📊 Dosagem</div>
      <div class="proto-section-text">${esc(p.dosagem)}</div>
    </div>
    <div class="proto-section">
      <div class="proto-section-title">🗂️ Protocolos Clínicos</div>
      <div class="proto-protocols">
        ${[p.protocolo1, p.protocolo2, p.protocolo3].filter(Boolean).map(prot => {
          const parts = prot.split(':');
          const pname = parts[0] || '';
          const pdesc = parts.slice(1).join(':').trim();
          return `<div class="proto-protocol-item">
            <div class="proto-protocol-name">${esc(pname)}</div>
            ${pdesc ? `<div class="proto-protocol-desc">${esc(pdesc)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="proto-section">
      <div class="proto-section-title">⚠️ Cuidados e Contraindicações</div>
      <div class="proto-warning">${esc(p.cuidados)}</div>
    </div>`;
}

function fecharProtocolo(e) {
  if (e.target === document.getElementById('proto-overlay')) {
    document.getElementById('proto-overlay').classList.remove('open');
  }
}
