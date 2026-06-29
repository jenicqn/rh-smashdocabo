import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'
import { parseCSV } from '../parseCSV'

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

function horaParaMinutos(hora) {
  if (!hora) return null
  const match = hora.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

function calcularAtraso(entradaReal, horarioPrevisto) {
  if (!entradaReal || !horarioPrevisto) return ''
  const realMin = horaParaMinutos(entradaReal.trim())
  const prevHora = horaParaMinutos(horarioPrevisto.trim())
  if (realMin === null || prevHora === null) return ''
  const diff = prevHora >= 720 && realMin < 360
    ? (realMin + 1440) - prevHora
    : realMin - prevHora
  if (diff <= 0) return ''
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return `-${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function limparHora(valor) {
  return String(valor || '')
    .replace(/\s*\([A-Za-z]\)\s*/g, ' ')
    .replace(/[�¿]/g, '')
    .trim()
}

function registrosDoPonto(p) {
  return [p.entrada1, p.saida1, p.entrada2, p.saida2]
    .map(limparHora)
    .filter(Boolean)
    .join(' | ')
}

export default function TabPonto() {
  const [mes, setMes] = useState(mesAtual())
  const [arquivos, setArquivos] = useState([])
  const [processando, setProcessando] = useState(false)
  const [resultados, setResultados] = useState([])
  const [historico, setHistorico] = useState([])
  const [funcionarios, setFuncionarios] = useState([])
  const [cartao, setCartao] = useState(null)
  const [loadingCartao, setLoadingCartao] = useState(false)
  const [pontosEditados, setPontosEditados] = useState({})
  const [salvandoPonto, setSalvandoPonto] = useState({})
  const [recalculando, setRecalculando] = useState(false)
  const inputRef = useRef()

  useEffect(() => { carregarTudo() }, [])

  async function carregarTudo() {
    await Promise.all([carregarHistorico(), carregarFuncionarios()])
  }

  async function carregarHistorico() {
    const { data } = await supabase
      .from('uploads_ponto')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(20)
    if (data) setHistorico(data)
  }

  async function carregarFuncionarios() {
    const { data } = await supabase
      .from('rh_funcionarios')
      .select('id, nome, cpf, cargo, departamento, horario_entrada, status, is_owner')
      .neq('status', 'demitido')
      .neq('is_owner', true)
      .order('nome')
    if (data) setFuncionarios(data)
  }

  async function handleImportar() {
    if (!arquivos.length) return
    setProcessando(true)
    setResultados([])
    const res = []

    for (const file of arquivos) {
      try {
        const text = await file.text()
        const parsed = parseCSV(text, file.name)
        if (!parsed) { res.push({ arquivo: file.name, status: 'erro', msg: 'Formato inválido' }); continue }

        const { funcionario, registros, periodo } = parsed

        const { data: funcionarioAtual } = await supabase
          .from('rh_funcionarios')
          .select('horario_entrada')
          .eq('cpf', funcionario.cpf)
          .maybeSingle()

        const horarioPadrao = funcionarioAtual?.horario_entrada || '16:00'
        const diasImportados = registros.map(r => r.dia).filter(Boolean)
        const { data: pontosExistentes } = diasImportados.length
          ? await supabase
            .from('registros_ponto')
            .select('dia, horario_previsto')
            .eq('funcionario_cpf', funcionario.cpf)
            .in('dia', diasImportados)
          : { data: [] }

        const horarioEditadoPorDia = {}
        pontosExistentes?.forEach(p => {
          if (p.horario_previsto) horarioEditadoPorDia[p.dia] = p.horario_previsto
        })

        const registrosComAtraso = registros.map(r => {
          const horarioPrevisto = horarioEditadoPorDia[r.dia] || horarioPadrao
          return {
            ...r,
            horario_previsto: horarioPrevisto,
            horas_atraso: r.tipo_dia === 'normal' ? calcularAtraso(r.entrada1, horarioPrevisto) : '',
          }
        })

        await supabase.from('rh_funcionarios').upsert({
          nome: funcionario.nome,
          cpf: funcionario.cpf,
          cargo: funcionario.cargo,
          departamento: funcionario.departamento,
          data_admissao: funcionario.data_admissao,
        }, { onConflict: 'cpf', ignoreDuplicates: false })

        let erroReg = null
        for (let i = 0; i < registrosComAtraso.length; i += 50) {
          const batch = registrosComAtraso.slice(i, i + 50).map(r => ({ ...r, periodo }))
          const { error } = await supabase.from('registros_ponto').upsert(batch, { onConflict: 'funcionario_cpf,dia' })
          if (error) { erroReg = error.message; break }
        }
        if (erroReg) { res.push({ arquivo: file.name, status: 'erro', msg: erroReg }); continue }

        await supabase.from('uploads_ponto').insert({
          periodo, arquivo: file.name,
          funcionario_nome: funcionario.nome,
          funcionario_cpf: funcionario.cpf,
          total_registros: registrosComAtraso.length,
        })

        res.push({ arquivo: file.name, status: 'ok', msg: `${funcionario.nome} - ${registrosComAtraso.length} dias (${periodo})` })
      } catch (e) {
        res.push({ arquivo: file.name, status: 'erro', msg: e.message })
      }
    }

    setResultados(res)
    setProcessando(false)
    setArquivos([])
    if (inputRef.current) inputRef.current.value = ''
    carregarTudo()
  }

  async function abrirCartao(func) {
    setLoadingCartao(true)
    setPontosEditados({})
    setCartao({ func, pontos: [] })
    const inicio = `${mes}-01`
    const [ano, m] = mes.split('-').map(Number)
    const fim = `${mes}-${new Date(ano, m, 0).getDate()}`
    const { data } = await supabase
      .from('registros_ponto')
      .select('*')
      .eq('funcionario_cpf', func.cpf)
      .gte('dia', inicio)
      .lte('dia', fim)
      .order('dia')
    setCartao({ func, pontos: data || [] })
    setLoadingCartao(false)
  }

  function getPonto(p, func) {
    const editado = pontosEditados[p.id]
    const horarioPrevisto = editado?.horario_previsto ?? p.horario_previsto ?? func?.horario_entrada ?? '16:00'
    const atraso = p.tipo_dia === 'normal' ? calcularAtraso(p.entrada1, horarioPrevisto) : ''
    return { ...p, ...editado, horario_previsto: horarioPrevisto, horas_atraso: atraso }
  }

  function handleHorarioPrevisto(p, valor) {
    setPontosEditados(prev => ({
      ...prev,
      [p.id]: { horario_previsto: valor, horas_atraso: calcularAtraso(p.entrada1, valor) }
    }))
  }

  async function salvarHorario(p, func) {
    const editado = pontosEditados[p.id]
    if (!editado) return
    setSalvandoPonto(prev => ({ ...prev, [p.id]: true }))
    const horarioPrevisto = editado.horario_previsto ?? p.horario_previsto ?? func?.horario_entrada ?? '16:00'
    const atraso = calcularAtraso(p.entrada1, horarioPrevisto)
    const { error } = await supabase.from('registros_ponto')
      .update({ horario_previsto: horarioPrevisto, horas_atraso: atraso })
      .eq('id', p.id)
    if (error) {
      alert(`Não foi possível salvar o horário editado: ${error.message}`)
      setSalvandoPonto(prev => ({ ...prev, [p.id]: false }))
      return
    }
    setCartao(prev => ({
      ...prev,
      pontos: prev.pontos.map(pp => pp.id === p.id ? { ...pp, horario_previsto: horarioPrevisto, horas_atraso: atraso } : pp)
    }))
    setPontosEditados(prev => { const n = { ...prev }; delete n[p.id]; return n })
    setSalvandoPonto(prev => ({ ...prev, [p.id]: false }))
  }

  async function recalcularTodosAtrasos() {
    if (!cartao) return
    setRecalculando(true)
    const atualizados = []
    for (const p of cartao.pontos) {
      if (p.tipo_dia !== 'normal') continue
      const horarioPrevisto = pontosEditados[p.id]?.horario_previsto ?? p.horario_previsto ?? cartao.func.horario_entrada ?? '16:00'
      const atraso = calcularAtraso(p.entrada1, horarioPrevisto)
      const { error } = await supabase.from('registros_ponto')
        .update({ horario_previsto: horarioPrevisto, horas_atraso: atraso })
        .eq('id', p.id)
      if (error) {
        alert(`Não foi possível recalcular os atrasos: ${error.message}`)
        setRecalculando(false)
        return
      }
      atualizados.push({ id: p.id, horario_previsto: horarioPrevisto, horas_atraso: atraso })
    }
    setCartao(prev => ({
      ...prev,
      pontos: prev.pontos.map(p => {
        const atualizado = atualizados.find(a => a.id === p.id)
        return atualizado ? { ...p, ...atualizado } : p
      })
    }))
    setPontosEditados({})
    setRecalculando(false)
  }

  function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const ultimoUpload = historico[0]
  const porPeriodo = historico.reduce((acc, h) => {
    if (!acc[h.periodo]) acc[h.periodo] = []
    acc[h.periodo].push(h)
    return acc
  }, {})

  return (
    <div>
      {cartao && (
        <div style={overlay}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 860, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Cartão de ponto</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                  {cartao.func.nome} - {MESES[parseInt(mes.split('-')[1]) - 1]} {mes.split('-')[0]}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={recalcularTodosAtrasos} disabled={recalculando} style={btnDark(recalculando)}>
                  {recalculando ? 'Recalculando...' : 'Recalcular atrasos'}
                </button>
                <button onClick={() => setCartao(null)} style={btnGhost}>Fechar</button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', padding: '16px 24px' }}>
              {loadingCartao ? (
                <div style={empty}>Carregando...</div>
              ) : cartao.pontos.length === 0 ? (
                <div style={empty}>Nenhum registro de ponto importado para este mes.</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '70px 118px 1fr 82px', gap: 8, padding: '6px 8px', fontSize: 11, color: '#888', fontWeight: 700, borderBottom: '1px solid #e5e7eb', marginBottom: 4 }}>
                    <div>Data</div>
                    <div>Horário de entrada</div>
                    <div>Registros</div>
                    <div style={{ textAlign: 'right' }}>Atraso</div>
                  </div>

                  {cartao.pontos.map(p => {
                    const pp = getPonto(p, cartao.func)
                    const foiEditado = !!pontosEditados[p.id]
                    const temAtraso = pp.horas_atraso && pp.horas_atraso.trim() !== ''
                    const dataFmt = new Date(p.dia + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

                    return (
                      <div key={p.id} style={{
                        display: 'grid', gridTemplateColumns: '70px 118px 1fr 82px',
                        gap: 8, alignItems: 'center', padding: 8, borderRadius: 8, marginBottom: 3,
                        background: temAtraso ? '#fef2f2' : p.tipo_dia === 'normal' ? '#f0fdf4' : '#f9fafb',
                        border: temAtraso ? '1px solid #fecaca' : '1px solid transparent'
                      }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{dataFmt}</span>
                          <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>{p.dia_semana}</span>
                        </div>
                        <div>
                          {p.tipo_dia === 'normal' ? (
                            <input
                              type="time"
                              value={pp.horario_previsto}
                              onChange={e => handleHorarioPrevisto(p, e.target.value)}
                              onBlur={() => foiEditado && salvarHorario(p, cartao.func)}
                              style={{ width: '100%', padding: '5px 4px', borderRadius: 6, border: foiEditado ? '1.5px solid #e63946' : '1.5px solid #ddd', fontSize: 12, background: foiEditado ? '#fff5f5' : '#fff', boxSizing: 'border-box' }}
                            />
                          ) : <span style={{ fontSize: 12, color: '#aaa' }}>--</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#333' }}>
                          {p.tipo_dia === 'normal'
                            ? (registrosDoPonto(p) || '--')
                            : p.tipo_dia === 'folga' ? 'Folga'
                              : p.tipo_dia === 'feriado' ? 'Feriado'
                                : p.tipo_dia === 'justificado' ? 'Justificado'
                                  : 'Sem marcação'}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {salvandoPonto[p.id] ? (
                            <span style={{ fontSize: 11, color: '#888' }}>Salvando</span>
                          ) : temAtraso ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', background: '#fee2e2', borderRadius: 6, padding: '2px 6px' }}>{pp.horas_atraso}</span>
                          ) : p.tipo_dia === 'normal' ? (
                            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>OK</span>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ fontSize: 11, color: '#888', marginTop: 12, textAlign: 'center' }}>
                    Se o horário não for alterado, será usado o padrão do funcionário: {cartao.func.horario_entrada || '16:00'}.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        <aside>
          <h2 style={h2}>Importar ponto</h2>
          <div style={uploadBox} onClick={() => inputRef.current?.click()}>
            <div style={{ fontWeight: 700, color: '#333', marginBottom: 4 }}>Selecionar CSV</div>
            <div style={{ color: '#888', fontSize: 12 }}>Vários arquivos de uma vez</div>
            <input ref={inputRef} type="file" accept=".csv" multiple
              onChange={e => { setArquivos(Array.from(e.target.files)); setResultados([]) }}
              style={{ display: 'none' }} />
          </div>

          {arquivos.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {arquivos.map((f, i) => <div key={i} style={cardSmall}>{f.name}</div>)}
              <button onClick={handleImportar} disabled={processando} style={btnPrimary(processando)}>
                {processando ? 'Importando...' : 'Importar para o sistema'}
              </button>
            </div>
          )}

          {ultimoUpload && (
            <div style={infoBox}>
              <div style={{ fontSize: 11, color: '#888', fontWeight: 700, marginBottom: 4 }}>Último upload</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{ultimoUpload.funcionario_nome}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{ultimoUpload.periodo} - {formatDate(ultimoUpload.uploaded_at)}</div>
            </div>
          )}

          {resultados.map((r, i) => (
            <div key={i} style={{
              borderRadius: 8, padding: '10px 12px', marginBottom: 8,
              background: r.status === 'ok' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${r.status === 'ok' ? '#bbf7d0' : '#fecaca'}`,
              fontSize: 12,
              color: r.status === 'ok' ? '#166534' : '#991b1b'
            }}>
              {r.msg}
            </div>
          ))}

          <h3 style={{ margin: '18px 0 10px', fontSize: 14, fontWeight: 800 }}>Histórico</h3>
          {historico.length === 0 ? (
            <div style={emptySmall}>Nenhum upload ainda.</div>
          ) : (
            Object.entries(porPeriodo).map(([periodo, items]) => (
              <div key={periodo} style={{ marginBottom: 12 }}>
                <div style={periodoHeader}>{periodo}</div>
                {items.slice(0, 4).map(h => (
                  <div key={h.id} style={historicoItem}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{h.funcionario_nome.split(' ').slice(0, 2).join(' ')}</div>
                    <div style={{ color: '#888', fontSize: 11 }}>{h.total_registros} dias - {formatDate(h.uploaded_at)}</div>
                  </div>
                ))}
              </div>
            ))
          )}
        </aside>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
            <h2 style={h2}>Funcionários e ponto</h2>
            <select value={mes} onChange={e => setMes(e.target.value)} style={sel}>
              {gerarOpcoesMes().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>

          {funcionarios.map(f => (
            <button key={f.id} onClick={() => abrirCartao(f)} style={funcCard}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{f.nome}</div>
                <div style={{ color: '#777', fontSize: 12, marginTop: 3 }}>
                  Padrão: {f.horario_entrada || '16:00'} - {f.cargo || 'Sem cargo'}
                </div>
              </div>
              <span style={{ fontSize: 12, color: '#e63946', fontWeight: 700 }}>Editar ponto</span>
            </button>
          ))}
        </section>
      </div>
    </div>
  )
}

