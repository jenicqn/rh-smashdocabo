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

function diasNoMes(mes) {
  const [a, m] = mes.split('-').map(Number)
  return new Date(a, m, 0).getDate()
}

function eraAtivoNaData(func, mes, dia) {
  const [ano, month] = mes.split('-').map(Number)
  const dataRef = new Date(ano, month - 1, dia)

  if (func.data_admissao) {
    const admissao = new Date(func.data_admissao + 'T00:00:00')
    if (admissao > dataRef) return false
  }

  if (func.status === 'demitido') {
    if (!func.data_saida) return false
    const saida = new Date(func.data_saida + 'T00:00:00')
    return dataRef <= saida
  }

  const pausas = func.pausas || []
  for (const p of pausas) {
    if (!p.inicio) continue
    const ini = new Date(p.inicio + 'T00:00:00')
    const fim = p.fim ? new Date(p.fim + 'T00:00:00') : null
    if (dataRef >= ini && (!fim || dataRef <= fim)) return false
  }

  return true
}

function idsDoLancamento(lancamento) {
  return Array.isArray(lancamento.funcionarios)
    ? lancamento.funcionarios
    : JSON.parse(lancamento.funcionarios || '[]')
}

export default function TabComissoes() {
  const [mes, setMes] = useState(mesAtual())
  const [dia, setDia] = useState(new Date().getDate())
  const [valor, setValor] = useState('')
  const [todosFuncionarios, setTodosFuncionarios] = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [ativosNaData, setAtivosNaData] = useState([])
  const [lancamentos, setLancamentos] = useState([])
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [resumo, setResumo] = useState([])
  const [lancamentosAberto, setLancamentosAberto] = useState(false)
  const [editando, setEditando] = useState(null)

  useEffect(() => { carregarFuncionarios() }, [])
  useEffect(() => { carregarLancamentos() }, [mes])
  useEffect(() => { atualizarAtivosNaData() }, [mes, dia, todosFuncionarios])
  useEffect(() => { calcularResumo() }, [lancamentos, todosFuncionarios])

  async function carregarFuncionarios() {
    const { data } = await supabase.from('rh_funcionarios').select('*').order('nome')
    if (data) setTodosFuncionarios(data.filter(f => !f.is_owner))
  }

  function atualizarAtivosNaData() {
    if (!todosFuncionarios.length) return
    const ativos = todosFuncionarios.filter(f => eraAtivoNaData(f, mes, parseInt(dia)))
    setAtivosNaData(ativos)
    setSelecionados(ativos.map(f => f.id))
  }

  async function carregarLancamentos() {
    setLoading(true)
    const { data } = await supabase.from('rh_comissoes').select('*').eq('mes', mes).order('dia', { ascending: true })
    if (data) setLancamentos(data)
    setLoading(false)
  }

  function funcionariosNoRateio(lancamento) {
    const ids = idsDoLancamento(lancamento)

    return ids
      .map(id => todosFuncionarios.find(f => f.id === id))
      .filter(Boolean)
      .filter(f => eraAtivoNaData(f, lancamento.mes, parseInt(lancamento.dia)))
  }

  function calcularResumo() {
    const map = {}
    todosFuncionarios.forEach(f => { map[f.id] = { nome: f.nome, dias: 0, bruto: 0 } })
    lancamentos.forEach(l => {
      const funcionariosRateio = funcionariosNoRateio(l)
      if (!funcionariosRateio.length) return

      const parte = parseFloat(l.valor) / funcionariosRateio.length
      funcionariosRateio.forEach(f => {
        if (map[f.id]) {
          map[f.id].dias++
          map[f.id].bruto += parte
        }
      })
    })
    setResumo(Object.values(map).filter(r => r.dias > 0).map(r => ({ ...r, empresa: r.bruto * 0.2, liquido: r.bruto * 0.8 })))
  }

  async function handleLancar() {
    if (!valor || parseFloat(valor) <= 0) { setMsg({ tipo: 'erro', texto: 'Informe um valor válido.' }); return }
    if (!selecionados.length) { setMsg({ tipo: 'erro', texto: 'Nenhum funcionário ativo nesta data.' }); return }
    setSalvando(true)
    const { error } = await supabase.from('rh_comissoes').insert({
      mes, dia: parseInt(dia), valor: parseFloat(valor), funcionarios: selecionados
    })
    if (error) {
      setMsg({ tipo: 'erro', texto: error.message })
    } else {
      setMsg({ tipo: 'ok', texto: `Lançamento do dia ${dia} salvo!` })
      setValor('')
      carregarLancamentos()
      setTimeout(() => setMsg(null), 3000)
    }
    setSalvando(false)
  }

  async function handleDeletar(id) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('rh_comissoes').delete().eq('id', id)
    if (editando?.id === id) setEditando(null)
    carregarLancamentos()
  }

  function toggleFunc(id) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function iniciarEdicao(lancamento) {
    setEditando({
      id: lancamento.id,
      dia: String(lancamento.dia),
      valor: String(lancamento.valor),
      funcionarios: idsDoLancamento(lancamento),
    })
  }

  function alterarDiaEdicao(novoDia) {
    const ativosNovoDia = todosFuncionarios.filter(f => eraAtivoNaData(f, mes, parseInt(novoDia)))
    setEditando(prev => ({
      ...prev,
      dia: novoDia,
      funcionarios: prev.funcionarios.filter(id => ativosNovoDia.some(f => f.id === id)),
    }))
  }

  function toggleFuncEdicao(id) {
    setEditando(prev => ({
      ...prev,
      funcionarios: prev.funcionarios.includes(id)
        ? prev.funcionarios.filter(x => x !== id)
        : [...prev.funcionarios, id],
    }))
  }

  async function salvarEdicao() {
    if (!editando) return
    if (!editando.valor || parseFloat(editando.valor) <= 0) {
      setMsg({ tipo: 'erro', texto: 'Informe um valor válido.' })
      return
    }
    if (!editando.funcionarios.length) {
      setMsg({ tipo: 'erro', texto: 'Selecione ao menos um funcionário para o rateio.' })
      return
    }

    const { error } = await supabase
      .from('rh_comissoes')
      .update({
        dia: parseInt(editando.dia),
        valor: parseFloat(editando.valor),
        funcionarios: editando.funcionarios,
      })
      .eq('id', editando.id)

    if (error) {
      setMsg({ tipo: 'erro', texto: error.message })
      return
    }

    setMsg({ tipo: 'ok', texto: 'Lançamento atualizado.' })
    setEditando(null)
    carregarLancamentos()
    setTimeout(() => setMsg(null), 3000)
  }

  const totalMes = lancamentos.reduce((a, l) => a + parseFloat(l.valor), 0)
  const inativosNaData = todosFuncionarios.filter(f => !eraAtivoNaData(f, mes, parseInt(dia)) && f.status !== 'demitido')
  const totaisResumo = resumo.reduce((acc, r) => ({
    bruto: acc.bruto + r.bruto,
    empresa: acc.empresa + r.empresa,
    liquido: acc.liquido + r.liquido,
  }), { bruto: 0, empresa: 0, liquido: 0 })

  return (
    <div>
      <h2 style={h2}>Lançamento de Comissões</h2>

      <select value={mes} onChange={e => setMes(e.target.value)} style={sel}>
        {gerarOpcoesMes().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
      </select>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Novo lançamento</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={lbl}>Dia</label>
            <select value={dia} onChange={e => setDia(e.target.value)} style={inp}>
              {Array.from({ length: diasNoMes(mes) }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>Valor total (R$)</label>
            <input style={inp} type="number" step="0.01" min="0" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} />
          </div>
        </div>

        <label style={lbl}>
          Funcionários no rateio
          <span style={{ color: '#888', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>(calculado automaticamente pela data)</span>
        </label>

        {ativosNaData.length === 0 ? (
          <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
            Nenhum funcionário ativo nesta data.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {ativosNaData.map(f => (
              <label key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: selecionados.includes(f.id) ? '#fce4e6' : '#f3f4f6',
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13,
                border: selecionados.includes(f.id) ? '1.5px solid #e63946' : '1.5px solid transparent'
              }}>
                <input type="checkbox" checked={selecionados.includes(f.id)} onChange={() => toggleFunc(f.id)} style={{ cursor: 'pointer' }} />
                {f.nome.split(' ')[0]}
              </label>
            ))}
          </div>
        )}

        {inativosNaData.length > 0 && (
          <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
            Fora do rateio nesta data: {inativosNaData.map(f => f.nome.split(' ')[0]).join(', ')}
          </div>
        )}

        {selecionados.length > 0 && valor && parseFloat(valor) > 0 && (
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#555' }}>
            Cada funcionário recebe: <strong>R$ {(parseFloat(valor) / selecionados.length * 0.8).toFixed(2).replace('.', ',')}</strong>
            {' '}(líquido, 80%) - {selecionados.length} no rateio
          </div>
        )}

        {msg && (
          <div style={{ borderRadius: 8, padding: '10px 14px', marginBottom: 12, background: msg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.tipo === 'ok' ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 600 }}>
            {msg.texto}
          </div>
        )}

        <button onClick={handleLancar} disabled={salvando} style={btnPrimary(salvando)}>
          {salvando ? 'Salvando...' : 'Lançar comissão'}
        </button>
      </div>

      {resumo.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>Resumo do mês</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  {['Funcionário', 'Dias', 'Bruto', 'Empresa (20%)', 'A receber'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumo.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.nome.split(' ')[0]}</td>
                    <td style={{ padding: '8px 10px' }}>{r.dias}</td>
                    <td style={{ padding: '8px 10px' }}>R$ {r.bruto.toFixed(2).replace('.', ',')}</td>
                    <td style={{ padding: '8px 10px', color: '#dc2626' }}>R$ {r.empresa.toFixed(2).replace('.', ',')}</td>
                    <td style={{ padding: '8px 10px', color: '#16a34a', fontWeight: 700 }}>R$ {r.liquido.toFixed(2).replace('.', ',')}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
                  <td style={{ padding: '10px', fontWeight: 800 }}>Total</td>
                  <td style={{ padding: '10px' }}></td>
                  <td style={{ padding: '10px', fontWeight: 800 }}>R$ {totaisResumo.bruto.toFixed(2).replace('.', ',')}</td>
                  <td style={{ padding: '10px', color: '#dc2626', fontWeight: 800 }}>R$ {totaisResumo.empresa.toFixed(2).replace('.', ',')}</td>
                  <td style={{ padding: '10px', color: '#16a34a', fontWeight: 800 }}>R$ {totaisResumo.liquido.toFixed(2).replace('.', ',')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={card}>
        <button onClick={() => setLancamentosAberto(v => !v)} style={accordionBtn}>
          <span>Lançamentos</span>
          <span style={{ color: '#16a34a', fontWeight: 800 }}>
            R$ {totalMes.toFixed(2).replace('.', ',')} {lancamentosAberto ? '▲' : '▼'}
          </span>
        </button>
        {lancamentosAberto && (
          <div style={{ marginTop: 12 }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#888', padding: 20 }}>Carregando...</div>
            ) : lancamentos.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', padding: 20 }}>Nenhum lançamento neste mês.</div>
            ) : lancamentos.map(l => {
              const nomes = funcionariosNoRateio(l).map(f => f.nome.split(' ')[0]).join(', ') || 'Nenhum funcionário ativo no rateio'
              const ativosEdicao = editando?.id === l.id
                ? todosFuncionarios.filter(f => eraAtivoNaData(f, mes, parseInt(editando.dia)))
                : []
              return (
                <div key={l.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div>
                      <span style={{ fontWeight: 700, marginRight: 8 }}>Dia {String(l.dia).padStart(2,'0')}</span>
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>R$ {parseFloat(l.valor).toFixed(2).replace('.', ',')}</span>
                      <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{nomes}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => iniciarEdicao(l)} style={btnEdit}>Editar</button>
                      <button onClick={() => handleDeletar(l.id)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Excluir</button>
                    </div>
                  </div>

                  {editando?.id === l.id && (
                    <div style={editBox}>
                      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={lbl}>Dia</label>
                          <select value={editando.dia} onChange={e => alterarDiaEdicao(e.target.value)} style={inp}>
                            {Array.from({ length: diasNoMes(mes) }, (_, i) => i + 1).map(d => (
                              <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={lbl}>Valor total (R$)</label>
                          <input style={inp} type="number" step="0.01" min="0" value={editando.valor} onChange={e => setEditando(prev => ({ ...prev, valor: e.target.value }))} />
                        </div>
                      </div>

                      <label style={lbl}>Funcionários neste lançamento</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        {ativosEdicao.map(f => (
                          <label key={f.id} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: editando.funcionarios.includes(f.id) ? '#fce4e6' : '#f3f4f6',
                            borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13,
                            border: editando.funcionarios.includes(f.id) ? '1.5px solid #e63946' : '1.5px solid transparent'
                          }}>
                            <input type="checkbox" checked={editando.funcionarios.includes(f.id)} onChange={() => toggleFuncEdicao(f.id)} style={{ cursor: 'pointer' }} />
                            {f.nome.split(' ')[0]}
                          </label>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditando(null)} style={btnCancel}>Cancelar</button>
                        <button onClick={salvarEdicao} style={btnSave}>Salvar edição</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const h2 = { margin: '0 0 16px', fontSize: 18, fontWeight: 700 }
const card = { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid #e5e7eb' }
const sel = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, marginBottom: 16, background: '#fff', cursor: 'pointer' }
const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, boxSizing: 'border-box', outline: 'none' }
const btnPrimary = (dis) => ({ width: '100%', padding: 12, background: dis ? '#ccc' : '#e63946', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: dis ? 'default' : 'pointer' })
const accordionBtn = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: 'none', background: 'transparent', padding: 0, margin: 0, fontSize: 15, fontWeight: 800, cursor: 'pointer', textAlign: 'left' }
const editBox = { marginTop: 10, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }
const btnEdit = { background: '#f3f4f6', color: '#555', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }
const btnCancel = { background: '#f3f4f6', color: '#555', border: 'none', borderRadius: 7, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }
const btnSave = { background: '#e63946', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }



