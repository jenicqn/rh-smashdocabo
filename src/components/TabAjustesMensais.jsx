import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function gerarOpcoesMes(n = 12) {
  const list = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    list.push({ val, label: `${MESES[d.getMonth()]} ${d.getFullYear()}` })
  }
  return list
}

function moedaParaNumero(valor) {
  const texto = String(valor || '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const numero = parseFloat(texto)
  return Number.isFinite(numero) ? numero : 0
}

function normalizarBanco(valor) {
  const texto = String(valor || '').trim()
  if (!texto) return '00:00'
  const match = texto.match(/^([+-])?(\d{1,4}):(\d{2})$/)
  if (!match) return texto
  const sinal = match[1] === '-' ? '-' : ''
  return `${sinal}${String(parseInt(match[2])).padStart(2, '0')}:${match[3]}`
}

function formatarMoeda(valor) {
  return Number(valor || 0).toFixed(2).replace('.', ',')
}

export default function TabAjustesMensais() {
  const [mes, setMes] = useState(mesAtual())
  const [funcionarios, setFuncionarios] = useState([])
  const [ajustes, setAjustes] = useState({})
  const [salvando, setSalvando] = useState({})
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregarFuncionarios() }, [])
  useEffect(() => { carregarAjustes() }, [mes])

  async function carregarFuncionarios() {
    const { data } = await supabase
      .from('rh_funcionarios')
      .select('id, nome, cpf, status, is_owner')
      .neq('is_owner', true)
      .order('nome')

    if (data) setFuncionarios(data)
  }

  async function carregarAjustes() {
    setLoading(true)
    const { data } = await supabase
      .from('rh_ajustes_mensais')
      .select('*')
      .eq('mes', mes)

    const map = {}
    ;(data || []).forEach(a => {
      map[a.funcionario_id] = {
        id: a.id,
        comissao: formatarMoeda(a.comissao),
        banco_horas: a.banco_horas || '00:00',
      }
    })
    setAjustes(map)
    setLoading(false)
  }

  function alterar(funcId, campo, valor) {
    setAjustes(prev => ({
      ...prev,
      [funcId]: {
        comissao: '',
        banco_horas: '',
        ...(prev[funcId] || {}),
        [campo]: valor,
      },
    }))
  }

  async function salvar(func) {
    const atual = ajustes[func.id] || {}
    const payload = {
      funcionario_id: func.id,
      mes,
      comissao: moedaParaNumero(atual.comissao),
      banco_horas: normalizarBanco(atual.banco_horas),
    }

    setSalvando(prev => ({ ...prev, [func.id]: true }))
    const { error } = await supabase
      .from('rh_ajustes_mensais')
      .upsert(payload, { onConflict: 'funcionario_id,mes' })

    setSalvando(prev => ({ ...prev, [func.id]: false }))

    if (error) {
      setMsg({ tipo: 'erro', texto: error.message })
      return
    }

    setMsg({ tipo: 'ok', texto: `Ajuste de ${func.nome.split(' ')[0]} salvo.` })
    carregarAjustes()
    setTimeout(() => setMsg(null), 2500)
  }

  async function limpar(func) {
    if (!ajustes[func.id]?.id) return
    if (!confirm(`Remover ajuste de ${func.nome.split(' ')[0]} neste mês?`)) return
    await supabase.from('rh_ajustes_mensais').delete().eq('id', ajustes[func.id].id)
    carregarAjustes()
  }

  return (
    <div>
      <h2 style={h2}>Ajustes mensais</h2>
      <p style={{ margin: '-6px 0 16px', color: '#666', fontSize: 13 }}>
        Use para lançar meses fechados sem arquivo de ponto ou sem comissão diária. Esses valores entram no portal do funcionário.
      </p>

      <select value={mes} onChange={e => setMes(e.target.value)} style={sel}>
        {gerarOpcoesMes().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
      </select>

      {msg && (
        <div style={{ borderRadius: 8, padding: '10px 14px', marginBottom: 12, background: msg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.tipo === 'ok' ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 600 }}>
          {msg.texto}
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 140px 140px 146px', gap: 8, padding: '0 0 10px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#777', fontWeight: 700 }}>
          <div>Funcionário</div>
          <div>Comissão</div>
          <div>Banco do mês</div>
          <div></div>
        </div>

        {loading ? (
          <div style={empty}>Carregando...</div>
        ) : funcionarios.map(f => {
          const ajuste = ajustes[f.id] || {}
          return (
            <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 140px 140px 146px', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{f.nome}</div>
                <div style={{ color: '#888', fontSize: 11 }}>{f.status || 'ativo'}</div>
              </div>
              <input
                style={inp}
                placeholder="0,00"
                value={ajuste.comissao || ''}
                onChange={e => alterar(f.id, 'comissao', e.target.value)}
              />
              <input
                style={inp}
                placeholder="-05:38"
                value={ajuste.banco_horas || ''}
                onChange={e => alterar(f.id, 'banco_horas', e.target.value)}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => salvar(f)} disabled={salvando[f.id]} style={btnPrimary(salvando[f.id])}>
                  {salvando[f.id] ? 'Salvando' : 'Salvar'}
                </button>
                <button onClick={() => limpar(f)} style={btnGhost}>Limpar</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const h2 = { margin: '0 0 16px', fontSize: 18, fontWeight: 700 }
const card = { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }
const sel = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, marginBottom: 16, background: '#fff', cursor: 'pointer' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13, boxSizing: 'border-box', outline: 'none' }
const empty = { color: '#888', fontSize: 13, textAlign: 'center', padding: 24 }
const btnPrimary = (disabled) => ({ background: disabled ? '#ccc' : '#e63946', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: disabled ? 'default' : 'pointer' })
const btnGhost = { background: '#f3f4f6', color: '#555', border: 'none', borderRadius: 7, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }
