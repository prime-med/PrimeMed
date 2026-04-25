/**
 * ============================================================================
 *  SETUP TEMPLATE — Gera uma planilha Google Sheets em branco, já estruturada
 *  para rodar o template B2B (vindo do projeto PharmaFit).
 *
 *  Como usar:
 *    1. Abra https://script.google.com/home → Novo Projeto
 *    2. Cole TODO este arquivo no editor
 *    3. Salve e rode a função `criarPlanilhaTemplate` (primeira vez pede permissão)
 *    4. Abra a aba "Execuções" (ou veja os Logs) — a URL + SHEET_ID da nova
 *       planilha aparecem lá
 *    5. Copie o SHEET_ID e cole em `_dev/Code.gs` na constante SHEET_ID
 *
 *  Se você quiser sobrescrever uma planilha já existente (em vez de criar nova),
 *  rode `estruturarPlanilhaExistente('SHEET_ID_AQUI')` — cria abas faltantes
 *  e cabeçalhos, mas NÃO apaga dados existentes.
 * ============================================================================
 */

const TEMPLATE_NOME = 'Template B2B — Backend';

// ── ENTRYPOINTS ──────────────────────────────────────────────────────────────

function criarPlanilhaTemplate() {
  const ss = SpreadsheetApp.create(TEMPLATE_NOME);
  estruturar_(ss);
  const id  = ss.getId();
  const url = ss.getUrl();
  Logger.log('✅  Planilha criada.');
  Logger.log('    SHEET_ID: ' + id);
  Logger.log('    URL:      ' + url);
  Logger.log('    → Cole o SHEET_ID em _dev/Code.gs');
  return { id, url };
}

function estruturarPlanilhaExistente(sheetId) {
  if (!sheetId) throw new Error('Passe o SHEET_ID como argumento.');
  const ss = SpreadsheetApp.openById(sheetId);
  estruturar_(ss);
  Logger.log('✅  Estrutura aplicada à planilha: ' + ss.getUrl());
}

/**
 * Apaga as abas do template (se existirem) e recria limpas, mantendo o
 * mesmo SHEET_ID. Útil quando o schema mudou e você não quer gerar uma
 * planilha nova. ⚠ Apaga TODOS os dados das abas listadas.
 *
 * Uso: edite a constante CONFIRMAR abaixo para 'SIM' antes de rodar
 *      (proteção contra clique acidental).
 */
function resetarEstrutura(sheetId) {
  const CONFIRMAR = 'NAO';   // ← troque para 'SIM' antes de executar
  if (CONFIRMAR !== 'SIM') {
    throw new Error('Edite CONFIRMAR para "SIM" no topo de resetarEstrutura() antes de rodar.');
  }
  if (!sheetId) throw new Error('Passe o SHEET_ID como argumento.');

  const ss   = SpreadsheetApp.openById(sheetId);
  const alvo = Object.keys(SCHEMAS).map(k => k === 'Cupons_Usados' ? 'Cupons Usados' : k);

  // Cria uma aba temporária pra evitar erro "não pode apagar a única aba"
  const tmpName = '__tmp_' + Date.now();
  ss.insertSheet(tmpName);

  ss.getSheets().forEach(s => {
    if (alvo.includes(s.getName())) ss.deleteSheet(s);
  });

  estruturar_(ss);

  // Remove a aba temporária
  const tmp = ss.getSheetByName(tmpName);
  if (tmp) ss.deleteSheet(tmp);

  Logger.log('✅  Estrutura resetada na planilha: ' + ss.getUrl());
}

// ── ORQUESTRADOR ─────────────────────────────────────────────────────────────

