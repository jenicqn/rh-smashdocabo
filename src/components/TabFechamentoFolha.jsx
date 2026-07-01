import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function mesAtual() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
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

function tempoParaMinutos(valor) {
  const texto = String(valor || '').trim()
  if (!texto) return 0
  const match = texto.match(/^([+-])?(\d{1,4}):(\d{2})$/)
  if (!match) return 0
  const sinal = match[1] === '-' ? -1 : 1
  return sinal * (parseInt(match[2]) * 60 + parseInt(match[3]))
}

function formatarHoras(minutos) {
  if (!minutos) return '00:00'
  const sinal = minutos < 0 ? '-' : ''
  const abs = Math.abs(minutos)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sinal}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatarMoeda(valor) {
  return `R$ ${(valor || 0).toFixed(2).replace('.', ',')}`
}

function bancoDoMesPeloArquivo(pontos) {
  const ordenados = [...pontos].sort((a, b) => String(a.dia || '').localeCompare(String(b.dia || '')))
  for (let i = ordenados.length - 1; i >= 0; i--) {
    const saldo = String(ordenados[i].banco_saldo || '').trim()
    if (saldo) return saldo
  }
  for (let i = ordenados.length - 1; i >= 0; i--) {
    const saldo = String(ordenados[i].banco_total || '').trim()
    if (saldo) return saldo
  }
  return '00:00'
}

function nomeMes(mes) {
  const [ano, m] = mes.split('-')
  return `${MESES[parseInt(m) - 1]} ${ano}`
}

function idsDoLancamento(lancamento) {
  return Array.isArray(lancamento.funcionarios)
    ? lancamento.funcionarios
    : JSON.parse(lancamento.funcionarios || '[]')
}

function eraAtivoNaData(func, mes, dia) {
  const [ano, month] = mes.split('-').map(Number)
  const dataRef = new Date(ano, month - 1, dia)
  if (!func || func.is_owner) return false
  if (func.data_admissao && new Date(func.data_admissao + 'T00:00:00') > dataRef) return false
  if (func.status === 'demitido') {
    if (!func.data_saida) return false
    return dataRef <= new Date(func.data_saida + 'T00:00:00')
  }
  for (const p of (func.pausas || [])) {
    if (!p.inicio) continue
    const ini = new Date(p.inicio + 'T00:00:00')
    const fim = p.fim ? new Date(p.fim + 'T00:00:00') : null
    if (dataRef >= ini && (!fim || dataRef <= fim)) return false
  }
  return true
}

function temHorarioPreenchido(ponto) {
  return [ponto.entrada1, ponto.saida1, ponto.entrada2, ponto.saida2]
    .some(v => {
      const texto = String(v || '').trim().toLowerCase()
      return texto && texto !== '-' && !texto.includes('feriado') && !texto.includes('folga')
    })
}

function formatarData(data) {
  if (!data) return ''
  return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')
}

