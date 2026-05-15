/**
 * client_render.js — Renderização dinâmica de marca/contato
 * ============================================================================
 * Popula elementos com `data-client-name` usando CLIENT.name (de config.js)
 * e configura links com `data-wa-link` apontando para CLIENT.wa.
 *
 * Uso (no HTML, após carregar config.js):
 *   <span data-client-name></span>
 *   <a data-wa-link data-wa-text="Olá! Tenho interesse no catálogo.">WhatsApp</a>
 *
 * Se CLIENT.wa estiver vazio, links com [data-wa-link] são ocultados.
 * ============================================================================
 */
(function () {
  function render() {
    // Nome do cliente
    document.querySelectorAll('[data-client-name]').forEach(function (el) {
      el.textContent = (typeof CLIENT !== 'undefined' && CLIENT.name) ? CLIENT.name : '';
    });

    // Links de WhatsApp
    var wa = (typeof CLIENT !== 'undefined' && CLIENT.wa) ? CLIENT.wa : '';
    document.querySelectorAll('[data-wa-link]').forEach(function (el) {
      var t = el.dataset.waText || '';
      if (wa) {
        el.href = 'https://wa.me/' + wa + (t ? '?text=' + encodeURIComponent(t) : '');
      } else {
        el.href = '#';
        el.style.display = 'none';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
