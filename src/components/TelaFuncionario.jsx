import { useState, useEffect } from 'react'
import logo from '../../logo.png'
import { supabase } from '../supabase'
import zona1 from '../assets/zonas/zona-1.png'
import zona2 from '../assets/zonas/zona-2.png'
import zona3 from '../assets/zonas/zona-3.png'
import zona4 from '../assets/zonas/zona-4.png'
import zona5 from '../assets/zonas/zona-5.png'
import zona6 from '../assets/zonas/zona-6.png'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const ZONAS = [
  { zona: 1, imagem: zona1, label: 'Excelência', premio: 200, cor: '#16a34a', bg: '#f0fdf4' },
  { zona: 2, imagem: zona2, label: 'Muito bom', premio: 100, cor: '#0284c7', bg: '#f0f9ff' },
  { zona: 3, imagem: zona3, label: 'Bom', premio: 50, cor: '#7c3aed', bg: '#f5f3ff' },
  { zona: 4, imagem: zona4, label: 'Regular', premio: 0, cor: '#d97706', bg: '#fffbeb' },
  { zona: 5, imagem: zona5, label: 'Atenção', premio: 0, cor: '#dc2626', bg: '#fef2f2' },
  { zona: 6, imagem: zona6, label: 'Crítico', premio: 0, cor: '#1a1a1a', bg: '#f9fafb' },
]
const BONIFICACOES_TEMPO_CASA = [
  { meses: 24, valor: 1000 },
  { meses: 36, valor: 1500 },
  { meses: 48, valor: 2000 },
  { meses: 60, valor: 3000 },
  { meses: 72, valor: 4000 },
]

