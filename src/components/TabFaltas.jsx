import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const TIPOS = {
  injustificada: { label: 'Injustificada', cor: '#dc2626', bg: '#fef2f2' },
  atestado: { label: 'Com Atestado', cor: '#d97706', bg: '#fffbeb' },
}

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

export default function TabFaltas() {
  const fileRef = useRef(null)
  const [funcionarios, setFuncionarios] = useState([])
  const [faltas, setFaltas] = useState([])
  const [mes, setMes] = useState(mesAtual())
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ funcionario_id: '', data: '', tipo: 'injustificada', motivo: '' })
  const [arquivo, setArquivo] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  useEffect(() => { carregarFuncionarios() }, [])
  useEffect(() => { carregarFaltas() }, [mes])

  async function carregarFuncionarios() {
    const { data } = await supabase.from('rh_funcionarios').select('id, nome').order('nome')
    if (data) setFuncionarios(data)
  }

  async function carregarFaltas() {
    setLoading(true)
    const inicio = `${mes}-01`
    const [ano, m] = mes.split('-').map(Number)
    const fim = `${mes}-${new Date(ano, m, 0).getDate()}`
    const { data } = await supabase
      .from('rh_faltas')
      .select('*, rh_funcionarios(nome)')
      .gte('data', inicio)
      .lte('data', fim)
      .order('data', { ascending: false })
    if (data) setFaltas(data)
    setLoading(false)
  }

  async function enviarDocumento() {
    if (!arquivo) return { path: null, nome: null }
    const nomeSeguro = arquivo.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]+/g, '-')
      .toLowerCase()
    const path = `${form.funcionario_id}/${form.data}-${Date.now()}-${nomeSeguro}`
    const { error } = await supabase.storage
      .from('documentos-faltas')
      .upload(path, arquivo, { upsert: true, contentType: arquivo.type || undefined })
    if (error) throw error
    return { path, nome: arquivo.name }
  }

  async function salvar() {
    if (!form.funcionario_id || !form.data) {
      setMsg({ tipo: 'erro', texto: 'Selecione o funcionário e a data.' })
      return
    }
    setSalvando(true)
    try {
      const documento = await enviarDocumento()
      const { error } = await supabase.from('rh_faltas').insert({
        funcionario_id: form.funcionario_id,
        data: form.data,
        tipo: form.tipo,
        motivo: form.motivo || null,
        documento_path: documento.path,
        documento_nome: documento.nome,
      })
      if (error) throw error
      setMsg({ tipo: 'ok', texto: 'Falta registrada!' })
      setForm({ funcionario_id: '', data: '', tipo: 'injustificada', motivo: '' })
      setArquivo(null)
      if (fileRef.current) fileRef.current.value = ''
      setMostrarForm(false)
      carregarFaltas()
      setTimeout(() => setMsg(null), 3000)
    } catch (error) {
      setMsg({ tipo: 'erro', texto: error.message || 'Não foi possível salvar o registro.' })
    } finally {
      setSalvando(false)
    }
  }

  async function abrirDocumento(path) {
    const { data, error } = await supabase.storage
      .from('documentos-faltas')
      .createSignedUrl(path, 60 * 5)
    if (error) {
      setMsg({ tipo: 'erro', texto: error.message })
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function deletar(id) {
    if (!confirm('Excluir este registro?')) return
    await supabase.from('rh_faltas').delete().eq('id', id)
    carregarFaltas()
  }

  function formatData(d) {
    if (!d) return ''
    const [a, m, dia] = d.split('-')
    return `${dia}/${m}/${a}`
  }

  const porFunc = faltas.reduce((acc, f) => {
    const nome = f.rh_funcionarios?.nome || '?'
    if (!acc[nome]) acc[nome] = []
    acc[nome].push(f)
    return acc
  }, {})

  const totalInj = faltas.filter(f => f.tipo === 'injustificada').length
  const totalAtest = faltas.filter(f => f.tipo === 'atestado').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={h2}>Faltas</h2>
        <button onClick={() => { setMostrarForm(!mostrarForm); setMsg(null) }} style={btnNovo}>+ Registrar falta</button>
      </div>

      {mostrarForm && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Registrar falta</div>
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
                <option value="injustificada">Falta Injustificada</option>
                <option value="atestado">Falta com Atestado</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Motivo / Observação <span style={{ color: '#888', fontWeight: 400 }}>(opcional)</span></label>
              <input style={inp} placeholder="Ex: Não compareceu sem justificativa" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Documento <span style={{ color: '#888', fontWeight: 400 }}>(opcional)</span></label>
              <input ref={fileRef} style={inp} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={e => setArquivo(e.target.files?.[0] || null)} />
            </div>
          </div>
          {msg && <Mensagem msg={msg} />}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={salvar} disabled={salvando} style={{ flex: 1, padding: 11, background: '#e63946', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: salvando ? 'default' : 'pointer' }}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setMostrarForm(false)} style={{ padding: '11px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {!mostrarForm && msg && <Mensagem msg={msg} />}

      <select value={mes} onChange={e => setMes(e.target.value)} style={sel}>
        {gerarOpcoesMes().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
      </select>

      {faltas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: '#fef2f2', borderRadius: 10, padding: '12px 16px', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: 12, color: '#888' }}>Injustificadas</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>{totalInj}</div>
          </div>
          <div style={{ background: '#fffbeb', borderRadius: 10, padding: '12px 16px', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: 12, color: '#888' }}>Com atestado</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706' }}>{totalAtest}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Carregando...</div>
      ) : faltas.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#888' }}>Nenhuma falta registrada neste mês.</div>
      ) : (
        Object.entries(porFunc).map(([nome, fs]) => (
          <div key={nome} style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
              {nome.split(' ')[0]} {nome.split(' ')[1] || ''}
              <span style={{ marginLeft: 8, background: '#fef2f2', color: '#dc2626', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                {fs.length} falta{fs.length > 1 ? 's' : ''}
              </span>
            </div>
            {fs.map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, marginBottom: 6, background: TIPOS[f.tipo]?.bg || '#f9fafb', border: `1px solid ${TIPOS[f.tipo]?.cor}30` }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: f.motivo ? 4 : 0 }}>
                    <span style={{ background: TIPOS[f.tipo]?.cor, color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{TIPOS[f.tipo]?.label}</span>
                    <span style={{ color: '#888', fontSize: 12 }}>{formatData(f.data)}</span>
                  </div>
                  {f.motivo && <div style={{ fontSize: 13, color: '#555' }}>{f.motivo}</div>}
                  {f.documento_path && (
                    <button onClick={() => abrirDocumento(f.documento_path)} style={btnDoc}>
                      Abrir documento{f.documento_nome ? `: ${f.documento_nome}` : ''}
                    </button>
                  )}
                </div>
                <button onClick={() => deletar(f.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>Excluir</button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}

function Mensagem({ msg }) {
  return (
    <div style={{ borderRadius: 8, padding: '10px 14px', marginBottom: 12, background: msg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.tipo === 'ok' ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 600 }}>
      {msg.texto}
    </div>
  )
}

const h2 = { margin: 0, fontSize: 18, fontWeight: 700 }
const card = { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', marginBottom: 16 }
const btnNovo = { background: '#e63946', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const sel = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, marginBottom: 16, background: '#fff', cursor: 'pointer' }
const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }
const btnDoc = { display: 'inline-block', marginTop: 6, padding: 0, border: 'none', background: 'transparent', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }
