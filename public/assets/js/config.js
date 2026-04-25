/**
 * config.js — Configuração do cliente final
 * ============================================================================
 *
 * Esse é o ÚNICO arquivo que você edita pra adaptar o template a um novo
 * cliente. Tudo que aparece na UI (nome, número de WhatsApp, logo, imagem
 * de preview em redes sociais) vem daqui.
 *
 * ─── Setup completo do template (ordem) ─────────────────────────────────────
 *
 *   1. Edite o objeto CLIENT abaixo (este arquivo)
 *   2. Substitua os arquivos de imagem:
 *        public/assets/img/logo.svg      ← logo do cliente
 *        public/assets/img/og-image.svg  ← imagem de preview WhatsApp/Facebook
 *      (Pode usar PNG/JPG; ajuste a extensão em CLIENT.logo / CLIENT.ogImage)
 *   3. Configure o backend (Google Apps Script):
 *        Menu Extensões → Apps Script
 *        Cole o conteúdo de _dev/Code.gs no editor
 *        ⚙️ Project Settings → Script Properties:
 *           SHEET_ID       = ID da planilha (URL: docs.google.com/.../d/<ID>/edit)
 *           CUPOM_PIN      = pin curto pro fluxo de cupom (ex: 5689)
 *           ADMIN_SECRET   = string aleatória ~32 chars
 *           PASSWORD_SALT  = outra string aleatória ~32 chars (DIFERENTE)
 *        Deploy → New deployment → Web app:
 *           Execute as: Me
 *           Who has access: Anyone
 *        Copie a URL `/exec` que sair
 *   4. No GitHub do repo deste template:
 *        Settings → Secrets and variables → Actions → New repository secret
 *        Name: SHEETS_URL · Value: a URL `/exec` do passo 3
 *   5. Push em `main` → workflow `.github/workflows/deploy.yml` injeta
 *      automaticamente a URL e publica no GitHub Pages
 *
 * ─── Em desenvolvimento local ───────────────────────────────────────────────
 *
 *   Para rodar local antes de publicar, edite a constante SHEETS_URL abaixo
 *   substituindo `'%%SHEETS_URL%%'` pela URL real do `/exec`. Lembre-se de
 *   reverter pro placeholder antes de commitar (ou use `git checkout` neste
 *   arquivo). O workflow do GitHub Actions só substitui se encontrar o
 *   placeholder literal.
 *
 * ─── Cadastrar primeiro admin ───────────────────────────────────────────────
 *
 *   Após o deploy do backend, o primeiro admin precisa ser criado por URL:
 *
 *     URL/exec?action=cadastrar_admin&pin=<SEU_CUPOM_PIN>&email=admin@x.com
 *           &senha=senha_forte&nome=Admin&cargo=admin
 *
 *   Daí em diante, login pela UI em /admin/.
 * ============================================================================
 */

const CLIENT = {
  name:    'Sua Empresa',           // Nome curto, exibido em títulos e logo (fallback)
  tagline: 'Catálogo B2B',          // Subtítulo / descrição em meta tags
  wa:      '',                      // WhatsApp do cliente — só dígitos com código país, ex: '5511999999999'
  logo:    'assets/img/logo.svg',   // Caminho do logo (SVG/PNG — relativo a /public)
  ogImage: 'assets/img/og-image.svg', // Imagem de preview em redes sociais (1200x630 ideal)
  baseUrl: '',                      // URL base do site, ex: 'https://meu-cliente.github.io/repo' (vazio = relativo)
};

const SHEETS_URL = '%%SHEETS_URL%%';
const WA_NUMBER  = CLIENT.wa;       // alias retrocompatível