function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function mesAnterior(mes) {
  const [ano, month] = mes.split('-').map(Number)
  const d = new Date(ano, month - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function mesEstaFechado(mes) {
  const [ano, month] = mes.split('-').map(Number)
  const inicioProximoMês = new Date(ano, month, 1)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return hoje >= inicioProximoMês
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

function formatarData(valor) {
  if (!valor) return 'Não informada'
  return new Date(valor + 'T12:00:00').toLocaleDateString('pt-BR')
}

function formatarDataHora(valor) {
  if (!valor) return 'Não informada'
  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mesesEntreDatas(inicio, fim) {
  let meses = (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth())
  if (fim.getDate() < inicio.getDate()) meses -= 1
  return Math.max(0, meses)
}

function somarMeses(data, meses) {
  const resultado = new Date(data)
  const diaOriginal = resultado.getDate()
  resultado.setMonth(resultado.getMonth() + meses)
  if (resultado.getDate() !== diaOriginal) resultado.setDate(0)
  return resultado
}

function formatarTempo(meses) {
  const anos = Math.floor(meses / 12)
  const resto = meses % 12
  const textoMeses = resto === 1 ? '1 mês' : `${resto} meses`
  if (anos === 0) return textoMeses
  if (resto === 0) return `${anos} ano${anos === 1 ? '' : 's'}`
  return `${anos} ano${anos === 1 ? '' : 's'} e ${textoMeses}`
}

function calcularBonificacaoTempoCasa(dataAdmissao) {
  if (!dataAdmissao) return null

  const admissao = new Date(dataAdmissao + 'T12:00:00')
  const hoje = new Date()
  const mesesDeCasa = mesesEntreDatas(admissao, hoje)
  const proxima = BONIFICACOES_TEMPO_CASA.find(item => item.meses > mesesDeCasa)
  const ultima = [...BONIFICACOES_TEMPO_CASA].reverse().find(item => item.meses <= mesesDeCasa) || null

  if (!proxima) {
    return {
      admissao,
      mesesDeCasa,
      ultima,
      proxima: null,
      dataProxima: null,
      mesesFaltantes: 0,
      diasFaltantes: 0,
    }
  }

  const dataProxima = somarMeses(admissao, proxima.meses)
  const hojeMeiaNoite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const dataProximaMeiaNoite = new Date(dataProxima.getFullYear(), dataProxima.getMonth(), dataProxima.getDate())
  const diasFaltantes = Math.max(0, Math.ceil((dataProximaMeiaNoite - hojeMeiaNoite) / 86400000))

  return {
    admissao,
    mesesDeCasa,
    ultima,
    proxima,
    dataProxima,
    mesesFaltantes: proxima.meses - mesesDeCasa,
    diasFaltantes,
  }
}

function limparHoraPonto(valor) {
  return String(valor || '')
    .replace(/\s*\([A-Za-z]\)\s*/g, ' ')
    .replace(/[�¿]/g, '')
    .trim()
}

function horáriosDoPonto(ponto) {
  const horários = [
    ['Entrada', limparHoraPonto(ponto.entrada1)],
    ['Saída', limparHoraPonto(ponto.saida1)],
    ['Entrada', limparHoraPonto(ponto.entrada2)],
    ['Saída', limparHoraPonto(ponto.saida2)],
  ]

  if (!horários.some(([, valor]) => valor)) return ''

  return horários
    .map(([label, valor]) => `${label}: ${valor || '--'}`)
    .join(' | ')
}

function horarioPrevistoDoPonto(ponto, funcionario) {
  return ponto.horario_previsto || funcionario?.horario_entrada || '16:00'
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

function bancoDoMesPeloArquivo(pontos) {
  const ultimoComSaldo = [...pontos].reverse().find(p => String(p.banco_saldo || '').trim())
  if (ultimoComSaldo?.banco_saldo) return ultimoComSaldo.banco_saldo
  const ultimoComTotal = [...pontos].reverse().find(p => String(p.banco_total || '').trim())
  return ultimoComTotal?.banco_total || '00:00'
}

function bancoDoMes(pontos, ajuste) {
  const bancoAjustado = String(ajuste?.banco_horas || '').trim()
  if (bancoAjustado && bancoAjustado !== '00:00') return ajuste.banco_horas
  return bancoDoMesPeloArquivo(pontos)
}

function calcularBancoSemestre(pontos, ajustes = []) {
  const saldoPorMes = {}
  pontos.forEach(p => {
    if (!p.dia) return
    const saldoMes = String(p.banco_saldo || '').trim()
    const totalFallback = String(p.banco_total || '').trim()
    if (!saldoMes && !totalFallback) return
    saldoPorMes[p.dia.slice(0, 7)] = saldoMes || totalFallback
  })

  ajustes.forEach(a => {
    const bancoAjustado = String(a.banco_horas || '').trim()
    if (!a.mes || !bancoAjustado || bancoAjustado === '00:00') return
    saldoPorMes[a.mes] = a.banco_horas
  })

  const total = Object.values(saldoPorMes)
    .reduce((acc, valor) => acc + tempoParaMinutos(valor), 0)

  return formatarBancoHoras(total)
}

function intervaloSemestre(mes) {
  const [ano, month] = mes.split('-').map(Number)
  const inicioMes = month <= 6 ? 1 : 7
  const fimMes = month <= 6 ? 6 : 12
  const inicio = `${ano}-${String(inicioMes).padStart(2, '0')}-01`
  const fim = `${ano}-${String(fimMes).padStart(2, '0')}-${new Date(ano, fimMes, 0).getDate()}`
  return { inicio, fim }
}

function mensagemDaZona(zona) {
  if (zona === 1) return 'Parabéns, você está na Zona 1. Continue assim.'
  if (zona === 2) return 'Você está indo muito bem, continue assim.'
  if (zona === 3) return 'Você está indo bem, mas cuidado para não cair de zona.'
  if (zona === 4) return 'Você pode fazer melhor! Foque nos horários e mantenha a constância.'
  if (zona === 5) return 'Esse é um bom momento para ajustar a rota. Reavalie as suas prioridades.'
  return 'Vamos buscar uma virada neste mês. Um dia bem feito de cada vez já muda o resultado.'
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 720)

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 720)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return isMobile
}

export default function TelaFuncionario({ usuario, onLogout }) {
  const isMobile = useIsMobile()
  const [abaPortal, setAbaPortal] = useState('painel')
  const [mes, setMes] = useState(mesAtual())
  const [funcionario, setFuncionario] = useState(null)
  const [zonaFinal, setZonaFinal] = useState(null)
  const [zonaAnterior, setZonaAnterior] = useState(null)
  const [zonaParcial, setZonaParcial] = useState(null)
  const [comissoes, setComissoes] = useState([])
  const [ajusteComissao, setAjusteComissao] = useState(0)
  const [comissaoAnterior, setComissaoAnterior] = useState(0)
  const [comissoesAberto, setComissoesAberto] = useState(false)
  const [espelhoAberto, setEspelhoAberto] = useState(false)
  const [pontos, setPontos] = useState([])
  const [bancoMes, setBancoMes] = useState('00:00')
  const [bancoTotal, setBancoTotal] = useState('00:00')
  const [premiacaoSemestre, setPremiacaoSemestre] = useState(0)
  const [documentos, setDocumentos] = useState([])
  const [ultimoUpload, setUltimoUpload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalZona, setModalZona] = useState(null)

  useEffect(() => { carregarFuncionario() }, [])
  useEffect(() => { carregarDocumentos() }, [])
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

  async function carregarDocumentos() {
    let resultado = await supabase
      .from('rh_documentos_empresa')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: false })

    if (resultado.error) {
      resultado = await supabase
        .from('rh_documentos_empresa')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false })
    }

    setDocumentos(resultado.data || [])
  }

  async function carregarDados() {
    setLoading(true)
    const inicio = `${mes}-01`
    const [ano, m] = mes.split('-').map(Number)
    const fim = `${mes}-${new Date(ano, m, 0).getDate()}`
    const cpfLimpo = usuario.cpf.replace(/\D/g, '')
    const mesAnt = mesAnterior(mes)
    const semestre = intervaloSemestre(mes)

    const [zonaRes, zonaAntRes, comRes, comAntRes, pontoRes, faltasRes, advRes, funcsRes, bancoRes, ajusteRes, ajustesSemestreRes, zonasSemestreRes, uploadRes] = await Promise.all([
      supabase.from('rh_zonas').select('*').eq('funcionario_id', funcionario.id).eq('mes', mes).maybeSingle(),
      supabase.from('rh_zonas').select('*').eq('funcionario_id', funcionario.id).eq('mes', mesAnt).maybeSingle(),
      supabase.from('rh_comissoes').select('*').eq('mes', mes).order('dia'),
      supabase.from('rh_comissoes').select('*').eq('mes', mesAnt).order('dia'),
      supabase.from('registros_ponto').select('*').eq('funcionario_cpf', cpfLimpo).gte('dia', inicio).lte('dia', fim).order('dia'),
      supabase.from('rh_faltas').select('*').eq('funcionario_id', funcionario.id).gte('data', inicio).lte('data', fim),
      supabase.from('rh_advertencias').select('*').eq('funcionario_id', funcionario.id).gte('data', inicio).lte('data', fim),
      supabase.from('rh_funcionarios').select('*'),
      supabase.from('registros_ponto').select('dia,banco_saldo,banco_total').eq('funcionario_cpf', cpfLimpo).gte('dia', semestre.inicio).lte('dia', semestre.fim).order('dia'),
      supabase.from('rh_ajustes_mensais').select('*').eq('funcionario_id', funcionario.id).in('mes', [mes, mesAnt]),
      supabase.from('rh_ajustes_mensais').select('mes,banco_horas,comissao').eq('funcionario_id', funcionario.id).gte('mes', semestre.inicio.slice(0, 7)).lte('mes', semestre.fim.slice(0, 7)),
      supabase.from('rh_zonas').select('mes,premio').eq('funcionario_id', funcionario.id).gte('mes', semestre.inicio.slice(0, 7)).lte('mes', semestre.fim.slice(0, 7)),
      supabase.from('uploads_ponto').select('periodo, arquivo, uploaded_at').eq('funcionario_cpf', cpfLimpo).order('uploaded_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    const pontoData = pontoRes.data || []
    const faltas = faltasRes.data || []
    const advs = advRes.data || []
    const funcionarios = funcsRes.data || []
    const ajustesDoPeriodo = ajusteRes.data || []
    const ajusteMes = ajustesDoPeriodo.find(a => a.mes === mes)
    const ajusteMesAnterior = ajustesDoPeriodo.find(a => a.mes === mesAnt)
    const ajustesSemestre = ajustesSemestreRes.data || []

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

    const minhasComissoesAnterior = (comAntRes.data || []).map(c => {
      const ids = idsDoLancamento(c)
      const participantes = ids
        .map(id => funcionarios.find(f => f.id === id))
        .filter(Boolean)
        .filter(f => eraAtivoNaData(f, c.mes, parseInt(c.dia)))

      if (!participantes.find(f => f.id === funcionario.id)) return null
      const parteBruta = parseFloat(c.valor) / participantes.length
      return parteBruta * 0.8
    }).filter(v => v !== null)

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
    setZonaAnterior(zonaAntRes.data || null)
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
    const totalComissoesAnterior = minhasComissoesAnterior.reduce((acc, valor) => acc + valor, 0)
    const totalPremiacaoSemestre = (zonasSemestreRes.data || []).reduce((acc, z) => acc + parseFloat(z.premio || 0), 0)

    setComissaoAnterior(totalComissoesAnterior + parseFloat(ajusteMesAnterior?.comissao || 0))
    setPontos(pontoData)
    setBancoMes(bancoDoMes(pontoData, ajusteMes))
    setBancoTotal(calcularBancoSemestre(bancoRes.data || [], ajustesSemestre))
    setAjusteComissao(parseFloat(ajusteMes?.comissao || 0))
    setPremiacaoSemestre(totalPremiacaoSemestre)
    setUltimoUpload(uploadRes.data || null)
    setLoading(false)

    setModalZona({
      zona: zonaNum,
      info: zonaInfo,
      mensagem: mensagemDaZona(zonaNum),
      detalhes: `${atrasosPequenos} atraso(s) leve(s) (1-5 min), ${atrasosGrandes} atraso(s) (6+ min)`,
    })
  }

  function baixarEspelhoPdf() {
    const tituloMes = gerarOpcoesMes().find(o => o.val === mes)?.label || mes
    const linhas = pontos.map(p => `
      <tr>
        <td>${new Date(p.dia + 'T12:00').toLocaleDateString('pt-BR')}</td>
        <td>${p.dia_semana || ''}</td>
        <td>${p.tipo_dia === 'normal' ? horarioPrevistoDoPonto(p, funcionario) : '--'}</td>
        <td>${p.tipo_dia === 'normal' ? (horáriosDoPonto(p) || '--') : p.tipo_dia}</td>
        <td>${p.total_trabalhado || ''}</td>
        <td>${p.horas_atraso || ''}</td>
      </tr>
    `).join('')

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Espelho de ponto - ${usuario.nome}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
            h1 { font-size: 22px; margin: 0 0 4px; }
            h2 { font-size: 14px; margin: 0 0 20px; color: #555; font-weight: 400; }
            .resumo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
            .box { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
            .label { font-size: 11px; color: #666; margin-bottom: 4px; }
            .valor { font-size: 18px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; font-size: 11px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Espelho de ponto</h1>
          <h2>${usuario.nome} - ${tituloMes}</h2>
          <div class="resumo">
            <div class="box"><div class="label">Dias trabalhados</div><div class="valor">${diasTrabalhados}</div></div>
            <div class="box"><div class="label">Banco de horas mês atual</div><div class="valor">${bancoMes}</div></div>
            <div class="box"><div class="label">Banco do semestre</div><div class="valor">${bancoTotal}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Dia</th>
                <th>Horário de entrada</th>
                <th>Registros</th>
                <th>Total</th>
                <th>Atraso</th>
              </tr>
            </thead>
            <tbody>${linhas || '<tr><td colspan="6">Nenhum registro no mês.</td></tr>'}</tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `)
    win.document.close()
  }

  const totalComissao = comissoes.reduce((a, c) => a + c.parteLiquida, 0) + ajusteComissao
  const totalDesconto = comissoes.reduce((a, c) => a + c.parteBruta * 0.2, 0)
  const atrasos = pontos.filter(p => p.horas_atraso && p.horas_atraso.trim() !== '')
  const diasTrabalhados = pontos.filter(p => p.tipo_dia === 'normal').length
  const zonaFinalInfo = zonaFinal ? ZONAS.find(z => z.zona === zonaFinal.zona) : null
  const zonaAnteriorInfo = zonaAnterior ? ZONAS.find(z => z.zona === zonaAnterior.zona) : null
  const mesFechado = mesEstaFechado(mes)

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

      <div style={{ background: '#1a1a1a', color: '#fff', padding: isMobile ? '12px 14px' : '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logo} alt="Smash do Cabo" style={{ width: 42, height: 42, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 11, opacity: 0.55 }}>Smash do Cabo</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Bem-vindo(a), {usuario.nome.split(' ')[0]}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>Sair</button>
      </div>

      <main style={{ padding: isMobile ? '12px 10px 24px' : '18px 14px 28px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: isMobile ? 12 : 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#666', fontWeight: 800, marginBottom: 4 }}>Atualização dos dados</div>
          <div style={{ fontSize: 14, color: '#111', fontWeight: 800 }}>
            Última atualização: {ultimoUpload ? formatarDataHora(ultimoUpload.uploaded_at) : 'ainda não informada'}
          </div>
          <div style={{ color: '#666', fontSize: 12, marginTop: 4, lineHeight: 1.35 }}>
            As informações do portal são atualizadas 1 vez por semana.
          </div>
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #facc15', borderRadius: 10, padding: isMobile ? 12 : 14, marginBottom: 12, color: '#854d0e', fontSize: 13, fontWeight: 800, lineHeight: 1.35 }}>
          ⚠️ SITE E MODELO DE PREMIAÇÃO EM FASE DE TESTES. AS INFORMAÇÕES PODEM SOFRER ALTERAÇÕES. ⚠️
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setAbaPortal('painel')} style={portalTabBtn(abaPortal === 'painel')}>Painel</button>
          <button onClick={() => setAbaPortal('bonificacao')} style={portalTabBtn(abaPortal === 'bonificacao')}>Bonificação</button>
          <button onClick={() => setAbaPortal('documentos')} style={portalTabBtn(abaPortal === 'documentos')}>Documentos</button>
        </div>

        {abaPortal === 'documentos' ? (
          <DocumentosPortal documentos={documentos} isMobile={isMobile} />
        ) : abaPortal === 'bonificacao' ? (
          <BonificacaoPortal funcionario={funcionario} isMobile={isMobile} />
        ) : (
          <>
            <select value={mes} onChange={e => setMes(e.target.value)} style={sel}>
              {gerarOpcoesMes().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>

            {loading ? (
              <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Carregando...</div>
            ) : (
              <>
            <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1.25fr 1.15fr 1.25fr', gap: 10, marginBottom: 14 }}>
              <div style={{ ...card, padding: isMobile ? 14 : 16, background: '#fff', borderColor: '#e5e7eb' }}>
                <div style={kicker}>Comissão do último mês</div>
                <div style={{ ...valorMoeda, fontSize: isMobile ? 28 : 26, color: '#111' }}>{formatMoeda(comissaoAnterior)}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Mês anterior</div>
              </div>
              <div style={{ ...card, padding: isMobile ? 14 : 16, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <div style={kicker}>Comissão do mês atual</div>
                <div style={{ ...valorMoeda, fontSize: isMobile ? 32 : 30, color: '#16a34a' }}>{formatMoeda(totalComissao)}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{comissoes.length} dia(s) no rateio</div>
              </div>
              <div style={{ ...card, padding: isMobile ? 14 : 16, background: zonaAnteriorInfo?.bg || '#fff', borderColor: `${zonaAnteriorInfo?.cor || '#e5e7eb'}55` }}>
                <div style={kicker}>Zona do mês anterior</div>
                {zonaAnteriorInfo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={zonaAnteriorInfo.imagem} alt={`Zona ${zonaAnterior.zona}`} style={{ width: 44, height: 44, objectFit: 'contain', flex: '0 0 auto' }} />
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: zonaAnteriorInfo.cor }}>Zona {zonaAnterior.zona}</div>
                      <div style={{ fontSize: 13, color: '#555' }}>{zonaAnteriorInfo.label}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#888', lineHeight: 1.4 }}>Ainda não há zona fechada no mês anterior.</div>
                )}
              </div>
              <div style={{ ...card, padding: isMobile ? 14 : 16, background: zonaParcial?.info?.bg || '#fff', borderColor: `${zonaParcial?.info?.cor || '#e5e7eb'}55` }}>
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
                {mesFechado && zonaFinalInfo && <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>Zona final fechada: Zona {zonaFinal.zona} - {zonaFinalInfo.label}</div>}
              </div>
            </section>

            <section style={{ ...card, padding: isMobile ? 14 : 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Premiações do semestre</div>
                <div style={{ color: '#16a34a', fontWeight: 900, fontSize: isMobile ? 26 : 30, whiteSpace: 'nowrap' }}>
                  {formatMoeda(premiacaoSemestre)}
                </div>
              </div>
              <div style={{ color: '#666', fontSize: 13, lineHeight: 1.4 }}>
                Soma das premiações de zona fechadas dentro do semestre atual.
              </div>
            </section>

            <section style={{ ...card, padding: isMobile ? 14 : 16, marginBottom: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Indicadores do mês</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 8 }}>
                <Mini label="Dias" valor={diasTrabalhados} />
                <Mini label="Atrasos" valor={atrasos.length} alerta={atrasos.length > 0} />
                <Mini label="Faltas" valor={(zonaParcial?.faltasInj || 0) + (zonaParcial?.faltasJust || 0)} alerta={((zonaParcial?.faltasInj || 0) + (zonaParcial?.faltasJust || 0)) > 0} />
                <Mini label="Advert." valor={zonaParcial?.advertencias || 0} alerta={(zonaParcial?.advertencias || 0) > 0} />
              </div>
            </section>

            <section style={{ ...card, padding: isMobile ? 14 : 16, marginBottom: 14 }}>
              <button onClick={() => setComissoesAberto(v => !v)} style={accordionBtn}>
                <span>Comissão do mês atual</span>
                <span style={{ color: '#16a34a', fontWeight: 800 }}>{formatMoeda(totalComissao)} {comissoesAberto ? '▲' : '▼'}</span>
              </button>
              {comissoesAberto && (
                comissoes.length === 0 ? (
                  <div style={empty}>Nenhuma comissão lançada neste mês.</div>
                ) : comissoes.map(c => (
                  <div key={c.id} style={row}>
                    <div>
                      <strong>Dia {String(c.dia).padStart(2, '0')}</strong>
                      <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>Total: {formatMoeda(parseFloat(c.valor))}</span>
                    </div>
                    <div style={{ color: '#16a34a', fontWeight: 800 }}>{formatMoeda(c.parteLiquida)}</div>
                  </div>
                ))
              )}
            </section>

            {mesFechado && (
              <section style={{ ...card, padding: isMobile ? 14 : 16 }}>
                <button onClick={() => setEspelhoAberto(v => !v)} style={accordionBtn}>
                  <span>Espelho de ponto</span>
                  <span style={{ color: '#555', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>{pontos.length} registro(s) {espelhoAberto ? '▲' : '▼'}</span>
                </button>
                {espelhoAberto && (
                  <>
                    <button onClick={baixarEspelhoPdf} style={pdfBtn}>Baixar PDF</button>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                      <div style={bancoBox}>
                        <div style={bancoLabel}>Banco de horas mês atual</div>
                        <div style={bancoValor}>{bancoMes}</div>
                      </div>
                      <div style={bancoBox}>
                        <div style={bancoLabel}>Banco do semestre</div>
                        <div style={bancoValor}>{bancoTotal}</div>
                      </div>
                    </div>
                    {pontos.length === 0 ? (
                      <div style={empty}>Nenhum registro de ponto neste mês.</div>
                    ) : pontos.map(p => (
                      <div key={p.id} style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: isMobile ? undefined : '74px 110px 1fr auto', gap: 10, alignItems: 'center', padding: isMobile ? '12px 10px' : '10px 0 10px 10px', borderBottom: '1px solid #f3f4f6', borderLeft: p.horas_atraso ? '4px solid #dc2626' : p.tipo_dia === 'normal' ? '4px solid #16a34a' : '4px solid #e5e7eb' }}>
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
                          ? (horáriosDoPonto(p) || '--')
                          : p.tipo_dia === 'folga' ? 'Folga' : p.tipo_dia === 'feriado' ? 'Feriado' : 'Sem marcação'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, minWidth: 54 }}>
                      {p.total_trabalhado && <div>{p.total_trabalhado}</div>}
                      {p.horas_atraso && <div style={{ color: '#dc2626', fontWeight: 800 }}>{p.horas_atraso}</div>}
                    </div>
                      </div>
                    ))}
                  </>
                )}
              </section>
            )}
              </>
            )}
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

function DocumentosPortal({ documentos, isMobile }) {
  return (
    <section style={{ ...card, padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 6 }}>Documentos da empresa</div>
      <div style={{ color: '#666', fontSize: 13, marginBottom: 14 }}>
        Regulamentos, manuais e comunicados disponíveis para consulta.
      </div>

      {documentos.length === 0 ? (
        <div style={empty}>Nenhum documento disponível no momento.</div>
      ) : documentos.map(doc => (
        <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: 12, alignItems: 'center', padding: '13px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{doc.titulo}</div>
            <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{doc.categoria || 'Documento'}</div>
            {doc.descricao && <div style={{ color: '#777', fontSize: 13, marginTop: 6, lineHeight: 1.35 }}>{doc.descricao}</div>}
          </div>
          <a href={doc.url} target="_blank" rel="noreferrer" style={{ background: '#1a1a1a', color: '#fff', borderRadius: 8, padding: '9px 12px', textDecoration: 'none', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', textAlign: 'center' }}>
            Abrir
          </a>
        </div>
      ))}
    </section>
  )
}

function BonificacaoPortal({ funcionario, isMobile }) {
  const resumo = calcularBonificacaoTempoCasa(funcionario?.data_admissao)

  if (!funcionario) {
    return <section style={{ ...card, padding: 16 }}><div style={empty}>Carregando dados do funcionário...</div></section>
  }

  if (!resumo) {
    return (
      <section style={{ ...card, padding: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 6 }}>Bonificação por tempo de casa</div>
        <div style={empty}>A data de admissão ainda não foi informada no cadastro.</div>
      </section>
    )
  }

  return (
    <section style={{ ...card, padding: isMobile ? 14 : 18 }}>
      <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 6 }}>Bonificação por tempo de casa</div>
      <div style={{ color: '#666', fontSize: 13, marginBottom: 16, lineHeight: 1.4 }}>
        A bonificação é calculada pela data de admissão cadastrada no RH.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={infoBox}>
          <div style={bancoLabel}>Data de admissão</div>
          <div style={infoValor}>{formatarData(funcionario.data_admissao)}</div>
        </div>
        <div style={infoBox}>
          <div style={bancoLabel}>Tempo de casa</div>
          <div style={infoValor}>{formatarTempo(resumo.mesesDeCasa)}</div>
        </div>
        <div style={{ ...infoBox, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <div style={bancoLabel}>{resumo.proxima ? 'Próxima bonificação' : 'Maior bonificação alcançada'}</div>
          <div style={{ ...infoValor, color: '#16a34a' }}>{formatMoeda((resumo.proxima || resumo.ultima)?.valor || 0)}</div>
        </div>
      </div>

      {resumo.proxima ? (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ color: '#9a3412', fontSize: 12, fontWeight: 800, marginBottom: 5 }}>
            Próximo marco: {formatarTempo(resumo.proxima.meses)}
          </div>
          <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 900, color: '#111', lineHeight: 1.1 }}>
            Faltam {formatarTempo(resumo.mesesFaltantes)}
          </div>
          <div style={{ color: '#666', fontSize: 13, marginTop: 6 }}>
            Previsão: {resumo.dataProxima.toLocaleDateString('pt-BR')} · {resumo.diasFaltantes} dia(s)
          </div>
        </div>
      ) : (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>Você já completou todos os marcos cadastrados.</div>
        </div>
      )}

      <div style={{ fontWeight: 800, marginBottom: 10 }}>Tabela de bonificações</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {BONIFICACOES_TEMPO_CASA.map(item => {
          const concluido = resumo.mesesDeCasa >= item.meses
          const atual = resumo.proxima?.meses === item.meses
          return (
            <div key={item.meses} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', border: `1px solid ${atual ? '#fed7aa' : concluido ? '#bbf7d0' : '#e5e7eb'}`, background: atual ? '#fff7ed' : concluido ? '#f0fdf4' : '#fff', borderRadius: 8, padding: 11 }}>
              <div>
                <div style={{ fontWeight: 800 }}>{formatarTempo(item.meses)}</div>
                <div style={{ color: '#777', fontSize: 12 }}>{concluido ? 'Marco alcançado' : atual ? 'Próximo marco' : 'Ainda em andamento'}</div>
              </div>
              <div style={{ fontWeight: 900, color: concluido || atual ? '#16a34a' : '#111', whiteSpace: 'nowrap' }}>{formatMoeda(item.valor)}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }
const sel = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, marginBottom: 14, background: '#fff', cursor: 'pointer' }
const card = { background: '#fff', borderRadius: 10, padding: 16, border: '1px solid #e5e7eb' }
const kicker = { fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 700 }
const valorMoeda = { fontWeight: 800, whiteSpace: 'nowrap', lineHeight: 1.05 }
const empty = { color: '#888', fontSize: 13, textAlign: 'center', padding: 20 }
const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }
const accordionBtn = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: 'none', background: 'transparent', padding: 0, margin: 0, fontSize: 18, fontWeight: 800, cursor: 'pointer', textAlign: 'left' }
const pdfBtn = { margin: '12px 0', width: '100%', border: 'none', borderRadius: 8, padding: 11, background: '#1a1a1a', color: '#fff', fontWeight: 800, cursor: 'pointer' }
const bancoBox = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }
const bancoLabel = { fontSize: 11, color: '#777', marginBottom: 4 }
const bancoValor = { fontSize: 18, fontWeight: 800, color: '#111' }
const infoBox = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }
const infoValor = { fontSize: 20, fontWeight: 900, color: '#111', lineHeight: 1.1 }
const portalTabBtn = (active) => ({ border: `1.5px solid ${active ? '#e63946' : '#e5e7eb'}`, background: active ? '#fff1f2' : '#fff', color: active ? '#e63946' : '#555', borderRadius: 8, padding: '11px 12px', fontSize: 14, fontWeight: 800, cursor: 'pointer' })
