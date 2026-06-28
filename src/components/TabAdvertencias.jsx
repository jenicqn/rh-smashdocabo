import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TIPOS = {
  verbal: { label: 'Verbal', cor: '#d97706', bg: '#fffbeb' },
  escrita: { label: 'Escrita', cor: '#dc2626', bg: '#fef2f2' },
  suspensao: { label: 'Suspensão', cor: '#7c3aed', bg: '#f5f3ff' },
}

function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

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

export default function TabAdvertencias() {
  const [funcionarios, setFuncionarios] = useState([])
  const [advertencias, setAdvertencias] = useState([])
  const [mes, setMes] = useState(mesAtual())
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ funcionario_id: '', data: '', tipo: 'verbal', motivo: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  useEffect(() => { carregarFuncionarios() }, [])
  useEffect(() => { carregarAdvertencias() }, [mes])

  async function carregarFuncionarios() {
    const { data } = await supabase.from('rh_funcionarios').select('id, nome').order('nome')
    if (data) setFuncionarios(data)
  }

  async function carregarAdvertencias() {
    setLoading(true)
    const inicio = `${mes}-01`
    const [ano, m] = mes.split('-').map(Number)
    const fim = `${mes}-${new Date(ano, m, 0).getDate()}`

    const { data } = await supabase
      .from('rh_advertencias')
      .select('*, rh_funcionarios(nome)')
      .gte('data', inicio)
      .lte('data', fim)
      .order('data', { ascending: false })
    if (data) setAdvertencias(data)
    setLoading(false)
  }

  async function salvar() {
    if (!form.funcionario_id || !form.data || !form.motivo) {
      setMsg({ tipo: 'erro', texto: 'Preencha todos os campos.' }); return
    }
    setSalvando(true)
    const { error } = await supabase.from('rh_advertencias').insert({
      funcionario_id: form.funcionario_id,
      data: form.data,
      tipo: form.tipo,
      motivo: form.motivo,
    })
    if (error) {
      setMsg({ tipo: 'erro', texto: error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Advertência registrada!' })
      setForm({ funcionario_id: '', data: '', tipo: 'verbal', motivo: '' })
      setMostrarForm(false)
      carregarAdvertencias()
      setTimeout(() => setMsg(null), 3000)
    }
    setSalvando(false)
  }

  async function deletar(id) {
    if (!confirm('Excluir esta advertência?')) return
    await supabase.from('rh_advertencias').delete().eq('id', id)
    carregarAdvertencias()
  }

  function formatData(d) {
    if (!d) return ''
    const [a, m, dia] = d.split('-')
    return `${dia}/${m}/${a}`
  }

  // Agrupa por funcionário
  const porFunc = advertencias.reduce((acc, a) => {
    const nome = a.rh_funcionarios?.nome || '?'
    if (!acc[nome]) acc[nome] = []
    acc[nome].push(a)
    return acc
  }, {})

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={h2}>⚠️ Advertências</h2>
        <button onClick={() => { setMostrarForm(!mostrarForm); setMsg(null) }} style={{
          background: '#e63946', color: '#fff', border: 'none',
          borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
        }}>+ Nova advertência</button>
      </div>

      {/* Formulário */}
      {mostrarForm && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>📝 Registrar advertência</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Funcionário</label>
              <select style={inp} value={form.funcionario_id} onChange={e => setForm(f => ({ ...f, funcionario_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Data</label>
              <input style={inp} type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Tipo</label>
              <select style={inp} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="verbal">Advertência Verbal</option>
                <option value="escrita">Advertência Escrita</option>
                <option value="suspensao">Suspensão</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Motivo</label>
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }}
                placeholder="Descreva o motivo da advertência..."
                value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} />
            </div>
          </div>

          {msg && (
            <div style={{ borderRadius: 8, padding: '10px 14px', marginBottom: 12, background: msg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.tipo === 'ok' ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 600 }}>
              {msg.tipo === 'ok' ? '✅' : '❌'} {msg.texto}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={salvar} disabled={salvando} style={{ flex: 1, padding: 11, background: '#e63946', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setMostrarForm(false)} style={{ padding: '11px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Filtro de mês */}
      <select value={mes} onChange={e => setMes(e.target.value)} style={sel}>
        {gerarOpcoesMes().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
      </select>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Carregando...</div>
      ) : advertencias.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#888' }}>
          Nenhuma advertência registrada neste mês. 👍
        </div>
      ) : (
        Object.entries(porFunc).map(([nome, adv]) => (
          <div key={nome} style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
              {nome.split(' ')[0]} {nome.split(' ')[1] || ''}
              <span style={{ marginLeft: 8, background: '#fef2f2', color: '#dc2626', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                {adv.length} advertência{adv.length > 1 ? 's' : ''}
              </span>
            </div>
            {adv.map(a => (
              <div key={a.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                background: TIPOS[a.tipo]?.bg || '#f9fafb',
                border: `1px solid ${TIPOS[a.tipo]?.cor}30`
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ background: TIPOS[a.tipo]?.cor, color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                      {TIPOS[a.tipo]?.label}
                    </span>
                    <span style={{ color: '#888', fontSize: 12 }}>{formatData(a.data)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#333' }}>{a.motivo}</div>
                </div>
                <button onClick={() => deletar(a.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>🗑</button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}

const h2 = { margin: 0, fontSize: 18, fontWeight: 700 }
const card = { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', marginBottom: 16 }
const sel = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, marginBottom: 16, background: '#fff', cursor: 'pointer' }
const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }
