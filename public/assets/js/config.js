/**
 * config.js — Configuração do cliente
 * ============================================================================
 * Edite o objeto CLIENT abaixo com os dados do seu cliente final.
 * Tudo que aparece na UI (nome, número de WhatsApp, logo) puxa daqui.
 *
 * SHEETS_URL é injetado em deploy pelo GitHub Actions a partir do secret
 * `SHEETS_URL` do repositório. Em desenvolvimento local, edite o arquivo
 * `assets/js/config.js` (gitignored) com a URL real do Web App do GAS.
 * ============================================================================
 */

const CLIENT = {
  name:    'Sua Empresa',           // Nome curto exibido em títulos e logo (fallback)
  tagline: 'Catálogo B2B',          // Subtítulo / descrição em meta tags
  wa:      '',                      // WhatsApp do cliente — só dígitos, ex: '5511999999999'
  logo:    'assets/img/logo.svg',   // Caminho do logo (SVG/PNG — relativo a /public)
  ogImage: 'assets/img/og-image.svg', // Imagem de preview em redes sociais
  baseUrl: '',                      // Ex: 'https://meu-cliente.github.io/repo' (vazio = relativo)
};

const SHEETS_URL = '%%SHEETS_URL%%';
const WA_NUMBER  = CLIENT.wa;
