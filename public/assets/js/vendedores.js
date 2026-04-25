// ── ESCAPE HTML ──
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return String(s || '').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ── HELPER POST ───────────────────────────────────────────────────────────────
// Usado em endpoints que recebem credenciais — evita senha em URL/logs.
async function postAction_(action, paramsObj) {
  const body = new URLSearchParams();
  body.append('action', action);
  for (const [k, v] of Object.entries(paramsObj || {})) {
    if (v !== undefined && v !== null) body.append(k, v);
  }
  const r = await fetch(SHEETS_URL, { method: 'POST', body });
  return r.json();
}

// ── SESSÃO ────────────────────────────────────────────────────────────────────
let SESSION = null;

function salvarSession(email, senha, nome) {
  SESSION = { email, senha, nome };
  sessionStorage.setItem('lp_vendedora', JSON.stringify(SESSION));
}
function carregarSession() {
  try {
    const s = sessionStorage.getItem('lp_vendedora');
    if (s) SESSION = JSON.parse(s);
  } catch(e) { SESSION = null; }
}

// ── PIN — verificação server-side via GAS ─────────────────────────────────────
async function checkPin() {
  const val = document.getElementById('pin-input').value.trim();
  const btn = document.getElementById('pin-btn');
  const err = document.getElementById('pin-err');
  if (!val) return;
  btn.disabled = true;
  err.textContent = '⏳ Verificando...';
  try {
    // GET pra verificar_pin — endpoint não recebe credencial sensível
    // (PIN é compartilhado pela equipe, não pessoal); evita CORS preflight
    // e funciona sem precisar do user redeployar Apps Script com nova versão.
    const r    = await fetch(`${SHEETS_URL}?action=verificar_pin&pin=${encodeURIComponent(val)}`);
    const data = await r.json();
    if (!data.ok) {
      err.textContent = '❌ PIN incorreto.';
      document.getElementById('pin-input').value = '';
      document.getElementById('pin-input').focus();
      btn.disabled = false;
      return;
    }
  } catch(e) {
    err.textContent = '⚠️ Erro de conexão. Tente novamente.';
    btn.disabled = false;
    return;
  }
  document.getElementById('pin-overlay').style.display = 'none';
  document.getElementById('main-header').classList.add('show');
  carregarSession();
  if (SESSION) {
    entrarNoApp(SESSION.nome);
  } else {
    document.getElementById('tela-auth').classList.add('show');
  }
}

