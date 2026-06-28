import { useState, useEffect } from 'react'
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

const ZONAS = [
  { zona: 1, label: 'Excelência', premio: 200, cor: '#16a34a', bg: '#f0fdf4' },
  { zona: 2, label: 'Muito Bom', premio: 100, cor: '#0284c7', bg: '#f0f9ff' },
  { zona: 3, label: 'Bom', premio: 50, cor: '#7c3aed', bg: '#f5f3ff' },
  { zona: 4, label: 'Regular', premio: 0, cor: '#d97706', bg: '#fffbeb' },
  { zona: 5, label: 'Atenção', premio: 0, cor: '#dc2626', bg: '#fef2f2' },
  { zona: 6, label: 'Crítico', premio: 0, cor: '#1a1a1a', bg: '#f9fafb' },
]

function minutosDeAtraso(horas_atraso) {
  if (!horas_atraso || horas_atraso.trim() === '') return 0
  const match = horas_atraso.match(/-(\d{1,2}):(\d{2})/)
  if (!match) return 0
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

function calcularZona(atrasosPequenos, atrasosGrandes, faltasInj, faltasJust, advertencias) {
  if (faltasInj >= 2 || advertencias >= 2) return 6
  if (faltasInj >= 1 && (advertencias >= 1 || atrasosGrandes >= 1)) return 6
  if (faltasInj === 1 || advertencias === 1 || atrasosGrandes >= 1) return 5
  if (faltasJust >= 1 && advertencias === 0) return 4
  if (atrasosPequenos === 0 && atrasosGrandes === 0 && faltasInj === 0 && faltasJust === 0 && advertencias === 0) return 1
  if (atrasosPequenos <= 2 && faltasInj === 0 && faltasJust === 0 && advertencias === 0) return 2
  if (atrasosPequenos <= 3 && faltasInj === 0 && faltasJust === 0 && advertencias === 0) return 3
  return 4
}

export default function TabZonas() {
  const [mes, setMes] = useState(mesAtual())
  const [funcionarios, setFuncionarios] = useState([])
  const [zonas, setZonas] = useState([])
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ zona: 1, observacao: '' })
  const [salvando, setSalvando] = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dadosMes, setDadosMes] = useState({})

  useEffect(() => { carregarFuncionarios() }, [])
  useEffect(() => { carregarZonas(); carregarDadosMes() }, [mes])

  async function carregarFuncionarios() {
    const { data } = await supabase
      .from('rh_funcionarios')
      .select('id, nome, status, cpf, horario_entrada, data_saida')
      .neq('status', 'demitido')
      .neq('is_owner', true)
      .order('nome')
    if (data) setFuncionarios(data)
  }

  async function carregarZonas() {
    setLoading(true)
    const { data } = await supabase.from('rh_zonas').select('*').eq('mes', mes)
    if (data) setZonas(data)
    setLoading(false)
  }

  async function carregarDadosMes() {
    const inicio = `${mes}-01`
    const [ano, m] = mes.split('-').map(Number)
    const fim = `${mes}-${new Date(ano, m, 0).getDate()}`

    const [{ data: pontos }, { data: faltas }, { data: advs }, { data: funcs }] = await Promise.all([
      supabase.from('registros_ponto').select('funcionario_cpf, horas_atraso').gte('dia', inicio).lte('dia', fim),
      supabase.from('rh_faltas').select('funcionario_id, tipo').gte('data', inicio).lte('data', fim),
      supabase.from('rh_advertencias').select('funcionario_id').gte('data', inicio).lte('data', fim),
      supabase.from('rh_funcionarios').select('id, cpf'),
    ])

    const cpfToId = {}
    funcs?.forEach(f => { cpfToId[f.cpf] = f.id })
    const dados = {}

    pontos?.forEach(p => {
      if (!p.horas_atraso || p.horas_atraso.trim() === '') return
      const id = cpfToId[p.funcionario_cpf]
      if (!id) return
      if (!dados[id]) dados[id] = vazio()
      const mins = minutosDeAtraso(p.horas_atraso)
      if (mins >= 6) dados[id].atrasosGrandes++
      else if (mins >= 1) dados[id].atrasosPequenos++
    })

    faltas?.forEach(f => {
      if (!dados[f.funcionario_id]) dados[f.funcionario_id] = vazio()
      if (f.tipo === 'injustificada') dados[f.funcionario_id].faltasInj++
      else dados[f.funcionario_id].faltasJust++
    })

    advs?.forEach(a => {
      if (!dados[a.funcionario_id]) dados[a.funcionario_id] = vazio()
      dados[a.funcionario_id].adv++
    })

    setDadosMes(dados)
  }

  async function calcularTodos() {
    setCalculando(true)
    const inicio = `${mes}-01`
    const [ano, m] = mes.split('-').map(Number)
    const fim = `${mes}-${new Date(ano, m, 0).getDate()}`

    const [{ data: pontos }, { data: faltas }, { data: advs }, { data: funcs }, { data: zonasAtuais }] = await Promise.all([
      supabase.from('registros_ponto').select('funcionario_cpf, horas_atraso').gte('dia', inicio).lte('dia', fim),
      supabase.from('rh_faltas').select('funcionario_id, tipo').gte('data', inicio).lte('data', fim),
      supabase.from('rh_advertencias').select('funcionario_id').gte('data', inicio).lte('data', fim),
      supabase.from('rh_funcionarios').select('id, cpf'),
      supabase.from('rh_zonas').select('*').eq('mes', mes),
    ])

    const cpfToId = {}
    funcs?.forEach(f => { cpfToId[f.cpf] = f.id })
    const dados = {}
    funcionarios.forEach(f => { dados[f.id] = vazio() })

    pontos?.forEach(p => {
      if (!p.horas_atraso || p.horas_atraso.trim() === '') return
      const id = cpfToId[p.funcionario_cpf]
      if (!id || !dados[id]) return
      const mins = minutosDeAtraso(p.horas_atraso)
      if (mins >= 6) dados[id].atrasosGrandes++
      else if (mins >= 1) dados[id].atrasosPequenos++
    })

    faltas?.forEach(f => {
      if (!dados[f.funcionario_id]) return
      if (f.tipo === 'injustificada') dados[f.funcionario_id].faltasInj++
      else dados[f.funcionario_id].faltasJust++
    })

    advs?.forEach(a => {
      if (!dados[a.funcionario_id]) return
      dados[a.funcionario_id].adv++
    })

    for (const f of funcionarios) {
      const d = dados[f.id] || vazio()
      const zonaNum = calcularZona(d.atrasosPequenos, d.atrasosGrandes, d.faltasInj, d.faltasJust, d.adv)
      const zonaInfo = ZONAS.find(z => z.zona === zonaNum)
      const obs = []
      if (d.atrasosPequenos > 0) obs.push(`${d.atrasosPequenos} atraso(s) leve(s) (1-5 min)`)
      if (d.atrasosGrandes > 0) obs.push(`${d.atrasosGrandes} atraso(s) (6+ min)`)
      if (d.faltasInj > 0) obs.push(`${d.faltasInj} falta(s) injustificada(s)`)
      if (d.faltasJust > 0) obs.push(`${d.faltasJust} falta(s) justificada(s)`)
      if (d.adv > 0) obs.push(`${d.adv} advertência(s)`)

      const payload = {
        funcionario_id: f.id,
        mes,
        zona: zonaNum,
        premio: zonaInfo?.premio || 0,
        observacao: obs.length ? obs.join(', ') : 'Sem ocorrências',
      }
      const zonaExistente = zonasAtuais?.find(z => z.funcionario_id === f.id)
      if (zonaExistente) await supabase.from('rh_zonas').update(payload).eq('id', zonaExistente.id)
      else await supabase.from('rh_zonas').insert(payload)
    }

    await carregarZonas()
    await carregarDadosMes()
    setCalculando(false)
  }

  function vazio() {
    return { atrasosPequenos: 0, atrasosGrandes: 0, faltasInj: 0, faltasJust: 0, adv: 0 }
  }

  function getZonaFunc(funcId) {
    return zonas.find(z => z.funcionario_id === funcId)
  }

  function abrirEditar(func) {
    const zonaAtual = getZonaFunc(func.id)
    setEditando(func)
    setForm({ zona: zonaAtual?.zona || 1, observacao: zonaAtual?.observacao || '' })
    setMsg(null)
  }

  async function salvar() {
    if (!editando) return
    setSalvando(true)
    const zonaInfo = ZONAS.find(z => z.zona === parseInt(form.zona))
    const payload = {
      funcionario_id: editando.id,
      mes,
      zona: parseInt(form.zona),
      premio: zonaInfo?.premio || 0,
      observacao: form.observacao,
    }
    const zonaExistente = getZonaFunc(editando.id)
    const res = zonaExistente
      ? await supabase.from('rh_zonas').update(payload).eq('id', zonaExistente.id)
      : await supabase.from('rh_zonas').insert(payload)

    if (res.error) setMsg({ tipo: 'erro', texto: res.error.message })
    else {
      setMsg({ tipo: 'ok', texto: 'Zona salva!' })
      carregarZonas()
      setTimeout(() => { setEditando(null); setMsg(null) }, 1200)
    }
    setSalvando(false)
  }

  async function remover(funcId) {
    const z = getZonaFunc(funcId)
    if (!z || !confirm('Remover classificação?')) return
    await supabase.from('rh_zonas').delete().eq('id', z.id)
    carregarZonas()
  }

  const totalPremios = zonas.reduce((a, z) => a + (parseFloat(z.premio) || 0), 0)
  const semZona = funcionarios.filter(f => !getZonaFunc(f.id))

  return (
    <div>
      {editando && (
        <div style={overlay}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>
              Zona de {editando.nome.split(' ')[0]} - {MESES[parseInt(mes.split('-')[1]) - 1]}
            </div>

            <label style={lbl}>Classificação</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {ZONAS.map(z => (
                <label key={z.zona} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: parseInt(form.zona) === z.zona ? z.bg : '#f9fafb',
                  border: `2px solid ${parseInt(form.zona) === z.zona ? z.cor : '#e5e7eb'}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  cursor: 'pointer',
                }}>
                  <input
                    type="radio"
                    name="zona"
                    value={z.zona}
                    checked={parseInt(form.zona) === z.zona}
                    onChange={e => setForm(f => ({ ...f, zona: parseInt(e.target.value) }))}
                    style={{ cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: z.cor }}>Zona {z.zona}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>{z.label} - {z.premio > 0 ? `R$ ${z.premio}` : 'Sem prêmio'}</div>
                  </div>
                </label>
              ))}
            </div>

            <label style={lbl}>Observação</label>
            <textarea
              style={{ ...inp, height: 70, resize: 'none' }}
              placeholder="Ex: 2 atrasos no mês, sem faltas..."
              value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
            />

            {msg && (
              <div style={{ borderRadius: 8, padding: '10px 14px', marginBottom: 12, background: msg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.tipo === 'ok' ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 600 }}>
                {msg.texto}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={salvar} disabled={salvando} style={{ flex: 1, padding: 12, background: '#e63946', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setEditando(null)} style={{ padding: '12px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={h2}>Zonas de Desempenho</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {totalPremios > 0 && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: '#16a34a', fontWeight: 700 }}>
              Total: R$ {totalPremios.toFixed(2).replace('.', ',')}
            </div>
          )}
          <button onClick={calcularTodos} disabled={calculando} style={{
            background: calculando ? '#ccc' : '#1a1a1a',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: calculando ? 'default' : 'pointer',
          }}>
            {calculando ? 'Calculando...' : 'Calcular automaticamente'}
          </button>
        </div>
      </div>

      <select value={mes} onChange={e => setMes(e.target.value)} style={sel}>
        {gerarOpcoesMes().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
      </select>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        {ZONAS.map(z => (
          <div key={z.zona} style={{ background: z.bg, borderRadius: 8, padding: '8px 10px', border: `1px solid ${z.cor}30` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: z.cor }}>Zona {z.zona} - {z.label}</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{z.premio > 0 ? `R$ ${z.premio},00` : 'Sem prêmio'}</div>
          </div>
        ))}
      </div>

      {semZona.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: '#92400e', fontSize: 13 }}>
            {semZona.length} funcionário(s) sem classificação. Clique em "Calcular automaticamente".
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Carregando...</div>
      ) : (
        funcionarios.map(f => {
          const zonaFunc = getZonaFunc(f.id)
          const zonaInfo = zonaFunc ? ZONAS.find(z => z.zona === zonaFunc.zona) : null
          const d = dadosMes[f.id] || vazio()
          return (
            <div key={f.id} style={{
              background: '#fff',
              borderRadius: 10,
              padding: '14px 16px',
              marginBottom: 8,
              border: '1px solid #e5e7eb',
              borderLeft: zonaInfo ? `4px solid ${zonaInfo.cor}` : '4px solid #e5e7eb',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{f.nome}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <Tag label={`${d.atrasosPequenos || 0} leve(s)`} cor={(d.atrasosPequenos || 0) > 0 ? '#d97706' : '#888'} />
                    <Tag label={`${d.atrasosGrandes || 0} atraso(s)`} cor={(d.atrasosGrandes || 0) > 0 ? '#ea580c' : '#888'} />
                    <Tag label={`${d.faltasInj || 0} inj.`} cor={(d.faltasInj || 0) > 0 ? '#dc2626' : '#888'} />
                    <Tag label={`${d.faltasJust || 0} just.`} cor={(d.faltasJust || 0) > 0 ? '#d97706' : '#888'} />
                    <Tag label={`${d.adv || 0} adv.`} cor={(d.adv || 0) > 0 ? '#7c3aed' : '#888'} />
                  </div>

                  {zonaInfo && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ background: zonaInfo.bg, color: zonaInfo.cor, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                        Zona {zonaFunc.zona} - {zonaInfo.label}
                      </span>
                      {zonaFunc.premio > 0 && (
                        <span style={{ marginLeft: 8, color: '#16a34a', fontSize: 12, fontWeight: 700 }}>
                          R$ {parseFloat(zonaFunc.premio).toFixed(2).replace('.', ',')}
                        </span>
                      )}
                      {zonaFunc.observacao && (
                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{zonaFunc.observacao}</div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => abrirEditar(f)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                    {zonaFunc ? 'Editar' : '+ Classificar'}
                  </button>
                  {zonaFunc && (
                    <button onClick={() => remover(f.id)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>Remover</button>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function Tag({ label, cor }) {
  return (
    <span style={{ fontSize: 11, color: cor, background: `${cor}15`, borderRadius: 6, padding: '2px 6px', fontWeight: 600 }}>
      {label}
    </span>
  )
}

const h2 = { margin: 0, fontSize: 18, fontWeight: 700 }
const sel = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, marginBottom: 16, background: '#fff', cursor: 'pointer' }
const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }
