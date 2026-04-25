# Setup — Planilha Template B2B

Script para gerar uma planilha Google Sheets em branco, já com a estrutura exata que o backend (`_dev/Code.gs`) espera.

## Passos

1. Abra <https://script.google.com> → **Novo projeto**
2. No editor, apague o `Code.gs` em branco e cole o conteúdo de `setup_template.gs`
3. Salve o projeto (pode dar um nome qualquer, ex: "Setup Template B2B")
4. Na barra de funções, selecione **`criarPlanilhaTemplate`** e clique em **Executar**
5. Autorize os escopos quando o Google pedir (primeira vez apenas)
6. Após rodar, abra **Ver → Registros** (ou **View → Execution log**). Você verá:
   ```
   ✅ Planilha criada.
       SHEET_ID: <id-gerado>
       URL:      <url>
   ```
7. Copie o `SHEET_ID` e cole em `_dev/Code.gs` na primeira linha:
   ```js
   const SHEET_ID = '<id-gerado>';
   ```

## Abas geradas

| Aba | Colunas | Observação |
|---|---|---|
| `Clientes` | 10 | Sem `Cargo`. `Nome` (entidade) + `Apelido` |
| `Produtos` | 16 | `Destaque` agora é dropdown `destaque` / `recomendado` |
| `Protocolos` | 9 | Conteúdo livre por produto |
| `Cupons` | 12 | `FreteGratisAtivo` (SIM/NAO) novo, separado do valor |
| `Historico_Cupons` | 12 | Espelha Cupons (antes faltavam Parcelamento e Frete) |
| `Cupons Usados` | 8 | Auditoria de uso |
| `Parcelas` | 3 | **Já vem com 1×/2×/3× ativos sem juros** |
| `Pedidos` | 31 | Sem `Cargo`. `Nome` + `Apelido`. Status via dropdown |
| `Vendedoras` | 5 | Login: email + senha |
| `Admins` | 5 | Login admin separado |

Todas com:
- Cabeçalho em negrito, fundo escuro, linha congelada
- Larguras de coluna pré-ajustadas
- Validações de dropdown (UF, SIM/NAO, tipo de cupom, status de pedido)
- Formatação numérica (R$, data BR, %)

## Rodar sobre uma planilha existente

### Opção A — adicionar abas faltantes (não destrutivo)
Cria as abas que ainda não existem e reaplica cabeçalhos/formatação. **Não apaga** dados existentes, mas **não corrige desalinhamento** se o schema mudou no meio (ex: coluna inserida ou removida no meio).

```js
estruturarPlanilhaExistente('COLE_O_SHEET_ID_AQUI')
```

### Opção B — resetar estrutura (destrutivo, mantém o SHEET_ID)
Apaga as 10 abas do template e recria limpas. Use quando o schema mudou no meio das colunas e você não quer gerar uma planilha nova. ⚠ **Perde tudo que estiver dentro dessas abas.**

1. Abra `setup_template.gs`, vá na função `resetarEstrutura`
2. Mude `const CONFIRMAR = 'NAO'` para `'SIM'`
3. Rode `resetarEstrutura('COLE_O_SHEET_ID_AQUI')`
4. Volte `CONFIRMAR` para `'NAO'` (proteção)

## Depois de criar a planilha

Próximos passos (fora do escopo deste script):

1. Publicar `_dev/Code.gs` como Web App (Deploy → New deployment → Web app → "Execute as: Me", "Who has access: Anyone")
2. Copiar a URL `https://script.google.com/macros/s/.../exec`
3. Colocar essa URL no secret `SHEETS_URL` do GitHub (ou direto em `assets/js/config.js` para rodar local)
4. Criar o primeiro admin com `?action=cadastrar_admin&pin=...&email=...&senha=...&nome=...&cargo=...`

> ⚠️ Antes de usar em produção: as senhas hoje são gravadas em texto plano. O backend precisa passar a hashear antes de salvar (ver diagnóstico anterior).

## ⚠ Quebra de compatibilidade com `Code.gs` atual

Esta planilha **não é mais compatível 1:1** com o `_dev/Code.gs` original do PharmaFit. Mudanças que exigem refatoração no backend antes de usar:

### 1. `Clientes` — removida coluna `Cargo`, renomeadas `Nome`/`Responsável`
| Índice | Antes | Agora |
|---|---|---|
| 0 | Data Cadastro | Data Cadastro |
| 1 | Nome (= clínica) | **Nome** |
| 2 | Responsável | **Apelido** |
| 3 | ~~Cargo~~ | Telefone |
| 4 | Telefone | E-mail |
| 5 | E-mail | CPF/CNPJ |
| 6 | CPF/CNPJ | Cidade |
| 7 | Cidade | Estado |
| 8 | Estado | Endereço |
| 9 | Endereço | Categoria |
| 10 | Categoria | — |

Funções afetadas no `Code.gs`: `cadastrarCliente`, `buscarCliente`, `getClientes`, `editarCliente` — todas as referências por índice (`row[3]`, `row[4]`, …) deslocam **−1** a partir do antigo Cargo.

### 2. `Pedidos` — mesma mudança que Clientes
Removido `Cargo` (col 3 antiga), renomeado `Clínica`→`Nome`, `Responsável`→`Apelido`. Todos os índices ≥ 4 deslocam −1. Funções afetadas: `salvar`, `getPedidos`, `getUltimosPedidos`, `getPedidosPainel`, `atualizarStatus`, `atualizarPedido`, `pedidosClienteAdmin`, `getEstatisticas`, `getRelatorio`, `salvarNotaInterna`, `adicionarRastreio`, `decrementarEstoque_`.

### 3. `Cupons` — adicionada coluna `FreteGratisAtivo`
Inserida no índice 10, entre `FreteGratisAcima` (9) e `Deletado` (que vai de 10 → **11**). Funções afetadas: `getCupons`, `criarCupom`, `criarCupomAdmin`, `listarCuponsAdmin`, `toggleCupomAdmin`, `apagarCupomAdmin`. A leitura do frete grátis precisa checar coluna 10 = `'SIM'` antes de aplicar.

### 4. `Historico_Cupons` — adicionadas Parcelamento, FreteGratisAcima, FreteGratisAtivo
Tinha 9 colunas, agora tem 12. `Arquivado em` saiu da posição 8 e foi pra 11. Funções afetadas: `arquivarCuponsExpirados_`, `criarCupom` (linha que dá `appendRow` no histórico).

### 5. `Produtos.Destaque` — não é mais SIM/NAO
Agora aceita `'destaque'` ou `'recomendado'` (ou vazio). Frontend já lê assim em `getProdutos()` (`String(r[15]).trim().toLowerCase()`), então **só** o site precisa renderizar duas vitrines distintas — não tem mudança no Code.gs em si, mas o JS da home/catálogo precisa filtrar por valor em vez de booleano.

---

Recomendação: depois de criar a planilha nova, faça uma branch `template-refactor` e atualize o `Code.gs` num único PR usando esta tabela de índices como referência.
