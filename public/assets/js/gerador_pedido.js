// FRETE_TABELA, buscarCEP e mascaraCep → frete.js

// ═══════════════════════════════════════════════════════════════════════════════
// SESSÃO ADMIN — gerenciada pelo painel.js (App.admin). Helper local pra anexar
// auth nas chamadas que exigem token admin.
// ═══════════════════════════════════════════════════════════════════════════════
function authQS_() {
  if (!window.App?.admin?.token) return '';
  return `&email=${encodeURIComponent(App.admin.email)}&token=${encodeURIComponent(App.admin.token)}`;
}

// Globais do gerador prefixados com `g` pra não colidir com painel.js
let gCATALOG=[], gCLIENTES=[], gCLIENTES_CORR=[], gPEDIDOS=[], gPARCELAS=[], gCUPONS={};
let gCart={}, gMODO='', gClienteAtual=null;
let gFreteValor=0, gFreteMetodo='', gFreteEstado='', gFreteCep='';
let gPendingCart=null, gPendingCartText=null;
let gPedidoRowId=null;
let gCupomAplicado=false, gCupomCodigo='', gCupomData=null;

// ── ESCAPE HTML ──
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return String(s || '').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ═══════════════════════════════════════════════════════════════════════════════
// INIT (chamado pelo painel.js quando o usuário abre a aba "Gerar Pedido")
//   - Primeira vez: carrega parcelas, cupons, catálogo
//   - Toda vez: verifica sessionStorage 'lp_corrigir' (caso o usuário tenha
//     vindo de "Corrigir" depois da primeira carga)
// ═══════════════════════════════════════════════════════════════════════════════
let _geradorInited = false;
function _consumirCorrigir() {
  const raw = sessionStorage.getItem('lp_corrigir');
  if (!raw) return;
  try {
    sessionStorage.removeItem('lp_corrigir');
    const payload = JSON.parse(raw);
    const p = {
      rowNum:    payload.rowNum,
      pagamento: payload.pagamento,
      parcelas:  payload.parcelas,
      obs:       payload.obs,
      cupom:     payload.cupom,
      carrinho:  payload.carrinho,
      cep:       payload.cep,
      freteMetodo: payload.freteMetodo,
      freteValor:  payload.freteValor,
      total:     payload.total,
      produtos:  payload.produtos,
    };
    gMODO = 'corrigir';
    gPedidoRowId = payload.rowNum;
    carregarPedidoNoEditor(p, payload.cli || {});
  } catch (e) { console.error(e); }
}
function initGerador() {
  if (_geradorInited) {
    // Já carregado — só consome o sessionStorage caso venha de "Corrigir"
    if (gCATALOG.length > 0) _consumirCorrigir();
    return;
  }
  _geradorInited = true;
  carregarParcelas();
  carregarCupons();
  carregarCatalogo().then(_consumirCorrigir);
}
window.initGerador = initGerador;

async function carregarCupons(){
  try{const r=await fetch(`${SHEETS_URL}?action=cupons`);const d=await r.json();if(d&&typeof d==='object')gCUPONS=d;}catch(e){}
}

// ── CACHE (apenas parcelas, 30min TTL — preços/cupons sempre frescos) ──────────
const CACHE_TTL = 30 * 60 * 1000;
function fromCache_(k){try{const c=sessionStorage.getItem('lp_'+k);if(!c)return null;const{data,ts}=JSON.parse(c);return(Date.now()-ts)<CACHE_TTL?data:null;}catch(e){return null;}}
function toCache_(k,data){try{sessionStorage.setItem('lp_'+k,JSON.stringify({data,ts:Date.now()}));}catch(e){}}

async function carregarCatalogo() {
  try {
    const processData = data => {
      gCATALOG = data.map(p => ({
        id: p.id, icon: p.icone||'💊', name: p.nome, conc: String(p.conc||''),
        price: parseFloat(p.preco)||0,
        variantes: (Array.isArray(p.variantes)&&p.variantes.length>0&&p.variantes[0].dose)
          ? p.variantes.map(v=>({dose:v.dose,preco:parseFloat(v.preco)||0})) : []
      }));
      if(gPendingCart){gCart=gPendingCart;gPendingCart=null;renderCart();renderCatalogo();gerarMensagem();}
      if(gPendingCartText){reconstruirCarrinho(gPendingCartText);gPendingCartText=null;renderCart();renderCatalogo();gerarMensagem();}
    };
    const res = await fetch(`${SHEETS_URL}?action=produtos`);
    const data = await res.json();
    processData(data);
  } catch(e){}
}