function estruturar_(ss) {
  criarAba_(ss, 'Clientes',         SCHEMAS.Clientes);
  criarAba_(ss, 'Produtos',         SCHEMAS.Produtos);
  criarAba_(ss, 'Protocolos',       SCHEMAS.Protocolos);
  criarAba_(ss, 'Cupons',           SCHEMAS.Cupons);
  criarAba_(ss, 'Historico_Cupons', SCHEMAS.Historico_Cupons);
  criarAba_(ss, 'Cupons Usados',    SCHEMAS.Cupons_Usados);
  criarAba_(ss, 'Parcelas',         SCHEMAS.Parcelas,   SEEDS.Parcelas);
  criarAba_(ss, 'Pedidos',          SCHEMAS.Pedidos);
  criarAba_(ss, 'Vendedoras',       SCHEMAS.Vendedoras);
  criarAba_(ss, 'Admins',           SCHEMAS.Admins);

  // Remove a "Página1" / "Sheet1" padrão criada junto com a planilha
  const padroes = ['Página1', 'Pagina1', 'Sheet1'];
  ss.getSheets().forEach(s => {
    if (padroes.includes(s.getName()) && ss.getSheets().length > 1) {
      ss.deleteSheet(s);
    }
  });
}

// ── BUILDER DE ABA ───────────────────────────────────────────────────────────

function criarAba_(ss, nome, schema, seed) {
  let sheet = ss.getSheetByName(nome);
  if (!sheet) sheet = ss.insertSheet(nome);

  const headers = schema.map(c => c.nome);

  // Cabeçalho
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setFontWeight('bold')
       .setBackground('#0D2B3E')
       .setFontColor('#ffffff')
       .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  // Larguras e formatos por coluna
  schema.forEach((c, i) => {
    const col = i + 1;
    if (c.largura)    sheet.setColumnWidth(col, c.largura);
    if (c.formato)    sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setNumberFormat(c.formato);
    if (c.validacao)  sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setDataValidation(c.validacao);
  });

  // Seeds (se houver)
  if (seed && seed.length) {
    sheet.getRange(2, 1, seed.length, seed[0].length).setValues(seed);
  }

  // Remove colunas/linhas em excesso
  const maxCols = sheet.getMaxColumns();
  if (maxCols > headers.length) sheet.deleteColumns(headers.length + 1, maxCols - headers.length);
}

// ── VALIDAÇÕES REUTILIZÁVEIS ─────────────────────────────────────────────────

function vSimNao_() {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(['SIM', 'NAO'], true).setAllowInvalid(false).build();
}
function vTipoCupom_() {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(['%', 'fixo'], true).setAllowInvalid(false).build();
}
function vDestaque_() {
  // Site de venda tem duas vitrines: "destaque" e "recomendado".
  // Vazio = produto comum (não aparece em nenhuma das duas).
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(['destaque', 'recomendado'], true).setAllowInvalid(true).build();
}
function vStatusPedido_() {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(
      ['Novo', 'Pag. Confirmado', 'Processando', 'Enviado', 'Entregue', 'Cancelado'],
      true
    ).setAllowInvalid(true).build();
}
function vUF_() {
  const ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
               'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(ufs, true).setAllowInvalid(true).build();
}

// ── SCHEMAS (cada aba) ───────────────────────────────────────────────────────
// Ordem das colunas importa — bate exatamente com os índices usados em Code.gs.

