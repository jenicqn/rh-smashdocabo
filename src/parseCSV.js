function limparHora(valor) {
  if (!valor) return ''
  return valor.replace(/\s*\(C\)\s*/g, '').trim()
}

function detectarTipoDia(entrada1) {
  if (!entrada1 || entrada1.trim() === '' || entrada1.trim() === '-' || entrada1.trim() === ' - ') return 'sem_marcacao'
  const v = entrada1.toLowerCase().trim()
  if (v === 'folga') return 'folga'
  if (v.includes('feriado')) return 'feriado'
  if (v.includes('justificado')) return 'justificado'
  return 'normal'
}

function parseDia(diaStr) {
  if (!diaStr) return { date: null, diaSemana: '' }
  const parts = diaStr.trim().split(' ')
  const [d, m, a] = parts[0].split('/')
  return { date: `${a}-${m}-${d}`, diaSemana: parts[1] || '' }
}

function detectarPeriodo(registros) {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  const datas = registros.map(r => r.dia).filter(Boolean)
  if (!datas.length) return 'desconhecido'
  const [ano, mes] = datas[0].split('-')
  return `${meses[parseInt(mes) - 1]}/${ano}`
}

function horaParaMinutos(hora) {
  if (!hora) return null
  const clean = hora.replace(/\s*\(C\)\s*/g, '').trim()
  const match = clean.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

function calcularAtrasoMinutos(entradaReal, horarioContratado) {
  if (!entradaReal || !horarioContratado) return 0
  const contratadoMin = horaParaMinutos(horarioContratado)
  const realMin = horaParaMinutos(entradaReal)
  if (contratadoMin === null || realMin === null) return 0
  let diff
  if (contratadoMin >= 720 && realMin < 360) {
    diff = (realMin + 1440) - contratadoMin
  } else {
    diff = realMin - contratadoMin
  }
  return diff > 0 ? diff : 0
}

function formatarAtraso(minutos) {
  if (!minutos || minutos <= 0) return ''
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `-${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

export function parseCSV(text, nomeArquivo, horarioEntrada = '16:00') {
  const clean = text.replace(/^\uFEFF/, '')
  const linhas = clean.split('\n').filter(l => l.trim())
  if (linhas.length < 2) return null

  const headers = linhas[0].split(';').map(h => h.trim())
  const idx = {
    nome: headers.indexOf('Nome do funcionário'),
    cpf: headers.indexOf('CPF do funcionário'),
    cargo: headers.indexOf('Nome do cargo'),
    depto: headers.indexOf('Nome do departamento'),
    admissao: headers.indexOf('Data de Admissão do funcionário'),
    dia: headers.indexOf('Dia'),
    e1: headers.indexOf('Entrada 1'),
    s1: headers.indexOf('Saída 1'),
    e2: headers.indexOf('Entrada 2'),
    s2: headers.indexOf('Saída 2'),
    total: headers.indexOf('Total Trabalhado'),
    noturno: headers.indexOf('Total Noturno'),
    previsto: headers.indexOf('Horas Previstas'),
    falta: headers.indexOf('Dia Falta'),
    atraso: headers.indexOf('Horas Atraso'),
    extra0: headers.indexOf('Extra   0% '),
    extra100: headers.indexOf('Extra   100% '),
    bancoTotal: headers.indexOf('Banco Total'),
    bancoSaldo: headers.indexOf('Banco Saldo'),
    justificativa: headers.indexOf('Justificativas'),
  }

  const dados = linhas.slice(1).map(l => l.split(';')).filter(c => c.length > 5)
  if (!dados.length) return null

  const primeira = dados[0]
  const funcionario = {
    nome: primeira[idx.nome]?.trim() || '',
    cpf: primeira[idx.cpf]?.trim().replace(/\D/g, '') || '',
    cargo: primeira[idx.cargo]?.trim() || '',
    departamento: primeira[idx.depto]?.trim() || '',
    data_admissao: (() => {
      const raw = primeira[idx.admissao]?.trim()
      if (!raw) return null
      const [d, m, a] = raw.split('/')
      return `${a}-${m}-${d}`
    })()
  }

  const registros = dados.map(cols => {
    const diaRaw = cols[idx.dia]?.trim() || ''
    const { date, diaSemana } = parseDia(diaRaw)
    const entrada1Raw = cols[idx.e1]?.trim() || ''
    const entrada1 = limparHora(entrada1Raw)
    const tipoDia = detectarTipoDia(entrada1Raw)

    let horas_atraso = ''
    if (tipoDia === 'normal' && entrada1) {
      const atrasoMin = calcularAtrasoMinutos(entrada1, horarioEntrada)
      horas_atraso = formatarAtraso(atrasoMin)
    }

    return {
      funcionario_cpf: funcionario.cpf,
      dia: date,
      dia_semana: diaSemana,
      entrada1,
      saida1: limparHora(cols[idx.s1]?.trim()),
      entrada2: limparHora(cols[idx.e2]?.trim()),
      saida2: limparHora(cols[idx.s2]?.trim()),
      total_trabalhado: cols[idx.total]?.trim() || '',
      total_noturno: cols[idx.noturno]?.trim() || '',
      horas_previstas: cols[idx.previsto]?.trim() || '',
      dia_falta: cols[idx.falta]?.trim() || '',
      horas_atraso,
      extra_0: cols[idx.extra0]?.trim() || '',
      extra_100: cols[idx.extra100]?.trim() || '',
      banco_total: cols[idx.bancoTotal]?.trim() || '',
      banco_saldo: cols[idx.bancoSaldo]?.trim() || '',
      justificativa: cols[idx.justificativa]?.trim() || '',
      tipo_dia: tipoDia,
    }
  }).filter(r => r.dia)

  const periodo = detectarPeriodo(registros)
  return { funcionario, registros, periodo, arquivo: nomeArquivo }
}