const h2 = { margin: '0 0 12px', fontSize: 18, fontWeight: 800 }
const uploadBox = { background: '#fff', borderRadius: 10, padding: 18, border: '2px dashed #ddd', textAlign: 'center', marginBottom: 14, cursor: 'pointer' }
const cardSmall = { background: '#f9fafb', borderRadius: 8, padding: '8px 10px', marginBottom: 6, fontSize: 12, color: '#555', border: '1px solid #e5e7eb' }
const btnPrimary = (disabled) => ({ marginTop: 8, width: '100%', padding: 11, background: disabled ? '#ccc' : '#e63946', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: disabled ? 'default' : 'pointer' })
const btnDark = (disabled) => ({ background: disabled ? '#ccc' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: disabled ? 'default' : 'pointer', fontSize: 12, fontWeight: 700 })
const btnGhost = { background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }
const infoBox = { background: '#fff', borderRadius: 10, padding: 12, border: '1px solid #e5e7eb', marginBottom: 14 }
const emptySmall = { background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #e5e7eb', color: '#888', fontSize: 12, textAlign: 'center' }
const periodoHeader = { background: '#1a1a1a', color: '#fff', borderRadius: '8px 8px 0 0', padding: '6px 10px', fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }
const historicoItem = { background: '#fff', padding: '8px 10px', borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }
const sel = { width: 210, maxWidth: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, background: '#fff', cursor: 'pointer' }
const funcCard = { width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }
const empty = { textAlign: 'center', color: '#888', padding: 40 }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }



