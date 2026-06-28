import { useState, useEffect } from 'react'
import logo from '../../logo.png'
import { supabase } from '../supabase'
import zona1 from '../assets/zonas/zona-1.png'
import zona2 from '../assets/zonas/zona-2.png'
import zona3 from '../assets/zonas/zona-3.png'
import zona4 from '../assets/zonas/zona-4.png'
import zona5 from '../assets/zonas/zona-5.png'
import zona6 from '../assets/zonas/zona-6.png'

const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const INICIO_BANCO_HORAS = '2026-06-01'
const ZONAS = [
  { zona: 1, imagem: zona1, label: 'Excelencia', premio: 200, cor: '#16a34a', bg: '#f0fdf4' },
  { zona: 2, imagem: zona2, label: 'Muito bom', premio: 100, cor: '#0284c7', bg: '#f0f9ff' },
  { zona: 3, imagem: zona3, label: 'Bom', premio: 50, cor: '#7c3aed', bg: '#f5f3ff' },
  { zona: 4, imagem: zona4, label: 'Regular', premio: 0, cor: '#d97706', bg: '#fffbeb' },
  { zona: 5, imagem: zona5, label: 'Atencao', premio: 0, cor: '#dc2626', bg: '#fef2f2' },
  { zona: 6, imagem: zona6, label: 'Critico', premio: 0, cor: '#1a1a1a', bg: '#f9fafb' },
]

function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function gerarOpcoesMes(n = 6) {
  const list = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    list.push({ val, label: `${MESES[d.getMonth()]} ${d.getFullYear()}` })
  }
  return list
}

function formatMoeda(valor) {
  return `R$ ${(valor || 0).toFixed(2).replace('.', ',')}`
}

function limparHoraPonto(valor) {
  return String(valor || '')
    .replace(/\s*\([A-Za-z]\)\s*/g, ' ')
    .replace(/[?¿�]/g, '')
    .trim()
}

function horariosDoPonto(ponto) {
  const horarios = [
    ['Entrada', limparHoraPonto(ponto.entrada1)],
    ['Saída', limparHoraPonto(ponto.saida1)],
    ['Entrada', limparHoraPonto(ponto.entrada2)],
    ['Saída', limparHoraPonto(ponto.saida2)],
  ]

  if (!horarios.some(([, valor]) => valor)) return ''

  return horarios
    .map(([label, valor]) => `${label}: ${valor || '--'}`)
    .join(' | ')
}

function horarioPrevistoDoPonto(ponto, funcionario) {
  return ponto.horario_previsto || funcionario?.horario_entrada || '16:00'
}

function ultimoBancoDeHoras(pontos) {
  const comBanco = [...pontos].reverse().find(p => p.banco_saldo || p.banco_total)
  return {
    saldo: comBanco?.banco_saldo || '--',
    total: comBanco?.banco_total || '--',
  }
}

function tempoParaMinutos(valor) {
  const texto = String(valor || '').trim()
  if (!texto) return 0
  const match = texto.match(/^([+-])?(\d{1,4}):(\d{2})$/)
  if (!match) return 0
  const sinal = match[1] === '-' ? -1 : 1
  return sinal * (parseInt(match[2]) * 60 + parseInt(match[3]))
}

function formatarBancoHoras(minutos) {
  if (!minutos) return '00:00'
  const sinal = minutos < 0 ? '-' : ''
  const abs = Math.abs(minutos)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sinal}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function calcularBancoTotal(pontos) {
  const total = pontos.reduce((acc, p) => acc + tempoParaMinutos(p.banco_saldo), 0)
  return formatarBancoHoras(total)
}

function mensagemDaZona(zona) {
  if (zona === 1) return 'Parabéns, você esta na Zona 1. Continue assim.'
  if (zona === 2) return 'Você esta indo muito bem, continue assim.'
  if (zona === 3) return 'Você esta indo bem, mas cuidado para não cair de zona.'
  if (zona === 4) return 'Você ainda pode melhorar sua zona neste mes. Foque nos horários e mantenha a constância.'
  if (zona === 5) return 'Esse é um bom momento para ajustar a rota. Foque nos horários e evite atrasos e faltas.'
  return 'Vamos buscar uma virada neste mes. Um dia bem feito de cada vez já muda o resultado.'
}

