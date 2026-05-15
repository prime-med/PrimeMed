// ─── frete.js — Template B2B ──────────────────────────────────────────────────
// Fonte única de verdade para frete. Importado por:
//   • pedido.html
//   • admin/painel.html (aba "Gerar Pedido")
//
// Para trocar de tabela fixa para API real no futuro,
// só mude este arquivo — as páginas não precisam saber.
// ──────────────────────────────────────────────────────────────────────────────

// ── Tabela de preços por estado (origem: Cotia/SP — CEP 06719-259) ────────────
// Atualizar quando Correios/Jadlog reajustarem preços.
// Campos: sedex, jadlog (R$) | ds, dj (dias úteis — exibição)
const FRETE_TABELA = {
  //         SEDEX   Jadlog   ds        dj
  SP:  { sedex:28,  jadlog:15,  ds:'1-2',   dj:'3-5'   },
  RJ:  { sedex:34,  jadlog:20,  ds:'1-2',   dj:'4-6'   },
  MG:  { sedex:34,  jadlog:20,  ds:'2-3',   dj:'4-7'   },
  ES:  { sedex:38,  jadlog:24,  ds:'2-3',   dj:'5-8'   },
  PR:  { sedex:38,  jadlog:22,  ds:'2-3',   dj:'4-7'   },
  SC:  { sedex:38,  jadlog:24,  ds:'2-3',   dj:'5-8'   },
  RS:  { sedex:42,  jadlog:28,  ds:'2-3',  dj:'5-8'   },
  MS:  { sedex:45,  jadlog:30,  ds:'3-4',  dj:'6-9'   },
  MT:  { sedex:48,  jadlog:34,  ds:'3-4',  dj:'7-10'  },
  GO:  { sedex:45,  jadlog:30,  ds:'3-4',  dj:'6-9'   },
  DF:  { sedex:45,  jadlog:30,  ds:'2-3',  dj:'5-8'   },
  BA:  { sedex:52,  jadlog:35,  ds:'3-5', dj:'7-10'  },
  SE:  { sedex:55,  jadlog:37,  ds:'3-5', dj:'8-11'  },
  AL:  { sedex:55,  jadlog:37,  ds:'4-5', dj:'8-12'  },
  PE:  { sedex:55,  jadlog:37,  ds:'4-5', dj:'8-12'  },
  PB:  { sedex:58,  jadlog:39,  ds:'4-5', dj:'9-13'  },
  RN:  { sedex:58,  jadlog:39,  ds:'4-5', dj:'9-13'  },
  CE:  { sedex:58,  jadlog:39,  ds:'4-5', dj:'9-13'  },
  PI:  { sedex:62,  jadlog:43,  ds:'5-6', dj:'10-14' },
  MA:  { sedex:62,  jadlog:43,  ds:'5-6', dj:'10-14' },
  PA:  { sedex:65,  jadlog:45,  ds:'5-6', dj:'10-15' },
  AM:  { sedex:68,  jadlog:48,  ds:'5-7', dj:'11-16' },
  AC:  { sedex:72,  jadlog:52,  ds:'6-8', dj:'12-18' },
  RO:  { sedex:68,  jadlog:48,  ds:'5-7', dj:'11-16' },
  RR:  { sedex:72,  jadlog:52,  ds:'6-8', dj:'12-18' },
  AP:  { sedex:68,  jadlog:48,  ds:'5-7', dj:'11-16' },
  TO:  { sedex:62,  jadlog:43,  ds:'4-6', dj:'9-13'  },
};

// ── Busca endereço via ViaCEP ──────────────────────────────────────────────────
// Retorna: { uf, localidade, logradouro } ou lança erro
async function buscarCEP(cep) {
  const limpo = String(cep).replace(/\D/g, '');
  if (limpo.length !== 8) throw new Error('CEP inválido');
  const res  = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
  const data = await res.json();
  if (data.erro) throw new Error('CEP não encontrado');
  return { uf: data.uf, localidade: data.localidade, logradouro: data.logradouro || '' };
}

// ── Máscara de CEP ─────────────────────────────────────────────────────────────
function mascaraCep(el) {
  let v = el.value.replace(/\D/g, '');
  if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8);
  el.value = v;
}
