// ── ESTADO ───────────────────────────────────────────────────────────────────
let CATALOG   = [];
let catAtiva  = '';
let queryAtiva = '';

// ── INIT ─────────────────────────────────────────────────────────────────────
window.onload = init;

async function init() {
  try {
    const res  = await fetch(`${SHEETS_URL}?action=produtos`);
    CATALOG    = await res.json();
    document.getElementById('loadingMsg').style.display = 'none';
    document.getElementById('catalogGrid').style.display = '';
    buildChips();
    render();
  } catch(e) {
    document.getElementById('loadingMsg').innerHTML =
      '<div class="empty-icon">⚠️</div><div style="font-size:1rem;font-weight:700;margin-bottom:8px">Falha ao carregar</div><div style="font-size:.82rem">Verifique sua conexão e recarregue a página.</div>';
  }
}

// ── CHIPS DE CATEGORIA ────────────────────────────────────────────────────────
function buildChips() {
  const cats = [...new Set(CATALOG.map(p => p.categoria).filter(Boolean))].sort();
  const wrap = document.getElementById('chipsCat');
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.dataset.cat = cat;
    btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    btn.onclick = function(){ setCategoria(this); };
    wrap.appendChild(btn);
  });
}

function setCategoria(el) {
  document.querySelectorAll('#chipsCat .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  catAtiva = el.dataset.cat;
  filtrar();
}

function filtrar() {
  queryAtiva = document.getElementById('searchInput').value.toLowerCase().trim();
  render();
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function isPromoAtiva(p) {
  if (!p.promo_preco || parseFloat(p.promo_preco) <= 0) return false;
  const agora = new Date();
  if (p.promo_inicio) {
    const ini = new Date(p.promo_inicio.split(' ')[0].split('/').reverse().join('-'));
    if (agora < ini) return false;
  }
  if (p.promo_fim) {
    const fim = new Date(p.promo_fim.split(' ')[0].split('/').reverse().join('-') + 'T23:59:59');
    if (agora > fim) return false;
  }
  return true;
}

function fmt(v) {
  return parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits:2 });
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function render() {
  const lista = CATALOG.filter(p => {
    if (catAtiva && p.categoria !== catAtiva) return false;
    if (queryAtiva) {
      const hay = [p.nome, p.conc, p.lab, ...(p.tags||[])].join(' ').toLowerCase();
      if (!hay.includes(queryAtiva)) return false;
    }
    return true;
  });

  document.getElementById('badgeCount').textContent = `${lista.length} produto${lista.length !== 1 ? 's' : ''}`;
  const grid = document.getElementById('catalogGrid');
  const emp  = document.getElementById('emptyMsg');

  if (!lista.length) {
    grid.innerHTML = '';
    emp.style.display = 'block';
    return;
  }
  emp.style.display = 'none';
  grid.innerHTML = lista.map(buildCard).join('');
}

function buildCard(p) {
  const temVariantes = p.variantes && p.variantes.length > 0;
  const promo        = isPromoAtiva(p);
  let priceHtml = '';
  let badgeHtml = '';

  if (temVariantes) {
    const precos = p.variantes.map(v => parseFloat(v.preco)||0).filter(v => v > 0);
    const min    = precos.length ? Math.min(...precos) : 0;
    const varPromo = p.variantes.find(v => parseFloat(v.promo_preco) > 0 && promo);
    if (varPromo) {
      const pct = Math.round((1 - parseFloat(varPromo.promo_preco)/parseFloat(varPromo.preco))*100);
      badgeHtml  = `<span class="promo-badge">-${pct}%</span>`;
      priceHtml  = `
        <div class="price-block">
          <div class="price-from">A partir de</div>
          <div class="price-old">R$ ${fmt(min)}</div>
          <div class="price-new">R$ ${fmt(varPromo.promo_preco)}</div>
        </div>`;
    } else {
      priceHtml = `
        <div class="price-block">
          <div class="price-from">A partir de</div>
          <div class="price-normal">R$ ${fmt(min)}</div>
        </div>`;
    }
  } else if (promo) {
    const pct  = p.promo_pct ? Math.round(p.promo_pct) : Math.round((1 - parseFloat(p.promo_preco)/parseFloat(p.preco))*100);
    badgeHtml  = `<span class="promo-badge">-${pct}%</span>`;
    priceHtml  = `
      <div class="price-block">
        <div class="price-old">R$ ${fmt(p.preco)}</div>
        <div class="price-new">R$ ${fmt(p.promo_preco)}</div>
      </div>`;
  } else {
    priceHtml = `
      <div class="price-block">
        <div class="price-normal">R$ ${fmt(p.preco)}</div>
      </div>`;
  }

  const tagsHtml = p.tags && p.tags.length
    ? `<div class="card-tags">${p.tags.slice(0,3).map(t=>`<span class="tag">${t}</span>`).join('')}</div>`
    : '';

  let variantesHtml = '';
  if (temVariantes && p.variantes.length > 1) {
    const rows = p.variantes.map(v => {
      const vPromo = promo && parseFloat(v.promo_preco) > 0;
      return `<div class="variant-row">
        <span class="variant-dose">${v.dose}</span>
        ${vPromo
          ? `<span><span class="variant-price" style="text-decoration:line-through;color:var(--gray);font-weight:400">R$ ${fmt(v.preco)}</span> <span class="variant-promo">R$ ${fmt(v.promo_preco)}</span></span>`
          : `<span class="variant-price">R$ ${fmt(v.preco)}</span>`}
      </div>`;
    }).join('');
    variantesHtml = `
      <div class="variants-toggle" onclick="toggleVariants(this)">
        📋 Ver doses e preços <span style="margin-left:auto">▼</span>
      </div>
      <div class="variants-list">${rows}</div>`;
  }

  return `
    <div class="card${promo ? ' em-promo' : ''}">
      <div class="card-head">
        <div class="card-icon">${p.icone || '💊'}</div>
        <div class="card-info">
          <div class="card-name">${p.nome}</div>
          ${p.conc ? `<div class="card-conc">${p.conc}</div>` : ''}
          ${p.lab  ? `<div class="card-lab">${p.lab}</div>`   : ''}
        </div>
      </div>
      ${tagsHtml}
      ${variantesHtml}
      <div class="card-price-area">
        ${priceHtml}
        ${badgeHtml}
      </div>
    </div>`;
}

function toggleVariants(el) {
  const list = el.nextElementSibling;
  const isOpen = list.classList.toggle('open');
  el.querySelector('span:last-child').textContent = isOpen ? '▲' : '▼';
}

// ── SCROLL TOP ────────────────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('scrollTop').classList.toggle('show', window.scrollY > 300);
});