function logout() {
  SESSION = null;
  sessionStorage.removeItem('lp_vendedora');
  document.getElementById('tela-app').classList.remove('show');
  document.getElementById('tela-auth').classList.add('show');
  document.getElementById('hist-resultado').style.display = 'none';
  document.getElementById('pin-overlay').style.display = 'flex';
  document.getElementById('main-header').classList.remove('show');
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-err').textContent = '';
  setMode('criar');
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function setAuthMode(modo) {
  document.getElementById('atab-login').classList.toggle('active', modo === 'login');
  document.getElementById('atab-reg').classList.toggle('active',   modo === 'reg');
  document.getElementById('form-login').style.display   = modo === 'login'   ? '' : 'none';
  document.getElementById('form-reg').style.display     = modo === 'reg'     ? '' : 'none';
  document.getElementById('form-esqueci').style.display = modo === 'esqueci' ? '' : 'none';
  document.getElementById('auth-tabs-el').style.display = modo === 'esqueci' ? 'none' : '';
  document.getElementById('login-msg').textContent = '';
  document.getElementById('reg-msg').textContent   = '';
  document.getElementById('esqueci-msg').textContent = '';
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function abrirTrocarSenha() {
  document.getElementById('ts_atual').value = '';
  document.getElementById('ts_nova').value  = '';
  document.getElementById('ts_conf').value  = '';
  document.getElementById('ts-msg').textContent = '';
  document.getElementById('modal-senha').classList.add('show');
  setTimeout(() => document.getElementById('ts_atual').focus(), 100);
}
function fecharModal(id) { document.getElementById(id).classList.remove('show'); }

async function confirmarTrocarSenha() {
  if (!SESSION) return;
  const atual = document.getElementById('ts_atual').value.trim();
  const nova  = document.getElementById('ts_nova').value.trim();
  const conf  = document.getElementById('ts_conf').value.trim();
  const msg   = document.getElementById('ts-msg');
  const btn   = document.getElementById('btn-ts-ok');
  msg.className = 'modal-msg';
  if (!atual || !nova || !conf) { msg.textContent = 'Preencha todos os campos.'; msg.classList.add('err'); return; }
  if (nova !== conf) { msg.textContent = 'As senhas não coincidem.'; msg.classList.add('err'); return; }
  if (nova.length < 6) { msg.textContent = 'Nova senha deve ter ao menos 6 caracteres.'; msg.classList.add('err'); return; }
  btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    const data = await postAction_('trocar_senha', { email: SESSION.email, senha_atual: atual, nova_senha: nova });
    if (data.ok) {
      SESSION.senha = nova;
      sessionStorage.setItem('lp_vendedora', JSON.stringify(SESSION));
      msg.textContent = '✅ Senha alterada com sucesso!'; msg.classList.add('ok');
      setTimeout(() => fecharModal('modal-senha'), 1800);
    } else {
      msg.textContent = data.erro || 'Erro ao alterar.'; msg.classList.add('err');
    }
  } catch(e) { msg.textContent = '⚠️ Erro de conexão.'; msg.classList.add('err'); }
  finally { btn.disabled = false; btn.textContent = 'Salvar'; }
}

async function recuperarSenha() {
  const email = document.getElementById('e_email').value.trim().toLowerCase();
  const nasc  = document.getElementById('e_nasc').value;
  const nova  = document.getElementById('e_nova').value.trim();
  const conf  = document.getElementById('e_conf').value.trim();
  const msg   = document.getElementById('esqueci-msg');
  const btn   = document.getElementById('btn-esqueci');
  msg.className = 'auth-msg';
  if (!email || !nasc || !nova || !conf) { msg.textContent = 'Preencha todos os campos.'; msg.classList.add('err'); return; }
  if (nova !== conf) { msg.textContent = 'As senhas não coincidem.'; msg.classList.add('err'); return; }
  if (nova.length < 6) { msg.textContent = 'Nova senha deve ter ao menos 6 caracteres.'; msg.classList.add('err'); return; }
  btn.disabled = true; btn.textContent = 'Verificando…';
  try {
    const data = await postAction_('trocar_senha', { email, data_nasc: nasc, nova_senha: nova });
    if (data.ok) {
      msg.textContent = '✅ Senha redefinida! Faça login com a nova senha.'; msg.classList.add('ok');
      setTimeout(() => setAuthMode('login'), 2200);
    } else {
      msg.textContent = data.erro || 'Erro ao redefinir.'; msg.classList.add('err');
    }
  } catch(e) { msg.textContent = '⚠️ Erro de conexão.'; msg.classList.add('err'); }
  finally { btn.disabled = false; btn.textContent = 'Redefinir Senha'; }
}

async function fazerLogin() {
  const email = document.getElementById('l_email').value.trim().toLowerCase();
  const senha = document.getElementById('l_senha').value.trim();
  const msg   = document.getElementById('login-msg');
  const btn   = document.getElementById('btn-login');
  if (!email || !senha) { msg.textContent = 'Preencha e-mail e senha.'; msg.className = 'auth-msg err'; return; }
  msg.textContent = ''; btn.disabled = true; btn.textContent = 'Verificando…';
  try {
    const data = await postAction_('login', { email, senha });
    if (data.ok) {
      salvarSession(email, senha, data.nome);
      document.getElementById('tela-auth').classList.remove('show');
      entrarNoApp(data.nome);
    } else {
      msg.textContent = data.erro || 'Erro ao entrar.'; msg.className = 'auth-msg err';
    }
  } catch(e) {
    msg.textContent = '⚠️ Erro de conexão.'; msg.className = 'auth-msg err';
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar →';
  }
}

async function criarConta() {
  const nome  = document.getElementById('r_nome').value.trim();
  const nasc  = document.getElementById('r_nasc').value;
  const email = document.getElementById('r_email').value.trim().toLowerCase();
  const senha = document.getElementById('r_senha').value.trim();
  const conf  = document.getElementById('r_conf').value.trim();
  const msg   = document.getElementById('reg-msg');
  const btn   = document.getElementById('btn-reg');
  if (!nome || !nasc || !email || !senha || !conf) { msg.textContent = 'Preencha todos os campos.'; msg.className = 'auth-msg err'; return; }
  if (senha !== conf) { msg.textContent = 'As senhas não coincidem.'; msg.className = 'auth-msg err'; return; }
  if (senha.length < 6) { msg.textContent = 'Senha deve ter ao menos 6 caracteres.'; msg.className = 'auth-msg err'; return; }
  msg.textContent = ''; btn.disabled = true; btn.textContent = 'Criando conta…';
  try {
    const data = await postAction_('registrar', { nome, data_nasc: nasc, email, senha });
    if (data.ok) {
      salvarSession(email, senha, data.nome);
      document.getElementById('tela-auth').classList.remove('show');
      entrarNoApp(data.nome);
    } else {
      msg.textContent = data.erro || 'Erro ao criar conta.'; msg.className = 'auth-msg err';
    }
  } catch(e) {
    msg.textContent = '⚠️ Erro de conexão.'; msg.className = 'auth-msg err';
  } finally {
    btn.disabled = false; btn.textContent = 'Criar Conta';
  }
}

function entrarNoApp(nome) {
  document.getElementById('header-nome').textContent = `Olá, ${nome}! 👋`;
  document.getElementById('tela-app').classList.add('show');
  carregarProdutos();
}

// ── MODO (ABAS) ───────────────────────────────────────────────────────────────
let modoAtual = 'criar';
function setMode(modo) {
  modoAtual = modo;
  document.getElementById('tab-criar').classList.toggle('active',  modo === 'criar');
  document.getElementById('tab-hist').classList.toggle('active',   modo === 'hist');
  document.getElementById('tab-cupons').classList.toggle('active', modo === 'cupons');
  document.getElementById('form-criar').style.display           = modo === 'criar'  ? '' : 'none';
  document.getElementById('secao-historico').style.display      = modo === 'hist'   ? '' : 'none';
  document.getElementById('secao-meus-cupons').style.display    = modo === 'cupons' ? '' : 'none';
  window.scrollTo({ top:0, behavior:'smooth' });
}

// ── PRODUTOS ──────────────────────────────────────────────────────────────────
let PRODUTOS = [], selecionados = new Set(), tipoAtual = 'pct';
let precosFixos = {}; // { prodId: '99.90' } — preserva valores ao re-renderizar tabela

async function carregarProdutos() {
  try {
    const res = await fetch(`${SHEETS_URL}?action=produtos`);
    const raw = await res.json();
    PRODUTOS = [];
    for (const p of raw) {
      if (p.variantes && p.variantes.length > 0) {
        p.variantes.forEach((v,i) => PRODUTOS.push({ id:`${p.id}__${i}`, icone:p.icone||'💊', nome:p.nome, conc:v.dose||p.conc, preco:parseFloat(v.preco)||0, lab:p.lab, tags:p.tags||[] }));
      } else { PRODUTOS.push(p); }
    }
    filtrarProdutos();
  } catch(e) {
    document.getElementById('prod-grid').innerHTML = '<div style="color:var(--red);font-size:.85rem">Erro ao carregar produtos.</div>';
  }
}

function filtrarProdutos() {
  const q = document.getElementById('prod-search').value.toLowerCase().trim();
  renderProdutos(PRODUTOS.filter(p => !q || [p.nome,p.conc,p.lab,...(p.tags||[])].join(' ').toLowerCase().includes(q)));
}

function renderProdutos(lista) {
  const grid = document.getElementById('prod-grid');
  if (!lista.length) { grid.innerHTML='<div style="color:var(--gray);font-size:.85rem;padding:20px">Nenhum produto encontrado.</div>'; return; }
  grid.innerHTML = lista.map(p => {
    const sel = selecionados.has(p.id);
    const precoNum = parseFloat(p.preco)||0;
    const preco = precoNum > 0 ? `R$ ${precoNum.toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '—';
    return `<div class="prod-card${sel?' selected':''}" onclick="toggleProd('${escAttr(p.id)}')">
      <div class="prod-check">${sel?'✓':''}</div>
      <div><div class="prod-name">${esc(p.icone||'💊')} ${esc(p.nome)}</div>
        ${p.conc?`<div class="prod-conc">${esc(p.conc)}</div>`:''}
        <div class="prod-price">${preco}</div></div>
    </div>`;
  }).join('');
  document.getElementById('sel-count').textContent = `${selecionados.size} selecionado${selecionados.size!==1?'s':''}`;
}

function toggleProd(id) {
  selecionados.has(id) ? selecionados.delete(id) : selecionados.add(id);
  filtrarProdutos(); if (tipoAtual==='fixo') renderTabelaPrecos();
}

function toggleTodos() {
  const q = document.getElementById('prod-search').value.toLowerCase().trim();
  const ids = PRODUTOS.filter(p => !q || [p.nome,p.conc,p.lab,...(p.tags||[])].join(' ').toLowerCase().includes(q)).map(p=>p.id);
  const todosSel = ids.every(id=>selecionados.has(id));
  ids.forEach(id => todosSel ? selecionados.delete(id) : selecionados.add(id));
  filtrarProdutos(); if (tipoAtual==='fixo') renderTabelaPrecos();
}

function setTipo(tipo) {
  tipoAtual = tipo;
  document.getElementById('btn-pct').classList.toggle('active',  tipo==='pct');
  document.getElementById('btn-fixo').classList.toggle('active', tipo==='fixo');
  document.getElementById('modo-pct').style.display  = tipo==='pct'  ? '' : 'none';
  document.getElementById('modo-fixo').style.display = tipo==='fixo' ? '' : 'none';
  if (tipo==='fixo') renderTabelaPrecos();
}

function renderTabelaPrecos() {
  // 1) Captura valores atuais antes do re-render destruir o DOM
  document.querySelectorAll('input[id^="novo-preco-"]').forEach(inp => {
    if (inp.value) precosFixos[inp.id.replace('novo-preco-','')] = inp.value;
  });
  // 2) Limpa valores de produtos que foram desselecionados
  Object.keys(precosFixos).forEach(id => {
    if (!selecionados.has(id)) delete precosFixos[id];
  });

  const wrap  = document.getElementById('tabela-precos-wrap');
  const prods = PRODUTOS.filter(p=>selecionados.has(p.id));
  if (!prods.length) { wrap.innerHTML='<p style="color:var(--gray);font-size:.82rem">Selecione os produtos acima para definir os preços.</p>'; return; }
  wrap.innerHTML = `<table class="preco-table"><thead><tr><th>Produto</th><th>Preço atual</th><th>Novo preço (R$)</th></tr></thead><tbody>
    ${prods.map(p=>`<tr>
      <td class="td-nome">${esc(p.icone||'💊')} ${esc(p.nome)}${p.conc?` <span style="color:var(--gray);font-weight:400">${esc(p.conc)}</span>`:''}</td>
      <td class="td-orig">R$ ${(parseFloat(p.preco)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      <td class="td-novo"><input type="number" id="novo-preco-${escAttr(p.id)}" min="0" step="0.01" placeholder="${(parseFloat(p.preco)||0).toFixed(2)}" value="${escAttr(precosFixos[p.id]||'')}" oninput="precosFixos[this.id.replace('novo-preco-','')]=this.value"/></td>
    </tr>`).join('')}
  </tbody></table>`;
}

// ── CÓDIGO E VALIDADE ─────────────────────────────────────────────────────────
function gerarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  document.getElementById('f_codigo').value = code;
}

function setValidade(btn, dias) {
  document.querySelectorAll('.valid-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const d = new Date(); d.setDate(d.getDate()+dias);
  document.getElementById('f_validade').valueAsDate = d;
  document.getElementById('f_validade').style.opacity = '1';
}

function setValidadeIndet(btn) {
  document.querySelectorAll('.valid-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('f_validade').value = '';
  document.getElementById('f_validade').style.opacity = '0.35';
}

// ── CRIAR CUPOM ───────────────────────────────────────────────────────────────
async function criarCupom() {
  if (!SESSION) return;
  const alertEl = document.getElementById('alert-main');
  alertEl.classList.remove('show');
  const codigo   = document.getElementById('f_codigo').value.trim().toUpperCase();
  const validade = document.getElementById('f_validade').value;
  const indet    = document.getElementById('btn-indet').classList.contains('active');
  if (selecionados.size===0 && tipoAtual!=='pct') { mostrarAlerta('Selecione pelo menos 1 produto.'); return; }
  if (!codigo) { mostrarAlerta('Gere ou digite um código para o cupom.'); return; }
  if (!indet && !validade) { mostrarAlerta('Defina a validade do cupom ou clique em Indeterminado.'); return; }
  let validadeFmt = '';
  if (validade && !indet) { const [y,m,d] = validade.split('-'); validadeFmt = `${d}/${m}/${y}`; }
  let produtos, precos, valor;
  if (tipoAtual==='pct') {
    valor = parseFloat(document.getElementById('f_pct').value);
    if (!valor||valor<=0||valor>=100) { mostrarAlerta('Informe um percentual válido (1–99%).'); return; }
    produtos = selecionados.size===0 ? 'todos' : [...selecionados].join(',');
    precos   = '';
  } else {
    const prods = PRODUTOS.filter(p=>selecionados.has(p.id));
    if (!prods.length) { mostrarAlerta('Selecione pelo menos 1 produto.'); return; }
    const precoParts = [];
    for (const p of prods) {
      const inp = document.getElementById(`novo-preco-${p.id}`);
      const val = parseFloat(inp?.value||0);
      if (!val||val<=0) { mostrarAlerta(`Informe o novo preço para: ${p.nome}`); return; }
      precoParts.push(`${p.id}:${val.toFixed(2)}`);
    }
    produtos = prods.map(p=>p.id).join(',');
    precos   = precoParts.join('|');
    valor    = 0;
  }
  const btn = document.getElementById('btn-submit');
  btn.disabled=true; btn.textContent='Salvando…';
  try {
    const parcelamento  = document.getElementById('f_parcelamento').checked ? 'SIM' : 'NAO';
    const freteAtivo    = document.getElementById('f_frete_gratis').checked;
    const freteMin      = parseFloat(document.getElementById('f_frete_minimo').value) || 0;
    const data = await postAction_('criarcupom', {
      email: SESSION.email, senha: SESSION.senha,
      codigo, tipo: tipoAtual === 'pct' ? '%' : 'fixo',
      valor: valor || 0, produtos, precos, validade: validadeFmt,
      parcelamento,
      frete_gratis_acima: freteAtivo ? freteMin.toFixed(2) : '',
      frete_gratis_ativo: freteAtivo ? 'SIM' : 'NAO',
    });
    if (data.ok) {
      document.getElementById('suc-code').textContent = codigo;
      document.getElementById('success-box').classList.add('show');
      document.getElementById('success-box').scrollIntoView({ behavior:'smooth', block:'center' });
    } else {
      mostrarAlerta(data.erro||'Erro ao salvar. Tente novamente.');
    }
  } catch(e) { mostrarAlerta('Erro de conexão.'); }
  finally { btn.disabled=false; btn.textContent='✅ Gerar Cupom'; }
}

function mostrarAlerta(msg) {
  const el = document.getElementById('alert-main');
  el.textContent='⚠️ '+msg; el.classList.add('show');
  el.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function copiarCodigo() {
  const code = document.getElementById('suc-code').textContent;
  navigator.clipboard.writeText(code).then(()=>{
    const btn = document.querySelector('.btn-copy');
    btn.textContent='✅ Copiado!';
    setTimeout(()=>btn.textContent='📋 Copiar Código', 2000);
  });
}

function novoCupom() {
  document.getElementById('success-box').classList.remove('show');
  document.getElementById('f_codigo').value='';
  document.getElementById('f_validade').value='';
  document.getElementById('f_validade').style.opacity='1';
  document.getElementById('f_pct').value='';
  document.getElementById('f_parcelamento').checked=false;
  document.getElementById('f_frete_gratis').checked=false;
  document.querySelectorAll('.valid-btn').forEach(b=>b.classList.remove('active'));
  selecionados.clear(); filtrarProdutos();
  if (tipoAtual==='fixo') renderTabelaPrecos();
  window.scrollTo({ top:0, behavior:'smooth' });
}

// ── HISTÓRICO ─────────────────────────────────────────────────────────────────
async function buscarHistorico() {
  if (!SESSION) return;
  const errEl = document.getElementById('hist-err');
  const btn   = document.getElementById('btn-buscar-hist');
  errEl.style.display = 'none';
  btn.disabled=true; btn.textContent='Buscando…';
  try {
    const data = await postAction_('historico_vendedora', { email: SESSION.email, senha: SESSION.senha });
    if (!data.ok) { errEl.textContent='⚠️ '+(data.erro||'Erro.'); errEl.style.display='block'; return; }
    mostrarHistorico(data);
  } catch(e) { errEl.textContent='⚠️ Erro de conexão.'; errEl.style.display='block'; }
  finally { btn.disabled=false; btn.textContent='🔍 Carregar Meus Pedidos'; }
}

function fmtBrl(v){ return parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }

function mostrarHistorico(data) {
  document.getElementById('hist-resultado').style.display = '';
  document.getElementById('hist-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Pedidos Realizados</div><div class="stat-value blue">${data.qtd_pedidos}</div></div>
    <div class="stat-card"><div class="stat-label">Total Vendido</div><div class="stat-value">R$ ${fmtBrl(data.total_vendido)}</div></div>
    <div class="stat-card"><div class="stat-label">Desconto Concedido</div><div class="stat-value green">R$ ${fmtBrl(data.total_desconto)}</div></div>
  `;
  const cupons = data.cupons||[];
  document.getElementById('hist-cupons-linha').innerHTML = cupons.length
    ? `Seus cupons: ${cupons.map(c=>`<span class="cupom-badge">${esc(c)}</span>`).join('')}`
    : '<span style="color:var(--gray)">Nenhum cupom criado ainda.</span>';
  const listEl = document.getElementById('hist-list');
  if (!data.pedidos||!data.pedidos.length) {
    listEl.innerHTML='<div class="hist-empty">Nenhum pedido encontrado com seus cupons ainda.<br/>Assim que alguém usar o seu código, os pedidos aparecem aqui.</div>';
    return;
  }
  listEl.innerHTML = data.pedidos.map(p=>{
    const itensH = (p.produtos||'').split('\n').filter(Boolean).map(l=>`<div>• ${esc(l)}</div>`).join('');
    return `<div class="ped-item">
      <div class="ped-top"><div class="ped-cliente">${esc(p.clinica||'—')}</div><div class="ped-data">📅 ${esc(p.data||'—')}</div></div>
      <div class="ped-row">
        <span class="ped-total">R$ ${fmtBrl(p.total)}</span>
        ${p.desconto>0?`<span class="ped-desc">🎟️ −R$ ${fmtBrl(p.desconto)}</span>`:''}
        ${p.pagamento?`<span class="ped-pag">${esc(p.pagamento)}</span>`:''}
      </div>
      ${p.cupom?`<div class="ped-cupom">cupom: ${esc(p.cupom)}</div>`:''}
      ${p.telefone?`<div class="ped-tel">📞 ${esc(p.telefone)}</div>`:''}
      ${itensH?`<div class="ped-prods">${itensH}</div>`:''}
    </div>`;
  }).join('');
}

// ── MEUS CUPONS ───────────────────────────────────────────────────────────────
async function carregarMeusCupons() {
  if (!SESSION) return;
  const errEl = document.getElementById('mc-err');
  const btn   = document.getElementById('btn-carregar-cupons');
  const lista = document.getElementById('mc-lista');
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Carregando…';
  try {
    const data = await postAction_('meus_cupons', { email: SESSION.email, senha: SESSION.senha });
    if (!data.ok) { errEl.textContent = '⚠️ '+(data.erro||'Erro.'); errEl.style.display='block'; return; }
    renderMeusCupons(data.cupons||[]);
  } catch(e) { errEl.textContent = '⚠️ Erro de conexão.'; errEl.style.display='block'; }
  finally { btn.disabled=false; btn.textContent='🔄 Carregar Meus Cupons'; }
}

function getNomeProduto(key) {
  const p = PRODUTOS.find(x => x.id === key);
  if (p) return `${esc(p.icone||'💊')} ${esc(p.nome)}${p.conc ? ' <span style="opacity:.6">' + esc(p.conc) + '</span>' : ''}`;
  return esc(key);
}

function toggleProdsList(uid) {
  const extra = document.getElementById('pe-' + uid);
  const btn   = document.getElementById('pb-' + uid);
  if (!extra || !btn) return;
  const aberto = extra.style.display !== 'none';
  extra.style.display = aberto ? 'none' : '';
  btn.textContent = aberto ? `▼ Ver mais (${extra.dataset.count} produtos)` : '▲ Ocultar';
}

function renderMeusCupons(cupons) {
  const lista = document.getElementById('mc-lista');
  if (!cupons.length) {
    lista.innerHTML = '<div class="hist-empty">Você não tem cupons ativos no momento.</div>';
    return;
  }
  const LIMITE = 3;
  lista.innerHTML = cupons.map((c, idx) => {
    const extras = [];
    if (c.parcelamento)       extras.push('⚡ Parcelamento sem juros (3×)');
    if (c.frete_gratis_acima) extras.push(`🚚 Frete grátis acima de R$ ${fmtBrl(c.frete_gratis_acima)}`);
    const tipoStr = c.tipo === '%' ? `${esc(c.valor)}% de desconto` : 'Preço fixo por produto';
    let prodsHtml = '';
    if (c.produtos === 'todos') {
      prodsHtml = '<div style="font-size:.72rem;color:var(--gray);margin-top:5px">🌐 Todos os produtos</div>';
    } else {
      const nomes = c.produtos.split(',').map(k => getNomeProduto(k.trim())).filter(Boolean);
      const vis   = nomes.slice(0, LIMITE);
      const rest  = nomes.slice(LIMITE);
      prodsHtml = `<div style="font-size:.72rem;color:var(--gray);line-height:1.8;margin-top:5px">
        ${vis.map(n => `<div>• ${n}</div>`).join('')}
        ${rest.length ? `
          <div id="pe-${idx}" style="display:none" data-count="${rest.length}">
            ${rest.map(n => `<div>• ${n}</div>`).join('')}
          </div>
          <button id="pb-${idx}" onclick="toggleProdsList(${idx})"
            style="background:transparent;border:none;color:var(--blue);font-size:.7rem;cursor:pointer;padding:3px 0;font-family:inherit;text-decoration:underline;text-underline-offset:2px">
            ▼ Ver mais (${rest.length} produtos)
          </button>` : ''}
      </div>`;
    }
    return `<div class="sec" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <div style="font-family:monospace;font-size:1.35rem;font-weight:800;letter-spacing:6px;color:var(--accent)">${esc(c.codigo)}</div>
          <div style="font-size:.78rem;color:var(--light);margin-top:3px">${tipoStr}</div>
          ${prodsHtml}
          ${extras.map(e => `<div style="font-size:.72rem;color:var(--green);margin-top:2px">${e}</div>`).join('')}
          <div style="font-size:.68rem;color:var(--gray);margin-top:7px;opacity:.7">Validade: ${esc(c.validade)} · Criado: ${esc(c.criado)}</div>
        </div>
        <button onclick="deletarCupomMeu('${escAttr(c.codigo)}',this)"
          style="background:transparent;border:1px solid var(--red);color:var(--red);padding:8px 16px;border-radius:8px;font-size:.78rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;font-family:inherit">
          🗑️ Excluir
        </button>
      </div>
    </div>`;
  }).join('');
}

async function deletarCupomMeu(codigo, btn) {
  if (!confirm(`Excluir o cupom ${codigo}? Esta ação não pode ser desfeita.`)) return;
  btn.disabled = true; btn.textContent = 'Excluindo…';
  try {
    const data = await postAction_('deletar_cupom', { email: SESSION.email, senha: SESSION.senha, codigo });
    if (data.ok) {
      carregarMeusCupons();
    } else {
      alert(data.erro || 'Erro ao excluir.'); btn.disabled=false; btn.textContent='🗑️ Excluir';
    }
  } catch(e) { alert('Erro de conexão.'); btn.disabled=false; btn.textContent='🗑️ Excluir'; }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
gerarCodigo();
