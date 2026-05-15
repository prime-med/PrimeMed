// FRETE_TABELA, buscarCEP e mascaraCep → frete.js
let freteValor = 0;
let freteMetodo = '';
let freteCep = '';
let freteEstado = '';

// ── ESCAPE HTML ──
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return String(s || '').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ─── STATE ──────────────────────────────────────────────────────────────────
// ─── CORRELAÇÕES ────────────────────────────────────────────────────────────
// "Você se esqueceu de algo?" — sugere produtos relacionados ao que está no
// carrinho. Lógica de domínio (peptídeos/estética):
//   • Vials/pó → sempre acompanha água bact (32) + seringa (45)
//   • Canetas GLP-1 → agulhas (41) + porta ampolas (53)
//   • Sinérgicos: BPC↔TB, NAD↔SS-31↔Epithalon, Selank↔Semax, GH-secretagogos
//   • Up-sell por categoria: GHK-Cu↔Klow↔GLOW, Sculptra↔Radiesse↔Biofill
const CORRELACOES = {
  // GLP-1 / GIP — emagrecimento
  '1':  ['41','53','6'],         // Tirzepatida Pen TNL → agulhas, porta ampolas, Tirzepatida USA (alternativa)
  '2':  ['32','45','4'],         // Retatrutide vial PeptiSciences → água bact, seringa, Retatrutide Pen
  '3':  ['32','45','4'],         // Retatrutide 10mg 4 Vials → água, seringa, Retatrutide Pen
  '4':  ['41','53','5'],         // Retatrutide Pen TNL → agulhas, porta ampolas, alternativa Oxygen
  '5':  ['41','53','4'],         // Retatrutide Pen Oxygen → agulhas, porta ampolas, alternativa TNL
  '6':  ['32','45','1'],         // Tirzepatida USA vial → água, seringa, Tirzepatida Pen
  '29': ['32','45','1'],         // Tirzepatida 60mg vial → água, seringa, Tirzepatida Pen
  '31': ['32','45','29'],        // Tirzepatida 150mg SEM ÁGUA → água bact obrigatória, seringa
  '56': ['32','45','4'],         // Retatrutide 40mg USA → água, seringa, Retatrutide Pen
  '58': ['32','45','1'],         // Tirzepatida Tirzec → água, seringa, Tirzepatida Pen
  '59': ['32','45','58'],        // TG Tirzepatida 4 ampolas → água, seringa, Tirzec (alternativa menor)
  '60': ['36','14','32'],        // Lipoless → CBL 514, Momm, água

  // Peptídeos lipolíticos / mimético exercício
  '7':  ['32','45','33'],        // AOD-9604 → água, seringa, HGH-Frag
  '33': ['32','45','7'],         // HGH-Frag → água, seringa, AOD-9604
  '38': ['39','7','32'],         // SLU-pp-322 inj → SLU oral, AOD, água
  '39': ['38','7','33'],         // SLU-pp-322 oral → SLU inj, AOD, HGH-Frag

  // BPC / TB — reparador, cicatrização
  '16': ['18','32','45'],        // BPC-157 → TB-500, água, seringa
  '18': ['16','32','45'],        // TB-500 → BPC-157, água, seringa
  '19': ['25','32','45'],        // BPC + TB Blend → CJC+IPA, água, seringa
  '34': ['32','45','16'],        // Most-c → água, seringa, BPC-157

  // GH-secretagogos
  '25': ['37','33','32'],        // CJC no DAC + IPA → Ipamorelin, HGH-Frag, água
  '37': ['25','33','32'],        // Ipamorelin → CJC+IPA, HGH-Frag, água
  '40': ['37','25','32'],        // Semorelin → Ipamorelin, CJC+IPA, água
  '55': ['25','37','32'],        // Tesamorelin → CJC+IPA, Ipamorelin, água

  // Cosméticos / cabelo / pele (Klow, GHK-Cu, GLOW)
  '8':  ['9','24','32'],         // Klow 80mg → GHK-Cu 100, GLOW, água
  '9':  ['8','24','32'],         // GHK-Cu 100mg → Klow, GLOW, água
  '24': ['9','8','49'],          // GLOW 70mg → GHK-Cu, Klow, Glow injetável
  '26': ['9','24','32'],         // Klow 80mg (id duplicado) → GHK-Cu, GLOW, água
  '27': ['9','8','24'],          // GHK-Cu 50mg → GHK-Cu 100, Klow, GLOW
  '28': ['9','8','24'],          // GHK-Cu 50mg (dup) → GHK-Cu 100, Klow, GLOW
  '49': ['9','24','12'],         // Glow injetável → GHK-Cu, GLOW oral, BiologicalFace

  // Cognitivo / nootrópicos / libido
  '17': ['22','23','32'],        // PT-141 → Selank, Semax, água
  '22': ['23','17','32'],        // Selank → Semax, PT-141, água
  '23': ['22','17','32'],        // Semax → Selank, PT-141, água

  // Longevidade / mitocondrial
  '20': ['30','21','35'],        // NAD+ 500mg → NAD+ 1000mg (up-sell), SS-31, Epithalon
  '21': ['20','30','35'],        // SS-31 → NAD+ 500, NAD+ 1000, Epithalon
  '30': ['20','21','35'],        // NAD+ 1000mg → NAD+ 500, SS-31, Epithalon
  '35': ['20','21','30'],        // Epithalon → NAD+ 500, SS-31, NAD+ 1000

  // Esteroides / hormonal
  '11': ['13','32','45'],        // Durateston → Oxandrolona, água, seringa
  '13': ['11','7','33'],         // Oxandrolona → Durateston, AOD, HGH-Frag

  // Estética dermal / bioestimuladores
  '10': ['46','50','12'],        // Sculptra → Radiesse, Biofill Contour, BiologicalFace
  '12': ['44','15','50'],        // BiologicalFace → Israderm, Line Body, Biofill
  '14': ['15','36','60'],        // Momm → Line Body, CBL 514, Lipoless
  '15': ['14','36','12'],        // Line Body → Momm, CBL 514, BiologicalFace
  '36': ['14','15','60'],        // CBL 514 → Momm, Line Body, Lipoless
  '46': ['10','50','12'],        // Radiesse → Sculptra, Biofill Contour, BiologicalFace
  '50': ['51','52','10'],        // Biofill Contour → Shape, Subskin, Sculptra
  '51': ['50','52','46'],        // Biofill Shape → Contour, Subskin, Radiesse
  '52': ['50','51','10'],        // Biofill Subskin → Contour, Shape, Sculptra

  // Toxinas botulínicas
  '42': ['47','48','32'],        // Nabota 150UI → Dysport, Botox Allergan, água
  '43': ['42','47','48'],        // Nabota 100UI → Nabota 150, Dysport, Botox
  '44': ['42','12','32'],        // Israderm 150UI → Nabota, BiologicalFace, água
  '47': ['48','42','32'],        // Dysport → Botox, Nabota, água
  '48': ['47','42','32'],        // Botox Allergan → Dysport, Nabota, água

  // Acessórios — sugerem o produto mais comum que precisa deles
  '32': ['45','41','16'],        // Água Bacteriostática → seringa, agulhas caneta, BPC (exemplo)
  '41': ['1','4','53'],          // Agulhas caneta → Tirzepatida Pen, Retatrutide Pen, Porta ampolas
  '45': ['32','16','41'],        // Seringa super fina → água, BPC, agulhas
  '53': ['41','1','4'],          // Porta ampolas → agulhas, canetas Tirz/Reta
  '54': ['32','41','45'],        // Caneta Injetora Reutilizável → água, agulhas, seringa
  '57': ['32','41','54'],        // Caneta Descartável → água, agulhas, caneta reutilizável
};

let CATALOG = [];
let PROTOCOLS = {};
let currentStep = 1;
let selectedPayment = '';
let cart = {};             // { productId: qty }
let selectedVariants = {}; // { productId: variantIndex }
let clienteHistorico = [];
let _clienteJaLogado = false;
let activeLabFilter  = 'todos';
let activeTagFilter  = 'todos';
let activeSort       = 'alpha';
let activeSearch     = '';
let countdownInterval = null;

// ─── CUPOM DE BONIFICAÇÃO ────────────────────────────────────────────────────
let CUPONS_VALIDOS  = {}; // carregado do Sheets (aba "Cupons")
let PARCELAS_CONFIG = []; // carregado do Sheets (aba "Parcelas")
let cupomAplicado  = false;
let cupomDesconto  = 0;
let cupomCodigo    = '';
let cupomData      = null; // objeto {tipo, valor, produtos, precos}

// Estado da indicação aplicada (campo unificado f_codigo aceita cupom OU indicação)
let _indicacaoAplicada = false;
let _indicacaoCodigo   = '';

// ─── MINI-CARRINHO EXPANSÍVEL (Step 1) ─────────────────────────────────────
// Permite ver, alterar quantidade e remover itens sem precisar voltar ao
// card do produto na grid (que pode estar oculto pelo filtro de categoria).
function toggleCartExpand() {
  const panel = document.getElementById('cart-expanded');
  const icon  = document.getElementById('tb-toggle-icon');
  if (!panel) return;
  // Não expande se carrinho vazio
  if (Object.keys(cart).length === 0) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (icon) icon.textContent = open ? '▲' : '▼';
  if (!open) renderCartExpanded();
}

function renderCartExpanded() {
  const list = document.getElementById('ce-list');
  if (!list) return;
  // Se vazio, fecha automático
  if (Object.keys(cart).length === 0) {
    const panel = document.getElementById('cart-expanded');
    const icon  = document.getElementById('tb-toggle-icon');
    if (panel) panel.style.display = 'none';
    if (icon)  icon.textContent = '▲';
    list.innerHTML = '';
    return;
  }
  list.innerHTML = Object.keys(cart).map(key => {
    const { id, varIdx } = parseCartKey(key);
    const p = CATALOG.find(x => x.id === id);
    if (!p) return '';
    const qty = cart[key];
    const price = getPriceByKey(key);
    const subtotal = price * qty;
    const variantLabel = getVariantLabel(key);
    const dose = (varIdx != null && variantLabel) ? variantLabel : (p.conc || '');
    return `
      <div class="ce-item">
        <span class="ce-icon">${esc(p.icon || '💊')}</span>
        <div class="ce-info">
          <div class="ce-name">${esc(p.name)}</div>
          ${dose ? `<div class="ce-dose">${esc(dose)}</div>` : ''}
          <div class="ce-price">R$ ${price.toLocaleString('pt-BR',{minimumFractionDigits:2})} · un.</div>
        </div>
        <div class="ce-qty">
          <button class="ce-qty-btn" onclick="event.stopPropagation(); mudarQtdCarrinho('${escAttr(key)}', -1)" aria-label="Diminuir">−</button>
          <span class="ce-qty-val">${qty}</span>
          <button class="ce-qty-btn" onclick="event.stopPropagation(); mudarQtdCarrinho('${escAttr(key)}', +1)" aria-label="Aumentar">+</button>
        </div>
        <div class="ce-subtotal">R$ ${subtotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
        <button class="ce-remove" onclick="event.stopPropagation(); removerDoCarrinho('${escAttr(key)}')" aria-label="Remover do carrinho">✕</button>
      </div>`;
  }).join('');
}

function mudarQtdCarrinho(key, delta) {
  if (cart[key] == null) return;
  const newQty = Math.max(0, Math.min(999, cart[key] + delta));
  if (newQty === 0) {
    delete cart[key];
  } else {
    cart[key] = newQty;
  }
  // Re-renderiza tudo: grid de produtos (atualizar checkmarks) + mini-cart + total
  if (typeof renderProducts === 'function') renderProducts();
  updateTotal();
}

function removerDoCarrinho(key) {
  delete cart[key];
  if (typeof renderProducts === 'function') renderProducts();
  updateTotal();
}

function limparCarrinho() {
  if (Object.keys(cart).length === 0) return;
  if (!confirm('Remover todos os itens do carrinho?')) return;
  cart = {};
  if (typeof renderProducts === 'function') renderProducts();
  updateTotal();
}

// ─── REFAZER ÚLTIMO PEDIDO ─────────────────────────────────────────────────
// Mostra atalho no Step 1 pra cliente logado com histórico. Carrega itens
// do último pedido e popula o carrinho com 1 clique.
let _ultimoPedido = null;