const SCHEMAS = {
  // ⚠ Colunas renomeadas/removidas vs. PharmaFit original:
  //    "Clínica"     → "Nome"      (genérico — funciona pra clínica, loja, pessoa)
  //    "Responsável" → "Apelido"
  //    "Cargo"       → REMOVIDO    (todos os índices seguintes deslocam −1)
  Clientes: [
    { nome: 'Data Cadastro', largura: 140 },
    { nome: 'Nome',          largura: 220 },
    { nome: 'Apelido',       largura: 160 },
    { nome: 'Telefone',      largura: 140 },
    { nome: 'E-mail',        largura: 220 },
    { nome: 'CPF/CNPJ',      largura: 160 },
    { nome: 'Cidade',        largura: 160 },
    { nome: 'Estado',        largura: 70,  validacao: vUF_() },
    { nome: 'Endereço',      largura: 280 },
    { nome: 'Categoria',     largura: 120 },
  ],

  Produtos: [
    { nome: 'ID',              largura: 140 },
    { nome: 'Ícone',           largura: 70  },
    { nome: 'Nome',            largura: 220 },
    { nome: 'Concentração',    largura: 110 },
    { nome: 'Preço',           largura: 100, formato: 'R$ #,##0.00' },
    { nome: 'Estoque',         largura: 90,  formato: '0' },
    { nome: 'Tags',            largura: 180 },
    { nome: 'Ativo',           largura: 80,  validacao: vSimNao_() },
    { nome: 'Laboratório',     largura: 140 },
    { nome: 'Variantes',       largura: 260 },
    { nome: 'Preço Promo',     largura: 110, formato: 'R$ #,##0.00' },
    { nome: 'Início Promo',    largura: 150, formato: 'dd/MM/yyyy HH:mm' },
    { nome: 'Fim Promo',       largura: 150, formato: 'dd/MM/yyyy HH:mm' },
    { nome: '% Promo',         largura: 80,  formato: '0"%"' },
    { nome: 'Categoria',       largura: 140 },
    { nome: 'Destaque',        largura: 130, validacao: vDestaque_() },
  ],

  Protocolos: [
    { nome: 'ID Produto',     largura: 140 },
    { nome: 'Mecanismo',      largura: 300 },
    { nome: 'Reconstituição', largura: 220 },
    { nome: 'Dosagem',        largura: 220 },
    { nome: 'Protocolo 1',    largura: 260 },
    { nome: 'Protocolo 2',    largura: 260 },
    { nome: 'Protocolo 3',    largura: 260 },
    { nome: 'Cuidados',       largura: 260 },
    { nome: 'Página',         largura: 160 },
  ],

  // ⚠ Adicionado FreteGratisAtivo (SIM/NAO) entre FreteGratisAcima e Deletado.
  //   Isso desloca o índice de "Deletado" de 10 → 11 no Code.gs.
  Cupons: [
    { nome: 'Código',             largura: 120 },
    { nome: 'Vendedora',          largura: 180 },
    { nome: 'Tipo',               largura: 80,  validacao: vTipoCupom_() },
    { nome: 'Valor%',             largura: 90,  formato: '0.00' },
    { nome: 'Produtos',           largura: 220 },
    { nome: 'Preços Fixos',       largura: 220 },
    { nome: 'Validade',           largura: 140 },
    { nome: 'Criado em',          largura: 140 },
    { nome: 'Parcelamento',       largura: 120, validacao: vSimNao_() },
    { nome: 'FreteGratisAcima',   largura: 140, formato: 'R$ #,##0.00' },
    { nome: 'FreteGratisAtivo',   largura: 130, validacao: vSimNao_() },
    { nome: 'Deletado',           largura: 100, validacao: vSimNao_() },
  ],

  // Espelha Cupons + colunas de auditoria. Adicionadas Parcelamento, FreteGratisAcima,
  // FreteGratisAtivo (estavam faltando vs. Cupons) — assim o histórico não perde info.
  Historico_Cupons: [
    { nome: 'Código',             largura: 120 },
    { nome: 'Vendedora',          largura: 180 },
    { nome: 'Tipo',               largura: 80  },
    { nome: 'Valor%',             largura: 90,  formato: '0.00' },
    { nome: 'Produtos',           largura: 220 },
    { nome: 'Preços Fixos',       largura: 220 },
    { nome: 'Validade',           largura: 140 },
    { nome: 'Criado em',          largura: 140 },
    { nome: 'Parcelamento',       largura: 120, validacao: vSimNao_() },
    { nome: 'FreteGratisAcima',   largura: 140, formato: 'R$ #,##0.00' },
    { nome: 'FreteGratisAtivo',   largura: 130, validacao: vSimNao_() },
    { nome: 'Arquivado em',       largura: 140 },
  ],

  Cupons_Usados: [
    { nome: 'Data/Hora',            largura: 140 },
    { nome: 'Nº Pedido',            largura: 90  },
    { nome: 'Clínica',              largura: 220 },
    { nome: 'Responsável',          largura: 180 },
    { nome: 'Código',               largura: 120 },
    { nome: 'Desconto %',           largura: 110 },
    { nome: 'Valor Desconto (R$)',  largura: 150 },
    { nome: 'Total do Pedido (R$)', largura: 150 },
  ],

  Parcelas: [
    { nome: 'Parcelas', largura: 90,  formato: '0' },
    { nome: 'Juros',    largura: 90,  formato: '0.00"%"' },
    { nome: 'Ativo',    largura: 90,  validacao: vSimNao_() },
  ],

  // ⚠ Mesmas mudanças de Clientes:
  //    "Clínica"     → "Nome"
  //    "Responsável" → "Apelido"
  //    "Cargo"       → REMOVIDO    (índices seguintes deslocam −1)
  Pedidos: [
    { nome: 'Data/Hora',       largura: 140 },
    { nome: 'Nome',            largura: 220 },
    { nome: 'Apelido',         largura: 160 },
    { nome: 'Telefone',        largura: 140 },
    { nome: 'E-mail',          largura: 220 },
    { nome: 'Documento',       largura: 160 },
    { nome: 'Cidade',          largura: 160 },
    { nome: 'Estado',          largura: 70,  validacao: vUF_() },
    { nome: 'Endereço',        largura: 280 },
    { nome: 'Produtos',        largura: 280 },
    { nome: 'Quantidades',     largura: 140 },
    { nome: 'Total',           largura: 110, formato: 'R$ #,##0.00' },
    { nome: 'Pagamento',       largura: 140 },
    { nome: 'Parcelas',        largura: 100, formato: '0' },
    { nome: 'Obs',             largura: 240 },
    { nome: 'Obs Pagamento',   largura: 220 },
    { nome: 'Cupom Código',    largura: 140 },
    { nome: 'Cupom Valor',     largura: 120, formato: 'R$ #,##0.00' },
    { nome: 'Carrinho',        largura: 280 },
    { nome: 'Status',          largura: 140, validacao: vStatusPedido_() },
    { nome: 'Data Status',     largura: 140 },
    { nome: 'Histórico Status',largura: 260 },
    { nome: 'Peso',            largura: 90  },
    { nome: 'Dimensões',       largura: 120 },
    { nome: 'Rastreio',        largura: 160 },
    { nome: 'Data Envio',      largura: 140 },
    { nome: 'CEP',             largura: 110 },
    { nome: 'Frete Método',    largura: 140 },
    { nome: 'Frete Valor',     largura: 110, formato: 'R$ #,##0.00' },
    { nome: '(reserva)',       largura: 80  },
    { nome: 'Nota Interna',    largura: 260 },
  ],

  Vendedoras: [
    { nome: 'Email',     largura: 220 },
    { nome: 'Senha',     largura: 200 },
    { nome: 'Nome',      largura: 180 },
    { nome: 'DataNasc',  largura: 120 },
    { nome: 'CriadoEm',  largura: 140 },
  ],

  Admins: [
    { nome: 'Email',     largura: 220 },
    { nome: 'Senha',     largura: 200 },
    { nome: 'Nome',      largura: 180 },
    { nome: 'Cargo',     largura: 140 },
    { nome: 'CriadoEm',  largura: 140 },
  ],
};

// ── SEEDS (apenas onde faz sentido já vir preenchido) ────────────────────────

const SEEDS = {
  // Parcelas: 1x à vista sem juros + 2x/3x sem juros ativos por padrão.
  // Ajuste conforme a política do cliente final.
  Parcelas: [
    [1, 0, 'SIM'],
    [2, 0, 'SIM'],
    [3, 0, 'SIM'],
    [4, 0, 'NAO'],
    [5, 0, 'NAO'],
    [6, 0, 'NAO'],
    [10, 0, 'NAO'],
    [12, 0, 'NAO'],
  ],
};
