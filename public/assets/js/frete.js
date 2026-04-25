// ─── frete.js — PharmaFit B2B ─────────────────────────────────────────────────
// Fonte única de verdade para frete. Importado por:
//   • pedido_pharmafit.html
//   • gerador_pedido.html
//
// Para trocar de tabela fixa para API real no futuro,
// só mude este arquivo — as páginas não precisam saber.
// ──────────────────────────────────────────────────────────────────────────────

// ── Tabela de preços por estado (origem: Cotia/SP — CEP 06719-259) ────────────
// Atualizar quando Correios/Jadlog reajustarem preços.
// Campos: sedex, pac, jadlog (R$) | ds, dp, dj (dias úteis — exibição)
const FRETE_TABELA = {
  //         SEDEX   PAC   Jadlog   ds        dp         dj
  SP:  { sedex:28,  pac:18,  jadlog:15,  ds:'1-2', dp:'4-6',   dj:'3-5'   },
  RJ:  { sedex:34,  pac:24,  jadlog:20,  ds:'1-2', dp:'5-7',   dj:'4-6'   },
  MG:  { sedex:34,  pac:24,  jadlog:20,  ds:'2-3', dp:'6-8',   dj:'4-7'   },
  ES:  { sedex:38,  pac:28,  jadlog:24,  ds:'2-3', dp:'6-9',   dj:'5-8'   },
  PR:  { sedex:38,  pac:28,  jadlog:22,  ds:'2-3', dp:'5-8',   dj:'4-7'   },
  SC:  { sedex:38,  pac:28,  jadlog:24,  ds:'2-3', dp:'6-9',   dj:'5-8'   },
  RS:  { sedex:42,  pac:32,  jadlog:28,  ds:'2-3', dp:'7-10',  dj:'5-8'   },
  MS:  { sedex:45,  pac:35,  jadlog:30,  ds:'3-4', dp:'8-12',  dj:'6-9'   },
  MT:  { sedex:48,  pac:38,  jadlog:34,  ds:'3-4', dp:'9-13',  dj:'7-10'  },
  GO:  { sedex:45,  pac:35,  jadlog:30,  ds:'3-4', dp:'8-12',  dj:'6-9'   },
  DF:  { sedex:45,  pac:35,  jadlog:30,  ds:'2-3', dp:'7-10',  dj:'5-8'   },
  BA:  { sedex:52,  pac:40,  jadlog:35,  ds:'3-5', dp:'10-14', dj:'7-10'  },
  SE:  { sedex:55,  pac:42,  jadlog:37,  ds:'3-5', dp:'10-14', dj:'8-11'  },
  AL:  { sedex:55,  pac:42,  jadlog:37,  ds:'4-5', dp:'11-15', dj:'8-12'  },
  PE:  { sedex:55,  pac:42,  jadlog:37,  ds:'4-5', dp:'11-15', dj:'8-12'  },
  PB:  { sedex:58,  pac:44,  jadlog:39,  ds:'4-5', dp:'12-16', dj:'9-13'  },
  RN:  { sedex:58,  pac:44,  jadlog:39,  ds:'4-5', dp:'12-16', dj:'9-13'  },
  CE:  { sedex:58,  pac:44,  jadlog:39,  ds:'4-5', dp:'12-16', dj:'9-13'  },
  PI:  { sedex:62,  pac:48,  jadlog:43,  ds:'5-6', dp:'13-17', dj:'10-14' },
  MA:  { sedex:62,  pac:48,  jadlog:43,  ds:'5-6', dp:'13-17', dj:'10-14' },
  PA:  { sedex:65,  pac:50,  jadlog:45,  ds:'5-6', dp:'14-18', dj:'10-15' },
  AM:  { sedex:68,  pac:52,  jadlog:48,  ds:'5-7', dp:'15-20', dj:'11-16' },
  AC:  { sedex:72,  pac:56,  jadlog:52,  ds:'6-8', dp:'16-22', dj:'12-18' },
  RO:  { sedex:68,  pac:52,  jadlog:48,  ds:'5-7', dp:'15-20', dj:'11-16' },
  RR:  { sedex:72,  pac:56,  jadlog:52,  ds:'6-8', dp:'16-22', dj:'12-18' },
  AP:  { sedex:68,  pac:52,  jadlog:48,  ds:'5-7', dp:'15-20', dj:'11-16' },
  TO:  { sedex:62,  pac:48,  jadlog:43,  ds:'4-6', dp:'12-16', dj:'9-13'  },
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
