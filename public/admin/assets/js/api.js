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
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.erro === 'Não autorizado' && admin) {
      localStorage.removeItem('pharmafit_admin');
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
  pedidosCliente:   (documento)         => API.call({ action: 'pedidos_cliente_admin', documento }),
  relatorio:        ()                  => API.call({ action: 'relatorio' }),
  salvarNotaInt:    (id, nota)          => API.call({ action: 'salvar_nota_interna', id, nota }),
  criarProduto:     (p)                 => API.call({ action: 'criar_produto', ...p }),
  retornarEstoque:  (id)                => API.call({ action: 'retornar_estoque', id }),
  protocolos:       ()                  => API.call({ action: 'protocolos' }),
  editarProtocolo:  (p)                 => API.call({ action: 'editar_protocolo', ...p }),
};