async function initRepeatLastOrder() {
  try {
    const sess = (typeof getClienteSession === 'function') ? getClienteSession() : null;
    if (!sess?.token) return;
    // Busca histórico de pedidos
    const r = await fetch(`${SHEETS_URL}?action=cliente_pedidos&token=${encodeURIComponent(sess.token)}`);
    const data = await r.json().catch(() => null);
    const pedidos = Array.isArray(data?.pedidos) ? data.pedidos : (Array.isArray(data) ? data : []);
    if (!pedidos.length) return;
    // Pega o mais recente (assume ordenação desc — backend padrão)
    const ultimo = pedidos[0];
    if (!ultimo || !ultimo.itens) return;
    _ultimoPedido = ultimo;
    // Detecta URL repeat=last (vinda do hero do index)
    const params = new URLSearchParams(window.location.search);
    if (params.get('repeat') === 'last') {
      refazerUltimoPedido();
      return;
    }
    // Mostra a barra
    const bar = document.getElementById('repeat-order-bar');
    const sub = document.getElementById('repeat-order-sub');
    if (bar) bar.style.display = 'flex';
    if (sub) {
      const dt = ultimo.data || ultimo.created_at || '';
      const total = ultimo.total ? `R$ ${parseFloat(ultimo.total).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '';
      sub.textContent = [dt, total].filter(Boolean).join(' · ') || 'Adiciona os itens da última compra';
    }
  } catch(e) { /* sem histórico */ }
}

function refazerUltimoPedido() {
  if (!_ultimoPedido || !_ultimoPedido.itens) {
    alert('⚠️ Sem pedido anterior pra refazer.');
    return;
  }
  // Itens no formato "2x BPC-157 (5mg) = R$ X" ou similar — backend pode retornar
  // estrutura mais simples. Vamos tentar mapear via CATALOG.
  let itensRaw = _ultimoPedido.itens;
  if (typeof itensRaw === 'string') {
    // Tenta parsear linhas "Nx Nome (variante)..."
    itensRaw = itensRaw.split(/\n|;/).map(l => l.trim()).filter(Boolean);
  }
  let added = 0;
  cart = {};
  selectedVariants = {};
  if (Array.isArray(itensRaw)) {
    itensRaw.forEach(item => {
      // Aceita objeto {id, qty, varIdx} ou string
      if (typeof item === 'object' && item.id) {
        const key = item.varIdx != null ? `${item.id}__${item.varIdx}` : item.id;
        cart[key] = (cart[key] || 0) + (parseInt(item.qty) || 1);
        added++;
        return;
      }
      // Parse string: "2x Nome (Dose) = ..."
      const m = String(item).match(/(\d+)x\s+(.+?)(?:\s*\((.+?)\))?\s*[=$]/);
      if (!m) return;
      const qty = parseInt(m[1]) || 1;
      const nome = m[2].trim().toLowerCase();
      const dose = (m[3] || '').trim().toLowerCase();
      const p = CATALOG.find(x => x.name.toLowerCase() === nome);
      if (!p) return;
      let key = p.id;
      if (p.variantes && dose) {
        const idx = p.variantes.findIndex(v => v.dose.toLowerCase() === dose);
        if (idx >= 0) key = `${p.id}__${idx}`;
      }
      cart[key] = (cart[key] || 0) + qty;
      added++;
    });
  }
  if (added === 0) {
    alert('⚠️ Não foi possível recuperar os itens do último pedido. Confira o catálogo.');
    return;
  }
  if (typeof renderProducts === 'function') renderProducts();
  if (typeof updateTotal === 'function') updateTotal();
  // Scroll suave pro carrinho
  const cartEl = document.querySelector('.cart-sticky');
  if (cartEl) cartEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// ─── PERSISTÊNCIA DO CARRINHO ──────────────────────────────────────────────
// Salva carrinho em localStorage com TTL de 24h. Recupera no load se ainda
// válido. Evita perder pedido se cliente fecha aba acidentalmente.
const _CART_STORAGE_KEY = 'lp_cart_v1';
const _CART_TTL_MS      = 24 * 60 * 60 * 1000; // 24h
function saveCartToStorage() {
  try {
    if (Object.keys(cart).length === 0) {
      localStorage.removeItem(_CART_STORAGE_KEY);
      return;
    }
    localStorage.setItem(_CART_STORAGE_KEY, JSON.stringify({
      cart, selectedVariants, ts: Date.now()
    }));
  } catch(e) { /* ignora — quota exceeded etc */ }
}
function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(_CART_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || (Date.now() - data.ts) > _CART_TTL_MS) {
      localStorage.removeItem(_CART_STORAGE_KEY);
      return;
    }
    if (data.cart && typeof data.cart === 'object') {
      Object.keys(data.cart).forEach(k => { cart[k] = data.cart[k]; });
    }
    if (data.selectedVariants) selectedVariants = data.selectedVariants;
  } catch(e) { /* ignora — JSON corrompido */ }
}

// ─── INIT ───────────────────────────────────────────────────────────────────
window.onload = () => {
  // Restaura carrinho ANTES de carregar produtos (CATALOG vai validar)
  loadCartFromStorage();
  carregarProdutos();
  // Tenta carregar atalho de "refazer último pedido" pra cliente logado
  setTimeout(() => initRepeatLastOrder(), 800);
  // Restaura sessão de cliente do localStorage e pré-popula form
  try {
    const sess = (typeof getClienteSession === 'function') ? getClienteSession() : null;
    if (sess && sess.token) {
      _clienteJaLogado = true;
      preencherStep2(sess);
      if (typeof lpSetLogado === 'function') {
        lpSetLogado(sess.nome || sess.clinica || '', sess.apelido || '');
      }
      const jaTem = document.getElementById('lp-ja-tem-conta');
      if (jaTem) jaTem.style.display = 'none';
    }
  } catch(e) { /* sem sessão */ }
};

// ── CACHE (apenas dados estáticos — protocolos e parcelas, 30min TTL) ─────────
// Preços, promos e cupons NUNCA são cacheados: devem ser sempre frescos.
const PF_CACHE_TTL = 30 * 60 * 1000;
function pfFromCache_(k){try{const c=sessionStorage.getItem('lp_'+k);if(!c)return null;const{data,ts}=JSON.parse(c);return(Date.now()-ts)<PF_CACHE_TTL?data:null;}catch(e){return null;}}
function pfToCache_(k,d){try{sessionStorage.setItem('lp_'+k,JSON.stringify({data:d,ts:Date.now()}));}catch(e){}}
function pfBgRefresh_(k,url){fetch(url).then(r=>r.json()).then(d=>pfToCache_(k,d)).catch(()=>{});}

async function carregarProdutos() {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray)">⏳ Carregando produtos...</div>';
  try {
    // produtos: sempre frescos (preços/promos mudam)
    // protocolos: cacheados 30min (texto científico estático)
    const [data, prots] = await Promise.all([
      fetch(`${SHEETS_URL}?action=produtos`).then(r=>r.json()),
      (async () => {
        const c = pfFromCache_('protos'); if(c){pfBgRefresh_('protos',`${SHEETS_URL}?action=protocolos`);return c;}
        const d = await fetch(`${SHEETS_URL}?action=protocolos`).then(r=>r.json()); pfToCache_('protos',d); return d;
      })(),
    ]);
    PROTOCOLS = prots;

    // Cupons: sempre frescos (expiram)
    try {
      const cuponsData = await fetch(`${SHEETS_URL}?action=cupons`).then(r=>r.json());
      if (cuponsData && typeof cuponsData === 'object') CUPONS_VALIDOS = cuponsData;
    } catch(e) { /* sem cupons */ }

    // Parcelas: cacheadas 30min (configuração raramente muda)
    try {
      const pc = pfFromCache_('parcelas');
      const parcelasData = pc || await fetch(`${SHEETS_URL}?action=parcelas`).then(r=>r.json());
      if (!pc) pfToCache_('parcelas', parcelasData);
      else pfBgRefresh_('parcelas',`${SHEETS_URL}?action=parcelas`);
      if (Array.isArray(parcelasData) && parcelasData.length > 0) {
        PARCELAS_CONFIG = parcelasData;
        const sel = document.getElementById('f_parcelas');
        sel.innerHTML = PARCELAS_CONFIG.map(p =>
          `<option value="${p.parcelas}">${p.parcelas}x ${p.juros > 0 ? '+ ' + p.juros + '%' : 'sem juros'}</option>`
        ).join('');
      }
    } catch(e) { /* usa opções padrão do HTML */ }
    CATALOG = data.map(p => ({
      id:          p.id,
      icon:        p.icone,
      name:        p.nome,
      conc:        p.conc,
      price:       parseFloat(p.preco) || 0,
      stock:       parseInt(p.estoque) || 0,
      tags:        Array.isArray(p.tags) ? p.tags : [],
      categoria:   p.categoria ? String(p.categoria).trim().toLowerCase() : '',
      destaque:    p.destaque || '',
      lab:         p.lab || '',
      variantes:   (Array.isArray(p.variantes) && p.variantes.length > 0 && p.variantes[0].dose)
                     ? p.variantes : null,
      promo_preco: parseFloat(p.promo_preco) || 0,
      promo_pct:   parseFloat(p.promo_pct)   || 0,
      promo_inicio: p.promo_inicio || '',
      promo_fim:   p.promo_fim || ''
    }));
    renderFilters();
    renderProducts();
    renderHighlights();
    // Remove skeleton agora que CATALOG está pronto
    const sk = document.getElementById('skeleton-wrap');
    if (sk) sk.style.display = 'none';

  } catch(e) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#e74c3c">⚠️ Erro ao carregar produtos. Recarregue a página.</div>';
  }
}

// ─── FILTERS & SORT ─────────────────────────────────────────────────────────
// As categorias são preenchidas dinamicamente a partir da coluna Categoria da planilha.
// Mantemos apenas "Todos" como categoria base — as demais são geradas em renderFilters().
const CATEGORIAS = [
  { val: 'todos', label: 'Todos' },
];

function renderFilters() {
  const labs = [...new Set(CATALOG.filter(p => p.lab).map(p => p.lab))].sort();
  document.getElementById('lab-filters').innerHTML = ['Todos', ...labs].map(l => {
    const val = l === 'Todos' ? 'todos' : l;
    return `<button class="lab-btn ${val === activeLabFilter ? 'active' : ''}" onclick="setLabFilter('${escAttr(val)}')">${esc(l)}</button>`;
  }).join('');

  // Categorias dinâmicas a partir da coluna Categoria do catálogo.
  // Capitaliza pra exibição (categoria_emagrecimento → "Emagrecimento") mas mantém o val em lowercase pra match.
  const allCats = new Set();
  CATALOG.forEach(p => {
    const c = String(p.categoria || '').trim();
    if (c) allCats.add(c.toLowerCase());
  });
  const cap = (s) => s.split(/[\s_-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const dyn = [...allCats].sort().map(c => ({ val: c, label: cap(c) }));
  const cats = [...CATEGORIAS, ...dyn];
  document.getElementById('tag-filters').innerHTML = cats.map(c =>
    `<button class="lab-btn ${c.val === activeTagFilter ? 'active' : ''}" onclick="setTagFilter('${escAttr(c.val)}')">${esc(c.label)}</button>`
  ).join('');
}

function toggleFilterGroup(filterId, arrowId) {
  const el = document.getElementById(filterId);
  const arrow = document.getElementById(arrowId);
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'flex';
  arrow.classList.toggle('open', !open);
}

function setLabFilter(lab) {
  activeLabFilter = lab;
  renderFilters();
  renderProducts();
}

function setTagFilter(tag) {
  activeTagFilter = tag;
  renderFilters();
  renderProducts();
  // Scroll suave para a lista quando filtra por categoria
  if (tag !== 'todos') {
    setTimeout(() => {
      const target = document.getElementById('cat-chip-bar') || document.getElementById('products-grid');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  } else {
    // Volta pra "home" — scroll pro topo do panel1
    setTimeout(() => {
      const top = document.getElementById('hero-carousel') || document.getElementById('panel1');
      if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }
}

function setSort(mode) {
  activeSort = mode;
  document.querySelectorAll('.sort-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sort === mode);
  });
  renderProducts();
}

function getEffectivePrice(p) {
  if (p.variantes && p.variantes.length > 0) {
    return Math.min(...p.variantes.map(v => {
      const promoV = parseFloat(v.promo_preco) || 0;
      if (promoV > 0 && isPromoDentroData(p)) return promoV;
      return parseFloat(v.preco) || 0;
    }));
  }
  if (isPromoAtiva(p)) {
    if (p.promo_pct > 0) return parseFloat((p.price * (1 - p.promo_pct / 100)).toFixed(2));
    if (p.promo_preco > 0) return p.promo_preco;
  }
  return p.price;
}

// ─── PROMO HELPERS ──────────────────────────────────────────────────────────
// ─── ACESSO RÁPIDO — CLIENTE RECORRENTE ─────────────────────────────────────
let _buscaTimer = null;

function agendarBuscaCliente(valor) {
  clearTimeout(_buscaTimer);
  const doc = valor.replace(/\D/g,'');
  // Dispara quando tiver 11 dígitos (CPF) ou 14 dígitos (CNPJ)
  if (doc.length === 11 || doc.length === 14) {
    _buscaTimer = setTimeout(() => buscarCliente(doc), 600);
  }
}

async function buscarCliente(docParam) {
  const doc = (docParam || '').replace(/\D/g,'');
  if (!doc || (doc.length !== 11 && doc.length !== 14)) return;

  const loading       = document.getElementById('ar-loading');
  const bemVindo      = document.getElementById('ar-bem-vindo');
  const naoEncontrado = document.getElementById('ar-nao-encontrado');
  const limpar        = document.getElementById('ar-limpar');

  loading.style.display       = 'block';
  bemVindo.style.display      = 'none';
  naoEncontrado.style.display = 'none';
  limpar.style.display        = 'none';

  try {
    const res  = await fetch(`${SHEETS_URL}?action=cliente&documento=${encodeURIComponent(doc)}`);
    const data = await res.json();
    loading.style.display = 'none';

    if (data && data.clinica) {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      set('f_clinica',     data.clinica);
      set('f_responsavel', data.responsavel);
      set('f_telefone',    data.telefone);
      set('f_email',       data.email);
      set('f_documento',   data.documento);
      set('f_cidade',      data.cidade);
      set('f_estado',      data.estado);
      set('f_endereco',    data.endereco);

      if (Array.isArray(data.historico)) clienteHistorico = data.historico;
      bemVindo.style.display = 'block';
      bemVindo.innerHTML = `✅ Bem-vindo de volta, <strong>${esc(data.responsavel || data.clinica)}</strong>! Dados preenchidos automaticamente.`;
      limpar.style.display = 'block';
    } else {
      naoEncontrado.innerHTML = '⚠️ Não encontramos seus dados. Preencha o formulário manualmente abaixo.';
      naoEncontrado.style.display = 'block';
    }
  } catch(e) {
    loading.style.display = 'none';
  }
}

function limparAcesso() {
  document.getElementById('ar-bem-vindo').style.display = 'none';
  document.getElementById('ar-nao-encontrado').style.display = 'none';
  document.getElementById('ar-limpar').style.display = 'none';
  ['f_clinica','f_responsavel','f_telefone','f_email','f_documento','f_cep_entrega','f_rua','f_numero','f_bairro','f_complemento','f_cidade','f_estado'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

// ─── CÓDIGO UNIFICADO (cupom OU indicação) ─────────────────────────────────
// Detecta o tipo pelo formato e despacha pra lógica certa.
function _isCodigoIndicacao(codigo) {
  // Formato: <slug>-<6 hex> (ex: joao-A4F7K2)
  return /.+-[A-F0-9]{6}$/i.test(codigo);
}

async function aplicarCodigo() {
  const input = document.getElementById('f_codigo');
  const msg   = document.getElementById('codigo-msg');
  if (!input) return;
  const codigo = (input.value || '').trim().toUpperCase();
  if (!codigo) {
    msg.innerHTML = `<div class="cupom-err">⚠️ Digite um cupom ou código de indicação.</div>`;
    return;
  }
  if (_isCodigoIndicacao(codigo)) {
    return _aplicarComoIndicacao(codigo);
  }
  return _aplicarComoCupom(codigo);
}

function removerCodigo() {
  // Reseta tudo (cupom OU indicação)
  cupomAplicado = false; cupomCodigo = ''; cupomDesconto = 0; cupomData = null;
  _indicacaoAplicada = false; _indicacaoCodigo = '';
  const input = document.getElementById('f_codigo');
  const msg   = document.getElementById('codigo-msg');
  const btnA  = document.getElementById('btn-codigo');
  const btnR  = document.getElementById('btn-remover-codigo');
  if (input) { input.value = ''; input.disabled = false; }
  if (btnA)  { btnA.classList.remove('hidden'); btnA.disabled = false; }
  if (btnR)  btnR.classList.add('hidden');
  if (msg)   msg.innerHTML = '';
  // Esconde benefícios visuais (parcela sem juros, frete grátis)
  const badge    = document.getElementById('cupom-parc-badge');
  const gratisEl = document.getElementById('frete-gratis');
  if (badge) badge.style.display = 'none';
  if (gratisEl) gratisEl.style.display = 'none';
  // CRÍTICO: re-aplica o frete selecionado pra restaurar o valor cheio
  // (cupom de frete grátis tinha zerado freteValor)
  if (freteEstado && freteMetodo) {
    selecionarFrete(freteMetodo);
  }
  if (selectedPayment === 'Cartão de Crédito') calcInstallment();
  buildReview();
}

function aplicarCupom() {
  // Wrapper retrocompatível — chama o handler unificado
  const f = document.getElementById('f_codigo');
  if (f) return aplicarCodigo();
}
function removerCupom() { return removerCodigo(); }
function validarIndicacaoLegacy() {
  const f = document.getElementById('f_codigo');
  if (f) return aplicarCodigo();
}
function removerIndicacao() { return removerCodigo(); }

function _aplicarComoCupom(codigo) {
  const msg = document.getElementById('codigo-msg');
  const c = CUPONS_VALIDOS[codigo];
  if (c !== undefined) {
    cupomAplicado = true;
    cupomCodigo   = codigo;
    // Suporte ao formato antigo (número) e novo (objeto)
    if (typeof c === 'number') {
      cupomData     = { tipo: '%', valor: c * 100, produtos: 'todos' };
      cupomDesconto = c;
    } else {
      cupomData     = c;
      cupomDesconto = c.tipo === '%' ? c.valor / 100 : 0;
    }
    document.getElementById('f_codigo').disabled   = true;
    document.getElementById('btn-codigo').disabled = true;
    const descValor = calcularDescontoCupom();
    const descStr   = descValor > 0
      ? ` — <strong>R$ ${descValor.toLocaleString('pt-BR',{minimumFractionDigits:2})} de desconto</strong>`
      : '';
    let msgTxt = '';
    if (cupomData.tipo === '%') {
      if (cupomData.produtos === 'todos') {
        msgTxt = `✅ Cupom <strong>${esc(codigo)}</strong> aplicado! ${esc(cupomData.valor)}% de desconto em todos os produtos${descStr}.`;
      } else {
        const prods = Array.isArray(cupomData.produtos) ? cupomData.produtos : [];
        const n = Object.keys(cart).filter(k => { const b = k.split('__')[0]; return prods.includes(k) || prods.includes(b); }).length;
        msgTxt = `✅ Cupom <strong>${esc(codigo)}</strong> aplicado! ${esc(cupomData.valor)}% em ${n || prods.length} produto(s)${descStr}.`;
      }
    } else {
      const precos = cupomData.precos || {};
      const n = Object.keys(cart).filter(k => { const b = k.split('__')[0]; return precos[k] !== undefined || precos[b] !== undefined; }).length;
      msgTxt = `✅ Cupom <strong>${esc(codigo)}</strong> aplicado! Preço especial em ${n || Object.keys(precos).length} produto(s)${descStr}.`;
    }
    msg.innerHTML = `<div class="cupom-ok">${msgTxt}</div>`;
    document.getElementById('btn-codigo').classList.add('hidden');
    document.getElementById('btn-remover-codigo').classList.remove('hidden');
    checkCupomExtras();
    // Cupom afeta o total → valor por parcela muda
    if (selectedPayment === 'Cartão de Crédito') calcInstallment();
    buildReview();
  } else {
    cupomAplicado = false;
    cupomDesconto = 0;
    cupomData     = null;
    msg.innerHTML = `<div class="cupom-err">❌ Código inválido. Verifique e tente novamente.</div>`;
  }
}

function checkCupomExtras() {
  const badge    = document.getElementById('cupom-parc-badge');
  const gratisEl = document.getElementById('frete-gratis');
  if (badge) badge.style.display = cupomData?.parcelamento === 'SIM' ? 'block' : 'none';
  if (cupomData?.frete_gratis_acima) {
    const limiar = parseFloat(cupomData.frete_gratis_acima);
    if (!isNaN(limiar)) {
      gratisEl.textContent = `🎉 Cupom: frete grátis para pedidos acima de R$ ${limiar.toLocaleString('pt-BR',{minimumFractionDigits:2})}!`;
      gratisEl.style.display = 'block';
    }
    if (freteEstado) selecionarFrete(freteMetodo || 'jadlog');
  }
  if (cupomData?.parcelamento === 'SIM') calcInstallment();
}

function calcularDescontoCupom() {
  if (!cupomAplicado || !cupomData) return 0;
  if (cupomData.tipo === '%') {
    if (cupomData.produtos === 'todos') {
      return (getTotal() + freteValor) * (cupomData.valor / 100);
    }
    let base = 0;
    const prods = Array.isArray(cupomData.produtos) ? cupomData.produtos : [];
    Object.entries(cart).forEach(([id, qty]) => {
      const baseId = id.split('__')[0];
      if (prods.includes(id) || prods.includes(baseId)) base += getPriceByKey(id) * qty;
    });
    return base * (cupomData.valor / 100);
  }
  if (cupomData.tipo === 'fixo') {
    let desc = 0;
    const precos = cupomData.precos || {};
    Object.entries(cart).forEach(([id, qty]) => {
      const baseId = id.split('__')[0];
      const discP  = precos[id]    !== undefined ? precos[id]
                   : precos[baseId] !== undefined ? precos[baseId]
                   : null;
      if (discP !== null) {
        desc += Math.max(0, getPriceByKey(id) - discP) * qty;
      }
    });
    return desc;
  }
  return 0;
}

function parseBrDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  // Formato brasileiro: DD/MM/YYYY ou DD/MM/YYYY HH:MM
  if (s.includes('/')) {
    const [datePart, timePart] = s.split(' ');
    const [d, m, y] = datePart.split('/');
    const [h, min] = timePart ? timePart.split(':') : ['0','0'];
    if (!d || !m || !y || isNaN(+d) || isNaN(+m) || isNaN(+y)) return null;
    return new Date(+y, +m - 1, +d, +(h||0), +(min||0));
  }
  // ISO ou YYYY-MM-DD (fallback para qualquer formato nativo)
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

function isPromoDentroData(p) {
  if (!p.promo_fim) return false;
  const now = new Date();
  const fim   = parseBrDate(p.promo_fim);
  const inicio = p.promo_inicio ? parseBrDate(p.promo_inicio) : new Date(0);
  if (!fim) return false;
  return now >= (inicio || new Date(0)) && now <= fim;
}

function isPromoAtiva(p) {
  if (!p.promo_preco && !p.promo_pct) return false;
  return isPromoDentroData(p);
}

function getCountdown(dataFim) {
  const diff = parseBrDate(dataFim) - new Date();
  if (diff <= 0) return 'Encerrada';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return d > 0
    ? `${d}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function startCountdowns() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    CATALOG.forEach(p => {
      if (!isPromoAtiva(p)) return;
      const txt = getCountdown(p.promo_fim);
      // card do catálogo principal
      const el = document.getElementById('countdown-' + p.id);
      if (el) el.textContent = txt;
      // tile dos destaques (legado)
      const hl = document.getElementById('hl-countdown-' + p.id);
      if (hl) hl.textContent = '⏱ ' + txt;
      // hero carrossel
      const hh = document.getElementById('hero-countdown-' + p.id);
      if (hh) hh.textContent = txt;
    });
  }, 1000);
}

