/**
 * informativo.js — Substitui placeholders pelo nome/tagline do cliente.
 * Usado em informativos E nas páginas principais (index, pedido, perfil, etc).
 * Lê CLIENT.name e CLIENT.tagline de config.js (precisa carregar ANTES).
 *
 * Operações:
 *   - "Sua Empresa" / "SUA EMPRESA"  → CLIENT.name (em texto, alt, title, meta)
 *   - "Catálogo B2B"                 → CLIENT.tagline (idem)
 *   - "-PY" / "-Py" / "<span>-PY</span>" → removido
 *   - Atributo data-client-name      → CLIENT.name (substitui textContent)
 *   - Atributo data-client-tagline   → CLIENT.tagline (idem)
 */
(function() {
  var c = (typeof CLIENT !== 'undefined' && CLIENT) ? CLIENT : {};
  var clientName = c.name    || 'Sua Empresa';
  var tagline    = c.tagline || 'Catálogo B2B';

  function fixText(text) {
    return text
      .split('Sua Empresa').join(clientName)
      .split('SUA EMPRESA').join(clientName.toUpperCase())
      .split('Catálogo B2B').join(tagline)
      .replace(/-Py\b/gi, '')
      .replace(/\s{2,}/g, ' ');
  }

  // Title
  if (document.title) document.title = fixText(document.title);

  // Meta tags (og:title, twitter:title, description)
  document.querySelectorAll('meta[content]').forEach(function(m) {
    var ct = m.getAttribute('content');
    if (ct && (ct.indexOf('Sua Empresa') !== -1 || ct.indexOf('Catálogo B2B') !== -1)) {
      m.setAttribute('content', fixText(ct));
    }
  });

  // Atributos alt das imagens
  document.querySelectorAll('img[alt]').forEach(function(img) {
    img.alt = fixText(img.alt);
  });

  // Atributos data-client-name / data-client-tagline (jeito mais explícito)
  document.querySelectorAll('[data-client-name]').forEach(function(el) {
    el.textContent = clientName;
  });
  document.querySelectorAll('[data-client-tagline]').forEach(function(el) {
    el.textContent = tagline;
  });

  // Remove spans vazios na .brand-name (o <span>-PY</span> hardcoded)
  document.querySelectorAll('.brand-name span').forEach(function(s) {
    var t = s.textContent.trim();
    if (/^-?Py$/i.test(t) || /^-?P[Yy]$/.test(t) || t === '') s.remove();
  });

  // Text nodes do body
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  var nodes = [];
  var n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach(function(n) {
    var v = n.nodeValue;
    if (v && (v.indexOf('Sua Empresa') !== -1 || v.indexOf('SUA EMPRESA') !== -1 || v.indexOf('Catálogo B2B') !== -1 || v.indexOf('-Py') !== -1 || v.indexOf('-PY') !== -1)) {
      n.nodeValue = fixText(v);
    }
  });
})();
