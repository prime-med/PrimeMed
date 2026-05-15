/* api.js — Wrapper GAS para o Admin Panel */

const API = {
  async call(params) {
    const admin = window.App?.admin;
    if (admin) {
      if (!params.email) params.email = admin.email;
      if (!params.token) params.token = admin.token;
    }
    const url = new URL(SHEETS_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    let res;
    try {
      res = await fetch(url.toString());
    } catch (netErr) {
      console.error('[API] Erro de rede:', netErr, 'action:', params.action);
      throw new Error('Sem conexão com o servidor');
    }
    if (!res.ok) {
      console.error('[API] HTTP', res.status, 'action:', params.action);
      throw new Error(`HTTP ${res.status}`);
    }
    // Tenta JSON. Se a resposta vier vazia/inválida MAS o status for 200,
    // assume que a operação rodou (Apps Script às vezes retorna content-type
    // estranho após redirect 302 → googleusercontent). Loga aviso pra debug.
    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      console.warn('[API] Resposta não-JSON status', res.status, 'action:', params.action, '— assumindo sucesso');
      return { ok: true, _silent: true };
    }
    if (data && data.erro === 'Não autorizado' && admin) {
      localStorage.removeItem('lp_admin');
      alert('Sessão expirada. Faça login novamente.');
      window.location.href = 'index.html';
    }
    return data;
  },

  pedidos:      ()               => API.call({ action: 'painel_pedidos' }),
  estatisticas: ()               => API.call({ action: 'estatisticas' }),
  clientes:     ()               => API.call({ action: 'clientes' }),
  produtos:     ()               => API.call({ action: 'produtos' }),

  atualizarStatus: (id, status, extra = {}) =>
    API.call({ action: 'atualizar_status', id, status, ...extra }),

  adicionarRastreio: (id, codigo) =>
    API.call({ action: 'add_rastreio', id, codigo }),

  atualizarProduto: (prod_id, campo, valor) =>
    API.call({ action: 'atualizar_produto', prod_id, campo, valor }),

  listarCupons:     ()                  => API.call({ action: 'listar_cupons_admin' }),
  toggleCupom:      (codigo)            => API.call({ action: 'toggle_cupom_admin', codigo }),
  apagarCupom:      (codigo)            => API.call({ action: 'apagar_cupom_admin', codigo }),
  criarCupom:       (p)                 => API.call({ action: 'criar_cupom_admin', ...p }),
  editarProduto:    (p)                 => API.call({ action: 'editar_produto_completo', ...p }),
  editarCliente:    (p)                 => API.call({ action: 'editar_cliente', ...p }),
  apagarCliente:    (documento, email)  => API.call({ action: 'apagar_cliente', documento: documento || '', email_cli: email || '' }),
  pedidosCliente:   (documento)         => API.call({ action: 'pedidos_cliente_admin', documento }),
  relatorio:        ()                  => API.call({ action: 'relatorio' }),
  salvarNotaInt:    (id, nota)          => API.call({ action: 'salvar_nota_interna', id, nota }),
  criarProduto:     (p)                 => API.call({ action: 'criar_produto', ...p }),
  apagarProduto:    (prodId)            => API.call({ action: 'apagar_produto', prod_id: prodId }),
  retornarEstoque:  (id)                => API.call({ action: 'retornar_estoque', id }),
  protocolos:       ()                  => API.call({ action: 'protocolos' }),
  editarProtocolo:  (p)                 => API.call({ action: 'editar_protocolo', ...p }),
  indicacoes:       ()                  => API.call({ action: 'painel_indicacoes' }),
  setIndicacaoStatus: (rowNum, status)  => API.call({ action: 'set_indicacao_status', rowNum, status }),
  solicitacoes:     ()                  => API.call({ action: 'painel_solicitacoes' }),
  aprovarSolicitacao: (rowNum, obs_admin) => API.call({ action: 'aprovar_solicitacao', rowNum, obs_admin: obs_admin || '' }),
  rejeitarSolicitacao: (rowNum, motivo) => API.call({ action: 'rejeitar_solicitacao', rowNum, motivo: motivo || '' }),
};