// ─── HELPERS DE VARIANTE/PREÇO/ESTOQUE ──────────────────────────────────────
function parseCartKey(key) {
  const parts = key.split('__');
  return { id: parts[0], varIdx: parts.length > 1 ? parseInt(parts[1]) : null };
}

function getPriceByKey(key) {
  const { id, varIdx } = parseCartKey(key);
  const p = CATALOG.find(x => x.id === id);
  if (!p) return 0;
  if (varIdx !== null && p.variantes && p.variantes[varIdx]) {
    const v = p.variantes[varIdx];
    const promoV = parseFloat(v.promo_preco) || 0;
    if (promoV > 0 && isPromoDentroData(p)) return promoV;
    return parseFloat(v.preco) || 0;
  }
  const promo = isPromoAtiva(p);
  if (promo) {
    if (p.promo_pct > 0) return parseFloat((p.price * (1 - p.promo_pct / 100)).toFixed(2));
    if (p.promo_preco > 0) return p.promo_preco;
  }
  return p.price;
}

function getProductPrice(id) {
  return getPriceByKey(id);
}

function getVariantLabel(key) {
  const { id, varIdx } = parseCartKey(key);
  const p = CATALOG.find(x => x.id === id);
  if (!p) return '';
  if (varIdx !== null && p.variantes && p.variantes[varIdx]) return p.variantes[varIdx].dose;
  return p.conc;
}

function getVariantStock(id) {
  const p = CATALOG.find(x => x.id === id);
  if (!p || !p.variantes) return p ? p.stock : 0;
  // Retorna o maior estoque entre as variantes (card só desativado se TODAS estiverem sem estoque)
  return Math.max(...p.variantes.map(v => parseInt(v.estoque) || 0));
}

function changeVariantQty(id, varIdx, delta) {
  const key = `${id}__${varIdx}`;
  const p   = CATALOG.find(x => x.id === id);
  // Estoque é informativo (label visual), não bloqueia compra — pedidos
  // sem estoque suficiente entram como pré-venda ("chega em 7 dias").
  // Cap de 999 só pra não travar o navegador com valores absurdos.
  const newQty = Math.max(0, Math.min(999, (cart[key] || 0) + delta));
  if (newQty === 0) delete cart[key]; else cart[key] = newQty;

  const qtyEl = document.getElementById(`vqty-${id}-${varIdx}`);
  if (qtyEl) qtyEl.textContent = newQty;

  const subEl = document.getElementById(`vsub-${id}-${varIdx}`);
  if (subEl) {
    const price = getPriceByKey(key);
    subEl.textContent = newQty > 0 ? `= R$ ${(price * newQty).toLocaleString('pt-BR', {minimumFractionDigits:2})}` : '';
  }

  const hasAny = p && Array.isArray(p.variantes) && p.variantes.some((_, i) => (cart[`${id}__${i}`] || 0) > 0);
  const cardEl = document.getElementById(`pc-${id}`);
  if (cardEl) {
    cardEl.classList.toggle('selected', hasAny);
    const chk = cardEl.querySelector('.pc-check');
    if (chk) chk.textContent = hasAny ? '✓' : '';
  }
  updateTotal();
}