function minutosDeAtraso(horasAtraso) {
  if (!horasAtraso || horasAtraso.trim() === '') return 0
  const match = horasAtraso.match(/-(\d{1,2}):(\d{2})/)
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

function eraAtivoNaData(func, mes, dia) {
  const [ano, month] = mes.split('-').map(Number)
  const dataRef = new Date(ano, month - 1, dia)

  if (!func || func.is_owner) return false

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

export default function TelaFuncionario({ usuario, onLogout }) {
  const [mes, setMes] = useState(mesAtual())
  const [funcionario, setFuncionario] = useState(null)
  const [zonaFinal, setZonaFinal] = useState(null)
  const [zonaParcial, setZonaParcial] = useState(null)
  const [comissoes, setComissoes] = useState([])
  const [pontos, setPontos] = useState([])
  const [bancoTotal, setBancoTotal] = useState('00:00')
  const [loading, setLoading] = useState(true)
  const [modalZona, setModalZona] = useState(null)

  useEffect(() => { carregarFuncionario() }, [])
  useEffect(() => { if (funcionario) carregarDados() }, [mes, funcionario?.id])

  async function carregarFuncionario() {
    const cpfLimpo = usuario.cpf.replace(/\D/g, '')
    const { data } = await supabase
      .from('rh_funcionarios')
      .select('*')
      .eq('cpf', cpfLimpo)
      .single()

    if (data) setFuncionario(data)
  }

  async function carregarDados() {
    setLoading(true)
    const inicio = `${mes}-01`
    const [ano, m] = mes.split('-').map(Number)
    const fim = `${mes}-${new Date(ano, m, 0).getDate()}`
    const cpfLimpo = usuario.cpf.replace(/\D/g, '')

    const [zonaRes, comRes, pontoRes, faltasRes, advRes, funcsRes, bancoRes] = await Promise.all([
      supabase.from('rh_zonas').select('*').eq('funcionario_id', funcionario.id).eq('mes', mes).maybeSingle(),
      supabase.from('rh_comissoes').select('*').eq('mes', mes).order('dia'),
      supabase.from('registros_ponto').select('*').eq('funcionario_cpf', cpfLimpo).gte('dia', inicio).lte('dia', fim).order('dia'),
      supabase.from('rh_faltas').select('*').eq('funcionario_id', funcionario.id).gte('data', inicio).lte('data', fim),
      supabase.from('rh_advertencias').select('*').eq('funcionario_id', funcionario.id).gte('data', inicio).lte('data', fim),
      supabase.from('rh_funcionarios').select('*'),
      supabase.from('registros_ponto').select('dia,banco_saldo').eq('funcionario_cpf', cpfLimpo).gte('dia', INICIO_BANCO_HORAS).lte('dia', fim).order('dia'),
    ])

    const pontoData = pontoRes.data || []
    const faltas = faltasRes.data || []
    const advs = advRes.data || []
    const funcionarios = funcsRes.data || []

    const minhasComissoes = (comRes.data || []).map(c => {
      const ids = idsDoLancamento(c)
      const participantes = ids
        .map(id => funcionarios.find(f => f.id === id))
        .filter(Boolean)
        .filter(f => eraAtivoNaData(f, c.mes, parseInt(c.dia)))

      if (!participantes.find(f => f.id === funcionario.id)) return null
      const parteBruta = parseFloat(c.valor) / participantes.length
      return { ...c, participantes, parteBruta, parteLiquida: parteBruta * 0.8 }
    }).filter(Boolean)

    const atrasosPequenos = pontoData.filter(p => {
      const mins = minutosDeAtraso(p.horas_atraso)
      return mins >= 1 && mins <= 5
    }).length
    const atrasosGrandes = pontoData.filter(p => minutosDeAtraso(p.horas_atraso) >= 6).length
    const faltasInj = faltas.filter(f => f.tipo === 'injustificada').length
    const faltasJust = faltas.filter(f => f.tipo !== 'injustificada').length
    const advertencias = advs.length
    const zonaNum = calcularZona(atrasosPequenos, atrasosGrandes, faltasInj, faltasJust, advertencias)
    const zonaInfo = ZONAS.find(z => z.zona === zonaNum)

    setZonaFinal(zonaRes.data || null)
    setZonaParcial({
      zona: zonaNum,
      info: zonaInfo,
      atrasosPequenos,
      atrasosGrandes,
      faltasInj,
      faltasJust,
      advertencias,
    })
    setComissoes(minhasComissoes)
    setPontos(pontoData)
    setBancoTotal(calcularBancoTotal(bancoRes.data || []))
    setLoading(false)

    setModalZona({
      zona: zonaNum,
      info: zonaInfo,
      mensagem: mensagemDaZona(zonaNum),
      detalhes: `${atrasosPequenos} atraso(s) leve(s) (1-5 min), ${atrasosGrandes} atraso(s) (6+ min)`,
    })
  }

  const totalComissao = comissoes.reduce((a, c) => a + c.parteLiquida, 0)
  const totalDesconto = comissoes.reduce((a, c) => a + c.parteBruta * 0.2, 0)
  const atrasos = pontos.filter(p => p.horas_atraso && p.horas_atraso.trim() !== '')
  const diasTrabalhados = pontos.filter(p => p.tipo_dia === 'normal').length
  const zonaFinalInfo = zonaFinal ? ZONAS.find(z => z.zona === zonaFinal.zona) : null
  const bancoHoras = ultimoBancoDeHoras(pontos)

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'Inter, Arial, sans-serif' }}>
      {modalZona && (
        <div style={overlay}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            {modalZona.info?.imagem && (
              <img src={modalZona.info.imagem} alt={`Zona ${modalZona.zona}`} style={{ width: 96, height: 96, objectFit: 'contain', marginBottom: 10 }} />
            )}
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Sua zona atual</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: modalZona.info?.cor, marginBottom: 10 }}>
              Zona {modalZona.zona} - {modalZona.info?.label}
            </div>
            <div style={{ color: modalZona.zona <= 3 ? '#166534' : '#555', fontWeight: modalZona.zona <= 3 ? 700 : 500, lineHeight: 1.45 }}>
              {modalZona.mensagem}
            </div>
            {modalZona.detalhes && <div style={{ marginTop: 12, fontSize: 13, color: '#666' }}>{modalZona.detalhes}</div>}
            <button onClick={() => setModalZona(null)} style={{ marginTop: 20, width: '100%', padding: 12, border: 'none', borderRadius: 8, background: '#e63946', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Entendi
            </button>
          </div>
        </div>
      )}

      <div style={{ background: '#1a1a1a', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logo} alt="Smash do Cabo" style={{ width: 42, height: 42, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 11, opacity: 0.55 }}>Smash do Cabo</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{usuario.nome.split(' ')[0]}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>Sair</button>
      </div>

      <main style={{ padding: '18px 14px 28px', maxWidth: 760, margin: '0 auto' }}>
        <select value={mes} onChange={e => setMes(e.target.value)} style={sel}>
          {gerarOpcoesMes().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Carregando...</div>
        ) : (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
              <div style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <div style={kicker}>Valor de comissao</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>{formatMoeda(totalComissao)}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{comissoes.length} dia(s) no rateio</div>
              </div>
              <div style={{ ...card, background: zonaParcial?.info?.bg || '#fff', borderColor: `${zonaParcial?.info?.cor || '#e5e7eb'}55` }}>
                <div style={kicker}>Zona atual (parcial)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {zonaParcial?.info?.imagem && (
                    <img src={zonaParcial.info.imagem} alt={`Zona ${zonaParcial.zona}`} style={{ width: 54, height: 54, objectFit: 'contain', flex: '0 0 auto' }} />
                  )}
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: zonaParcial?.info?.cor }}>Zona {zonaParcial?.zona}</div>
                    <div style={{ fontSize: 13, color: '#555' }}>{zonaParcial?.info?.label}</div>
                  </div>
                </div>
                {zonaFinalInfo && <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>Zona final ja fechada: Zona {zonaFinal.zona} - {zonaFinalInfo.label}</div>}
              </div>
            </section>

            <section style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Indicadores do mes</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <Mini label="Dias" valor={diasTrabalhados} />
                <Mini label="Atrasos" valor={atrasos.length} alerta={atrasos.length > 0} />
                <Mini label="Faltas" valor={(zonaParcial?.faltasInj || 0) + (zonaParcial?.faltasJust || 0)} alerta={((zonaParcial?.faltasInj || 0) + (zonaParcial?.faltasJust || 0)) > 0} />
                <Mini label="Advert." valor={zonaParcial?.advertencias || 0} alerta={(zonaParcial?.advertencias || 0) > 0} />
              </div>
            </section>

            <section style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Comissoes do mes</div>
              {comissoes.length === 0 ? (
                <div style={empty}>Nenhuma comissao lançada neste mes.</div>
              ) : comissoes.map(c => (
                <div key={c.id} style={row}>
                  <div>
                    <strong>Dia {String(c.dia).padStart(2, '0')}</strong>
                    <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>Total: {formatMoeda(parseFloat(c.valor))}</span>
                  </div>
                  <div style={{ color: '#16a34a', fontWeight: 800 }}>{formatMoeda(c.parteLiquida)}</div>
                </div>
              ))}
            </section>

            <section style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 800 }}>Espelho de ponto</div>
                <div style={{ fontSize: 12, color: '#888' }}>{pontos.length} registro(s)</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                <div style={bancoBox}>
                  <div style={bancoLabel}>Banco de horas</div>
                  <div style={bancoValor}>{bancoHoras.saldo}</div>
                </div>
                <div style={bancoBox}>
                  <div style={bancoLabel}>Banco total</div>
                  <div style={bancoValor}>{bancoTotal}</div>
                </div>
              </div>
              {pontos.length === 0 ? (
                <div style={empty}>Nenhum registro de ponto neste mes.</div>
              ) : pontos.map(p => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '74px 110px 1fr auto', gap: 10, alignItems: 'center', padding: '10px 0 10px 10px', borderBottom: '1px solid #f3f4f6', borderLeft: p.horas_atraso ? '4px solid #dc2626' : p.tipo_dia === 'normal' ? '4px solid #16a34a' : '4px solid #e5e7eb' }}>
                  <div>
                    <strong>{new Date(p.dia + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</strong>
                    <span style={{ color: '#888', fontSize: 11, marginLeft: 6 }}>{p.dia_semana}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#888', fontWeight: 700 }}>Horário de entrada</div>
                    <div style={{ fontSize: 13, color: '#111', fontWeight: 800 }}>{p.tipo_dia === 'normal' ? horarioPrevistoDoPonto(p, funcionario) : '--'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                      {p.tipo_dia === 'normal'
                        ? (horariosDoPonto(p) || '--')
                        : p.tipo_dia === 'folga' ? 'Folga' : p.tipo_dia === 'feriado' ? 'Feriado' : 'Sem marcacao'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, minWidth: 54 }}>
                    {p.total_trabalhado && <div>{p.total_trabalhado}</div>}
                    {p.horas_atraso && <div style={{ color: '#dc2626', fontWeight: 800 }}>{p.horas_atraso}</div>}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function Mini({ label, valor, alerta }) {
  return (
    <div style={{ background: alerta ? '#fef2f2' : '#f9fafb', borderRadius: 8, padding: 10, textAlign: 'center', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 11, color: '#777' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: alerta ? '#dc2626' : '#111' }}>{valor}</div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }
const sel = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, marginBottom: 14, background: '#fff', cursor: 'pointer' }
const card = { background: '#fff', borderRadius: 10, padding: 16, border: '1px solid #e5e7eb' }
const kicker = { fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 700 }
const empty = { color: '#888', fontSize: 13, textAlign: 'center', padding: 20 }
const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }
const bancoBox = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }
const bancoLabel = { fontSize: 11, color: '#777', marginBottom: 4 }
const bancoValor = { fontSize: 18, fontWeight: 800, color: '#111' }
