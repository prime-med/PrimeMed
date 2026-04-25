// FRETE_TABELA, buscarCEP e mascaraCep → frete.js
let freteValor = 0;
let freteMetodo = '';
let freteCep = '';
let freteEstado = '';

// ─── STATE ──────────────────────────────────────────────────────────────────
// ─── CORRELAÇÕES ────────────────────────────────────────────────────────────
const CORRELACOES = {
  '1':  ['32','42','8'],    '2':  ['32','46','7'],    '3':  ['32','46','7'],
  '4':  ['42','32'],        '5':  ['42','32'],        '6':  ['32','42','7'],
  '7':  ['32','46','8'],    '8':  ['7','32','46'],    '9':  ['24','36','32'],
  '10': ['12','15','46'],   '11': ['46','16','9'],    '12': ['10','15','24'],
  '13': ['16','9','20'],    '14': ['20','21'],         '15': ['12','10','46'],
  '16': ['18','32','46'],   '17': ['32','46','25'],   '18': ['16','32','46'],
  '19': ['20','32','46'],   '20': ['21','14'],         '21': ['20','32','14'],
  '22': ['23','32','20'],   '23': ['22','32','20'],   '24': ['9','36','32'],
  '25': ['32','46','20'],   '26': ['7','32','46'],    '27': ['24','36','32'],
  '28': ['24','36','32'],   '29': ['32','42','7'],    '30': ['21','14'],
  '31': ['42','32'],        '32': ['42','46'],         '33': ['32','46','7'],
  '34': ['32','46'],        '36': ['32','24','9'],    '37': ['32','46'],
  '38': ['32','46','25'],   '39': ['32','46'],         '41': ['32','46','20'],
  '42': ['32','46'],        '43': ['46','12','48'],   '44': ['46','12','48'],
  '45': ['46','12','10'],   '46': ['32','42'],         '47': ['46','12','15'],
  '48': ['46','43','12'],   '49': ['46','44','12'],
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

// ─── INIT ───────────────────────────────────────────────────────────────────
window.onload = () => {
  carregarProdutos();
};

// ── CACHE (apenas dados estáticos — protocolos e parcelas, 30min TTL) ─────────
// Preços, promos e cupons NUNCA são cacheados: devem ser sempre frescos.
const PF_CACHE_TTL = 30 * 60 * 1000;
function pfFromCache_(k){try{const c=sessionStorage.getItem('pf_'+k);if(!c)return null;const{data,ts}=JSON.parse(c);return(Date.now()-ts)<PF_CACHE_TTL?data:null;}catch(e){return null;}}
function pfToCache_(k,d){try{sessionStorage.setItem('pf_'+k,JSON.stringify({data:d,ts:Date.now()}));}catch(e){}}
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

  } catch(e) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#e74c3c">⚠️ Erro ao carregar produtos. Recarregue a página.</div>';
  }
}

// ─── FILTERS & SORT ─────────────────────────────────────────────────────────
const CATEGORIAS = [
  { val: 'todos',          label: 'Todos' },
  { val: 'emagrecimento',  label: '⚡ Emagrecimento' },
  { val: 'peptideo',       label: '🧬 Peptídeo' },
  { val: 'estetica',       label: '✨ Estética' },
];