async function carregarParcelas() {
  try {
    const cached = fromCache_('parcelas');
    if (cached) { gPARCELAS = cached; renderParcelasSelect(); fetch(`${SHEETS_URL}?action=parcelas`).then(r=>r.json()).then(d=>toCache_('parcelas',d)).catch(()=>{}); return; }
    const r = await fetch(`${SHEETS_URL}?action=parcelas`);
    gPARCELAS = await r.json();
    toCache_('parcelas', gPARCELAS);
    renderParcelasSelect();
  } catch(e){}
}
function renderParcelasSelect() {
  const sel=document.getElementById('c_parcelas'); if(!sel)return;
  const cur=sel.value;
  const parcCupom=gCupomData?.parcelamento==='SIM';
  sel.innerHTML='<option value="1">1x sem juros</option>';
  gPARCELAS.forEach(p=>{
    const semJurosCupom=parcCupom&&p.parcelas<=3;
    const l=semJurosCupom?`${p.parcelas}x sem juros (cupom)`:p.juros>0?`${p.parcelas}x com ${p.juros}% juros`:`${p.parcelas}x sem juros`;
    sel.innerHTML+=`<option value="${p.parcelas}" data-juros="${p.juros}">${l}</option>`;
  });
  if(cur)sel.value=cur;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUPOM
// ═══════════════════════════════════════════════════════════════════════════════
function getItemPrice(key){
  const parts=key.split('__'),id=parts[0],varIdx=parts.length>1?parseInt(parts[1]):null;
  const p=gCATALOG.find(x=>x.id===id);if(!p)return 0;
  let price=p.price;
  if(varIdx!==null&&p.variantes[varIdx])price=p.variantes[varIdx].preco;
  if(gCupomAplicado&&gCupomData&&gCupomData.tipo==='fixo'){
    const precos=gCupomData.precos||{};
    if(precos[key]!==undefined)price=precos[key];
    else if(precos[id]!==undefined)price=precos[id];
  }
  return price;
}
function calcularDescontoCupom(){
  if(!gCupomAplicado||!gCupomData)return 0;
  if(gCupomData.tipo==='%'){
    if(gCupomData.produtos==='todos')return calcSubtotal()*(gCupomData.valor/100);
    let base=0;const prods=Array.isArray(gCupomData.produtos)?gCupomData.produtos:[];
    Object.keys(gCart).forEach(key=>{const bid=key.split('__')[0];if(prods.includes(key)||prods.includes(bid))base+=getItemPrice(key)*gCart[key];});
    return base*(gCupomData.valor/100);
  }
  if(gCupomData.tipo==='fixo'){
    let desc=0;const precos=gCupomData.precos||{};
    Object.keys(gCart).forEach(key=>{const bid=key.split('__')[0];const p=gCATALOG.find(x=>x.id===bid);if(!p)return;
      const parts=key.split('__'),varIdx=parts.length>1?parseInt(parts[1]):null;
      let orig=p.price;if(varIdx!==null&&p.variantes[varIdx])orig=p.variantes[varIdx].preco;
      const disc=precos[key]!==undefined?precos[key]:precos[bid]!==undefined?precos[bid]:null;
      if(disc!==null)desc+=Math.max(0,orig-disc)*gCart[key];
    });
    return desc;
  }
  return 0;
}
function aplicarCupom(){
  const codigo=(document.getElementById('c_cupom').value||'').trim().toUpperCase();
  const status=document.getElementById('cupom-status');
  if(!codigo){status.innerHTML='<span class="cupom-err">⚠️ Digite um código.</span>';return;}
  const c=gCUPONS[codigo];
  if(c!==undefined){
    gCupomAplicado=true;gCupomCodigo=codigo;
    gCupomData=typeof c==='number'?{tipo:'%',valor:c*100,produtos:'todos'}:c;
    document.getElementById('c_cupom').disabled=true;
    document.getElementById('btn-aplicar-cupom').disabled=true;
    document.getElementById('btn-remover-cupom').classList.remove('hidden');
    const desc=calcularDescontoCupom();
    const descStr=desc>0?` — <strong>R$ ${desc.toLocaleString('pt-BR',{minimumFractionDigits:2})} de desconto</strong>`:'';
    let txt='';
    if(gCupomData.tipo==='%')txt=`✅ <strong>${esc(codigo)}</strong> aplicado! ${esc(gCupomData.valor)}% de desconto${descStr}.`;
    else txt=`✅ <strong>${esc(codigo)}</strong> aplicado! Preço especial em produtos selecionados${descStr}.`;
    status.innerHTML=`<span class="cupom-ok">${txt}</span>`;
    renderParcelasSelect();renderCart();gerarMensagem();
  }else{
    gCupomAplicado=false;gCupomData=null;
    status.innerHTML='<span class="cupom-err">❌ Código inválido.</span>';
  }
}
function removerCupom(){
  gCupomAplicado=false;gCupomCodigo='';gCupomData=null;
  document.getElementById('c_cupom').value='';
  document.getElementById('c_cupom').disabled=false;
  document.getElementById('btn-aplicar-cupom').disabled=false;
  document.getElementById('btn-remover-cupom').classList.add('hidden');
  document.getElementById('cupom-status').textContent='';
  renderParcelasSelect();renderCart();gerarMensagem();
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAVEGACAO
// ═══════════════════════════════════════════════════════════════════════════════
function mostrarTela(id){
  ['tela-inicio','tela-clientes','tela-pedidos','tela-editor'].forEach(t=>document.getElementById(t).classList.toggle('hidden',t!==id));
  document.getElementById('btn-voltar').style.display=id==='tela-inicio'?'none':'block';
}
function voltarInicio(){
  if(gMODO&&Object.keys(gCart).length>0){if(!confirm('Tem certeza? O pedido atual sera perdido.'))return;}
  gMODO='';gCart={};gClienteAtual=null;gFreteValor=0;gFreteMetodo='';gPedidoRowId=null;mostrarTela('tela-inicio');
}
function iniciarModo(modo){
  gMODO=modo;
  if(modo==='novo'){mostrarTela('tela-clientes');carregarClientesLista();}
  else{mostrarTela('tela-pedidos');carregarUltimosPedidos();carregarClientesCorrLista();}
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABS (Corrigir)
// ═══════════════════════════════════════════════════════════════════════════════
function trocarTab(tab){
  document.getElementById('tab-pedidos').classList.toggle('active',tab==='pedidos');
  document.getElementById('tab-clientes-corr').classList.toggle('active',tab==='clientes-corr');
  document.getElementById('tab-content-pedidos').classList.toggle('hidden',tab!=='pedidos');
  document.getElementById('tab-content-clientes-corr').classList.toggle('hidden',tab!=='clientes-corr');
}

// ═══════════════════════════════════════════════════════════════════════════════
// IR PARA EDITOR
// ═══════════════════════════════════════════════════════════════════════════════
function irParaEditor(){
  mostrarTela('tela-editor');
  const bN=document.getElementById('badge-novo'),bC=document.getElementById('badge-corrigir');
  if(gMODO==='novo'){bN.classList.remove('hidden');bC.classList.add('hidden');document.getElementById('lbl-obs').textContent='Observacao';document.getElementById('c_obs').placeholder='Ex: cliente solicitou entrega expressa';}
  else{bC.classList.remove('hidden');bN.classList.add('hidden');document.getElementById('lbl-obs').textContent='Observacao (o que foi alterado)';document.getElementById('c_obs').placeholder='Ex: adicionado Tirzepatida 120mg conforme solicitado';}
  if(gClienteAtual){
    document.getElementById('c_nome').value=gClienteAtual.clinica||gClienteAtual.nome||'';
    document.getElementById('c_telefone').value=gClienteAtual.telefone||'';
  }
  renderCatalogo();renderCart();gerarMensagem();
}

// ═══════════════════════════════════════════════════════════════════════════════
// FRETE
// ═══════════════════════════════════════════════════════════════════════════════
async function calcularFrete(){
  const cep=document.getElementById('f_cep').value.replace(/\D/g,'');
  const status=document.getElementById('frete-status');
  const opcoes=document.getElementById('frete-opcoes');
  const endTxt=document.getElementById('frete-endereco-txt');
  const gratisEl=document.getElementById('frete-gratis');
  if(cep.length!==8){status.textContent='CEP invalido (8 digitos).';status.style.color='#FCA5A5';return;}
  status.textContent='⏳ Consultando CEP...';status.style.color='var(--gray)';
  try{
    const data=await buscarCEP(cep);
    gFreteEstado=data.uf;gFreteCep=cep;
    endTxt.textContent=`📍 ${data.logradouro?data.logradouro+', ':''}${data.localidade}/${data.uf}`; // textContent already safe
    const tab=FRETE_TABELA[data.uf];
    if(!tab){status.textContent='Estado sem tabela de frete.';status.style.color='#FCA5A5';return;}

    // Sempre mostra as opções SEDEX/Jadlog. Frete grátis só via cupom (frete_gratis_acima).
    gratisEl.style.display='none';
    opcoes.style.display='flex';
    opcoes.innerHTML=[
      {id:'sedex',nome:'SEDEX',preco:tab.sedex,prazo:tab.ds},
      {id:'jadlog',nome:'Jadlog',preco:tab.jadlog,prazo:tab.dj},
    ].map(o=>`<div class="frete-opt" id="fo-${o.id}" onclick="selecionarFrete('${o.id}')">
      <div class="fo-nome">${o.nome}</div>
      <div class="fo-preco">R$ ${o.preco.toFixed(2).replace('.',',')}</div>
      <div class="fo-prazo">${o.prazo} dias uteis</div>
    </div>`).join('');
    selecionarFrete('jadlog');
    status.textContent='';
    renderCart();gerarMensagem();
  }catch(e){status.textContent='⚠️ Erro ao consultar CEP.';status.style.color='#FCA5A5';}
}

function selecionarFrete(metodo){
  gFreteMetodo=metodo;
  const tab=FRETE_TABELA[gFreteEstado];
  gFreteValor=tab?(tab[metodo]||0):0;
  document.querySelectorAll('.frete-opt').forEach(el=>el.classList.remove('sel'));
  const el=document.getElementById('fo-'+metodo);if(el)el.classList.add('sel');
  renderCart();gerarMensagem();
}

function calcSubtotal(){
  let s=0;
  Object.keys(gCart).forEach(key=>{const p=gCATALOG.find(x=>x.id===key.split('__')[0]);if(!p)return;s+=getItemPrice(key)*gCart[key];});
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARCELAS
// ═══════════════════════════════════════════════════════════════════════════════
function onPagamentoChange(){
  const v=document.getElementById('c_pagamento').value;
  const f=document.getElementById('parcelas-field');
  if(v==='Cartao de Credito')f.classList.remove('hidden');else{f.classList.add('hidden');document.getElementById('c_parcelas').value='1';}
  gerarMensagem();
}
function getParcelaInfo(){
  if(document.getElementById('c_pagamento').value!=='Cartao de Credito')return null;
  const sel=document.getElementById('c_parcelas'),opt=sel.options[sel.selectedIndex];if(!opt)return null;
  const parc=parseInt(sel.value)||1;
  let juros=parseFloat(opt.getAttribute('data-juros'))||0;
  if(gCupomData?.parcelamento==='SIM'&&parc<=3)juros=0;
  return{parcelas:parc,juros};
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATALOGO
// ═══════════════════════════════════════════════════════════════════════════════
function filtrarProdutos(){renderCatalogo(document.getElementById('busca_cat').value.toLowerCase());}
function renderCatalogo(filtro=''){
  const grid=document.getElementById('cat-grid');if(!grid)return;
  if(gCATALOG.length===0){grid.innerHTML='<div class="loading-box">⏳ Carregando catalogo...</div>';return;}
  const lista=filtro?gCATALOG.filter(p=>p.name.toLowerCase().includes(filtro)||String(p.conc).toLowerCase().includes(filtro)):gCATALOG;
  if(!lista.length){grid.innerHTML='<div class="loading-box">Nenhum produto encontrado.</div>';return;}
  grid.innerHTML=lista.map(p=>{
    const inCart=Object.keys(gCart).some(k=>k.split('__')[0]===p.id);
    const precoMin=p.variantes.length>0?Math.min(...p.variantes.map(v=>v.preco)):p.price;
    return`<div class="prod-tile ${inCart?'in-cart':''}" onclick="adicionarProduto('${escAttr(p.id)}')">
      ${inCart?'<span class="pt-badge">✓</span>':''}
      <div class="pt-icon">${esc(p.icon)}</div><div class="pt-name">${esc(p.name)}</div>
      <div class="pt-conc">${esc(p.conc)}</div><div class="pt-price">R$ ${precoMin.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTES (NOVO PEDIDO) — funções renomeadas com prefixo g_ pra não colidir
// com renderClientes/filtrarClientes/salvarNovoCliente do painel.js
// ═══════════════════════════════════════════════════════════════════════════════
async function carregarClientesLista(){
  document.getElementById('g-clientes-grid').innerHTML='<div class="loading-box">⏳ Carregando clientes...</div>';
  try{const r=await fetch(`${SHEETS_URL}?action=clientes${authQS_()}`);gCLIENTES=await r.json();g_renderClientes();}
  catch(e){document.getElementById('g-clientes-grid').innerHTML='<div class="loading-box">⚠️ Erro ao carregar.</div>';}
}
function g_filtrarClientes(){g_renderClientes(document.getElementById('busca_cliente').value.toLowerCase());}
function g_renderClientes(filtro=''){
  const grid=document.getElementById('g-clientes-grid');
  const lista=filtro?gCLIENTES.filter(c=>`${c.clinica} ${c.responsavel} ${c.telefone} ${c.cpf} ${c.email}`.toLowerCase().includes(filtro)):gCLIENTES;
  let html=`<div class="btn-novo-cliente" onclick="abrirCadastro()"><div class="icon">➕</div><div class="label">Cadastrar Novo Cliente</div></div>`;
  if(!lista.length&&filtro)html+='<div class="loading-box">Nenhum cliente encontrado.</div>';
  else html+=lista.map((c,i)=>{
    const ri=gCLIENTES.indexOf(c);const parts=[];
    if(c.telefone)parts.push(`📞 ${esc(c.telefone)}`);if(c.cpf)parts.push(`🆔 ${esc(c.cpf)}`);if(c.email)parts.push(`📧 ${esc(c.email)}`);if(c.cidade)parts.push(`📍 ${esc(c.cidade)}${c.estado?'/'+esc(c.estado):''}`);
    return`<div class="cli-card" onclick="selecionarCliente(${ri},'novo')"><div class="cli-nome">${esc(c.clinica||c.responsavel||'Sem nome')}</div><div class="cli-info">${parts.join(' · ')}</div>${c.responsavel&&c.clinica?`<span class="cli-tag">${esc(c.responsavel)}</span>`:''}</div>`;
  }).join('');
  grid.innerHTML=html;
  document.getElementById('clientes-status').textContent=`${gCLIENTES.length} clientes cadastrados`;
}
function selecionarCliente(i,modo){
  gClienteAtual=(modo==='novo'?gCLIENTES:gCLIENTES_CORR)[i];if(!gClienteAtual)return;
  gCart={};gFreteValor=0;gFreteMetodo='';
  if(modo==='novo')irParaEditor();
  else carregarPedidosDoCliente(gClienteAtual);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTES (CORRIGIR — tab Por Cliente)
// ═══════════════════════════════════════════════════════════════════════════════
async function carregarClientesCorrLista(){
  document.getElementById('clientes-corr-grid').innerHTML='<div class="loading-box">⏳ Carregando clientes...</div>';
  try{const r=await fetch(`${SHEETS_URL}?action=clientes${authQS_()}`);gCLIENTES_CORR=await r.json();renderClientesCorr();}
  catch(e){document.getElementById('clientes-corr-grid').innerHTML='<div class="loading-box">⚠️ Erro.</div>';}
}
function filtrarClientesCorr(){renderClientesCorr(document.getElementById('busca_cli_corr').value.toLowerCase());}
function renderClientesCorr(filtro=''){
  const grid=document.getElementById('clientes-corr-grid');
  const lista=filtro?gCLIENTES_CORR.filter(c=>`${c.clinica} ${c.responsavel} ${c.telefone} ${c.cpf} ${c.email}`.toLowerCase().includes(filtro)):gCLIENTES_CORR;
  if(!lista.length){grid.innerHTML='<div class="loading-box">Nenhum cliente encontrado.</div>';return;}
  grid.innerHTML=lista.map((c,i)=>{
    const ri=gCLIENTES_CORR.indexOf(c);const parts=[];
    if(c.telefone)parts.push(`📞 ${esc(c.telefone)}`);if(c.cpf)parts.push(`🆔 ${esc(c.cpf)}`);if(c.cidade)parts.push(`📍 ${esc(c.cidade)}${c.estado?'/'+esc(c.estado):''}`);
    return`<div class="cli-card" onclick="selecionarCliente(${ri},'corr')"><div class="cli-nome">${esc(c.clinica||'Sem nome')}</div><div class="cli-info">${parts.join(' · ')}</div></div>`;
  }).join('');
  document.getElementById('clientes-corr-status').textContent=`${gCLIENTES_CORR.length} clientes`;
}

async function carregarPedidosDoCliente(cli){
  const sec=document.getElementById('pedidos-cliente-section');
  const grid=document.getElementById('pedidos-cliente-grid');
  document.getElementById('pedidos-cli-titulo').textContent=`📦 Pedidos de ${cli.clinica||'cliente'}`;
  sec.classList.remove('hidden');
  grid.innerHTML='<div class="loading-box">⏳ Buscando pedidos...</div>';
  const doc=cli.cpf||cli.telefone||cli.email||'';
  if(!doc){grid.innerHTML='<div class="loading-box">Sem documento para buscar.</div>';return;}
  try{
    const r=await fetch(`${SHEETS_URL}?action=pedidos&documento=${encodeURIComponent(doc.replace(/\D/g,''))}${authQS_()}`);
    const pedidos=await r.json();
    if(!pedidos.length){grid.innerHTML='<div class="loading-box">Nenhum pedido encontrado para este cliente.</div>';return;}
    grid.innerHTML=pedidos.map((p,i)=>{
      const itens=(p.produtos||'').split('\n').filter(Boolean);
      const itensH=itens.slice(0,3).map(l=>`<div>${esc(l)}</div>`).join('')+(itens.length>3?`<div style="color:var(--gray)">+${itens.length-3} itens...</div>`:'');
      const total=p.total?`R$ ${parseFloat(p.total).toLocaleString('pt-BR',{minimumFractionDigits:2})}`:'—';
      return`<div class="ped-card" id="pcli-card-${i}"><div class="ped-header"><div class="ped-cliente">${esc(p.clinica||'')}</div><div class="ped-data">📅 ${esc(p.data||'—')}</div></div>
        <div class="ped-total">${total}</div>${p.pagamento?`<span class="ped-pag">${esc(p.pagamento)}</span>`:''}
        <div class="ped-itens">${itensH}</div>
        <button class="ped-btn" id="pcli-btn-${i}" onclick="selecionarPedidoCliente(${i})">✏️ Editar este pedido</button></div>`;
    }).join('');
    grid._pedidos=pedidos;
  }catch(e){grid.innerHTML='<div class="loading-box">⚠️ Erro ao buscar pedidos.</div>';}
}

function selecionarPedidoCliente(i){
  const pedidos=document.getElementById('pedidos-cliente-grid')._pedidos;
  if(!pedidos||!pedidos[i])return;
  gPedidoRowId = pedidos[i].rowNum || null;
  carregarPedidoNoEditor(pedidos[i],gClienteAtual);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PEDIDOS (CORRIGIR — tab Por Pedido)
// ═══════════════════════════════════════════════════════════════════════════════
async function carregarUltimosPedidos(){
  document.getElementById('pedidos-grid').innerHTML='<div class="loading-box">⏳ Carregando pedidos...</div>';
  try{const r=await fetch(`${SHEETS_URL}?action=ultimos_pedidos${authQS_()}`);gPEDIDOS=await r.json();renderPedidosLista();}
  catch(e){document.getElementById('pedidos-grid').innerHTML='<div class="loading-box">⚠️ Erro.</div>';}
}
function filtrarPedidos(){renderPedidosLista(document.getElementById('busca_pedido').value.toLowerCase());}
function renderPedidosLista(filtro=''){
  const grid=document.getElementById('pedidos-grid');
  const lista=filtro?gPEDIDOS.filter(p=>`${p.clinica} ${p.telefone} ${p.data} ${p.produtos} ${p.pagamento}`.toLowerCase().includes(filtro)):gPEDIDOS;
  if(!lista.length){grid.innerHTML=`<div class="loading-box">${filtro?'Nenhum pedido encontrado.':'Nenhum pedido registrado.'}</div>`;return;}
  grid.innerHTML=lista.map(p=>{
    const ri=gPEDIDOS.indexOf(p);const itens=(p.produtos||'').split('\n').filter(Boolean);
    const itensH=itens.slice(0,3).map(l=>`<div>${esc(l)}</div>`).join('')+(itens.length>3?`<div style="color:var(--gray)">+${itens.length-3} itens...</div>`:'');
    const total=p.total?`R$ ${parseFloat(p.total).toLocaleString('pt-BR',{minimumFractionDigits:2})}`:'—';
    return`<div class="ped-card" id="ped-card-${ri}"><div class="ped-header"><div class="ped-cliente">${esc(p.clinica||'Sem nome')}</div><div class="ped-data">📅 ${esc(p.data||'—')}</div></div>
      <div class="ped-total">${total}</div>${p.pagamento?`<span class="ped-pag">${esc(p.pagamento)}</span>`:''}
      <div class="ped-itens">${itensH}</div>
      <button class="ped-btn" id="ped-btn-${ri}" onclick="selecionarPedido(${ri})">✏️ Editar este pedido</button></div>`;
  }).join('');
  document.getElementById('pedidos-status').textContent=`${gPEDIDOS.length} pedidos encontrados`;
}

async function selecionarPedido(i){
  const p=gPEDIDOS[i];if(!p)return;
  // Visual
  document.querySelectorAll('#pedidos-grid .ped-card').forEach(c=>c.classList.remove('selecionado'));
  document.querySelectorAll('#pedidos-grid .ped-btn').forEach(b=>{b.classList.remove('loaded');b.innerHTML='✏️ Editar este pedido';});
  const card=document.getElementById(`ped-card-${i}`),btn=document.getElementById(`ped-btn-${i}`);
  if(card)card.classList.add('selecionado');if(btn){btn.classList.add('loaded');btn.textContent='⏳ Carregando...';}

  // Busca dados completos do cliente
  const doc=p.documento||p.telefone||'';
  let cli={clinica:p.clinica||'',telefone:p.telefone||'',endereco:p.endereco||'',cidade:p.cidade||'',estado:p.estado||''};
  if(doc){
    try{
      const r=await fetch(`${SHEETS_URL}?action=cliente&documento=${encodeURIComponent(doc.replace(/\D/g,''))}`);
      const fullCli=await r.json();
      if(fullCli&&fullCli.clinica)cli=fullCli;
    }catch(e){}
  }

  if(btn)btn.textContent='✓ Selecionado';
  gPedidoRowId = p.rowNum || null;
  carregarPedidoNoEditor(p,cli);
}

function carregarPedidoNoEditor(p,cli){
  gClienteAtual=cli;
  if(p.pagamento){const sel=document.getElementById('c_pagamento');[...sel.options].forEach(o=>{if(o.value===p.pagamento)o.selected=true;});onPagamentoChange();}
  gCart={};let ok=false;
  if(p.carrinho){try{const cj=JSON.parse(p.carrinho);if(typeof cj==='object'&&Object.keys(cj).length>0){gCart=cj;ok=true;}}catch(e){}}
  if(!ok&&p.produtos){
    if(gCATALOG.length>0)reconstruirCarrinho(p.produtos);
    else gPendingCartText=p.produtos;
  }
  if(gCATALOG.length===0&&Object.keys(gCart).length>0){gPendingCart={...gCart};gCart={};}
  // Restaura frete do pedido salvo (se houver) — pré-preenche CEP e chama calcularFrete
  // pra reconstruir as opções e selecionar o método antes usado.
  gFreteValor=parseFloat(p.freteValor)||0;
  gFreteMetodo=String(p.freteMetodo||'').toLowerCase();
  gFreteCep=String(p.cep||'').replace(/\D/g,'');
  irParaEditor();
  if(gFreteCep){
    const cepInput=document.getElementById('f_cep');
    if(cepInput){
      cepInput.value=gFreteCep.length===8?`${gFreteCep.slice(0,5)}-${gFreteCep.slice(5)}`:gFreteCep;
      // Aguarda 1 tick pra garantir que o editor foi renderizado, e re-aplica o método
      setTimeout(async ()=>{
        const metodoAntes=gFreteMetodo;
        await calcularFrete();
        if(metodoAntes&&['sedex','jadlog'].includes(metodoAntes)){
          selecionarFrete(metodoAntes);
        }
      },50);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL CADASTRO
// ═══════════════════════════════════════════════════════════════════════════════
function abrirCadastro(){document.getElementById('modal-cadastro').classList.add('ativo');}
function fecharModal(){document.getElementById('modal-cadastro').classList.remove('ativo');document.getElementById('cadastro-status').textContent='';}
async function g_salvarNovoCliente(){
  const status=document.getElementById('cadastro-status');
  const nome=document.getElementById('nc_nome').value.trim(),tel=document.getElementById('nc_telefone').value.trim();
  if(!nome){status.textContent='Preencha o nome.';return;}if(!tel){status.textContent='Preencha o telefone.';return;}
  const btn=document.getElementById('btn-salvar-cliente');btn.disabled=true;btn.textContent='Salvando...';status.textContent='';
  const params=new URLSearchParams({action:'cadastrar',clinica:nome,responsavel:document.getElementById('nc_responsavel').value.trim(),telefone:tel,email:document.getElementById('nc_email').value.trim(),cpf:document.getElementById('nc_cpf').value.trim(),cidade:document.getElementById('nc_cidade').value.trim(),estado:document.getElementById('nc_estado').value.trim(),endereco:document.getElementById('nc_endereco').value.trim()});
  // Admin auth via token de sessão — backend (validateAdmin_) só precisa do token.
  // Pula a obrigatoriedade de senha/email do fluxo customer self-service.
  if(window.App?.admin?.token){params.set('token',App.admin.token);}
  try{
    const r=await fetch(`${SHEETS_URL}?${params}`);const data=await r.json();
    if(data.ok){fecharModal();['nc_nome','nc_responsavel','nc_telefone','nc_email','nc_cpf','nc_cidade','nc_estado','nc_endereco'].forEach(id=>document.getElementById(id).value='');
      gClienteAtual={clinica:nome,telefone:tel,email:document.getElementById('nc_email').value,endereco:document.getElementById('nc_endereco').value,cidade:document.getElementById('nc_cidade').value,estado:document.getElementById('nc_estado').value,cpf:document.getElementById('nc_cpf').value,responsavel:document.getElementById('nc_responsavel').value};
      gCart={};irParaEditor();
    }else if(data.duplicado){const c=data.duplicado==='cpf'?'CPF/CNPJ':data.duplicado==='email'?'E-mail':'Telefone';status.textContent=`${c} ja cadastrado.`;}
    else status.textContent=data.erro||'Erro.';
  }catch(e){status.textContent='⚠️ Erro de conexao.';}
  finally{btn.disabled=false;btn.textContent='Cadastrar';}
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATCH DE PRODUTOS
// ═══════════════════════════════════════════════════════════════════════════════
function reconstruirCarrinho(txt){txt.split('\n').forEach(l=>{const m=l.match(/^(\d+)x\s+(.+)/);if(!m)return;const melhor=encontrarProduto(m[2]);if(melhor){const key=melhor.varIdx!==null?`${melhor.produto.id}__${melhor.varIdx}`:melhor.produto.id;gCart[key]=parseInt(m[1]);}});}
function encontrarProduto(linha){
  const ll=normalizar(linha);let ms=0,mp=null,mv=null;
  gCATALOG.forEach(p=>{if(p.variantes.length>0)p.variantes.forEach((v,i)=>{const s=calcScore(ll,normalizar(p.name),normalizar(v.dose));if(s>ms){ms=s;mp=p;mv=i;}});
  else{const s=calcScore(ll,normalizar(p.name),normalizar(p.conc));if(s>ms){ms=s;mp=p;mv=null;}}});
  return ms>=0.35?{produto:mp,varIdx:mv}:null;
}
function normalizar(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s\+]/g,' ').replace(/\s+/g,' ').trim();}
function calcScore(linha,nome,conc){const pn=nome.split(' ').filter(w=>w.length>2),pc=conc.split(' ').filter(w=>w.length>1);if(!pn.length)return 0;const aN=pn.filter(w=>linha.includes(w)).length/pn.length,aC=pc.length>0?pc.filter(w=>linha.includes(w)).length/pc.length:0;return aN*0.7+aC*0.3;}

// ═══════════════════════════════════════════════════════════════════════════════
// CARRINHO
// ═══════════════════════════════════════════════════════════════════════════════
function adicionarProduto(id){
  const p=gCATALOG.find(x=>x.id===id);if(!p)return;
  if(p.variantes.length>0){const ex=Object.keys(gCart).filter(k=>k.split('__')[0]===id);ex.length?gCart[ex[0]]++:(gCart[`${id}__0`]=1);}
  else gCart[id]=(gCart[id]||0)+1;
  renderCart();renderCatalogo(document.getElementById('busca_cat').value.toLowerCase());gerarMensagem();
}
function alterarQtd(key,d){const n=(gCart[key]||0)+d;n<=0?delete gCart[key]:(gCart[key]=n);renderCart();renderCatalogo(document.getElementById('busca_cat').value.toLowerCase());gerarMensagem();}
function removerItem(key){delete gCart[key];renderCart();renderCatalogo(document.getElementById('busca_cat').value.toLowerCase());gerarMensagem();}
function alterarVariante(id,old,novo){const q=gCart[old]||1;delete gCart[old];gCart[`${id}__${novo}`]=q;renderCart();gerarMensagem();}

function renderCart(){
  const list=document.getElementById('cart-list'),totalDiv=document.getElementById('cart-total'),keys=Object.keys(gCart);
  if(!keys.length){list.innerHTML='<div class="cart-empty">Adicione produtos do catalogo →</div>';totalDiv.style.display='none';return;}
  let subtotal=0;
  list.innerHTML=keys.map(key=>{
    const parts=key.split('__'),id=parts[0],varIdx=parts.length>1?parseInt(parts[1]):null,p=gCATALOG.find(x=>x.id===id);
    if(!p)return`<div class="cart-item"><span class="ci-icon">❓</span><div class="ci-info"><div class="ci-name">${esc(key)}</div></div><button class="ci-remove" onclick="removerItem('${escAttr(key)}')">✕</button></div>`;
    const qty=gCart[key];let conc=p.conc;
    if(varIdx!==null&&p.variantes[varIdx])conc=p.variantes[varIdx].dose;
    const price=getItemPrice(key);const sub=price*qty;subtotal+=sub;
    const vs=p.variantes.length>1?`<select class="var-select" onchange="alterarVariante('${escAttr(id)}','${escAttr(key)}',this.value)">${p.variantes.map((v,vi)=>`<option value="${vi}" ${vi===varIdx?'selected':''}>${esc(v.dose)}</option>`).join('')}</select>`:'';
    return`<div class="cart-item"><span class="ci-icon">${esc(p.icon)}</span>
      <div class="ci-info"><div class="ci-name">${esc(p.name)}</div><div class="ci-conc">${esc(conc)}</div>${vs}</div>
      <div style="text-align:right;flex-shrink:0"><div class="ci-price">R$ ${sub.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
        <div class="ci-qty" style="margin-top:4px;justify-content:flex-end"><button onclick="alterarQtd('${escAttr(key)}',-1)">−</button><span>${qty}</span><button onclick="alterarQtd('${escAttr(key)}',1)">+</button></div>
      </div><button class="ci-remove" onclick="removerItem('${escAttr(key)}')">✕</button></div>`;
  }).join('');

  document.getElementById('subtotal-amount').textContent=`R$ ${subtotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;

  // Frete row
  const fr=document.getElementById('frete-row');
  if(gFreteValor>0){fr.style.display='flex';document.getElementById('frete-metodo-label').textContent=gFreteMetodo.toUpperCase();document.getElementById('frete-valor-label').textContent=`R$ ${gFreteValor.toFixed(2).replace('.',',')}`;}
  else if(gFreteMetodo==='gratis'){fr.style.display='flex';document.getElementById('frete-metodo-label').textContent='GRATIS';document.getElementById('frete-valor-label').textContent='R$ 0,00';}
  else fr.style.display='none';

  // Desconto cupom
  const descRow=document.getElementById('cupom-desc-row');
  const desconto=calcularDescontoCupom();
  if(gCupomAplicado&&desconto>0){
    descRow.style.display='flex';
    document.getElementById('cupom-codigo-label').textContent=gCupomCodigo;
    document.getElementById('cupom-desc-label').textContent=`− R$ ${desconto.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  } else descRow.style.display='none';

  // Parcelas
  const parcInfo=getParcelaInfo(),jurosDiv=document.getElementById('juros-info');
  let totalFinal=subtotal+gFreteValor-desconto;if(totalFinal<0)totalFinal=0;
  if(parcInfo&&parcInfo.parcelas>1&&parcInfo.juros>0){
    totalFinal=totalFinal*(1+parcInfo.juros/100);const vp=totalFinal/parcInfo.parcelas;
    jurosDiv.innerHTML=`💳 ${parcInfo.parcelas}x de R$ ${vp.toLocaleString('pt-BR',{minimumFractionDigits:2})} (${parcInfo.juros}% juros)`;jurosDiv.style.display='block';
  }else if(parcInfo&&parcInfo.parcelas>1){const vp=totalFinal/parcInfo.parcelas;jurosDiv.innerHTML=`💳 ${parcInfo.parcelas}x de R$ ${vp.toLocaleString('pt-BR',{minimumFractionDigits:2})} sem juros`;jurosDiv.style.display='block';}
  else jurosDiv.style.display='none';

  document.getElementById('total-amount').textContent=`R$ ${totalFinal.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  totalDiv.style.display='block';
}

// ═══════════════════════════════════════════════════════════════════════════════
// GERAR MENSAGEM
// ═══════════════════════════════════════════════════════════════════════════════
function gerarMensagem(){
  const ta=document.getElementById('msg-preview'),btnC=document.getElementById('btn-copy'),btnW=document.getElementById('btn-wa'),btnS=document.getElementById('btn-save'),keys=Object.keys(gCart);
  if(!keys.length){ta.value='';btnC.disabled=true;btnW.disabled=true;btnS.disabled=true;return;}
  const nome=document.getElementById('c_nome').value.trim()||'Cliente',pag=document.getElementById('c_pagamento').value,obs=document.getElementById('c_obs').value.trim();
  const isNovo=gMODO==='novo',titulo=isNovo?'NOVO PEDIDO':'PEDIDO CORRIGIDO',rodape=isNovo?'Novo pedido':'Pedido corrigido';
  const _clientName=(typeof CLIENT!=='undefined'&&CLIENT.name)?CLIENT.name:'';
  let msg=`📦 *${titulo}${_clientName?' — '+_clientName:''}*\n━━━━━━━━━━━━━━━━━━━━━━\n\n👤 *CLIENTE*\n${nome}\n\n📦 *PRODUTOS*\n`;
  let subtotal=0;
  keys.forEach(key=>{
    const parts=key.split('__'),id=parts[0],vi=parts.length>1?parseInt(parts[1]):null,p=gCATALOG.find(x=>x.id===id);if(!p)return;
    const qty=gCart[key];let price=p.price,conc=String(p.conc);if(vi!==null&&p.variantes[vi]){price=p.variantes[vi].preco;conc=p.variantes[vi].dose;}
    const sub=price*qty;subtotal+=sub;
    msg+=`• ${p.icon} ${p.name} (${conc}) — ${qty}x — R$ ${sub.toLocaleString('pt-BR',{minimumFractionDigits:2})}\n`;
  });
  msg+=`\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  // Frete
  if(gFreteValor>0)msg+=`📦 Frete (${gFreteMetodo.toUpperCase()}): R$ ${gFreteValor.toFixed(2).replace('.',',')}\n`;
  else if(gFreteMetodo==='gratis')msg+=`📦 Frete: 🎉 GRATIS\n`;
  // Cupom
  const desc=calcularDescontoCupom();
  if(gCupomAplicado&&desc>0)msg+=`🎟️ Cupom ${gCupomCodigo}: − R$ ${desc.toLocaleString('pt-BR',{minimumFractionDigits:2})}\n`;
  // Parcelas
  const pi=getParcelaInfo();let total=subtotal+gFreteValor-desc;if(total<0)total=0;
  if(pi&&pi.parcelas>1&&pi.juros>0){total=total*(1+pi.juros/100);const vp=total/pi.parcelas;msg+=`💰 *SUBTOTAL: R$ ${subtotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}*\n💳 *${pi.parcelas}x de R$ ${vp.toLocaleString('pt-BR',{minimumFractionDigits:2})}* (${pi.juros}% juros)\n💰 *TOTAL: R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}*\n`;}
  else if(pi&&pi.parcelas>1){const vp=total/pi.parcelas;msg+=`💰 *TOTAL: R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}*\n💳 ${pi.parcelas}x de R$ ${vp.toLocaleString('pt-BR',{minimumFractionDigits:2})} sem juros\n`;}
  else msg+=`💰 *TOTAL: R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}*\n`;
  if(pag)msg+=`💳 Pagamento: ${pag}\n`;
  if(obs)msg+=`\n📝 ${obs}\n`;
  msg+=`━━━━━━━━━━━━━━━━━━━━━━\n_${_clientName?_clientName+' · ':''}${rodape}_`;
  ta.value=msg;btnC.disabled=false;btnS.disabled=false;
  btnS.classList.remove('saved');btnS.innerHTML='💾 Salvar no Sheets';document.getElementById('save-status').textContent='';
  btnW.disabled=!document.getElementById('c_telefone').value.trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SALVAR PEDIDO
// ═══════════════════════════════════════════════════════════════════════════════
async function salvarPedido(){
  const keys=Object.keys(gCart);if(!keys.length)return;
  const btn=document.getElementById('btn-save'),status=document.getElementById('save-status');
  const nome=document.getElementById('c_nome').value.trim(),tel=document.getElementById('c_telefone').value.trim();
  if(!nome||!tel){status.textContent='⚠️ Preencha nome e telefone.';status.style.color='#FCA5A5';return;}
  btn.disabled=true;btn.innerHTML='⏳ Salvando...';status.textContent='';
  let prodTxt='',qtds='',subtotal=0;
  keys.forEach(key=>{const parts=key.split('__'),id=parts[0],vi=parts.length>1?parseInt(parts[1]):null,p=gCATALOG.find(x=>x.id===id);if(!p)return;
    const qty=gCart[key];let price=p.price,conc=String(p.conc);if(vi!==null&&p.variantes[vi]){price=p.variantes[vi].preco;conc=p.variantes[vi].dose;}
    subtotal+=price*qty;prodTxt+=`${qty}x ${p.name} (${conc}) = R$ ${(price*qty).toLocaleString('pt-BR',{minimumFractionDigits:2})}\n`;qtds+=`${qty},`;
  });
  const pag=document.getElementById('c_pagamento').value,pi=getParcelaInfo();
  let totalFinal=subtotal+gFreteValor;let parcVal='';
  if(pi&&pi.parcelas>1&&pi.juros>0){totalFinal=(subtotal+gFreteValor)*(1+pi.juros/100);parcVal=`${pi.parcelas}x (${pi.juros}% juros)`;}
  else if(pi&&pi.parcelas>1)parcVal=`${pi.parcelas}x sem juros`;
  const obs=document.getElementById('c_obs').value.trim(),tipo=gMODO==='novo'?'NOVO':'CORRECAO';
  const endTxt=document.getElementById('frete-endereco-txt').textContent||'';
  const params=new URLSearchParams({
    clinica:nome,responsavel:gClienteAtual?.responsavel||'',telefone:tel,
    email:gClienteAtual?.email||'',documento:gClienteAtual?.cpf||gClienteAtual?.documento||'',
    cidade:gClienteAtual?.cidade||'',estado:gClienteAtual?.estado||'',
    endereco:endTxt||gClienteAtual?.endereco||'',
    produtos:prodTxt.trim(),quantidades:qtds,total:totalFinal.toFixed(2),
    pagamento:pag,parcelas:parcVal,obs:`[${tipo}] ${obs}`.trim(),
    obs_pagamento:gFreteValor>0?`Frete ${gFreteMetodo.toUpperCase()} R$${gFreteValor.toFixed(2)}`:'',
    cupom_codigo:gCupomCodigo||'',cupom_valor:calcularDescontoCupom().toFixed(2),carrinho:JSON.stringify(gCart),
    cep:gFreteCep||'',frete_metodo:gFreteMetodo||'',frete_valor:gFreteValor>0?gFreteValor.toFixed(2):'0',
  });
  // Auth admin SEMPRE — backend salvar() exige cliente_token OU admin.
  // No painel admin nunca temos cliente_token; precisamos do email+token admin.
  if(window.App?.admin){
    params.set('email', App.admin.email);
    params.set('token', App.admin.token);
  }
  // Corrigir: atualiza linha existente em vez de criar nova
  if(gMODO==='corrigir'&&gPedidoRowId){
    params.set('action','atualizar_pedido');
    params.set('rowNum',gPedidoRowId);
  }
  try{
    const r=await fetch(`${SHEETS_URL}?${params}`);
    // Backend novo retorna JSON ({ok:true,token}). Pode também retornar string
    // 'ignored' ou 'ok' em paths legados. Tenta ambos.
    const txt = await r.text();
    let resultado;
    try { resultado = JSON.parse(txt); } catch(_) { resultado = txt; }
    const ok = typeof resultado === 'object'
      ? resultado.ok === true
      : (resultado === 'ok' || (typeof resultado === 'string' && resultado.includes('ok')));
    if(ok){btn.classList.add('saved');btn.innerHTML='✓ Salvo!';status.textContent=`✅ Pedido ${tipo==='NOVO'?'criado':'corrigido'} salvo com sucesso.`;status.style.color='#6EE7B7';}
    else{btn.disabled=false;btn.innerHTML='💾 Salvar no Sheets';status.textContent=`⚠️ ${typeof resultado==='object'?(resultado.erro||'Resposta inesperada'):'Resposta inesperada'}`;status.style.color='#FCA5A5';}
  }catch(e){btn.disabled=false;btn.innerHTML='💾 Salvar no Sheets';status.textContent='⚠️ Erro de conexao.';status.style.color='#FCA5A5';}
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACOES
// ═══════════════════════════════════════════════════════════════════════════════
async function copiarMensagem(){
  const msg=document.getElementById('msg-preview').value;if(!msg)return;
  try{await navigator.clipboard.writeText(msg);}catch(e){const ta=document.createElement('textarea');ta.value=msg;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);}
  const btn=document.getElementById('btn-copy');btn.classList.add('copied');btn.textContent='✓ Copiado!';setTimeout(()=>{btn.classList.remove('copied');btn.innerHTML='📋 Copiar';},2500);
}
function enviarWhatsApp(){
  const tel=document.getElementById('c_telefone').value.replace(/\D/g,''),msg=document.getElementById('msg-preview').value;if(!tel||!msg)return;
  const n=tel.startsWith('55')?tel:`55${tel}`;window.open(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`,'_blank');
}
function limparPedido(){
  if(!confirm('Limpar o pedido atual?'))return;gCart={};gFreteValor=0;gFreteMetodo='';
  document.getElementById('c_obs').value='';document.getElementById('c_pagamento').value='';
  document.getElementById('c_parcelas').value='1';document.getElementById('parcelas-field').classList.add('hidden');
  document.getElementById('busca_cat').value='';document.getElementById('msg-preview').value='';
  document.getElementById('f_cep').value='';document.getElementById('frete-opcoes').style.display='none';
  document.getElementById('frete-status').textContent='';document.getElementById('frete-endereco-txt').textContent='';
  document.getElementById('frete-gratis').style.display='none';
  removerCupom();
  renderCart();renderCatalogo();gerarMensagem();
}