export default function TabFechamentoFolha() {
  const [mes, setMes] = useState(mesAtual())
  const [funcionarios, setFuncionarios] = useState([])
  const [linhas, setLinhas] = useState([])
  const [feriados, setFeriados] = useState([])
  const [feriadoForm, setFeriadoForm] = useState({ data: '', descricao: '' })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    const [ano, m] = mes.split('-').map(Number)
    setFeriadoForm({ data: `${mes}-01`, descricao: '' })
    carregarTudo(ano, m)
  }, [mes])

  async function carregarTudo() {
    setLoading(true)
    setMsg(null)
    const [ano, m] = mes.split('-').map(Number)
    const inicio = `${mes}-01`
    const fim = `${mes}-${new Date(ano, m, 0).getDate()}`

    const [funcRes, pontoRes, comRes, faltasRes, feriadosRes, ajustesRes] = await Promise.all([
      supabase.from('rh_funcionarios').select('*').order('nome'),
      supabase.from('registros_ponto').select('*').gte('dia', inicio).lte('dia', fim).order('dia'),
      supabase.from('rh_comissoes').select('*').eq('mes', mes).order('dia'),
      supabase.from('rh_faltas').select('*').gte('data', inicio).lte('data', fim),
      supabase.from('rh_feriados').select('*').gte('data', inicio).lte('data', fim).order('data'),
      supabase.from('rh_ajustes_mensais').select('*').eq('mes', mes),
    ])

    if (feriadosRes.error) {
      setMsg({ tipo: 'erro', texto: 'Tabela de feriados ainda não criada no Supabase. Rode o SQL supabase_feriados.sql.' })
    }

    const funcs = (funcRes.data || []).filter(f => !f.is_owner)
    const pontos = pontoRes.data || []
    const comissoes = comRes.data || []
    const faltas = faltasRes.data || []
    const feriadosMes = feriadosRes.data || []
    const ajustesPorFuncionario = Object.fromEntries((ajustesRes.data || []).map(a => [a.funcionario_id, a]))
    const datasFeriado = new Set(feriadosMes.map(f => f.data))

    const porFuncionario = funcs.map(func => {
      const cpf = String(func.cpf || '').replace(/\D/g, '')
      const pontosFunc = pontos.filter(p => String(p.funcionario_cpf || '').replace(/\D/g, '') === cpf)
      const pontoPorData = Object.fromEntries(pontosFunc.map(p => [p.dia, p]))
      const faltasFunc = faltas.filter(f => f.funcionario_id === func.id)
      const atestados = faltasFunc.filter(f => f.tipo === 'atestado').length
      const faltasInjustificadas = faltasFunc.filter(f => f.tipo !== 'atestado').length

      const feriadosTrabalhados = feriadosMes.filter(f => temHorarioPreenchido(pontoPorData[f.data] || {})).length
      const feriadosNaoTrabalhados = feriadosMes.length - feriadosTrabalhados

      const comissaoLiquida = comissoes.reduce((acc, lancamento) => {
        const ids = idsDoLancamento(lancamento)
        if (!ids.includes(func.id)) return acc
        const participantes = ids
          .map(id => funcs.find(f => f.id === id))
          .filter(Boolean)
          .filter(f => eraAtivoNaData(f, lancamento.mes, parseInt(lancamento.dia)))
        if (!participantes.find(f => f.id === func.id) || !participantes.length) return acc
        return acc + (parseFloat(lancamento.valor || 0) / participantes.length * 0.8)
      }, 0)

      const horasExtras0 = pontosFunc.reduce((acc, p) => datasFeriado.has(p.dia) ? acc : acc + tempoParaMinutos(p.extra_0), 0)
      const horasExtras100 = pontosFunc.reduce((acc, p) => {
        if (datasFeriado.has(p.dia)) {
          return temHorarioPreenchido(p) ? acc + Math.max(tempoParaMinutos(p.total_trabalhado), tempoParaMinutos(p.extra_100)) : acc
        }
        return acc + tempoParaMinutos(p.extra_100)
      }, 0)
      const adicionalNoturno = pontosFunc.reduce((acc, p) => acc + tempoParaMinutos(p.total_noturno), 0)
      const ajusteMes = ajustesPorFuncionario[func.id] || {}
      const bancoHorasMes = ajusteMes.banco_horas || bancoDoMesPeloArquivo(pontosFunc)

      return {
        id: func.id,
        nome: func.nome,
        cpf: func.cpf,
        cargo: func.cargo || '',
        diasPonto: pontosFunc.length,
        horasExtras0,
        horasExtras100,
        horasExtrasTotal: horasExtras0 + horasExtras100,
        feriadosTrabalhados,
        feriadosNaoTrabalhados,
        adicionalNoturno,
        bancoHorasMes,
        bancoPago: !!ajusteMes.banco_pago,
        comissaoLiquida,
        atestados,
        faltas: faltasInjustificadas,
      }
    })

    setFuncionarios(funcs)
    setFeriados(feriadosMes)
    setLinhas(porFuncionario)
    setLoading(false)
  }

  async function alterarBancoPago(linha, bancoPago) {
    setLinhas(lista => lista.map(item => item.id === linha.id ? { ...item, bancoPago } : item))
    const { error } = await supabase
      .from('rh_ajustes_mensais')
      .upsert({
        funcionario_id: linha.id,
        mes,
        banco_pago: bancoPago,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'funcionario_id,mes' })

    if (error) {
      setLinhas(lista => lista.map(item => item.id === linha.id ? { ...item, bancoPago: !bancoPago } : item))
      setMsg({ tipo: 'erro', texto: `Não foi possível salvar Banco pago: ${error.message}. Rode o SQL supabase_ajustes_mensais.sql no Supabase.` })
      return
    }

    setMsg({ tipo: 'ok', texto: `Banco de ${linha.nome.split(' ')[0]} marcado como ${bancoPago ? 'pago' : 'não pago'}.` })
  }

  async function salvarFeriado() {
    if (!feriadoForm.data) return
    const { error } = await supabase.from('rh_feriados').upsert({
      data: feriadoForm.data,
      descricao: feriadoForm.descricao || 'Feriado',
    }, { onConflict: 'data' })
    if (error) {
      setMsg({ tipo: 'erro', texto: error.message })
      return
    }
    setFeriadoForm({ data: `${mes}-01`, descricao: '' })
    carregarTudo()
  }

  async function excluirFeriado(id) {
    if (!confirm('Remover este feriado?')) return
    await supabase.from('rh_feriados').delete().eq('id', id)
    carregarTudo()
  }

  function gerarTabelaTexto(separador = ';') {
    const cabecalho = ['Funcionário', 'CPF', 'Cargo', 'Dias de ponto', 'Horas extras', 'Extra 100%', 'Banco do mês', 'Banco pago', 'Feriados trabalhados', 'Feriados não trabalhados', 'Adc. noturno', 'Comissão', 'Atestados', 'Faltas']
    const corpo = linhas.map(l => [
      l.nome, l.cpf, l.cargo, l.diasPonto, formatarHoras(l.horasExtrasTotal), formatarHoras(l.horasExtras100),
      l.bancoHorasMes, l.bancoPago ? 'Sim' : 'Não', l.feriadosTrabalhados, l.feriadosNaoTrabalhados, formatarHoras(l.adicionalNoturno), formatarMoeda(l.comissaoLiquida), l.atestados, l.faltas,
    ].map(valor => `"${String(valor ?? '').replace(/"/g, '""')}"`).join(separador))
    return [cabecalho.map(h => `"${h}"`).join(separador), ...corpo].join('\n')
  }

  function copiarResumo() {
    navigator.clipboard?.writeText(gerarTabelaTexto('\t'))
  }

  function baixarCsv() {
    const blob = new Blob([`\uFEFF${gerarTabelaTexto(';')}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fechamento-folha-${mes}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totais = linhas.reduce((acc, l) => ({
    horasExtras: acc.horasExtras + l.horasExtrasTotal,
    extra100: acc.extra100 + l.horasExtras100,
    noturno: acc.noturno + l.adicionalNoturno,
    comissao: acc.comissao + l.comissaoLiquida,
    atestados: acc.atestados + l.atestados,
    faltas: acc.faltas + l.faltas,
    feriadosTrabalhados: acc.feriadosTrabalhados + l.feriadosTrabalhados,
  }), { horasExtras: 0, extra100: 0, noturno: 0, comissao: 0, atestados: 0, faltas: 0, feriadosTrabalhados: 0 })

  function baixarPdf() {
    const linhasHtml = linhas.map(l => `
      <tr>
        <td><strong>${l.nome}</strong><br><small>${l.cargo || ''}</small></td>
        <td>${l.diasPonto} dia(s)</td>
        <td>${formatarHoras(l.horasExtrasTotal)}</td>
        <td>${formatarHoras(l.horasExtras100)}</td>
        <td>${l.bancoHorasMes}</td>
        <td>${l.bancoPago ? 'Sim' : 'Não'}</td>
        <td>${l.feriadosTrabalhados} trab.<br><small>${l.feriadosNaoTrabalhados} sem trabalho</small></td>
        <td>${formatarHoras(l.adicionalNoturno)}</td>
        <td>${formatarMoeda(l.comissaoLiquida)}</td>
        <td>${l.atestados}</td>
        <td>${l.faltas}</td>
      </tr>
    `).join('')
    const feriadosHtml = feriados.map(f => `<li>${formatarData(f.data)} - ${f.descricao || 'Feriado'}</li>`).join('')
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Fechamento de folha - ${nomeMes(mes)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
            h1 { font-size: 22px; margin: 0 0 4px; }
            h2 { font-size: 14px; margin: 0 0 18px; color: #555; font-weight: 400; }
            .resumo { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
            .box { border: 1px solid #ddd; border-radius: 8px; padding: 9px; }
            .label { font-size: 10px; color: #666; margin-bottom: 4px; font-weight: 700; }
            .valor { font-size: 16px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border-bottom: 1px solid #ddd; padding: 7px 5px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; font-size: 10px; }
            small, li { color: #666; font-size: 11px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Fechamento de folha</h1>
          <h2>${nomeMes(mes)} - Smash do Cabo</h2>
          <div class="resumo">
            <div class="box"><div class="label">Horas extras</div><div class="valor">${formatarHoras(totais.horasExtras)}</div></div>
            <div class="box"><div class="label">Extra 100%</div><div class="valor">${formatarHoras(totais.extra100)}</div></div>
            <div class="box"><div class="label">Adc. noturno</div><div class="valor">${formatarHoras(totais.noturno)}</div></div>
            <div class="box"><div class="label">Comissões</div><div class="valor">${formatarMoeda(totais.comissao)}</div></div>
          </div>
          <h2>Feriados cadastrados</h2>
          <ul>${feriadosHtml || '<li>Nenhum feriado cadastrado.</li>'}</ul>
          <table>
            <thead><tr><th>Funcionário</th><th>Ponto</th><th>Horas extras</th><th>Extra 100%</th><th>Banco do mês</th><th>Banco pago</th><th>Feriados</th><th>Adc. noturno</th><th>Comissão</th><th>Atestados</th><th>Faltas</th></tr></thead>
            <tbody>${linhasHtml || '<tr><td colspan="11">Nenhum dado encontrado.</td></tr>'}</tbody>
          </table>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={h2}>Fechamento de folha</h2>
          <div style={{ color: '#666', fontSize: 13 }}>Conferência mensal para envio ao DP.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={copiarResumo} style={btnDark}>Copiar resumo</button>
          <button onClick={baixarCsv} style={btnGhost}>Baixar CSV</button>
          <button onClick={baixarPdf} style={btnGhost}>Baixar PDF</button>
        </div>
      </div>

      {msg && <div style={{ ...card, color: msg.tipo === 'erro' ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{msg.texto}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <aside style={card}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Feriados do mês</div>
          <select value={mes} onChange={e => setMes(e.target.value)} style={sel}>
            {gerarOpcoesMes().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <label style={lbl}>Data</label>
          <input type="date" value={feriadoForm.data} onChange={e => setFeriadoForm(f => ({ ...f, data: e.target.value }))} style={inp} />
          <label style={lbl}>Descrição</label>
          <input value={feriadoForm.descricao} onChange={e => setFeriadoForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex.: Corpus Christi" style={inp} />
          <button onClick={salvarFeriado} style={btnFull}>Registrar feriado</button>
          <div style={{ marginTop: 14 }}>
            {feriados.length === 0 ? (
              <div style={emptySmall}>Nenhum feriado cadastrado neste mês.</div>
            ) : feriados.map(f => (
              <div key={f.id} style={feriadoItem}>
                <div>
                  <div style={{ fontWeight: 800 }}>{formatarData(f.data)}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>{f.descricao || 'Feriado'}</div>
                </div>
                <button onClick={() => excluirFeriado(f.id)} style={btnMiniDanger}>Excluir</button>
              </div>
            ))}
          </div>
        </aside>

        <main>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
            <Resumo label="Funcionários" valor={funcionarios.length} />
            <Resumo label="Horas extras" valor={formatarHoras(totais.horasExtras)} />
            <Resumo label="Extra 100%" valor={formatarHoras(totais.extra100)} />
            <Resumo label="Adc. noturno" valor={formatarHoras(totais.noturno)} />
            <Resumo label="Comissões" valor={formatarMoeda(totais.comissao)} destaque />
            <Resumo label="Feriados trab." valor={totais.feriadosTrabalhados} />
            <Resumo label="Atestados" valor={totais.atestados} alerta={totais.atestados > 0} />
            <Resumo label="Faltas" valor={totais.faltas} alerta={totais.faltas > 0} />
          </section>

          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Funcionários</div>
            {loading ? (
              <div style={empty}>Carregando...</div>
            ) : linhas.length === 0 ? (
              <div style={empty}>Nenhum funcionário encontrado.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1080 }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      {['Funcionário', 'Ponto', 'Horas extras', 'Extra 100%', 'Banco do mês', 'Banco pago', 'Feriados', 'Adc. noturno', 'Comissão', 'Atestados', 'Faltas'].map(h => <th key={h} style={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={td}><div style={{ fontWeight: 800 }}>{l.nome}</div><div style={{ color: '#888', fontSize: 11 }}>{l.cargo || 'Sem cargo'}</div></td>
                        <td style={td}>{l.diasPonto} dia(s)</td>
                        <td style={td}>{formatarHoras(l.horasExtrasTotal)}</td>
                        <td style={{ ...td, fontWeight: l.horasExtras100 ? 800 : 400 }}>{formatarHoras(l.horasExtras100)}</td>
                        <td style={{ ...td, fontWeight: 800 }}>{l.bancoHorasMes}</td>
                        <td style={td}>
                          <label style={toggleWrap}>
                            <input
                              type="checkbox"
                              checked={l.bancoPago}
                              onChange={e => alterarBancoPago(l, e.target.checked)}
                            />
                            <span style={{ color: l.bancoPago ? '#16a34a' : '#888', fontWeight: 800 }}>
                              {l.bancoPago ? 'Pago' : 'Não pago'}
                            </span>
                          </label>
                        </td>
                        <td style={td}><div>{l.feriadosTrabalhados} trabalhado(s)</div><div style={{ color: '#888', fontSize: 11 }}>{l.feriadosNaoTrabalhados} sem trabalho</div></td>
                        <td style={td}>{formatarHoras(l.adicionalNoturno)}</td>
                        <td style={{ ...td, color: '#16a34a', fontWeight: 800 }}>{formatarMoeda(l.comissaoLiquida)}</td>
                        <td style={{ ...td, color: l.atestados ? '#d97706' : '#555', fontWeight: l.atestados ? 800 : 400 }}>{l.atestados}</td>
                        <td style={{ ...td, color: l.faltas ? '#dc2626' : '#555', fontWeight: l.faltas ? 800 : 400 }}>{l.faltas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function Resumo({ label, valor, destaque, alerta }) {
  return (
    <div style={{ background: alerta ? '#fef2f2' : destaque ? '#f0fdf4' : '#fff', border: `1px solid ${alerta ? '#fecaca' : destaque ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11, color: '#666', fontWeight: 800, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: alerta ? '#dc2626' : destaque ? '#16a34a' : '#111', whiteSpace: 'nowrap' }}>{valor}</div>
    </div>
  )
}

const h2 = { margin: 0, fontSize: 18, fontWeight: 800 }
const card = { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', marginBottom: 16 }
const sel = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 12, background: '#fff', cursor: 'pointer' }
const lbl = { display: 'block', fontSize: 12, fontWeight: 800, color: '#555', marginBottom: 5 }
const inp = { width: '100%', padding: '9px 10px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }
const empty = { color: '#888', fontSize: 13, textAlign: 'center', padding: 30 }
const emptySmall = { color: '#888', fontSize: 12, textAlign: 'center', padding: 14, background: '#f9fafb', borderRadius: 8 }
const th = { padding: '9px 10px', textAlign: 'left', fontWeight: 800, color: '#444', whiteSpace: 'nowrap' }
const td = { padding: '9px 10px', verticalAlign: 'top', color: '#555' }
const toggleWrap = { display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: 'pointer' }
const btnDark = { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnGhost = { background: '#f3f4f6', color: '#333', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnFull = { width: '100%', background: '#e63946', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }
const btnMiniDanger = { background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 7, padding: '6px 8px', fontSize: 11, cursor: 'pointer' }
const feriadoItem = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid #f3f4f6' }