function renderFilters() {
  const labs = [...new Set(CATALOG.filter(p => p.lab).map(p => p.lab))].sort();
  document.getElementById('lab-filters').innerHTML = ['Todos', ...labs].map(l => {
    const val = l === 'Todos' ? 'todos' : l;
    return `<button class="lab-btn ${val === activeLabFilter ? 'active' : ''}" onclick="setLabFilter('${val}')">${l}</button>`;
  }).join('');

  document.getElementById('tag-filters').innerHTML = CATEGORIAS.map(c =>
    `<button class="lab-btn ${c.val === activeTagFilter ? 'active' : ''}" onclick="setTagFilter('${c.val}')">${c.label}</button>`
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
      set('f_cargo',       data.cargo);
      set('f_telefone',    data.telefone);
      set('f_email',       data.email);
      set('f_documento',   data.documento);
      set('f_cidade',      data.cidade);
      set('f_estado',      data.estado);
      set('f_endereco',    data.endereco);

      if (Array.isArray(data.historico)) clienteHistorico = data.historico;
      bemVindo.style.display = 'block';
      bemVindo.innerHTML = `✅ Bem-vindo de volta, <strong>${data.responsavel || data.clinica}</strong>! Dados preenchidos automaticamente.`;
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
  ['f_clinica','f_responsavel','f_cargo','f_telefone','f_email','f_documento','f_cep_entrega','f_rua','f_numero','f_bairro','f_complemento','f_cidade','f_estado'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

function aplicarCupom() {
  const codigo = (document.getElementById('f_cupom').value || '').trim().toUpperCase();
  const msg    = document.getElementById('cupom-msg');
  if (!codigo) {
    msg.innerHTML = `<div class="cupom-err">⚠️ Digite um código de bonificação.</div>`;
    return;
  }
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
    document.getElementById('f_cupom').disabled   = true;
    document.getElementById('btn-cupom').disabled = true;
    const descValor = calcularDescontoCupom();
    const descStr   = descValor > 0
      ? ` — <strong>R$ ${descValor.toLocaleString('pt-BR',{minimumFractionDigits:2})} de desconto</strong>`
      : '';
    let msgTxt = '';
    if (cupomData.tipo === '%') {
      if (cupomData.produtos === 'todos') {
        msgTxt = `✅ Cupom <strong>${codigo}</strong> aplicado! ${cupomData.valor}% de desconto em todos os produtos${descStr}.`;
      } else {
        const prods = Array.isArray(cupomData.produtos) ? cupomData.produtos : [];
        const n = Object.keys(cart).filter(k => { const b = k.split('__')[0]; return prods.includes(k) || prods.includes(b); }).length;
        msgTxt = `✅ Cupom <strong>${codigo}</strong> aplicado! ${cupomData.valor}% em ${n || prods.length} produto(s)${descStr}.`;
      }
    } else {
      const precos = cupomData.precos || {};
      const n = Object.keys(cart).filter(k => { const b = k.split('__')[0]; return precos[k] !== undefined || precos[b] !== undefined; }).length;
      msgTxt = `✅ Cupom <strong>${codigo}</strong> aplicado! Preço especial em ${n || Object.keys(precos).length} produto(s)${descStr}.`;
    }
    msg.innerHTML = `<div class="cupom-ok">${msgTxt}</div>`;
    checkCupomExtras();
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
      // tile dos destaques
      const hl = document.getElementById('hl-countdown-' + p.id);
      if (hl) hl.textContent = '⏱ ' + txt;
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
  const p = CATALOG.find(x => x.id === id);
  const maxStock = p && p.variantes && p.variantes[varIdx] ? parseInt(p.variantes[varIdx].estoque) || 999 : 999;
  const newQty = Math.max(0, Math.min(maxStock, (cart[key] || 0) + delta));
  if (newQty === 0) delete cart[key]; else cart[key] = newQty;

  const qtyEl = document.getElementById(`vqty-${id}-${varIdx}`);
  if (qtyEl) qtyEl.textContent = newQty;

  const subEl = document.getElementById(`vsub-${id}-${varIdx}`);
  if (subEl) {
    const price = getPriceByKey(key);
    subEl.textContent = newQty > 0 ? `= R$ ${(price * newQty).toLocaleString('pt-BR', {minimumFractionDigits:2})}` : '';
  }

  const hasAny = p && p.variantes.some((_, i) => (cart[`${id}__${i}`] || 0) > 0);
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
  // Ocultar destaques durante pesquisa
  const searching = !!activeSearch;
  ['section-destaque','section-recomendado','catalog-divider'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = searching ? 'none' : '';
  });
  if (!searching) renderHighlights();

  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';
  let list = CATALOG.filter(p => {
    if (activeLabFilter !== 'todos' && p.lab !== activeLabFilter) return false;
    if (activeTagFilter !== 'todos' && p.categoria !== activeTagFilter) return false;
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
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--gray)">Nenhum produto encontrado para este filtro.</div>`;
    updateTotal(); return;
  }

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
    const labBadge = p.lab ? `<span class="pc-tag" style="background:rgba(26,188,156,.15);border-color:rgba(26,188,156,.3);color:var(--accent)">${p.lab}</span>` : '';
    const promoAtiva = isPromoAtiva(p);
    const promoRibbon = promoAtiva ? `<div class="promo-ribbon">🔥 Promoção</div>` : '';
    const promoTimer  = promoAtiva ? `
      <div class="promo-timer">⏱ Termina em: <span id="countdown-${p.id}">${getCountdown(p.promo_fim)}</span></div>` : '';
    const promoPrecoHtml = promoAtiva ? `
      <span class="promo-price-old">R$ ${p.price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>` : '';
    const temProtocolo = PROTOCOLS && PROTOCOLS[p.id];
    const saibaMaisBtn = temProtocolo ? `<button class="btn-saiba-mais" onclick="event.stopPropagation(); abrirProtocolo('${p.id}')">📋 Saiba mais sobre este produto</button>` : '';
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
              <span class="vr-dose">${v.dose}</span>
              <div class="vr-price-row">${vPromoHtml}${vStockLabel2}</div>
            </div>
            <div class="vr-controls">
              <button class="vr-btn" onclick="event.stopPropagation(); changeVariantQty('${p.id}',${i},-1)">−</button>
              <span class="vr-qty" id="vqty-${p.id}-${i}">${vQty}</span>
              <button class="vr-btn" onclick="event.stopPropagation(); changeVariantQty('${p.id}',${i},1)">+</button>
            </div>
            <span class="vr-sub" id="vsub-${p.id}-${i}">${vQty > 0 ? `= R$ ${(vPriceDisc*vQty).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : ''}</span>
          </div>`;
        }).join('')}
      </div>` : '';

    // Produtos SEM variantes: comportamento original
    const qtyWrapHtml = !temVariantes ? `
        <div class="pc-qty-wrap" id="qty-wrap-${p.id}">
          <button class="qty-btn" onclick="event.stopPropagation(); changeQty('${p.id}',-1)">−</button>
          <input class="qty-input" type="number" id="qty-${p.id}" value="${qty}" min="1" max="${p.stock}"
            onchange="event.stopPropagation(); setQty('${p.id}', this.value)"
            onclick="event.stopPropagation()"/>
          <button class="qty-btn" onclick="event.stopPropagation(); changeQty('${p.id}',1)">+</button>
          <span class="qty-label">un.</span>
          <span class="pc-subtotal" id="sub-${p.id}">= R$ ${subtotal}</span>
        </div>` : '';

    const cardOnclick = temVariantes ? '' : `toggleProduct('${p.id}')`;
    const cardSelected = temVariantes
      ? p.variantes.some((_, i) => (cart[`${p.id}__${i}`] || 0) > 0)
      : isSelected;

    grid.innerHTML += `
      <div class="product-card ${cardSelected ? 'selected' : ''} ${promoAtiva ? 'promo-ativa' : ''}"
           id="pc-${p.id}" onclick="${cardOnclick}"
           style="">
        ${promoRibbon}
        <div class="pc-header">
          <span class="pc-icon">${p.icon}</span>
          <div class="pc-check">${cardSelected ? '✓' : ''}</div>
        </div>
        <div class="pc-name">${p.name}</div>
        <div class="pc-conc">${p.conc}</div>
        <div class="pc-tags">${labBadge}${(p.tags||[]).map(t=>`<span class="pc-tag">${t}</span>`).join('')}</div>
        ${!temVariantes ? `<div style="margin:6px 0" id="stock-${p.id}">${estoqueLabel}</div>` : ''}
        ${!temVariantes ? `<div class="pc-price-row" style="flex-direction:column;align-items:flex-start;gap:2px">
          ${promoPrecoHtml}<div style="display:flex;align-items:baseline;gap:4px">
          <span class="pc-price" id="price-${p.id}" style="${promoAtiva?'color:#F39C12':''}">R$ ${currentPrice.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
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

function renderHighlights() {
  const destaques    = CATALOG.filter(p => p.destaque === 'destaque');
  const recomendados = CATALOG.filter(p => p.destaque === 'recomendado');
  const secDest  = document.getElementById('section-destaque');
  const secRec   = document.getElementById('section-recomendado');
  const divider  = document.getElementById('catalog-divider');
  secDest.style.display  = destaques.length    ? '' : 'none';
  secRec.style.display   = recomendados.length ? '' : 'none';
  divider.style.display  = (destaques.length || recomendados.length) ? '' : 'none';
  function buildTile(p, badgeClass, badgeLabel, cardClass) {
    const temVariantes = p.variantes && p.variantes.length > 0;
    let promoRibbon = '', promoClass = '', priceHtml;

    if (temVariantes) {
      const precos = p.variantes.map(v => parseFloat(v.preco) || 0).filter(v => v > 0);
      const minPreco = precos.length ? Math.min(...precos) : 0;
      const varPromos = p.variantes.filter(v => parseFloat(v.promo_preco) > 0 && isPromoDentroData(p));
      if (varPromos.length > 0) {
        const minPromo = Math.min(...varPromos.map(v => parseFloat(v.promo_preco)));
        const varOriginal = Math.min(...varPromos.map(v => parseFloat(v.preco)));
        promoRibbon = `<div class="promo-ribbon">🔥 Promoção</div>`;
        promoClass  = 'promo-ativa';
        priceHtml   = `<div style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;margin-top:4px">
           <span style="font-size:.65rem;color:var(--gray)">A partir de</span>
           <span style="font-size:.7rem;color:var(--gray);text-decoration:line-through">R$ ${varOriginal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
           <span class="hl-card-price" style="color:#F59E0B">R$ ${minPromo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
           <span id="hl-countdown-${p.id}" style="font-size:.63rem;color:#F59E0B;font-weight:600">⏱ ${getCountdown(p.promo_fim)}</span>
         </div>`;
      } else {
        priceHtml = `<div style="margin-top:4px">
          <span style="font-size:.62rem;color:var(--gray)">A partir de</span>
          <div class="hl-card-price">R$ ${minPreco.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
        </div>`;
      }
    } else {
      const price = getEffectivePrice(p);
      const promo = isPromoAtiva(p);
      promoRibbon = promo ? `<div class="promo-ribbon">🔥 Promoção</div>` : '';
      promoClass  = promo ? 'promo-ativa' : '';
      priceHtml   = promo
        ? `<div style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;margin-top:4px">
             <span style="font-size:.7rem;color:var(--gray);text-decoration:line-through">R$ ${p.price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
             <span class="hl-card-price" style="color:#F59E0B">R$ ${price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
             <span id="hl-countdown-${p.id}" style="font-size:.63rem;color:#F59E0B;font-weight:600">⏱ ${getCountdown(p.promo_fim)}</span>
           </div>`
        : `<div class="hl-card-price">R$ ${price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>`;
    }
    return `<div class="hl-card ${cardClass} ${promoClass}" onclick="scrollToCard('${p.id}')">
      ${promoRibbon}
      <span class="${badgeClass}">${badgeLabel}</span>
      <span class="hl-card-icon">${p.icon}</span>
      <div class="hl-card-name">${p.name}</div>
      <div class="hl-card-conc">${p.conc}</div>
      ${priceHtml}
      <div class="hl-card-hint">Toque para ver no catálogo →</div>
    </div>`;
  }
  document.getElementById('grid-destaque').innerHTML =
    destaques.map(p => buildTile(p,'hl-badge-destaque','⭐ Destaque','card-destaque')).join('');
  document.getElementById('grid-recomendado').innerHTML =
    recomendados.map(p => buildTile(p,'hl-badge-recomendado','💡 Recomendado','card-recomendado')).join('');
}

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
      <div class="proto-section-body">${String(s.campo).replace(/\n/g,'<br>')}</div>
    </div>`).join('');

  // Informativo
  const footer = document.getElementById('pm-info-footer');
  const aviso  = document.getElementById('pm-aviso');
  if (proto.pagina) {
    aviso.style.display   = 'flex';
    footer.style.display  = 'block';
    footer.dataset.pagina = proto.pagina;
    footer.dataset.titulo = p.name;
  } else {
    aviso.style.display  = 'none';
    footer.style.display = 'none';
  }

  document.getElementById('protocol-modal').classList.add('open');
}

function abrirInformativo() {
  const footer = document.getElementById('pm-info-footer');
  let pagina = footer.dataset.pagina;
  if (pagina && !pagina.startsWith('http') && !pagina.includes('/'))
    pagina = 'informativos/' + pagina;
  document.getElementById('info-iframe').src = pagina;
  document.getElementById('info-overlay-title').textContent = footer.dataset.titulo || 'Informativo do produto';
  document.getElementById('info-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fecharInformativo() {
  document.getElementById('info-overlay').classList.remove('open');
  document.getElementById('info-iframe').src = '';
  document.body.style.overflow = '';
}

function getFreteLabel() {
  if (!freteCep) return 'Não calculado';
  const nomes = { sedex: 'SEDEX', pac: 'PAC', jadlog: 'Jadlog' };
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
  let total = getTotal() + freteValor - desconto;
  if (total < 0) total = 0;
  if (juros > 0) total *= (1 + juros / 100);
  const por = total / parcelas;
  document.getElementById('f_parcela_val').value = `R$ ${por.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

// ─── NAVIGATION ─────────────────────────────────────────────────────────────
function goStep(n) {
  // Validações — se falhar em passo anterior, volta para ele e mostra o erro
  if (n > 1 && !validateStep1()) { _aplicarStep(1); return; }
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
      cargo:       v('f_cargo'),
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
  const ok = Object.keys(cart).length > 0;
  const alert = document.getElementById('alert1');
  ok ? alert.classList.remove('show') : alert.classList.add('show');
  return ok;
}

function validateStep2() {
  const base    = ['f_clinica','f_responsavel','f_telefone','f_email'];
  const enderecoFields = ['f_rua','f_numero','f_bairro'];
  // Clientes já cadastrados não são obrigados a preencher os novos campos de endereço
  const required = _clienteJaLogado ? base : [...base, ...enderecoFields];
  let ok = true;
  required.forEach(id => {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) { if (el) el.classList.add('error'); ok = false; }
    else el.classList.remove('error');
  });
  if (_clienteJaLogado) {
    enderecoFields.forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('error'); });
  }
  const alert = document.getElementById('alert2');
  ok ? alert.classList.remove('show') : alert.classList.add('show');
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
    ['Clínica', v('f_clinica')],
    ['Responsável', v('f_responsavel')],
    ['Cargo', v('f_cargo') || '—'],
    ['Telefone', v('f_telefone')],
    ['E-mail', v('f_email')],
    ['Documento', v('f_documento') || '—'],
    ['Cidade', `${v('f_cidade')} — ${v('f_estado')}`],
    ['Endereço', getEnderecoCompleto() || '—'],
    ['Observações', v('f_obs') || '—'],
  ];
  document.getElementById('review-dados').innerHTML =
    dados.map(([l,val]) => `<div class="rc-row"><span class="lbl">${l}</span><span class="val">${val}</span></div>`).join('');

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
          cupomHtml = `<div style="font-size:.72rem;color:var(--accent);margin-top:1px">🎟️ Cupom: −${cupomData.valor}%</div>`;
        }
      }
    }

    html += `<div class="rp-item">
      <div><div class="rp-name">${p.icon} ${p.name}</div><div class="rp-detail">${varLabel}</div>${cupomHtml}</div>
      <div><div style="text-align:right; font-size:.8rem; color:var(--gray)">${qty} × R$${price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      <div class="rp-total">R$ ${sub.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
    </div>`;
  });
  document.getElementById('review-products').innerHTML = html;

  // Pagamento
  let pagInfo = `<div class="rc-row"><span class="lbl">Forma</span><span class="val">${selectedPayment}</span></div>`;
  if (selectedPayment === 'Cartão de Crédito') {
    const parc = document.getElementById('f_parcelas').value;
    const val = document.getElementById('f_parcela_val').value;
    const semJuros = cupomData?.parcelamento === 'SIM' && parseInt(parc) <= 3 ? ' — sem juros (cupom)' : '';
    pagInfo += `<div class="rc-row"><span class="lbl">Parcelamento</span><span class="val">${parc}x de ${val}${semJuros}</span></div>`;
  }
  if (v('f_obs_pag')) {
    pagInfo += `<div class="rc-row"><span class="lbl">Obs. pagamento</span><span class="val">${v('f_obs_pag')}</span></div>`;
  }

  // Frete
  let freteLabel = getFreteLabel();
  if (cupomData?.frete_gratis_acima) {
    const limiar = parseFloat(cupomData.frete_gratis_acima);
    if (!isNaN(limiar)) {
      if (freteValor === 0) {
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
      <span>🎟️ Desconto (${descontoLabel} — ${cupomCodigo})</span>
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
        items.push(`⚡ Parcelamento sem juros (${parc}×)${econJuros} · cupom <strong>${cupomCodigo}</strong>`);
      }
    }
    if (cupomData.frete_gratis_acima && freteValor === 0 && freteEstado && freteMetodo) {
      const tabela       = FRETE_TABELA[freteEstado];
      const freteOriginal = tabela ? (tabela[freteMetodo] || 0) : 0;
      const econFrete    = freteOriginal > 0
        ? ` <span style="opacity:.85">· economia de R$ ${freteOriginal.toFixed(2).replace('.',',')}</span>`
        : '';
      items.push(`🚚 Frete grátis${econFrete} · cupom <strong>${cupomCodigo}</strong>`);
    }
    if (!items.length) return '';
    return items.map(i =>
      `<div style="font-size:.75rem;color:var(--green);margin-bottom:5px">${i}</div>`
    ).join('');
  })();
  document.getElementById('review-total-box').innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:.85rem;color:rgba(255,255,255,.6)">
      <span>Subtotal produtos</span><span>R$ ${subtotalBruto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:.85rem;color:rgba(255,255,255,.6)">
      <span>Frete</span><span>${freteValor===0 ? '🎉 Grátis' : 'R$ '+freteValor.toFixed(2).replace('.',',')}</span>
    </div>
    ${descontoHtml}
    ${beneficiosReviewHtml}
    <div style="border-top:1px solid rgba(255,255,255,.15);margin:10px 0"></div>
    <div class="rtb-label">Total do Pedido</div>
    <div class="rtb-amount">R$ ${totalFinal.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
    <div class="rtb-method">${selectedPayment}</div>`;
  renderRecomendacoesRevisao();
}

function v(id) { return document.getElementById(id)?.value?.trim() || ''; }

// ─── WHATSAPP ────────────────────────────────────────────────────────────────
function sendWhatsApp() {
  const total = getFinalTotal();

  let msg = `🧬 *PEDIDO PHARMAFIT-PY*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `📋 *DADOS DA CLÍNICA*\n`;
  msg += `Clínica: ${v('f_clinica')}\n`;
  msg += `Responsável: ${v('f_responsavel')}\n`;
  if (v('f_cargo')) msg += `Cargo: ${v('f_cargo')}\n`;
  msg += `Telefone: ${v('f_telefone')}\n`;
  msg += `E-mail: ${v('f_email')}\n`;
  if (v('f_documento')) msg += `Documento: ${v('f_documento')}\n`;
  if (v('f_cidade')) msg += `Cidade/Estado: ${v('f_cidade')} — ${v('f_estado')}\n`;
  const endCompleto = getEnderecoCompleto();
  if (endCompleto) msg += `Endereço: ${endCompleto}\n`;
  if (v('f_obs')) msg += `Obs: ${v('f_obs')}\n`;

  msg += `\n💊 *PRODUTOS SOLICITADOS*\n`;
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
  msg += `\n_Pedido enviado via formulário PharmaFit-PY_`;

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


  const params = new URLSearchParams({
    clinica:       v('f_clinica'),
    responsavel:   v('f_responsavel'),
    cargo:         v('f_cargo'),
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
    carrinho:      JSON.stringify(cart)
  });
  fetch(`${SHEETS_URL}?${params.toString()}`, { method: 'GET', mode: 'no-cors' }).catch(() => {});

  // Decrementar estoque
  fetch(`${SHEETS_URL}?action=decrementar_estoque&carrinho=${encodeURIComponent(JSON.stringify(cart))}`, { method: 'GET', mode: 'no-cors' }).catch(() => {});

  // Abrir WhatsApp
  const encoded = encodeURIComponent(msg);
  window.open(`https://wa.me/${WA_NUMBER}?text=${encoded}`, '_blank');

  // Mostrar sucesso
  showSuccess();
}

function getFinalTotal() {
  let total = getTotal() + freteValor;
  if (selectedPayment === 'Cartão de Crédito') {
    const parc   = parseInt(document.getElementById('f_parcelas').value);
    const config = PARCELAS_CONFIG.find(p => p.parcelas === parc);
    let juros  = config ? config.juros : 0;
    if (cupomData?.parcelamento === 'SIM' && parc <= 3) juros = 0;
    if (juros > 0) total *= (1 + juros / 100);
  }
  if (cupomAplicado) {
    const desc = calcularDescontoCupom();
    total -= desc;
    if (total < 0) total = 0;
  }
  return total;
}

function showSuccess() {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('success-screen').classList.add('show');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function newOrder() {
  // Preserva dados do cliente logado antes de limpar tudo
  const camposCliente = ['f_documento','f_clinica','f_responsavel','f_cargo','f_telefone','f_email','f_cep_entrega','f_rua','f_numero','f_bairro','f_complemento','f_cidade','f_estado'];
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
  const orders = JSON.parse(localStorage.getItem('pharmafit_orders') || '[]');
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
  localStorage.setItem('pharmafit_orders', JSON.stringify(orders));
}

function openHistory() {
  const orders = JSON.parse(localStorage.getItem('pharmafit_orders') || '[]');
  const body = document.getElementById('history-body');
  if (orders.length === 0) {
    body.innerHTML = '<div class="no-history">📭 Nenhum pedido registrado ainda.</div>';
  } else {
    body.innerHTML = orders.map(o => `
      <div class="history-item">
        <div class="hi-top">
          <span class="hi-clinic">${o.clinica}</span>
          <span class="hi-total">R$ ${o.total}</span>
        </div>
        <div class="hi-date">📅 ${o.date} · ${o.responsavel} · ${o.telefone}</div>
        <div class="hi-products">💊 ${o.products.join(' | ')}</div>
        <div class="hi-method">💳 ${o.payment}</div>
      </div>`).join('');
  }
  document.getElementById('history-modal').classList.add('open');
}

function closeHistory() {
  document.getElementById('history-modal').classList.remove('open');
}

function clearHistory() {
  if (confirm('Apagar todo o histórico de pedidos?')) {
    localStorage.removeItem('pharmafit_orders');
    closeHistory();
  }
}

// Fechar modal clicando fora
document.getElementById('history-modal').addEventListener('click', function(e) {
  if (e.target === this) closeHistory();
});

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
        <span class="rec-card-icon">${p.icon}</span>
        <span class="rec-card-name">${p.name}</span>
      </div>
      <div class="rec-card-conc">${p.conc}</div>
      <div class="rec-card-price">R$ ${price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      <button class="rec-add-btn" id="rec-btn-${p.id}" ${inCart ? 'disabled' : ''}
        onclick="adicionarDaRec('${p.id}')">
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
  ['f_clinica','f_responsavel','f_cargo','f_telefone','f_email','f_documento','f_cep_entrega','f_rua','f_numero','f_bairro','f_complemento','f_cidade','f_estado'].forEach(id => {
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
  set('f_cargo',       data.cargo || '');
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