// ─── RENDER PRODUCTS ────────────────────────────────────────────────────────
function renderProducts() {
  // Modo "navegação" (home) = sem busca E categoria=todos → mostra hero + categorias, esconde grid
  // Modo "lista" = busca ativa OU categoria selecionada → esconde hero+cat, mostra grid
  const searching = !!activeSearch;
  const filtering = activeTagFilter !== 'todos' || activeLabFilter !== 'todos';
  const navMode   = !searching && !filtering;
  // __all__ = "Ver tudo" — modo lista sem filtro de categoria; trata como categoria=todos pra match
  const tagForMatch = activeTagFilter === '__all__' ? 'todos' : activeTagFilter;

  const hero      = document.getElementById('hero-carousel');
  const catSec    = document.getElementById('cat-section');
  const chipBar   = document.getElementById('cat-chip-bar');
  const advWrap   = document.getElementById('adv-filters-wrap');
  const grid      = document.getElementById('products-grid');
  const empty     = document.getElementById('empty-state');
  const catTitle  = document.getElementById('catalog-title');

  if (hero)     hero.style.display     = navMode ? '' : 'none';
  if (catSec)   catSec.style.display   = navMode ? '' : 'none';
  if (chipBar)  chipBar.style.display  = (filtering && !searching) ? 'flex' : 'none';
  if (advWrap)  advWrap.style.display  = navMode ? 'none' : '';
  if (catTitle) catTitle.style.display = 'none'; // catálogo completo só aparece no modo lista

  const recSec = document.getElementById('rec-section');
  if (navMode) {
    renderHero();
    renderCategoryTiles();
    renderRecomendados();
    if (grid)  grid.style.display  = 'none';
    if (empty) empty.style.display = 'none';
    grid.innerHTML = '';
    updateTotal();
    return;
  }
  if (recSec) recSec.style.display = 'none';

  // Atualiza chip da categoria ativa
  if (filtering && !searching) {
    const cap = (s) => s.split(/[\s_-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const lbl = document.getElementById('cat-chip-label');
    const cnt = document.getElementById('cat-chip-count');
    if (activeTagFilter === '__all__') {
      if (lbl) lbl.textContent = 'Todos os produtos';
      if (cnt) cnt.textContent = `${CATALOG.length} produto(s)`;
    } else if (activeTagFilter !== 'todos') {
      const cat = activeTagFilter;
      const count = CATALOG.filter(p => String(p.categoria||'').toLowerCase() === cat).length;
      if (lbl) lbl.textContent = cap(cat);
      if (cnt) cnt.textContent = `${count} produto(s)`;
    } else if (activeLabFilter !== 'todos') {
      if (lbl) lbl.textContent = activeLabFilter;
      const count = CATALOG.filter(p => p.lab === activeLabFilter).length;
      if (cnt) cnt.textContent = `${count} produto(s)`;
    }
  }

  grid.innerHTML = '';
  let list = CATALOG.filter(p => {
    if (activeLabFilter !== 'todos' && p.lab !== activeLabFilter) return false;
    if (tagForMatch !== 'todos' && String(p.categoria||'').toLowerCase() !== tagForMatch) return false;
    if (activeSearch) {
      const hay = [p.name, p.conc, p.lab, ...(p.tags||[])].join(' ').toLowerCase();
      if (!hay.includes(activeSearch)) return false;
    }
    return true;
  });
  if (activeSort === 'alpha') {
    list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  } else if (activeSort === 'price-asc') {
    list.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
  } else if (activeSort === 'price-desc') {
    list.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
  }

  if (list.length === 0) {
    if (grid)  grid.style.display  = 'none';
    if (empty) empty.style.display = 'block';
    updateTotal(); return;
  }
  if (grid)  grid.style.display  = 'grid';
  if (empty) empty.style.display = 'none';

  list.forEach(p => {
    const varIdx = selectedVariants[p.id] || 0;
    const currentPrice = getProductPrice(p.id);
    const qty = cart[p.id] || 1;
    const isSelected = cart.hasOwnProperty(p.id);
    const subtotal = isSelected ? (currentPrice * qty).toLocaleString('pt-BR', {minimumFractionDigits:2}) : '0,00';
    const stockAtual = p.variantes ? getVariantStock(p.id) : p.stock;
    const semEstoque = stockAtual === 0;
    const estoqueLabel = semEstoque
      ? `<span style="color:#f39c12;font-size:.7rem;font-weight:700">🕐 Sem estoque — chega em até 7 dias</span>`
      : stockAtual <= 10
        ? `<span style="color:#f39c12;font-size:.7rem">⚡ Últimas ${stockAtual} un.</span>`
        : `<span style="color:var(--accent);font-size:.7rem">✅ ${stockAtual} em estoque</span>`;
    const labBadge = p.lab ? `<span class="pc-tag" style="background:rgba(26,188,156,.15);border-color:rgba(26,188,156,.3);color:var(--accent)">${esc(p.lab)}</span>` : '';
    const promoAtiva = isPromoAtiva(p);
    const promoRibbon = promoAtiva ? `<div class="promo-ribbon">🔥 Promoção</div>` : '';
    const promoTimer  = promoAtiva ? `
      <div class="promo-timer">⏱ Termina em: <span id="countdown-${escAttr(p.id)}">${getCountdown(p.promo_fim)}</span></div>` : '';
    const promoPrecoHtml = promoAtiva ? `
      <span class="promo-price-old">R$ ${p.price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>` : '';
    const temProtocolo = PROTOCOLS && PROTOCOLS[p.id];
    const saibaMaisBtn = temProtocolo ? `<button class="btn-saiba-mais" onclick="event.stopPropagation(); abrirProtocolo('${escAttr(p.id)}')">📋 Saiba mais sobre este produto</button>` : '';
    const temVariantes = p.variantes && p.variantes.length > 0;

    // Produtos COM variantes: cada dose tem sua própria linha com [− qty +]
    const variantRowsHtml = temVariantes ? `
      <div class="variant-rows">
        ${p.variantes.map((v, i) => {
          const key = `${p.id}__${i}`;
          const vQty = cart[key] || 0;
          const vPrice = parseFloat(v.preco) || 0;
          const vPriceDisc = getPriceByKey(key);
          const vStock = parseInt(v.estoque) || 0;
          const semV = vStock === 0;
          const vStockLabel = semV
            ? `<span class="vr-stock out">⚠️ Sem estoque</span>`
            : vStock <= 5
              ? `<span class="vr-stock low">⚡ ${vStock} un.</span>`
              : `<span class="vr-stock ok">✅ ${vStock} un.</span>`;
          const vPromo = parseFloat(v.promo_preco) || 0;
          const vPromoAtiva = vPromo > 0 && isPromoDentroData(p);
          const vPromoHtml = vPromoAtiva
            ? `<span class="vr-price-old">R$ ${vPrice.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
               <span class="vr-price promo">R$ ${vPromo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>`
            : `<span class="vr-price">R$ ${vPrice.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>`;
          const vStockLabel2 = semV
            ? `<span class="vr-stock" style="color:#f39c12;font-size:.68rem">🕐 Chega em 7 dias</span>`
            : vStockLabel;
          return `<div class="variant-row">
            <div class="vr-info">
              <span class="vr-dose">${esc(v.dose)}</span>
              <div class="vr-price-row">${vPromoHtml}${vStockLabel2}</div>
            </div>
            <div class="vr-controls">
              <button class="vr-btn" onclick="event.stopPropagation(); changeVariantQty('${escAttr(p.id)}',${i},-1)">−</button>
              <span class="vr-qty" id="vqty-${escAttr(p.id)}-${i}">${vQty}</span>
              <button class="vr-btn" onclick="event.stopPropagation(); changeVariantQty('${escAttr(p.id)}',${i},1)">+</button>
            </div>
            <span class="vr-sub" id="vsub-${escAttr(p.id)}-${i}">${vQty > 0 ? `= R$ ${(vPriceDisc*vQty).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : ''}</span>
          </div>`;
        }).join('')}
      </div>` : '';

    // Produtos SEM variantes: comportamento original. Estoque 0 = pré-venda
    // (libera compra com aviso "chega em 7 dias" — não bloqueia).
    const qtyMax = p.stock > 0 ? p.stock : 999;
    const qtyWrapHtml = !temVariantes ? `
        <div class="pc-qty-wrap" id="qty-wrap-${escAttr(p.id)}">
          <button class="qty-btn" onclick="event.stopPropagation(); changeQty('${escAttr(p.id)}',-1)">−</button>
          <input class="qty-input" type="number" id="qty-${escAttr(p.id)}" value="${qty}" min="1" max="${qtyMax}"
            onchange="event.stopPropagation(); setQty('${escAttr(p.id)}', this.value)"
            onclick="event.stopPropagation()"/>
          <button class="qty-btn" onclick="event.stopPropagation(); changeQty('${escAttr(p.id)}',1)">+</button>
          <span class="qty-label">un.</span>
          <span class="pc-subtotal" id="sub-${escAttr(p.id)}">= R$ ${subtotal}</span>
        </div>` : '';

    const cardOnclick = temVariantes ? '' : `toggleProduct('${escAttr(p.id)}')`;
    const cardSelected = temVariantes
      ? p.variantes.some((_, i) => (cart[`${p.id}__${i}`] || 0) > 0)
      : isSelected;

    grid.innerHTML += `
      <div class="product-card ${cardSelected ? 'selected' : ''} ${promoAtiva ? 'promo-ativa' : ''} ${p.imagem ? 'pc-has-image' : 'pc-no-image'}"
           id="pc-${escAttr(p.id)}" onclick="${cardOnclick}"
           style="">
        ${promoRibbon}
        <div class="pc-media">
          ${productImageHTML(p, 'pc-img-card')}
          <div class="pc-check">${cardSelected ? '✓' : ''}</div>
        </div>
        <div class="pc-name">${esc(p.name)}</div>
        <div class="pc-conc">${esc(p.conc)}</div>
        <div class="pc-tags">${labBadge}${(p.tags||[]).map(t=>`<span class="pc-tag">${esc(t)}</span>`).join('')}</div>
        ${!temVariantes ? `<div style="margin:6px 0" id="stock-${escAttr(p.id)}">${estoqueLabel}</div>` : ''}
        ${!temVariantes ? `<div class="pc-price-row" style="flex-direction:column;align-items:flex-start;gap:2px">
          ${promoPrecoHtml}<div style="display:flex;align-items:baseline;gap:4px">
          <span class="pc-price" id="price-${escAttr(p.id)}" style="${promoAtiva?'color:#F39C12':''}">R$ ${currentPrice.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
          <span class="pc-unit">/ unidade</span></div></div>` : ''}
        ${promoTimer}
        ${variantRowsHtml}
        ${qtyWrapHtml}
        ${saibaMaisBtn}
      </div>`;
  });
  updateTotal();
  startCountdowns();
}

// ─── IMAGEM DE PRODUTO ──────────────────────────────────────────────────────
// Convenção: cada cliente sobe imagens em /assets/img/produtos/ (no GitHub).
// Coluna `imagem` na planilha guarda só o filename (ex: "bpc-157.webp").
// Sem imagem → placeholder colorido com gradient (tom determinístico do nome) + ícone.
function _imgHashTone(str) {
  let h = 0; const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 10;
}
window.imgFallback = function(imgEl) {
  const tone = imgEl.dataset.tone || '0';
  const icon = imgEl.dataset.icon || '💊';
  const sizeClass = imgEl.dataset.sizeClass || '';
  const div = document.createElement('div');
  div.className = `img-placeholder ${sizeClass} tone-${tone}`;
  div.innerHTML = `<span class="ph-icon">${icon}</span>`;
  imgEl.replaceWith(div);
};
function productImageHTML(p, sizeClass) {
  const tone = _imgHashTone(p.categoria || p.id || p.name || '');
  const icon = p.icon || '💊';
  const cls  = sizeClass || '';
  if (p.imagem) {
    const src = `assets/img/produtos/${p.imagem}`;
    return `<img class="product-img ${cls}" src="${escAttr(src)}" alt="${escAttr(p.name)}" loading="lazy"
      data-tone="${tone}" data-icon="${escAttr(icon)}" data-size-class="${escAttr(cls)}"
      onerror="imgFallback(this)"/>`;
  }
  return `<div class="img-placeholder ${cls} tone-${tone}"><span class="ph-icon">${esc(icon)}</span></div>`;
}

// ─── HERO CARROSSEL ─────────────────────────────────────────────────────────
let _heroIdx = 0;
let _heroTimer = null;
let _heroSlides = [];

function renderHero() {
  const track = document.getElementById('hero-track');
  const dotsEl = document.getElementById('hero-dots');
  const hero = document.getElementById('hero-carousel');
  if (!track || !hero) return;

  // Hero exibe apenas produtos em destaque (promo herda tema visual quando aplicável)
  const destaques = CATALOG.filter(p => p.destaque === 'destaque');
  const slides = destaques.map(p => ({
    p,
    theme: isPromoAtiva(p) ? 'promo' : 'destaque',
    badge: isPromoAtiva(p) ? '🔥 Promoção' : '⭐ Destaque',
  }));

  _heroSlides = slides;
  if (slides.length === 0) { hero.style.display = 'none'; return; }

  track.innerHTML = slides.map((s, i) => {
    const p = s.p;
    const promoAtiva = isPromoAtiva(p);
    const price = getEffectivePrice(p);
    const oldPrice = (promoAtiva && p.price > price)
      ? `<span class="hero-slide-price-old">R$ ${p.price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>`
      : '';
    const countdown = promoAtiva
      ? `<div class="hero-slide-countdown">⏱ <span id="hero-countdown-${escAttr(p.id)}">${getCountdown(p.promo_fim)}</span></div>`
      : '';
    return `
      <div class="hero-slide theme-${s.theme}" data-idx="${i}" onclick="abrirProdutoDoHero('${escAttr(p.id)}')">
        ${productImageHTML(p, 'hero-slide-icon')}
        <div class="hero-slide-content">
          <span class="hero-slide-badge">${s.badge}</span>
          <div class="hero-slide-title">${esc(p.name)}</div>
          ${p.conc ? `<div class="hero-slide-sub">${esc(p.conc)}</div>` : ''}
          <div class="hero-slide-price-row">
            ${oldPrice}
            <span class="hero-slide-price">R$ ${price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
          </div>
          ${countdown}
          <span class="hero-slide-cta">Ver produto →</span>
        </div>
      </div>`;
  }).join('');

  if (dotsEl) {
    dotsEl.innerHTML = slides.map((_, i) =>
      `<button class="hero-dot ${i===0?'active':''}" onclick="heroGo(${i})" aria-label="Slide ${i+1}"></button>`
    ).join('');
  }

  // Esconde flechas e dots se só tem 1 slide
  const arrowL = hero.querySelector('.hero-arrow-left');
  const arrowR = hero.querySelector('.hero-arrow-right');
  const single = slides.length <= 1;
  if (arrowL) arrowL.style.display = single ? 'none' : '';
  if (arrowR) arrowR.style.display = single ? 'none' : '';
  if (dotsEl) dotsEl.style.display = single ? 'none' : '';

  // Sincroniza dots com scroll
  track.onscroll = () => {
    const w = track.clientWidth;
    const idx = Math.round(track.scrollLeft / w);
    if (idx !== _heroIdx) {
      _heroIdx = idx;
      const dots = dotsEl ? dotsEl.querySelectorAll('.hero-dot') : [];
      dots.forEach((d,i) => d.classList.toggle('active', i === idx));
    }
  };

  startHeroAutoplay();

  // Pausa auto-play no hover
  hero.onmouseenter = () => stopHeroAutoplay();
  hero.onmouseleave = () => startHeroAutoplay();
}

function heroGo(i) {
  const track = document.getElementById('hero-track');
  if (!track || !_heroSlides.length) return;
  _heroIdx = (i + _heroSlides.length) % _heroSlides.length;
  track.scrollTo({ left: _heroIdx * track.clientWidth, behavior: 'smooth' });
}

function heroNav(delta) {
  if (!_heroSlides.length) return;
  heroGo(_heroIdx + delta);
  // Reset autoplay timer ao navegar manualmente
  stopHeroAutoplay();
  startHeroAutoplay();
}

function startHeroAutoplay() {
  stopHeroAutoplay();
  if (_heroSlides.length <= 1) return;
  _heroTimer = setInterval(() => heroGo(_heroIdx + 1), 5000);
}

function stopHeroAutoplay() {
  if (_heroTimer) { clearInterval(_heroTimer); _heroTimer = null; }
}

// ─── CATEGORIAS EM DESTAQUE ─────────────────────────────────────────────────
// Ícones padrão por categoria (fallback). Se não bater, usa o ícone do 1º produto da categoria.
const CAT_ICONS = {
  emagrecimento: '🔥',
  performance:   '💪',
  estetica:      '✨',
  estética:      '✨',
  hormonios:     '🧬',
  hormônios:     '🧬',
  recovery:      '🛌',
  imunidade:     '🛡️',
  longevidade:   '⏳',
  cognitiva:     '🧠',
  pele:          '💅',
  cabelo:        '💇',
  feminino:      '🌸',
  masculino:     '⚡',
  pre_treino:    '🏋️',
  pos_treino:    '🥤',
};

function renderCategoryTiles() {
  const grid = document.getElementById('cat-grid');
  const sec  = document.getElementById('cat-section');
  if (!grid || !sec) return;

  // Agrupa produtos por categoria
  const byCat = {};
  CATALOG.forEach(p => {
    const c = String(p.categoria || '').trim().toLowerCase();
    if (!c) return;
    (byCat[c] = byCat[c] || []).push(p);
  });

  const cats = Object.keys(byCat).sort();
  if (cats.length === 0) { sec.style.display = 'none'; return; }

  const cap = (s) => s.split(/[\s_-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  grid.innerHTML = cats.map((cat, i) => {
    const items = byCat[cat];
    const icon = CAT_ICONS[cat] || (items[0] && items[0].icon) || '💊';
    const tone = (i % 10);
    return `
      <div class="cat-tile tone-${tone}" onclick="setTagFilter('${escAttr(cat)}')">
        <div class="cat-tile-icon">${esc(icon)}</div>
        <div>
          <div class="cat-tile-name">${esc(cap(cat))}</div>
          <div class="cat-tile-count">${items.length} produto(s)</div>
        </div>
        <span class="cat-tile-arrow">→</span>
      </div>`;
  }).join('') + `
    <div class="cat-tile tile-all" onclick="verTodosProdutos()">
      <div class="cat-tile-icon">📦</div>
      <div>
        <div class="cat-tile-name">Ver tudo</div>
        <div class="cat-tile-count">${CATALOG.length} produto(s)</div>
      </div>
      <span class="cat-tile-arrow">→</span>
    </div>`;
}

function renderRecomendados() {
  const sec = document.getElementById('rec-section');
  const track = document.getElementById('rec-track');
  if (!sec || !track) return;
  const recs = CATALOG.filter(p => p.destaque === 'recomendado');
  if (recs.length === 0) { sec.style.display = 'none'; return; }
  sec.style.display = '';
  track.innerHTML = recs.map(p => {
    const promoAtiva = isPromoAtiva(p);
    const price = getEffectivePrice(p);
    const oldPrice = (promoAtiva && p.price > price)
      ? `<span class="rec-card-price-old">R$ ${p.price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>`
      : '';
    const temVar = p.variantes && p.variantes.length > 0;
    const inCart = temVar
      ? p.variantes.some((_, i) => (cart[`${p.id}__${i}`] || 0) > 0)
      : !!cart[p.id];
    return `
      <div class="rec-card ${promoAtiva ? 'promo-ativa' : ''} ${inCart ? 'in-cart' : ''}" id="rec-${escAttr(p.id)}" onclick="abrirProdutoDoHero('${escAttr(p.id)}')">
        ${promoAtiva ? '<div class="rec-card-ribbon">🔥 Promo</div>' : ''}
        ${productImageHTML(p, 'rec-card-icon')}
        <div class="rec-card-name">${esc(p.name)}</div>
        ${p.conc ? `<div class="rec-card-conc">${esc(p.conc)}</div>` : ''}
        <div class="rec-card-price-row">
          ${oldPrice}
          <span class="rec-card-price">R$ ${price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
        </div>
        <button class="rec-card-add" onclick="event.stopPropagation(); adicionarRecomendado('${escAttr(p.id)}')" aria-label="Adicionar ao carrinho">${inCart ? '✓' : '+'}</button>
      </div>`;
  }).join('');
}

function adicionarRecomendado(id) {
  const p = CATALOG.find(x => x.id === id);
  if (!p) return;
  // Se tem variantes, abre o produto pra escolher dose. Senão, toggle direto.
  if (p.variantes && p.variantes.length > 0) {
    abrirProdutoDoHero(id);
    return;
  }
  if (cart[id]) {
    delete cart[id];
  } else {
    cart[id] = 1;
  }
  // Atualiza visual do rec-card
  const recEl = document.getElementById('rec-' + id);
  if (recEl) {
    recEl.classList.toggle('in-cart', !!cart[id]);
    const btn = recEl.querySelector('.rec-card-add');
    if (btn) btn.textContent = cart[id] ? '✓' : '+';
  }
  updateTotal();
}

function abrirProdutoDoHero(id) {
  // Click num slide do hero: garante que o card esteja no DOM (modo lista),
  // depois faz scroll suave + pulse, e abre protocolo se houver.
  const navMode = !activeSearch && activeTagFilter === 'todos' && activeLabFilter === 'todos';
  if (navMode) {
    activeTagFilter = '__all__';
    renderProducts();
  }
  setTimeout(() => {
    scrollToCard(id);
    if (typeof PROTOCOLS !== 'undefined' && PROTOCOLS && PROTOCOLS[id] && typeof abrirProtocolo === 'function') {
      abrirProtocolo(id);
    }
  }, 80);
}

function verTodosProdutos() {
  // "Todos" não usa filtro de categoria — mostra catálogo inteiro com filtros avançados
  activeTagFilter = 'todos';
  activeLabFilter = 'todos';
  // Trick pra entrar no modo "lista" sem categoria selecionada: aciona busca vazia? Não.
  // Vamos usar uma categoria especial "__all__" pra indicar "modo lista, sem filtro de categoria"
  activeTagFilter = '__all__';
  renderProducts();
  setTimeout(() => {
    const grid = document.getElementById('products-grid');
    if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function onSearchInput(val) {
  activeSearch = (val || '').toLowerCase().trim();
  const clr = document.getElementById('search-clear-btn');
  if (clr) clr.style.display = activeSearch ? 'flex' : 'none';
  renderProducts();
}

function clearSearch() {
  const inp = document.getElementById('product-search');
  if (inp) inp.value = '';
  activeSearch = '';
  const clr = document.getElementById('search-clear-btn');
  if (clr) clr.style.display = 'none';
  renderProducts();
}

function toggleAdvFilters() {
  const body  = document.getElementById('adv-filters-body');
  const arrow = document.getElementById('adv-filters-arrow');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'flex';
  if (arrow) arrow.classList.toggle('open', !open);
}

// renderHighlights foi substituído por renderHero + renderCategoryTiles.
function renderHighlights() { /* no-op (legado) */ }

function scrollToCard(id) {
  const el = document.getElementById('pc-' + id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('card-pulse');
  setTimeout(() => el.classList.remove('card-pulse'), 2000);
}

function toggleProduct(id) {
  if (cart.hasOwnProperty(id)) {
    delete cart[id];
  } else {
    cart[id] = 1;
  }
  renderProducts();
  updateTotal(); // revalida cupom de frete grátis ao adicionar/remover produto
}

function changeQty(id, delta) {
  if (!cart.hasOwnProperty(id)) return;
  cart[id] = Math.max(1, (cart[id] || 1) + delta);
  document.getElementById('qty-' + id).value = cart[id];
  updateSubtotal(id);
  updateTotal();
}

function setQty(id, val) {
  if (!cart.hasOwnProperty(id)) return;
  cart[id] = Math.max(1, parseInt(val) || 1);
  updateSubtotal(id);
  updateTotal();
}

function updateSubtotal(id) {
  const sub = document.getElementById('sub-' + id);
  if (sub) sub.textContent = `= R$ ${(getProductPrice(id) * cart[id]).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
}

function updateTotal() {
  let total = 0, count = 0;
  Object.keys(cart).forEach(key => {
    total += getPriceByKey(key) * cart[key];
    count += cart[key];
  });
  document.getElementById('total-display').textContent = total.toLocaleString('pt-BR', {minimumFractionDigits:2});
  document.getElementById('items-count').textContent = `${count} produto(s) · ${Object.keys(cart).length} tipo(s)`;
  if (cupomData?.frete_gratis_acima && freteEstado) selecionarFrete(freteMetodo || 'jadlog');
  if (selectedPayment === 'Cartão de Crédito') calcInstallment();
  // Persiste carrinho a cada mudança
  saveCartToStorage();
  // Atualiza mini-carrinho expandido (se aberto)
  renderCartExpanded();
}

function getTotal() {
  let total = 0;
  Object.keys(cart).forEach(key => { total += getPriceByKey(key) * cart[key]; });
  return total;
}

// ─── ENDEREÇO — CEP AUTO-FILL + COMPOSIÇÃO ───────────────────────────────────
async function preencherEnderecoViaCEP() {
  const cep     = document.getElementById('f_cep_entrega').value.replace(/\D/g,'');
  if (cep.length !== 8) return;
  const loading = document.getElementById('cep-end-loading');
  if (loading) loading.style.display = 'block';
  try {
    const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (loading) loading.style.display = 'none';
    if (!data.erro) {
      const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
      set('f_rua',    data.logradouro);
      set('f_bairro', data.bairro);
      set('f_cidade', data.localidade);
      set('f_estado', data.uf);
      document.getElementById('f_numero')?.focus();
    }
  } catch(e) {
    if (loading) loading.style.display = 'none';
  }
}

function getEnderecoCompleto() {
  const cep  = (document.getElementById('f_cep_entrega')?.value || '').trim();
  const rua  = v('f_rua');
  const num  = v('f_numero');
  const bairro = v('f_bairro');
  const comp = v('f_complemento');
  const parts = [rua, num, comp, bairro, cep].filter(Boolean);
  return parts.join(', ');
}

// ─── FRETE (ViaCEP → tabela por estado) ──────────────────────────────────────
async function calcFrete() {
  const cepRaw = document.getElementById('f_frete_cep').value.replace(/\D/g,'');
  if (cepRaw.length !== 8) {
    showFreteError('Digite um CEP válido com 8 dígitos.');
    return;
  }
  freteCep = cepRaw;
  freteMetodo = '';

  const loading  = document.getElementById('frete-loading');
  const errEl    = document.getElementById('frete-error');
  const metodos  = document.getElementById('frete-metodos');
  const gratisEl = document.getElementById('frete-gratis');

  loading.style.display  = 'block';
  errEl.style.display    = 'none';
  metodos.style.display  = 'none';

  try {
    const data = await buscarCEP(cepRaw);
    loading.style.display = 'none';

    const uf = data.uf;
    const tabela = FRETE_TABELA[uf];
    if (!tabela) {
      showFreteError('Estado fora da área de entrega. Entre em contato.');
      return;
    }

    freteEstado = uf;
    metodos.style.display = 'grid';
    const aviso = document.getElementById('frete-aviso');
    if (aviso) aviso.style.display = 'block';

    document.getElementById('fp-sedex').textContent  = `R$ ${tabela.sedex.toFixed(2).replace('.',',')}`;
    document.getElementById('fd-sedex').textContent  = `${tabela.ds} dias úteis`;
    document.getElementById('fp-jadlog').textContent = `R$ ${tabela.jadlog.toFixed(2).replace('.',',')}`;
    document.getElementById('fd-jadlog').textContent = `${tabela.dj} dias úteis`;

    selecionarFrete('jadlog'); // auto-seleciona Jadlog (mais barato)

  } catch(e) {
    loading.style.display = 'none';
    showFreteError('Erro ao consultar CEP. Verifique sua conexão.');
  }
}

function showFreteError(msg) {
  const el = document.getElementById('frete-error');
  el.textContent = '⚠️ ' + msg;
  el.style.display = 'block';
  document.getElementById('frete-loading').style.display = 'none';
}

function selecionarFrete(metodo) {
  document.querySelectorAll('.frete-opt').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById('fo-' + metodo);
  if (el) el.classList.add('selected');
  freteMetodo = metodo;
  const tabela = FRETE_TABELA[freteEstado];
  freteValor = tabela ? (tabela[metodo] || 0) : 0;
  if (cupomData?.frete_gratis_acima) {
    const limiar = parseFloat(cupomData.frete_gratis_acima);
    if (!isNaN(limiar) && getTotal() >= limiar) freteValor = 0;
  }
  if (selectedPayment === 'Cartão de Crédito') calcInstallment();
}

// ─── PROTOCOLO MODAL ────────────────────────────────────────────────────────
// ─── MODAL DE PROTOCOLO (unificado: tabs Resumo / Informativo) ─────────────
let _protoInfoPagina = ''; // guarda url do informativo do produto atual (lazy)
let _protoInfoCarregado = false;

function abrirProtocolo(id) {
  const p = CATALOG.find(x => x.id === id);
  const proto = PROTOCOLS[id];
  if (!p || !proto) return;

  document.getElementById('pm-icon').textContent = p.icon;
  document.getElementById('pm-name').textContent = p.name;
  document.getElementById('pm-conc').textContent = p.conc + (p.lab ? ' · ' + p.lab : '');

  const secoes = [
    { titulo: '⚙️ Mecanismo de Ação',  campo: proto.mecanismo      },
    { titulo: '💧 Reconstituição',      campo: proto.reconstituicao },
    { titulo: '📏 Dosagem',             campo: proto.dosagem        },
    { titulo: '📋 Protocolo 1',         campo: proto.protocolo1     },
    { titulo: '📋 Protocolo 2',         campo: proto.protocolo2     },
    { titulo: '📋 Protocolo 3',         campo: proto.protocolo3     },
    { titulo: '⚠️ Cuidados',            campo: proto.cuidados       },
  ];

  document.getElementById('pm-body').innerHTML = secoes
    .filter(s => s.campo && String(s.campo).trim())
    .map(s => `<div class="proto-section">
      <div class="proto-section-title">${s.titulo}</div>
      <div class="proto-section-body">${esc(String(s.campo)).replace(/\n/g,'<br>')}</div>
    </div>`).join('');

  // Tab "Informativo completo": só aparece se o produto tem página
  const tabInfo = document.getElementById('pm-tab-info');
  const aviso   = document.getElementById('pm-aviso');
  _protoInfoCarregado = false;
  document.getElementById('pm-info-iframe').src = '';
  if (proto.pagina) {
    let pagina = proto.pagina;
    if (!pagina.startsWith('http') && !pagina.includes('/')) {
      pagina = 'informativos/' + pagina;
    }
    _protoInfoPagina = pagina;
    if (tabInfo) tabInfo.style.display = '';
    if (aviso)   aviso.style.display   = 'flex';
  } else {
    _protoInfoPagina = '';
    if (tabInfo) tabInfo.style.display = 'none';
    if (aviso)   aviso.style.display   = 'none';
  }

  // Reset pra tab Resumo sempre que abrir
  trocarTabProto('resumo');
  document.getElementById('protocol-modal').classList.add('open');
}

function fecharProtocolo() {
  document.getElementById('protocol-modal').classList.remove('open');
  // Limpa iframe pra liberar memória + parar áudio/vídeo se houver
  document.getElementById('pm-info-iframe').src = '';
  _protoInfoCarregado = false;
}

function trocarTabProto(tab) {
  document.querySelectorAll('.pm-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.pm-tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === 'pm-pane-' + tab);
  });
  // Lazy load do iframe na primeira vez que abre a tab Informativo
  if (tab === 'info' && _protoInfoPagina && !_protoInfoCarregado) {
    document.getElementById('pm-info-iframe').src = _protoInfoPagina;
    _protoInfoCarregado = true;
  }
}

// Wrappers retrocompatíveis (caso algo externo ainda chame)
function abrirInformativo() { trocarTabProto('info'); }
function fecharInformativo() { fecharProtocolo(); }

function getFreteLabel() {
  if (!freteCep) return 'Não calculado';
  const nomes = { sedex: 'SEDEX', jadlog: 'Jadlog' };
  const cepFormatado = freteCep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  return `${nomes[freteMetodo] || freteMetodo} · ${freteEstado} · CEP ${cepFormatado} · R$ ${freteValor.toFixed(2).replace('.',',')}`;
}

// ─── PAYMENT ────────────────────────────────────────────────────────────────
function selectPayment(method) {
  document.querySelectorAll('.pay-opt').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById('pay-' + method);
  if (el) el.classList.add('selected');
  selectedPayment = method;

  const iw = document.getElementById('installment-wrap');
  if (method === 'Cartão de Crédito') {
    iw.classList.add('show');
    calcInstallment();
  } else {
    iw.classList.remove('show');
  }
}

function calcInstallment() {
  const parcelas = parseInt(document.getElementById('f_parcelas').value);
  if (!parcelas) return;
  const config = PARCELAS_CONFIG.find(p => p.parcelas === parcelas);
  let juros = config ? config.juros : 0;
  if (cupomData?.parcelamento === 'SIM' && parcelas <= 3) juros = 0;
  const desconto = cupomAplicado ? calcularDescontoCupom() : 0;
  // Juros incidem APENAS sobre subtotal de produtos (sem frete)
  let subtotal = getTotal() - desconto;
  if (subtotal < 0) subtotal = 0;
  if (juros > 0) subtotal *= (1 + juros / 100);
  // Frete soma depois — não tem juros
  const total = subtotal + freteValor;
  const por = total / parcelas;
  document.getElementById('f_parcela_val').value = `R$ ${por.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

// ─── NAVIGATION ─────────────────────────────────────────────────────────────
function goStep(n) {
  // Validações — se falhar em passo anterior, volta para ele e mostra o erro
  if (n > 1 && !validateStep1()) { _aplicarStep(1); return; }

  const sess = (typeof getClienteSession === 'function') ? getClienteSession() : null;
  const onStep1 = document.getElementById('panel1')?.classList.contains('active');

  // Gate de login obrigatório: ao sair do step 1, exige sessão.
  if (n >= 2 && !sess) {
    abrirModalLogin('login', (cliente) => {
      preencherStep2(cliente);
      _clienteJaLogado = true;
      lpSetLogado(cliente.nome || cliente.clinica || '', cliente.apelido || '');
      const jaTem = document.getElementById('lp-ja-tem-conta');
      if (jaTem) jaTem.style.display = 'none';
      _aplicarStep(3); // ← após login, pula step 2 (dados já vieram do cadastro) e vai pra pagamento
    });
    return;
  }

  // Cliente logado: step 2 é transparente. Pula sempre.
  //   • Avançando de 1 → 2:  vai direto pra 3 (pagamento)
  //   • Voltando de 3 → 2:   volta pra 1 (produtos)
  // Pra editar dados, cliente vai em perfil.html.
  if (n === 2 && sess && _clienteJaLogado) {
    const onStep3 = document.getElementById('panel3')?.classList.contains('active');
    if (onStep3) {
      _aplicarStep(1);
    } else {
      preencherStep2(sess);
      _aplicarStep(3);
    }
    return;
  }

  if (n > 2 && !validateStep2()) { _aplicarStep(2); return; }
  if (n > 3 && !validateStep3()) { return; }

  // Ao avançar do passo 2 → 3: verifica duplicata e cadastra
  if (n === 3) { _goStep3(); return; }

  try {
    _aplicarStep(n);
  } catch(e) {
    console.error('Erro ao avançar passo:', e);
    alert('Ocorreu um erro ao carregar a revisão. Tente novamente.');
  }
}

// ─── PRE-FILL STEP 2 com dados da sessão de cliente ─────────────────────────
function preencherStep2(cliente) {
  if (!cliente) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  set('f_clinica',     cliente.nome || cliente.clinica || '');
  set('f_responsavel', cliente.apelido || cliente.responsavel || '');
  set('f_telefone',    cliente.telefone);
  set('f_email',       cliente.email);
  set('f_documento',   cliente.cpf || cliente.documento || '');
  set('f_cidade',      cliente.cidade);
  set('f_estado',      cliente.estado);
  // O endereço vem como string composta — coloca em f_rua p/ o cliente revisar
  if (cliente.endereco) set('f_rua', cliente.endereco);
}

async function _goStep3() {
  const btn     = document.querySelector('#panel2 .btn-next');
  const alertEl = document.getElementById('alert2');
  alertEl.classList.remove('show');

  // Já logado via painel → avança direto, sem tentar cadastrar de novo
  if (_clienteJaLogado) {
    _aplicarStep(3);
    return;
  }

  const docLimpo = v('f_documento').replace(/\D/g,'');
  btn.disabled = true;
  btn.textContent = '⏳ Verificando...';

  try {
    const p = new URLSearchParams({
      action:      'cadastrar',
      clinica:     v('f_clinica'),
      responsavel: v('f_responsavel'),
      telefone:    v('f_telefone'),
      email:       v('f_email'),
      cpf:         docLimpo,
      cidade:      v('f_cidade'),
      estado:      v('f_estado'),
      endereco:    getEnderecoCompleto()
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res  = await fetch(`${SHEETS_URL}?${p.toString()}`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();

    if (!data.ok) {
      const msgs = {
        cpf:      '⚠️ Este CPF/CNPJ já está cadastrado. Use "Já sou cadastrado" para entrar.',
        email:    '⚠️ Este e-mail já está cadastrado. Use "Já sou cadastrado" para entrar.',
        telefone: '⚠️ Este telefone já está cadastrado. Use "Já sou cadastrado" para entrar.',
      };
      alertEl.textContent = msgs[data.duplicado] || '⚠️ ' + (data.erro || 'Erro ao cadastrar.');
      alertEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Continuar para Pagamento →';
      return;
    }
  } catch(e) {
    // erro de rede ou timeout: avança mesmo assim
  }

  btn.disabled = false;
  btn.textContent = 'Continuar para Pagamento →';
  _clienteJaLogado = true;
  lpSetLogado(v('f_clinica'), v('f_responsavel'));
  document.getElementById('lp-ja-tem-conta').style.display = 'none';
  _aplicarStep(3);
}

function _aplicarStep(n) {
  // Atualiza stepper visual
  for (let i = 1; i <= 4; i++) {
    const s = document.getElementById('s' + i);
    s.classList.remove('active', 'done');
    if (i < n) s.classList.add('done');
    else if (i === n) s.classList.add('active');
  }
  for (let i = 1; i <= 3; i++) {
    const l = document.getElementById('line' + i);
    l.classList.toggle('done', i < n);
  }

  // Troca painel
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel' + n).classList.add('active');
  currentStep = n;

  // Build review on step 4
  if (n === 4) buildReview();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── VALIDAÇÕES ─────────────────────────────────────────────────────────────
function validateStep1() {
  // Considera só itens com quantidade > 0 (keys zeradas não contam)
  const itens = Object.entries(cart || {}).filter(function(kv){ return parseInt(kv[1]) > 0; });
  const ok = itens.length > 0;
  const alert = document.getElementById('alert1');
  if (alert) {
    if (ok) {
      alert.classList.remove('show');
    } else {
      alert.classList.add('show');
      alert.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  if (!ok && typeof window !== 'undefined') {
    try { window.alert('Selecione pelo menos 1 produto antes de finalizar.'); } catch(_) {}
  }
  return ok;
}

// Marca um campo com erro + mensagem inline. Mensagem some assim que usuário digitar.
function _markFieldError(el, msg) {
  if (!el) return;
  el.classList.add('error');
  let hint = el.parentElement?.querySelector('.field-error');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'field-error';
    el.parentElement?.appendChild(hint);
  }
  hint.textContent = msg || 'Campo obrigatório';
  if (!el._errorListenerAttached) {
    el.addEventListener('input', () => {
      el.classList.remove('error');
      const h = el.parentElement?.querySelector('.field-error');
      if (h) h.remove();
    }, { once: true });
    el._errorListenerAttached = true;
  }
}

function _clearFieldError(el) {
  if (!el) return;
  el.classList.remove('error');
  const h = el.parentElement?.querySelector('.field-error');
  if (h) h.remove();
}

function validateStep2() {
  const FIELD_LABELS = {
    f_documento: 'CPF / CNPJ',
    f_clinica: 'Nome',
    f_responsavel: 'Apelido',
    f_telefone: 'Telefone / WhatsApp',
    f_email: 'E-mail',
    f_rua: 'Rua / Logradouro',
    f_numero: 'Número',
    f_bairro: 'Bairro',
  };
  const base = ['f_documento','f_clinica','f_responsavel','f_telefone','f_email'];
  const enderecoFields = ['f_rua','f_numero','f_bairro'];
  const required = _clienteJaLogado ? base : [...base, ...enderecoFields];
  let ok = true;
  let firstError = null;
  required.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = el.value.trim();
    if (!val) {
      _markFieldError(el, `Preencha "${FIELD_LABELS[id] || id}"`);
      if (!firstError) firstError = el;
      ok = false;
      return;
    }
    // Validações específicas
    if (id === 'f_email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) {
      _markFieldError(el, 'E-mail inválido');
      if (!firstError) firstError = el;
      ok = false;
      return;
    }
    if (id === 'f_telefone' && val.replace(/\D/g,'').length < 10) {
      _markFieldError(el, 'Telefone incompleto');
      if (!firstError) firstError = el;
      ok = false;
      return;
    }
    if (id === 'f_documento') {
      const dig = val.replace(/\D/g,'').length;
      if (dig !== 11 && dig !== 14) {
        _markFieldError(el, 'CPF (11 dígitos) ou CNPJ (14 dígitos)');
        if (!firstError) firstError = el;
        ok = false;
        return;
      }
    }
    _clearFieldError(el);
  });
  if (_clienteJaLogado) {
    enderecoFields.forEach(id => _clearFieldError(document.getElementById(id)));
  }
  const alert = document.getElementById('alert2');
  if (ok) {
    alert.classList.remove('show');
  } else {
    alert.classList.add('show');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return ok;
}

function validateStep3() {
  const ok = selectedPayment !== '';
  const alert = document.getElementById('alert3');
  ok ? alert.classList.remove('show') : alert.classList.add('show');
  return ok;
}

// ─── BUILD REVIEW ───────────────────────────────────────────────────────────
function buildReview() {
  // Dados
  const dados = [
    ['Nome', v('f_clinica')],
    ['Apelido', v('f_responsavel')],
    ['Telefone', v('f_telefone')],
    ['E-mail', v('f_email')],
    ['Documento', v('f_documento') || '—'],
    ['Cidade', `${v('f_cidade')} — ${v('f_estado')}`],
    ['Endereço', getEnderecoCompleto() || '—'],
    ['Observações', v('f_obs') || '—'],
  ];
  document.getElementById('review-dados').innerHTML =
    dados.map(([l,val]) => `<div class="rc-row"><span class="lbl">${l}</span><span class="val">${esc(val)}</span></div>`).join('');

  // Produtos
  let html = '';
  let total = 0;
  Object.keys(cart).forEach(key => {
    const { id } = parseCartKey(key);
    const p = CATALOG.find(x => x.id === id);
    if (!p) return;
    const qty   = cart[key];
    const price = getPriceByKey(key);
    const varLabel = getVariantLabel(key);
    const sub   = price * qty;
    total += sub;

    // Verifica se este item tem desconto de cupom
    let cupomHtml = '';
    if (cupomAplicado && cupomData) {
      const { id: baseId } = parseCartKey(key);
      if (cupomData.tipo === 'fixo') {
        const precos = cupomData.precos || {};
        const novoP  = precos[key]    !== undefined ? parseFloat(precos[key])
                     : precos[baseId] !== undefined ? parseFloat(precos[baseId])
                     : null;
        if (novoP !== null) {
          cupomHtml = `<div style="font-size:.72rem;color:var(--accent);margin-top:1px">🎟️ Cupom: R$ ${novoP.toLocaleString('pt-BR',{minimumFractionDigits:2})} / un.</div>`;
        }
      } else if (cupomData.tipo === '%') {
        const prods = Array.isArray(cupomData.produtos) ? cupomData.produtos : null;
        if (!prods || prods.includes(key) || prods.includes(baseId)) {
          cupomHtml = `<div style="font-size:.72rem;color:var(--accent);margin-top:1px">🎟️ Cupom: −${esc(cupomData.valor)}%</div>`;
        }
      }
    }

    html += `<div class="rp-item">
      <div><div class="rp-name">${esc(p.icon)} ${esc(p.name)}</div><div class="rp-detail">${esc(varLabel)}</div>${cupomHtml}</div>
      <div><div style="text-align:right; font-size:.8rem; color:var(--gray)">${qty} × R$${price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      <div class="rp-total">R$ ${sub.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
    </div>`;
  });
  document.getElementById('review-products').innerHTML = html;

  // Pagamento
  let pagInfo = `<div class="rc-row"><span class="lbl">Forma</span><span class="val">${esc(selectedPayment)}</span></div>`;
  if (selectedPayment === 'Cartão de Crédito') {
    const parc = document.getElementById('f_parcelas').value;
    const val = document.getElementById('f_parcela_val').value;
    const semJuros = cupomData?.parcelamento === 'SIM' && parseInt(parc) <= 3 ? ' — sem juros (cupom)' : '';
    pagInfo += `<div class="rc-row"><span class="lbl">Parcelamento</span><span class="val">${esc(parc)}x de ${esc(val)}${semJuros}</span></div>`;
  }
  if (v('f_obs_pag')) {
    pagInfo += `<div class="rc-row"><span class="lbl">Obs. pagamento</span><span class="val">${esc(v('f_obs_pag'))}</span></div>`;
  }

  // Frete
  let freteLabel = getFreteLabel();
  // Só anota "Grátis (cupom)" se o frete FOI calculado (freteEstado/freteCep preenchidos).
  // Quando ainda não calculou, freteValor=0 mas isso não é "grátis" — é "não calculado".
  if (cupomData?.frete_gratis_acima && freteEstado) {
    const limiar = parseFloat(cupomData.frete_gratis_acima);
    if (!isNaN(limiar)) {
      if (freteValor === 0 && getTotal() >= limiar) {
        freteLabel += ` <span style="color:var(--green);font-size:.78rem">🎉 Grátis (cupom)</span>`;
      } else {
        const falta = limiar - getTotal();
        if (falta > 0) freteLabel += ` <span style="color:var(--accent);font-size:.78rem">🎟️ Adicione R$ ${falta.toLocaleString('pt-BR',{minimumFractionDigits:2})} para frete grátis</span>`;
      }
    }
  }
  let pagFrete = `<div class="rc-row"><span class="lbl">Frete</span><span class="val">${freteLabel}</span></div>`;
  document.getElementById('review-payment').innerHTML = pagInfo + pagFrete;

  // Total com frete
  total += freteValor;
  if (selectedPayment === 'Cartão de Crédito') {
    const parc   = parseInt(document.getElementById('f_parcelas').value);
    const config = PARCELAS_CONFIG.find(p => p.parcelas === parc);
    let juros  = config ? config.juros : 0;
    if (cupomData?.parcelamento === 'SIM' && parc <= 3) juros = 0;
    if (juros > 0) total *= (1 + juros / 100);
  }

  // Total box
  const subtotalBruto = getTotal();
  const totalFinal    = getFinalTotal();
  const descontoValor = cupomAplicado ? calcularDescontoCupom() : 0;
  const descontoLabel = cupomAplicado && cupomData
    ? (cupomData.tipo === '%' ? `${cupomData.valor}%` : 'Preço especial')
    : '';
  const descontoHtml  = cupomAplicado ? `
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:.85rem;color:var(--accent);font-weight:700">
      <span>🎟️ Desconto (${esc(descontoLabel)} — ${esc(cupomCodigo)})</span>
      <span>− R$ ${descontoValor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
    </div>` : '';
  const beneficiosReviewHtml = (() => {
    if (!cupomAplicado || !cupomData) return '';
    const items = [];
    if (cupomData.parcelamento === 'SIM' && selectedPayment === 'Cartão de Crédito') {
      const parc = parseInt(document.getElementById('f_parcelas').value) || 1;
      if (parc <= 3) {
        const origConf  = PARCELAS_CONFIG.find(p => p.parcelas === parc);
        const jurosOrig = origConf ? origConf.juros : 0;
        const base      = getTotal() - descontoValor;
        const econJuros = jurosOrig > 0
          ? ` <span style="opacity:.85">· economia de R$ ${(base * jurosOrig / 100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} em juros</span>`
          : '';
        items.push(`⚡ Parcelamento sem juros (${parc}×)${econJuros} · cupom <strong>${esc(cupomCodigo)}</strong>`);
      }
    }
    if (cupomData.frete_gratis_acima && freteValor === 0 && freteEstado && freteMetodo) {
      const tabela       = FRETE_TABELA[freteEstado];
      const freteOriginal = tabela ? (tabela[freteMetodo] || 0) : 0;
      const econFrete    = freteOriginal > 0
        ? ` <span style="opacity:.85">· economia de R$ ${freteOriginal.toFixed(2).replace('.',',')}</span>`
        : '';
      items.push(`🚚 Frete grátis${econFrete} · cupom <strong>${esc(cupomCodigo)}</strong>`);
    }
    if (!items.length) return '';
    return items.map(i =>
      `<div style="font-size:.75rem;color:var(--green);margin-bottom:5px">${i}</div>`
    ).join('');
  })();
  // Linha de saldo de indicação usado (se cliente marcou o checkbox)
  const usandoSaldo = document.getElementById('usar_saldo_indicacao_chk')?.checked && _saldoIndicacaoUsavel > 0;
  const saldoIndicHtml = usandoSaldo ? `
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:.85rem;color:#15803D;font-weight:700">
      <span>💰 Saldo de indicação</span>
      <span>− R$ ${_saldoIndicacaoUsavel.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
    </div>` : '';
  document.getElementById('review-total-box').innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:.85rem;color:rgba(255,255,255,.6)">
      <span>Subtotal produtos</span><span>R$ ${subtotalBruto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:.85rem;color:rgba(255,255,255,.6)">
      <span>Frete</span><span>${freteValor===0 ? '🎉 Grátis' : 'R$ '+freteValor.toFixed(2).replace('.',',')}</span>
    </div>
    ${descontoHtml}
    ${saldoIndicHtml}
    ${beneficiosReviewHtml}
    <div style="border-top:1px solid rgba(255,255,255,.15);margin:10px 0"></div>
    <div class="rtb-label">Total do Pedido</div>
    <div class="rtb-amount">R$ ${totalFinal.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
    <div class="rtb-method">${esc(selectedPayment)}</div>`;
  renderRecomendacoesRevisao();
}

function v(id) { return document.getElementById(id)?.value?.trim() || ''; }

// ─── WHATSAPP ────────────────────────────────────────────────────────────────
let _sendingPedido = false;
// ─── CONFIRMATION MODAL ANTES DE ENVIAR ────────────────────────────────────
function confirmarEnviarPedido() {
  // Validações antes de mostrar confirm
  if (Object.keys(cart).length === 0) {
    alert('⚠️ Carrinho vazio.');
    return;
  }
  if (!selectedPayment) {
    alert('⚠️ Selecione uma forma de pagamento.');
    return;
  }
  // Monta resumo compacto
  const totalItens = Object.values(cart).reduce((s, q) => s + q, 0);
  const total = (typeof getFinalTotal === 'function') ? getFinalTotal() : 0;
  const desc = cupomAplicado ? calcularDescontoCupom() : 0;
  const fmt = (v) => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const sumEl = document.getElementById('confirm-summary');
  if (sumEl) {
    sumEl.innerHTML = `
      <div class="cs-row"><span>Itens</span><strong>${totalItens} produto(s)</strong></div>
      <div class="cs-row"><span>Pagamento</span><strong>${esc(selectedPayment)}</strong></div>
      ${desc > 0 ? `<div class="cs-row cs-disc"><span>Desconto cupom</span><strong>−${fmt(desc)}</strong></div>` : ''}
      ${_indicacaoAplicada ? `<div class="cs-row cs-disc"><span>Código de indicação</span><strong>${esc(_indicacaoCodigo)}</strong></div>` : ''}
      <div class="cs-row cs-total"><span>Total</span><strong>${fmt(total)}</strong></div>
    `;
  }
  document.getElementById('confirm-pedido-modal').classList.add('open');
}

function fecharConfirmacao() {
  document.getElementById('confirm-pedido-modal').classList.remove('open');
}

async function sendWhatsApp() {
  // Trava contra múltiplos cliques: enquanto o request está em voo,
  // ignora cliques adicionais. Reativa só após sucesso/erro.
  if (_sendingPedido) return;
  _sendingPedido = true;
  const btnWA = document.querySelector('.btn-wa');
  let _btnHtmlOrig = '';
  if (btnWA) {
    _btnHtmlOrig = btnWA.innerHTML;
    btnWA.disabled = true;
    btnWA.style.opacity = '.6';
    btnWA.style.cursor = 'wait';
    btnWA.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px">⏳ Enviando pedido...</span>';
  }
  // Wrapper try-finally garante que o flag e o botão SEMPRE voltam ao normal,
  // mesmo se algo no meio do código throw. Isso evita o bug "botão travado".
  try {
    return await _sendWhatsAppCore(btnWA, _btnHtmlOrig);
  } catch (err) {
    console.error('Erro inesperado em sendWhatsApp:', err);
  } finally {
    _sendingPedido = false;
    if (btnWA && btnWA.innerHTML.includes('Enviando')) {
      btnWA.disabled = false;
      btnWA.style.opacity = '';
      btnWA.style.cursor = '';
      btnWA.innerHTML = _btnHtmlOrig;
    }
  }
}

async function _sendWhatsAppCore(btnWA, _btnHtmlOrig) {

  const total = getFinalTotal();

  const _clientName = (typeof CLIENT !== 'undefined' && CLIENT.name) ? CLIENT.name.toUpperCase() : 'PEDIDO';
  let msg = `📦 *PEDIDO ${_clientName}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `📋 *DADOS DO CLIENTE*\n`;
  msg += `Nome: ${v('f_clinica')}\n`;
  msg += `Apelido: ${v('f_responsavel')}\n`;
  msg += `Telefone: ${v('f_telefone')}\n`;
  msg += `E-mail: ${v('f_email')}\n`;
  if (v('f_documento')) msg += `Documento: ${v('f_documento')}\n`;
  if (v('f_cidade')) msg += `Cidade/Estado: ${v('f_cidade')} — ${v('f_estado')}\n`;
  const endCompleto = getEnderecoCompleto();
  if (endCompleto) msg += `Endereço: ${endCompleto}\n`;
  if (v('f_obs')) msg += `Obs: ${v('f_obs')}\n`;

  msg += `\n📦 *PRODUTOS SOLICITADOS*\n`;
  Object.keys(cart).forEach(key => {
    const { id } = parseCartKey(key);
    const p = CATALOG.find(x => x.id === id);
    if (!p) return;
    const qty = cart[key];
    const price = getPriceByKey(key);
    const varLabel = getVariantLabel(key);
    msg += `• ${p.name} (${varLabel}) — ${qty}x — R$ ${(price * qty).toLocaleString('pt-BR',{minimumFractionDigits:2})}\n`;
  });

  msg += `\n🚚 *FRETE*\n`;
  msg += `${getFreteLabel()}\n`;

  msg += `\n💳 *PAGAMENTO*\n`;
  msg += `Forma: ${selectedPayment}\n`;
  if (selectedPayment === 'Cartão de Crédito') {
    const parc = document.getElementById('f_parcelas').value;
    const val = document.getElementById('f_parcela_val').value;
    const semJurosSuffix = cupomData?.parcelamento === 'SIM' && parseInt(parc) <= 3 ? ' (sem juros — cupom)' : '';
    msg += `Parcelamento: ${parc}x de ${val}${semJurosSuffix}\n`;
  }
  if (cupomData?.parcelamento === 'SIM') msg += `⚡ Benefício: parcelas 1× a 3× sem juros (cupom)\n`;
  if (v('f_obs_pag')) msg += `Obs. pagamento: ${v('f_obs_pag')}\n`;

  msg += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📦 Frete: ${freteValor === 0 ? 'GRÁTIS' : 'R$ ' + freteValor.toFixed(2).replace('.',',')}\n`;
  if (cupomAplicado) {
    const desc = calcularDescontoCupom();
    const dLabel = cupomData && cupomData.tipo === '%' ? `${cupomData.valor}%` : 'Preço especial';
    msg += `🎟️ Desconto (${dLabel} — ${cupomCodigo}): − R$ ${desc.toLocaleString('pt-BR',{minimumFractionDigits:2})}\n`;
  }
  msg += `💰 *TOTAL: R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `\n_Pedido enviado via formulário ${(typeof CLIENT !== 'undefined' && CLIENT.name) ? CLIENT.name : ''}_`;

  // Salvar localmente
  saveOrder(total);

  // Salvar no Google Sheets
  const itensPedido = Object.keys(cart).map(key => {
    const { id } = parseCartKey(key);
    const p = CATALOG.find(x => x.id === id);
    if (!p) return key;
    const price = getPriceByKey(key);
    const varLabel = getVariantLabel(key);
    return `${cart[key]}x ${p.name} (${varLabel}) = R$ ${(price * cart[key]).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  }).join('\n');
  const parcelas = selectedPayment === 'Cartão de Crédito'
    ? `${document.getElementById('f_parcelas').value}x de ${document.getElementById('f_parcela_val').value}`
    : '—';


  const _cliSess = (typeof getClienteSession === 'function') ? getClienteSession() : null;
  const params = new URLSearchParams({
    clinica:       v('f_clinica'),
    responsavel:   v('f_responsavel'),
    telefone:      v('f_telefone'),
    email:         v('f_email'),
    documento:     v('f_documento'),
    cidade:        v('f_cidade'),
    estado:        v('f_estado'),
    endereco:      getEnderecoCompleto(),
    produtos:      itensPedido,
    quantidades:   itensPedido,
    total:         total.toFixed(2),
    pagamento:     selectedPayment,
    parcelas,
    obs:           v('f_obs'),
    obs_pagamento: v('f_obs_pag'),
    cupom_codigo:  cupomCodigo || '',
    cupom_pct:     cupomAplicado && cupomData?.tipo === '%' ? (cupomData.valor).toFixed(0) : '0',
    cupom_valor:   cupomAplicado ? calcularDescontoCupom().toFixed(2) : '0',
    indicado_por:  _indicacaoAplicada ? _indicacaoCodigo : '',
    saldo_indicacao_usar: (document.getElementById('usar_saldo_indicacao_chk')?.checked
                            ? String(_saldoIndicacaoUsavel || 0) : '0'),
    carrinho:      JSON.stringify(cart),
    cliente_token: _cliSess?.token || '',
  });
  // CRÍTICO: window.open precisa rodar DENTRO da user gesture chain (sem await
  // antes), senão o browser bloqueia popup. Por isso disparamos fetch sem
  // await (fire-and-forget) e abrimos o WhatsApp na sequência síncrona.
  fetch(`${SHEETS_URL}?${params.toString()}`)
    .then(r => r.json().catch(() => null))
    .then(data => {
      if (!data || data.ok === false) console.warn('Pedido pode não ter sido salvo:', data);
      else if (data.indicacao && !data.indicacao.aplicada && _indicacaoAplicada) {
        // Loga motivo da rejeição da indicação pra debug
        console.warn('Indicação rejeitada pelo backend:', data.indicacao.motivo_rejeicao || 'motivo desconhecido');
      }
    })
    .catch(err => console.warn('Erro ao enviar pedido ao backend:', err));

  // Abrir WhatsApp imediatamente (síncrono em relação ao click → sem popup block)
  const encoded = encodeURIComponent(msg);
  const wa = (typeof CLIENT !== 'undefined' && CLIENT.wa) ? CLIENT.wa : WA_NUMBER;
  if (wa) window.open(`https://wa.me/${wa}?text=${encoded}`, '_blank');

  // Mostrar tela de sucesso
  showSuccess();
  // Reset do flag pra permitir novo pedido após showSuccess (se o user voltar)
  _sendingPedido = false;
  if (btnWA) {
    btnWA.disabled = false;
    btnWA.style.opacity = '';
    btnWA.style.cursor = '';
    btnWA.innerHTML = _btnHtmlOrig;
  }
}

// Total ANTES do desconto de saldo de indicação (usado pra calcular quanto
// do saldo pode ser usado, evitando recursão).
function getBaseTotal() {
  // Calcula subtotal de produtos com desconto aplicado
  let subtotal = getTotal();
  if (cupomAplicado) {
    const desc = calcularDescontoCupom();
    subtotal -= desc;
    if (subtotal < 0) subtotal = 0;
  }
  // Juros do cartão incidem APENAS sobre produtos (sem frete)
  if (selectedPayment === 'Cartão de Crédito') {
    const parc   = parseInt(document.getElementById('f_parcelas').value);
    const config = PARCELAS_CONFIG.find(p => p.parcelas === parc);
    let juros  = config ? config.juros : 0;
    if (cupomData?.parcelamento === 'SIM' && parc <= 3) juros = 0;
    if (juros > 0) subtotal *= (1 + juros / 100);
  }
  // Frete entra fora do cálculo de juros
  return subtotal + freteValor;
}

function getFinalTotal() {
  let total = getBaseTotal();
  // Desconto de saldo de indicação (se cliente marcou o checkbox)
  const chk = document.getElementById('usar_saldo_indicacao_chk');
  if (chk && chk.checked && _saldoIndicacaoUsavel > 0) {
    total -= _saldoIndicacaoUsavel;
    if (total < 0) total = 0;
  }
  return total;
}

function showSuccess() {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('success-screen').classList.add('show');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Pedido enviado — limpa carrinho persistido
  try { localStorage.removeItem(_CART_STORAGE_KEY); } catch(e) {}
}

function newOrder() {
  // Preserva dados do cliente logado antes de limpar tudo
  const camposCliente = ['f_documento','f_clinica','f_responsavel','f_telefone','f_email','f_cep_entrega','f_rua','f_numero','f_bairro','f_complemento','f_cidade','f_estado'];
  const dadosSalvos = _clienteJaLogado
    ? Object.fromEntries(camposCliente.map(id => [id, document.getElementById(id)?.value || '']))
    : null;

  // Reset
  cart = {};
  selectedPayment  = '';
  currentStep      = 1;
  cupomAplicado    = false;
  cupomDesconto    = 0;
  cupomCodigo      = '';
  cupomData        = null;
  const fc = document.getElementById('f_cupom');
  const bc = document.getElementById('btn-cupom');
  const mc = document.getElementById('cupom-msg');
  if (fc) { fc.value = ''; fc.disabled = false; }
  if (bc) bc.disabled = false;
  if (mc) mc.innerHTML = '';
  document.querySelectorAll('input, textarea, select').forEach(el => { if (el.id !== 'f_parcelas') el.value = ''; });

  // Restaura dados do cliente se estava logado
  if (dadosSalvos) {
    camposCliente.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = dadosSalvos[id];
    });
  }
  document.querySelectorAll('.pay-opt').forEach(el => el.classList.remove('selected'));
  document.getElementById('installment-wrap').classList.remove('show');
  for (let i = 1; i <= 4; i++) {
    const s = document.getElementById('s' + i);
    s.classList.remove('active', 'done');
  }
  document.getElementById('s1').classList.add('active');
  for (let i = 1; i <= 3; i++) document.getElementById('line' + i).classList.remove('done');
  document.getElementById('success-screen').classList.remove('show');
  document.getElementById('panel1').classList.add('active');
  renderProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── LOCAL STORAGE "DATABASE" ────────────────────────────────────────────────
function saveOrder(total) {
  const orders = JSON.parse(localStorage.getItem('lp_orders') || '[]');
  const products = Object.keys(cart).map(id => {
    const p = CATALOG.find(x => x.id === id);
    return p ? `${p.name} ×${cart[id]}` : id;
  });
  orders.unshift({
    id: Date.now(),
    date: new Date().toLocaleString('pt-BR'),
    clinica: v('f_clinica'),
    responsavel: v('f_responsavel'),
    telefone: v('f_telefone'),
    email: v('f_email'),
    products,
    payment: selectedPayment,
    total: total.toFixed(2)
  });
  localStorage.setItem('lp_orders', JSON.stringify(orders));
}

// ─── RECOMENDAÇÕES NA REVISÃO ────────────────────────────────────────────────
function renderRecomendacoesRevisao() {
  const cartIds = Object.keys(cart).map(k => k.split('__')[0]);

  const corrIds = new Set();
  cartIds.forEach(id => {
    (CORRELACOES[id] || []).forEach(rel => { if (!cartIds.includes(rel)) corrIds.add(rel); });
  });
  const corrProdutos = [...corrIds].map(id => CATALOG.find(p => p.id === id)).filter(Boolean);

  const histProdutos = clienteHistorico.length
    ? CATALOG.filter(p =>
        !cartIds.includes(p.id) &&
        clienteHistorico.some(h => p.name.toLowerCase().includes(h.toLowerCase()) || h.toLowerCase().includes(p.name.toLowerCase()))
      ).slice(0, 4)
    : [];

  const section = document.getElementById('rec-revisao');
  if (corrProdutos.length === 0 && histProdutos.length === 0) {
    section.style.display = 'none'; return;
  }
  section.style.display = '';

  function buildRecCard(p) {
    const price  = getEffectivePrice(p);
    const inCart = cartIds.includes(p.id);
    return `<div class="rec-card">
      <div class="rec-card-top">
        <span class="rec-card-icon">${esc(p.icon)}</span>
        <span class="rec-card-name">${esc(p.name)}</span>
      </div>
      <div class="rec-card-conc">${esc(p.conc)}</div>
      <div class="rec-card-price">R$ ${price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      <button class="rec-add-btn" id="rec-btn-${escAttr(p.id)}" ${inCart ? 'disabled' : ''}
        onclick="adicionarDaRec('${escAttr(p.id)}')">
        ${inCart ? '✓ Já no carrinho' : '+ Adicionar ao pedido'}
      </button>
    </div>`;
  }

  const leveGrid = document.getElementById('rec-rev-leve-grid');
  const histEl   = document.getElementById('rec-rev-hist');
  const histGrid = document.getElementById('rec-rev-hist-grid');

  leveGrid.innerHTML = corrProdutos.length
    ? corrProdutos.map(buildRecCard).join('')
    : '<div style="font-size:.7rem;color:var(--gray)">Nenhuma sugestão para este pedido.</div>';

  if (histProdutos.length > 0) {
    histGrid.innerHTML = histProdutos.map(buildRecCard).join('');
    histEl.style.display = '';
  } else {
    histEl.style.display = 'none';
  }
}

function adicionarDaRec(id) {
  const p = CATALOG.find(x => x.id === id);
  if (!p) return;
  if (p.variantes && p.variantes.length > 0) {
    const key = `${id}__0`;
    if (!cart[key]) cart[key] = 1;
  } else {
    if (!cart[id]) cart[id] = 1;
  }
  updateTotal();
  buildReview();
}

// ─── LOGIN PANEL ────────────────────────────────────────────────────────────
// ─── LOGIN PANEL ─────────────────────────────────────────────────────────────

function lpToggleLogin() {
  const panel = document.getElementById('lp-panel');
  const open  = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : '';
  if (!open) {
    document.getElementById('lp-erro').style.display = 'none';
    document.getElementById('lp-loading').style.display = 'none';
    setTimeout(() => document.getElementById('lp-doc-input').focus(), 100);
  }
}

function lpShowForm() {
  document.getElementById('lp-panel').style.display = 'none';
}

function lpSetLogado(clinica, responsavel) {
  const exibir = responsavel || clinica || '';
  document.getElementById('lp-nome-bar').textContent = exibir;
  document.getElementById('lp-logado-bar').style.display = 'flex';
}

function lpLogout() {
  clienteHistorico = [];
  _clienteJaLogado = false;
  ['f_clinica','f_responsavel','f_telefone','f_email','f_documento','f_cep_entrega','f_rua','f_numero','f_bairro','f_complemento','f_cidade','f_estado'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('lp-logado-bar').style.display = 'none';
  document.getElementById('lp-ja-tem-conta').style.display = '';
  document.getElementById('lp-panel').style.display = 'none';
}

function lpFormatDoc(input) {
  if (input.value.includes('@')) return; // é e-mail, não formata
  let v = input.value.replace(/\D/g,'');
  if (v.length <= 11) {
    v = v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  } else {
    v = v.replace(/(\d{2})(\d)/,'$1.$2')
         .replace(/(\d{3})(\d)/,'$1.$2')
         .replace(/(\d{3})(\d)/,'$1/$2')
         .replace(/(\d{4})(\d{1,2})$/,'$1-$2');
  }
  input.value = v;
}

async function lpEntrar() {
  const raw     = document.getElementById('lp-doc-input').value.trim();
  const isEmail = raw.includes('@');
  const doc     = isEmail ? raw.toLowerCase() : raw.replace(/\D/g,'');
  if (!isEmail && doc.length !== 11 && doc.length !== 14) {
    document.getElementById('lp-erro').innerHTML = '⚠️ CPF ou CNPJ inválido. <span class="lp-link" onclick="lpShowForm()">Preencher manualmente</span>';
    document.getElementById('lp-erro').style.display = 'block';
    return;
  }
  if (isEmail && !doc.includes('.')) {
    document.getElementById('lp-erro').innerHTML = '⚠️ E-mail inválido. <span class="lp-link" onclick="lpShowForm()">Preencher manualmente</span>';
    document.getElementById('lp-erro').style.display = 'block';
    return;
  }
  document.getElementById('lp-loading').style.display = 'block';
  document.getElementById('lp-erro').style.display = 'none';
  try {
    const res = await fetch(`${SHEETS_URL}?action=cliente&documento=${encodeURIComponent(doc)}`);
    const data = await res.json();
    document.getElementById('lp-loading').style.display = 'none';
    if (data && (data.clinica || data.nome)) {
      lpPreencherCampos(data);
      lpSetLogado(data.clinica || data.nome, data.responsavel);
      if (Array.isArray(data.historico)) clienteHistorico = data.historico;
      _clienteJaLogado = true;
      lpShowForm();
      document.getElementById('lp-ja-tem-conta').style.display = 'none';
      _aplicarStep(3);
    } else {
      document.getElementById('lp-erro').innerHTML = '⚠️ Não encontrado. <span class="lp-link" onclick="lpShowForm()">Preencher manualmente</span>';
      document.getElementById('lp-erro').style.display = 'block';
    }
  } catch(e) {
    document.getElementById('lp-loading').style.display = 'none';
    document.getElementById('lp-erro').innerHTML = '⚠️ Erro de conexão. <span class="lp-link" onclick="lpShowForm()">Preencher manualmente</span>';
    document.getElementById('lp-erro').style.display = 'block';
  }
}

function lpPreencherCampos(data) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('f_documento',   data.doc || data.documento || '');
  set('f_clinica',     data.clinica || data.nome || '');
  set('f_responsavel', data.responsavel || '');
  set(       data.cargo || '');
  set('f_telefone',    data.telefone);
  set('f_email',       data.email);
  set('f_cidade',      data.cidade);
  set('f_estado',      data.estado);
  // Carrega endereço legado no campo de rua para o cliente revisar
  if (data.endereco) set('f_rua', data.endereco);
}


function fecharPopupPrazo() {
  const el = document.getElementById('popup-prazo');
  if (!el) return;
  el.classList.add('hide');
  setTimeout(() => el.remove(), 280);
}
setTimeout(fecharPopupPrazo, 8000);

// ─── CÓDIGO DE INDICAÇÃO (digitado pelo comprador) ──────────────────────────
// Validação completa server-side: formato + indicador existe + anti-fraude
// (self-ref, vendedora stacking, primeira-compra). Mostra mensagem específica
// pra cada motivo de rejeição.
const INDICACAO_MOTIVOS = {
  formato_invalido:        '❌ Formato inválido. Use o código completo (ex: joao-A4F7K2).',
  indicador_nao_encontrado: '❌ Código não encontrado. Confira se digitou certo.',
  self_ref_email:          '❌ Você não pode usar o seu próprio código de indicação.',
  self_ref_cpf:            '❌ Esse código pertence ao seu CPF — não pode usar.',
  self_ref_tel:            '❌ Esse código pertence ao seu telefone — não pode usar.',
  indicador_e_vendedora:   '❌ Esse código pertence a uma vendedora. Vendedoras não participam do programa de indicação.',
  nao_e_primeira_compra:   '❌ O código de indicação só pode ser usado na sua primeira compra no site.',
  sem_clientes:            '❌ Sistema indisponível. Tente novamente em alguns minutos.',
  sem_coluna_cliente_id:   '❌ Sistema indisponível. Tente novamente em alguns minutos.',
  erro_interno:            '⚠️ Erro ao validar. Tente novamente.',
};

async function _aplicarComoIndicacao(codigo) {
  const input = document.getElementById('f_codigo');
  const msg   = document.getElementById('codigo-msg');
  const btnA  = document.getElementById('btn-codigo');
  const btnR  = document.getElementById('btn-remover-codigo');
  // Pre-check de formato (defesa redundante — _isCodigoIndicacao já checou)
  if (!codigo.match(/([A-F0-9]{6})$/)) {
    msg.innerHTML = `<div class="cupom-err">${INDICACAO_MOTIVOS.formato_invalido}</div>`;
    return;
  }
  // Estado loading
  msg.innerHTML = `<div class="cupom-loading">⏳ Validando código…</div>`;
  if (btnA) btnA.disabled = true;
  // Coleta dados do comprador (do form OU sessão)
  const sess = (typeof getClienteSession === 'function') ? getClienteSession() : null;
  const params = new URLSearchParams({
    action: 'validar_indicacao',
    codigo,
    token: sess?.token || '',
    email: document.getElementById('f_email')?.value || '',
    cpf:   document.getElementById('f_documento')?.value || '',
    tel:   document.getElementById('f_telefone')?.value || '',
  });
  try {
    const r = await fetch(`${SHEETS_URL}?${params.toString()}`);
    const data = await r.json().catch(() => null);
    if (data && data.ok) {
      // Aplica + trava
      _indicacaoAplicada = true;
      _indicacaoCodigo   = codigo;
      input.disabled = true;
      if (btnA) { btnA.disabled = false; btnA.classList.add('hidden'); }
      if (btnR) btnR.classList.remove('hidden');
      msg.innerHTML = `<div class="cupom-ok">✅ Código <strong>${esc(codigo)}</strong> aplicado!</div>`;
    } else {
      const motivo = data?.motivo || 'erro_interno';
      const text = INDICACAO_MOTIVOS[motivo] || `❌ Código não pôde ser aplicado (${motivo}).`;
      msg.innerHTML = `<div class="cupom-err">${text}</div>`;
      if (btnA) btnA.disabled = false;
    }
  } catch (e) {
    msg.innerHTML = `<div class="cupom-err">⚠️ Erro de conexão. Tente novamente.</div>`;
    if (btnA) btnA.disabled = false;
  }
}

// (legado) — wrappers retrocompatíveis pra qualquer código externo
async function validarIndicacao() {
  const f = document.getElementById('f_codigo');
  if (f) return aplicarCodigo();
}

// ─── SALDO DE INDICAÇÃO (uso direto no checkout) ────────────────────────────
// Quando cliente abre Step 4 (revisão), busca saldo disponível e mostra opção
// de usar nesse pedido. O valor real é validado server-side em salvar().
let _saldoIndicacaoDisponivel = 0;
let _saldoIndicacaoUsavel = 0;

async function carregarSaldoIndicacao() {
  const sess = (typeof getClienteSession === 'function') ? getClienteSession() : null;
  if (!sess?.token) return;
  try {
    const data = await cliPost_('meu_perfil', { token: sess.token });
    if (!data?.ok || !data.cliente?.indicacao) return;
    _saldoIndicacaoDisponivel = parseFloat(data.cliente.indicacao.disponivel || 0);
    if (_saldoIndicacaoDisponivel > 0) {
      const sec = document.getElementById('saldo-indicacao-section');
      const display = document.getElementById('saldo-disp-display');
      if (sec) sec.style.display = '';
      if (display) display.textContent = 'R$ ' + _saldoIndicacaoDisponivel.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
      atualizarUsoSaldoIndicacao();
    }
  } catch (e) { /* silently */ }
}

function atualizarUsoSaldoIndicacao() {
  const chk = document.getElementById('usar_saldo_indicacao_chk');
  const det = document.getElementById('saldo-usado-detalhe');
  const valEl = document.getElementById('saldo-usado-valor');
  if (!chk || !det) return;
  if (!chk.checked) {
    _saldoIndicacaoUsavel = 0;
    det.style.display = 'none';
  } else {
    // Calcula com base no total ANTES do saldo (evita loop em getFinalTotal)
    const baseTotal = (typeof getBaseTotal === 'function') ? getBaseTotal() : 0;
    _saldoIndicacaoUsavel = Math.min(_saldoIndicacaoDisponivel, baseTotal);
    _saldoIndicacaoUsavel = Math.round(_saldoIndicacaoUsavel * 100) / 100;
    if (valEl) valEl.textContent = 'R$ ' + _saldoIndicacaoUsavel.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    det.style.display = '';
  }
  // Re-renderiza o review pra atualizar o total mostrado
  if (typeof buildReview === 'function') buildReview();
}

// Hook: quando usuário entra no Step 4 (revisão), carrega saldo
const _origGoStep = typeof goStep === 'function' ? goStep : null;
if (_origGoStep) {
  window.goStep = function(n) {
    _origGoStep.apply(this, arguments);
    if (n === 4) carregarSaldoIndicacao();
  };
}
