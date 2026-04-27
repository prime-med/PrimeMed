/**
 * cliente_auth.js — Autenticação compartilhada de cliente final B2B
 * ============================================================================
 *
 * Módulo standalone (sem dependências externas além de SHEETS_URL/CLIENT
 * vindos de config.js). Responsável por:
 *
 *   - Armazenar e ler a sessão do cliente em localStorage (chave 'lp_cliente')
 *   - POST helper para o backend (Apps Script)
 *   - Renderizar o botão "Minha Conta / Entrar" no header
 *   - Modal full-feature de Login / Cadastro / Esqueci minha senha
 *   - Auto-preencher endereço por CEP (ViaCEP) no formulário de cadastro
 *
 * Carregar APÓS config.js. Não depende de jQuery nem de outros módulos.
 * ============================================================================
 */

(function (global) {
  'use strict';

  // ─── ESCAPE HTML ────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  // ─── SESSÃO ────────────────────────────────────────────────────────────────
  const STORAGE_KEY = 'lp_cliente';

  function getClienteSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.token) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function setClienteSession(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {}));
    } catch (e) { /* ignore */ }
  }

  function clearClienteSession() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  async function clienteLogout() {
    const sess = getClienteSession();
    clearClienteSession();
    if (sess && sess.token) {
      try { await cliPost_('logout_cliente', { token: sess.token }); } catch (e) {}
    }
    // re-render header buttons
    document.querySelectorAll('[data-cli-header-btn]').forEach(el => {
      _renderInto(el);
    });
  }

  // ─── POST HELPER ────────────────────────────────────────────────────────────
  async function cliPost_(action, paramsObj) {
    const url  = (typeof SHEETS_URL !== 'undefined' && SHEETS_URL) ? SHEETS_URL : '';
    const body = new URLSearchParams();
    body.append('action', action);
    for (const [k, v] of Object.entries(paramsObj || {})) {
      if (v !== undefined && v !== null) body.append(k, v);
    }
    const r = await fetch(url, { method: 'POST', body });
    return r.json();
  }

  // ─── HEADER BUTTON ──────────────────────────────────────────────────────────
  function renderClienteHeaderBtn(targetSelector) {
    const targets = (typeof targetSelector === 'string')
      ? document.querySelectorAll(targetSelector)
      : (targetSelector && targetSelector.length !== undefined ? targetSelector : [targetSelector]);
    Array.from(targets).forEach(el => { if (el) _renderInto(el); });
  }

  function _renderInto(el) {
    if (!el) return;
    el.setAttribute('data-cli-header-btn', '1');
    const sess = getClienteSession();
    if (sess) {
      const display = sess.apelido || sess.nome || sess.email || 'Minha Conta';
      const initial = (display || '?').trim().charAt(0).toUpperCase();
      el.innerHTML = `
        <div class="cli-hbtn cli-hbtn-logged" title="${_esc(display)}">
          <a href="perfil.html" class="cli-hbtn-link">
            <span class="cli-hbtn-avatar">${_esc(initial)}</span>
            <span class="cli-hbtn-name">${_esc(display)}</span>
          </a>
          <button type="button" class="cli-hbtn-logout" title="Sair" data-cli-logout>Sair</button>
        </div>`;
      const logoutBtn = el.querySelector('[data-cli-logout]');
      if (logoutBtn) logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await clienteLogout();
      });
    } else {
      el.innerHTML = `
        <button type="button" class="cli-hbtn cli-hbtn-anon" data-cli-open-login>
          <span class="cli-hbtn-icon">👤</span>
          <span class="cli-hbtn-name">Entrar</span>
        </button>`;
      const btn = el.querySelector('[data-cli-open-login]');
      if (btn) btn.addEventListener('click', () => abrirModalLogin('login'));
    }
  }

  // ─── MODAL ──────────────────────────────────────────────────────────────────
  let _modalEl  = null;
  let _onSuccess = null;

  function _ensureModal() {
    if (_modalEl) return _modalEl;
    const wrap = document.createElement('div');
    wrap.className = 'cli-modal-overlay';
    wrap.id = 'cli-modal-overlay';
    wrap.innerHTML = `
      <div class="cli-modal" role="dialog" aria-modal="true">
        <button type="button" class="cli-modal-close" data-cli-close aria-label="Fechar">✕</button>

        <div class="cli-modal-tabs">
          <button type="button" class="cli-tab" data-cli-tab="login">Entrar</button>
          <button type="button" class="cli-tab" data-cli-tab="cadastro">Criar conta</button>
          <button type="button" class="cli-tab" data-cli-tab="esqueci">Esqueci a senha</button>
          <button type="button" class="cli-tab" data-cli-tab="primeiro">Primeiro acesso</button>
        </div>

        <!-- ── LOGIN ── -->
        <form class="cli-form" data-cli-form="login" autocomplete="on">
          <h2 class="cli-form-title">Acesse sua conta</h2>
          <div class="cli-field">
            <label>E-mail</label>
            <input type="email" name="email" autocomplete="email" required/>
          </div>
          <div class="cli-field">
            <label>Senha</label>
            <input type="password" name="senha" autocomplete="current-password" required/>
          </div>
          <div class="cli-msg" data-cli-msg></div>
          <button type="submit" class="cli-btn-cta">Entrar →</button>
          <div class="cli-form-foot">
            <a href="#" data-cli-go="cadastro">Criar conta</a>
            <span class="cli-sep">·</span>
            <a href="#" data-cli-go="esqueci">Esqueci a senha</a>
            <span class="cli-sep">·</span>
            <a href="#" data-cli-go="primeiro">Primeiro acesso</a>
          </div>
        </form>

        <!-- ── CADASTRO ── -->
        <form class="cli-form" data-cli-form="cadastro" autocomplete="on">
          <h2 class="cli-form-title">Crie sua conta</h2>
          <div class="cli-grid">
            <div class="cli-field full">
              <label>Nome / Empresa <span class="req">*</span></label>
              <input type="text" name="clinica" required/>
            </div>
            <div class="cli-field">
              <label>Apelido / Responsável <span class="req">*</span></label>
              <input type="text" name="apelido" required/>
            </div>
            <div class="cli-field">
              <label>Telefone (com DDD) <span class="req">*</span></label>
              <input type="tel" name="telefone" placeholder="+55 (11) 99999-9999" required/>
            </div>
            <div class="cli-field">
              <label>E-mail <span class="req">*</span></label>
              <input type="email" name="email" autocomplete="email" required/>
            </div>
            <div class="cli-field">
              <label>CPF / CNPJ</label>
              <input type="text" name="cpf" placeholder="Opcional"/>
            </div>
            <div class="cli-field">
              <label>CEP</label>
              <input type="text" name="cep" maxlength="9" placeholder="00000-000" data-cli-cep/>
              <div class="cli-cep-loading" data-cli-cep-loading>⏳ Buscando endereço...</div>
            </div>
            <div class="cli-field">
              <label>Rua / Logradouro</label>
              <input type="text" name="rua"/>
            </div>
            <div class="cli-field">
              <label>Número</label>
              <input type="text" name="numero"/>
            </div>
            <div class="cli-field">
              <label>Bairro</label>
              <input type="text" name="bairro"/>
            </div>
            <div class="cli-field">
              <label>Complemento</label>
              <input type="text" name="complemento"/>
            </div>
            <div class="cli-field">
              <label>Cidade</label>
              <input type="text" name="cidade"/>
            </div>
            <div class="cli-field">
              <label>Estado</label>
              <input type="text" name="estado" list="cli-ufs-list" maxlength="2" placeholder="Digite ou selecione" autocomplete="off"/>
              <datalist id="cli-ufs-list">
                <option value="AC"/><option value="AL"/><option value="AP"/><option value="AM"/>
                <option value="BA"/><option value="CE"/><option value="DF"/><option value="ES"/>
                <option value="GO"/><option value="MA"/><option value="MT"/><option value="MS"/>
                <option value="MG"/><option value="PA"/><option value="PB"/><option value="PR"/>
                <option value="PE"/><option value="PI"/><option value="RJ"/><option value="RN"/>
                <option value="RS"/><option value="RO"/><option value="RR"/><option value="SC"/>
                <option value="SP"/><option value="SE"/><option value="TO"/>
              </datalist>
            </div>
            <div class="cli-field">
              <label>Data de Nascimento <span class="req">*</span></label>
              <input type="date" name="data_nasc" required/>
            </div>
            <div class="cli-field">
              <label>Senha (mín 6) <span class="req">*</span></label>
              <input type="password" name="senha" autocomplete="new-password" required minlength="6"/>
            </div>
            <div class="cli-field">
              <label>Confirmar Senha <span class="req">*</span></label>
              <input type="password" name="senha_conf" autocomplete="new-password" required minlength="6"/>
            </div>
          </div>
          <div class="cli-msg" data-cli-msg></div>
          <button type="submit" class="cli-btn-cta">Criar Conta</button>
          <div class="cli-form-foot">
            <a href="#" data-cli-go="login">Já tenho conta — entrar</a>
          </div>
        </form>

        <!-- ── ESQUECI SENHA ── -->
        <form class="cli-form" data-cli-form="esqueci" autocomplete="off">
          <h2 class="cli-form-title">Recuperar senha</h2>
          <p class="cli-form-sub">Informe e-mail, CPF/CNPJ e data de nascimento pra confirmar sua identidade.</p>
          <div class="cli-field">
            <label>E-mail</label>
            <input type="email" name="email" required/>
          </div>
          <div class="cli-field">
            <label>CPF / CNPJ</label>
            <input type="text" name="documento" inputmode="numeric" placeholder="Apenas números" required/>
          </div>
          <div class="cli-field">
            <label>Data de Nascimento</label>
            <input type="date" name="data_nasc" required/>
          </div>
          <div class="cli-field">
            <label>Nova Senha (mín 6)</label>
            <input type="password" name="nova_senha" minlength="6" required/>
          </div>
          <div class="cli-field">
            <label>Confirmar Nova Senha</label>
            <input type="password" name="nova_senha_conf" minlength="6" required/>
          </div>
          <div class="cli-msg" data-cli-msg></div>
          <button type="submit" class="cli-btn-cta">Redefinir Senha</button>
          <div class="cli-form-foot">
            <a href="#" data-cli-go="login">← Voltar para o login</a>
          </div>
        </form>

        <!-- ── PRIMEIRO ACESSO ── -->
        <form class="cli-form" data-cli-form="primeiro" autocomplete="off">
          <h2 class="cli-form-title">Primeiro acesso</h2>
          <p class="cli-form-sub">Já é nosso cliente mas nunca acessou o site? Defina sua senha aqui. Validamos pelo seu CPF/CNPJ.</p>
          <div class="cli-field">
            <label>E-mail cadastrado</label>
            <input type="email" name="email" required/>
          </div>
          <div class="cli-field">
            <label>CPF / CNPJ</label>
            <input type="text" name="documento" inputmode="numeric" placeholder="Apenas números" required/>
          </div>
          <div class="cli-field">
            <label>Data de Nascimento</label>
            <input type="date" name="data_nasc" required/>
          </div>
          <div class="cli-field">
            <label>Defina sua Senha (mín 6)</label>
            <input type="password" name="nova_senha" minlength="6" required/>
          </div>
          <div class="cli-field">
            <label>Confirmar Senha</label>
            <input type="password" name="nova_senha_conf" minlength="6" required/>
          </div>
          <div class="cli-msg" data-cli-msg></div>
          <button type="submit" class="cli-btn-cta">Definir Senha e Entrar</button>
          <div class="cli-form-foot">
            <a href="#" data-cli-go="login">← Já tenho senha — entrar</a>
          </div>
        </form>

      </div>`;
    document.body.appendChild(wrap);

    // Listeners
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) fecharModalLogin();
    });
    wrap.querySelectorAll('[data-cli-close]').forEach(b => b.addEventListener('click', fecharModalLogin));
    wrap.querySelectorAll('[data-cli-tab]').forEach(b => {
      b.addEventListener('click', () => _showMode(b.getAttribute('data-cli-tab')));
    });
    wrap.querySelectorAll('[data-cli-go]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        _showMode(a.getAttribute('data-cli-go'));
      });
    });

    // CEP auto-fill (cadastro)
    const cepInp = wrap.querySelector('[data-cli-cep]');
    if (cepInp) {
      cepInp.addEventListener('input', () => {
        cepInp.value = cepInp.value.replace(/\D/g,'').replace(/^(\d{5})(\d)/,'$1-$2');
        const digits = cepInp.value.replace(/\D/g,'');
        if (digits.length === 8) _preencherCEP(digits);
      });
    }

    // Submit handlers
    const fLogin = wrap.querySelector('[data-cli-form="login"]');
    fLogin.addEventListener('submit', (e) => { e.preventDefault(); _doLogin(fLogin); });

    const fReg = wrap.querySelector('[data-cli-form="cadastro"]');
    fReg.addEventListener('submit', (e) => { e.preventDefault(); _doCadastro(fReg); });

    const fEsq = wrap.querySelector('[data-cli-form="esqueci"]');
    fEsq.addEventListener('submit', (e) => { e.preventDefault(); _doEsqueci(fEsq); });

    const fPri = wrap.querySelector('[data-cli-form="primeiro"]');
    fPri.addEventListener('submit', (e) => { e.preventDefault(); _doPrimeiroAcesso(fPri); });

    _modalEl = wrap;
    return wrap;
  }

  function _showMode(modo) {
    if (!_modalEl) return;
    _modalEl.querySelectorAll('[data-cli-tab]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-cli-tab') === modo);
    });
    _modalEl.querySelectorAll('[data-cli-form]').forEach(f => {
      f.style.display = (f.getAttribute('data-cli-form') === modo) ? 'block' : 'none';
    });
    _modalEl.querySelectorAll('[data-cli-msg]').forEach(m => { m.textContent = ''; m.className = 'cli-msg'; });
  }

  function abrirModalLogin(modo, onSuccess) {
    _onSuccess = (typeof onSuccess === 'function') ? onSuccess : null;
    _ensureModal();
    _showMode(modo || 'login');
    _modalEl.classList.add('show');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const first = _modalEl.querySelector('[data-cli-form="' + (modo || 'login') + '"] input');
      if (first) first.focus();
    }, 80);
  }

  function fecharModalLogin() {
    if (!_modalEl) return;
    _modalEl.classList.remove('show');
    document.body.style.overflow = '';
  }

  // ─── CEP / VIACEP ───────────────────────────────────────────────────────────
  async function _preencherCEP(cep) {
    const loading = _modalEl.querySelector('[data-cli-cep-loading]');
    if (loading) loading.style.display = 'block';
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (loading) loading.style.display = 'none';
      if (!d || d.erro) return;
      const set = (n, v) => {
        const el = _modalEl.querySelector(`[data-cli-form="cadastro"] [name="${n}"]`);
        if (el && v && !el.value) el.value = v;
      };
      set('rua',    d.logradouro);
      set('bairro', d.bairro);
      set('cidade', d.localidade);
      set('estado', d.uf);
      const numEl = _modalEl.querySelector('[data-cli-form="cadastro"] [name="numero"]');
      if (numEl) numEl.focus();
    } catch (e) {
      if (loading) loading.style.display = 'none';
    }
  }

  // ─── HANDLERS ───────────────────────────────────────────────────────────────
  function _setMsg(form, text, kind) {
    const m = form.querySelector('[data-cli-msg]');
    if (!m) return;
    m.textContent = text || '';
    m.className = 'cli-msg' + (kind ? ' cli-msg-' + kind : '');
  }

  function _setBusy(form, busy, label) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = !!busy;
    if (busy) {
      btn.dataset._orig = btn.dataset._orig || btn.textContent;
      btn.textContent = label || 'Aguarde…';
    } else if (btn.dataset._orig) {
      btn.textContent = btn.dataset._orig;
    }
  }

  function _composeEndereco(d) {
    const parts = [d.rua, d.numero, d.complemento, d.bairro, d.cep].filter(Boolean);
    return parts.join(', ');
  }

  async function _doLogin(form) {
    const fd    = new FormData(form);
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const senha = String(fd.get('senha') || '').trim();
    if (!email || !senha) { _setMsg(form, 'Preencha e-mail e senha.', 'err'); return; }
    if (!email.includes('@')) { _setMsg(form, 'E-mail inválido.', 'err'); return; }
    _setMsg(form, '');
    _setBusy(form, true, 'Verificando…');
    try {
      const data = await cliPost_('login_cliente', { email, senha });
      if (data && data.ok) {
        const sess = Object.assign({ email, token: data.token }, data.cliente || {});
        setClienteSession(sess);
        _setMsg(form, '✅ Bem-vindo!', 'ok');
        setTimeout(() => {
          fecharModalLogin();
          document.querySelectorAll('[data-cli-header-btn]').forEach(el => _renderInto(el));
          if (_onSuccess) _onSuccess(sess);
          _onSuccess = null;
        }, 350);
      } else {
        _setMsg(form, (data && data.erro) || 'E-mail ou senha incorretos.', 'err');
      }
    } catch (e) {
      _setMsg(form, '⚠️ Erro de conexão. Tente novamente.', 'err');
    } finally {
      _setBusy(form, false);
    }
  }

  async function _doCadastro(form) {
    const fd = new FormData(form);
    const get = (n) => String(fd.get(n) || '').trim();
    const clinica    = get('clinica');
    const apelido    = get('apelido');
    const telefone   = get('telefone');
    const email      = get('email').toLowerCase();
    const cpf        = get('cpf').replace(/\D/g,'');
    const cep        = get('cep');
    const rua        = get('rua');
    const numero     = get('numero');
    const bairro     = get('bairro');
    const complemento = get('complemento');
    const cidade     = get('cidade');
    const estado     = get('estado').toUpperCase();
    const dataNasc   = get('data_nasc');
    const senha      = get('senha');
    const senhaConf  = get('senha_conf');

    if (!clinica || !apelido || !telefone || !email || !dataNasc || !senha || !senhaConf) {
      _setMsg(form, 'Preencha todos os campos obrigatórios.', 'err'); return;
    }
    if (!email.includes('@') || !email.includes('.')) { _setMsg(form, 'E-mail inválido.', 'err'); return; }
    if (senha.length < 6)      { _setMsg(form, 'Senha deve ter ao menos 6 caracteres.', 'err'); return; }
    if (senha !== senhaConf)   { _setMsg(form, 'As senhas não coincidem.', 'err'); return; }

    const endereco = _composeEndereco({ rua, numero, complemento, bairro, cep });

    _setMsg(form, '');
    _setBusy(form, true, 'Criando conta…');
    try {
      const data = await cliPost_('cadastrar', {
        clinica, responsavel: apelido, apelido,
        telefone, email, cpf,
        cidade, estado, endereco,
        senha, data_nasc: dataNasc,
      });
      if (data && data.ok) {
        const sess = Object.assign({ email, token: data.token }, data.cliente || {
          nome: clinica, apelido, telefone, cpf, cidade, estado, endereco,
        });
        setClienteSession(sess);
        _setMsg(form, '✅ Conta criada com sucesso!', 'ok');
        setTimeout(() => {
          fecharModalLogin();
          document.querySelectorAll('[data-cli-header-btn]').forEach(el => _renderInto(el));
          if (_onSuccess) _onSuccess(sess);
          _onSuccess = null;
        }, 400);
      } else {
        const msgs = {
          email:    'Este e-mail já está cadastrado.',
          cpf:      'Este CPF/CNPJ já está cadastrado.',
          telefone: 'Este telefone já está cadastrado.',
        };
        const m = (data && data.duplicado && msgs[data.duplicado])
          || (data && data.erro)
          || 'Erro ao criar conta.';
        _setMsg(form, '⚠️ ' + m, 'err');
      }
    } catch (e) {
      _setMsg(form, '⚠️ Erro de conexão.', 'err');
    } finally {
      _setBusy(form, false);
    }
  }

  async function _doEsqueci(form) {
    const fd        = new FormData(form);
    const email     = String(fd.get('email') || '').trim().toLowerCase();
    const documento = String(fd.get('documento') || '').replace(/\D/g,'');
    const dataNasc  = String(fd.get('data_nasc') || '').trim();
    const nova      = String(fd.get('nova_senha') || '').trim();
    const conf      = String(fd.get('nova_senha_conf') || '').trim();
    if (!email || !documento || !dataNasc || !nova || !conf) { _setMsg(form, 'Preencha todos os campos.', 'err'); return; }
    if (nova.length < 6) { _setMsg(form, 'Senha deve ter ao menos 6 caracteres.', 'err'); return; }
    if (nova !== conf)   { _setMsg(form, 'As senhas não coincidem.', 'err'); return; }
    _setMsg(form, '');
    _setBusy(form, true, 'Redefinindo…');
    try {
      const data = await cliPost_('recuperar_senha_cliente', { email, documento, data_nasc: dataNasc, nova_senha: nova });
      if (data && data.ok) {
        _setMsg(form, '✅ Senha redefinida! Faça login com a nova senha.', 'ok');
        setTimeout(() => _showMode('login'), 1600);
      } else {
        _setMsg(form, '⚠️ ' + ((data && data.erro) || 'Não foi possível redefinir. Verifique os dados.'), 'err');
      }
    } catch (e) {
      _setMsg(form, '⚠️ Erro de conexão.', 'err');
    } finally {
      _setBusy(form, false);
    }
  }

  async function _doPrimeiroAcesso(form) {
    const fd        = new FormData(form);
    const email     = String(fd.get('email') || '').trim().toLowerCase();
    const documento = String(fd.get('documento') || '').replace(/\D/g,'');
    const dataNasc  = String(fd.get('data_nasc') || '').trim();
    const nova      = String(fd.get('nova_senha') || '').trim();
    const conf      = String(fd.get('nova_senha_conf') || '').trim();
    if (!email || !documento || !dataNasc || !nova || !conf) { _setMsg(form, 'Preencha todos os campos.', 'err'); return; }
    if (nova.length < 6) { _setMsg(form, 'Senha deve ter ao menos 6 caracteres.', 'err'); return; }
    if (nova !== conf)   { _setMsg(form, 'As senhas não coincidem.', 'err'); return; }
    _setMsg(form, '');
    _setBusy(form, true, 'Criando acesso…');
    try {
      const data = await cliPost_('primeiro_acesso_cliente', { email, documento, data_nasc: dataNasc, nova_senha: nova });
      if (data && data.ok) {
        const sess = Object.assign({ email, token: data.token }, data.cliente || {});
        setClienteSession(sess);
        _setMsg(form, '✅ Acesso criado! Bem-vindo.', 'ok');
        setTimeout(() => {
          fecharModalLogin();
          document.querySelectorAll('[data-cli-header-btn]').forEach(el => _renderInto(el));
          if (_onSuccess) _onSuccess(sess);
          _onSuccess = null;
        }, 400);
      } else {
        _setMsg(form, '⚠️ ' + ((data && data.erro) || 'Não foi possível concluir.'), 'err');
      }
    } catch (e) {
      _setMsg(form, '⚠️ Erro de conexão.', 'err');
    } finally {
      _setBusy(form, false);
    }
  }

  // ─── EXPORT ─────────────────────────────────────────────────────────────────
  global.getClienteSession      = getClienteSession;
  global.setClienteSession      = setClienteSession;
  global.clearClienteSession    = clearClienteSession;
  global.clienteLogout          = clienteLogout;
  global.cliPost_               = cliPost_;
  global.renderClienteHeaderBtn = renderClienteHeaderBtn;
  global.abrirModalLogin        = abrirModalLogin;
  global.fecharModalLogin       = fecharModalLogin;

})(window);
