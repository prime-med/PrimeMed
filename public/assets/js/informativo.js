/**
 * informativo.js — Substitui placeholders dos informativos pelo nome do cliente
 * Lê CLIENT.name de config.js (que precisa ser carregado ANTES deste script).
 * Operações:
 *   - "Sua Empresa" / "SUA EMPRESA" → CLIENT.name (em texto, alt, title)
 *   - "-PY" / "-Py" / "<span>-PY</span>" → removido
 */
(function() {
  var clientName = (typeof CLIENT !== 'undefined' && CLIENT && CLIENT.name)
    ? CLIENT.name
    : 'Sua Empresa';

  function fixText(text) {
    return text
      .split('Sua Empresa').join(clientName)
      .split('SUA EMPRESA').join(clientName.toUpperCase())
      .replace(/-Py\b/gi, '')
      .replace(/—\s*$/, '')
      .replace(/\s{2,}/g, ' ');
  }

  // Title
  if (document.title) document.title = fixText(document.title);

  // Atributos alt das imagens
  document.querySelectorAll('img[alt]').forEach(function(img) {
    img.alt = fixText(img.alt);
  });

  // Remove spans que ficam vazios na .brand-name (o <span>-PY</span> hardcoded)
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
    if (v && (v.indexOf('Sua Empresa') !== -1 || v.indexOf('SUA EMPRESA') !== -1 || v.indexOf('-Py') !== -1 || v.indexOf('-PY') !== -1)) {
      n.nodeValue = fixText(v);
    }
  });
})();
