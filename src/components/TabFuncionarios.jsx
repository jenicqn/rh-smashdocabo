import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function TabFuncionarios() {
  const [funcionarios, setFuncionarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'novo' | objeto funcionário
  const [form, setForm] = useState({ nome: '', cpf: '', cargo: '', departamento: '', data_admissao: '', data_nascimento: '', status: 'ativo', horario_entrada: '16:00', is_owner: false })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('ativos')
  const [modalPausa, setModalPausa] = useState(null)
  const [pausaForm, setPausaForm] = useState({ inicio: '', fim: '', motivo: 'Férias' })
  const [modalDemissao, setModalDemissao] = useState(null)
  const [demissaoForm, setDemissaoForm] = useState({ data_saida: new Date().toISOString().slice(0, 10) })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('rh_funcionarios').select('*').order('nome')
    if (data) {
      const donosDemitidos = data.filter(f => f.is_owner && f.status === 'demitido')
      if (donosDemitidos.length) {
        await Promise.all(donosDemitidos.map(f =>
          supabase.from('rh_funcionarios').update({ status: 'ativo', data_saida: null }).eq('id', f.id)
        ))
      }

      setFuncionarios(data.map(f => f.is_owner ? { ...f, status: 'ativo', data_saida: null } : f))
    }
    setLoading(false)
  }

  function abrirNovo() {
    setModal('novo')
    setForm({ nome: '', cpf: '', cargo: '', departamento: '', data_admissao: '', data_nascimento: '', status: 'ativo', horario_entrada: '16:00', is_owner: false })
    setMsg(null)
  }

  function abrirEditar(f) {
    setModal(f)
    setForm({
      nome: f.nome, cpf: f.cpf, cargo: f.cargo || '',
      departamento: f.departamento || '',
      data_admissao: f.data_admissao || '',
      data_nascimento: f.data_nascimento || '',
      status: f.is_owner ? 'ativo' : (f.status || 'ativo'),
      horario_entrada: f.horario_entrada || '16:00',
      is_owner: !!f.is_owner
    })
    setMsg(null)
  }

  function formatCPF(v) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  async function salvar() {
    if (!form.nome || !form.cpf) { setMsg({ tipo: 'erro', texto: 'Nome e CPF são obrigatórios.' }); return }
    setSalvando(true)
    const payload = {
      nome: form.nome.trim(),
      cpf: form.cpf.replace(/\D/g, ''),
      cargo: form.cargo || null,
      departamento: form.departamento || null,
      data_admissao: form.data_admissao || null,
      data_nascimento: form.data_nascimento || null,
      status: form.is_owner ? 'ativo' : (form.status || 'ativo'),
      horario_entrada: form.horario_entrada || '16:00',
      is_owner: !!form.is_owner,
    }
    let error
    if (modal === 'novo') {
      const res = await supabase.from('rh_funcionarios').insert(payload)
      error = res.error
    } else {
      const res = await supabase.from('rh_funcionarios').update(payload).eq('id', modal.id)
      error = res.error
    }
    if (error) {
      setMsg({ tipo: 'erro', texto: error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Salvo!' })
      carregar()
      setTimeout(() => { setModal(null); setMsg(null) }, 1500)
    }
    setSalvando(false)
  }

  async function pausar(f) {
    if (!pausaForm.inicio) { alert('Informe a data de início.'); return }
    if (pausaForm.fim && pausaForm.fim < pausaForm.inicio) { alert('A data final não pode ser menor que a inicial.'); return }

    const pausa = {
      id: Date.now().toString(36),
      inicio: pausaForm.inicio,
      fim: pausaForm.fim || null,
      motivo: pausaForm.motivo || 'Férias'
    }
    const pausas = [...(f.pausas || []), pausa]
    const hoje = new Date().toISOString().slice(0, 10)
    const pausaAtivaHoje = pausa.inicio <= hoje && (!pausa.fim || pausa.fim >= hoje)

    await supabase.from('rh_funcionarios').update({ status: pausaAtivaHoje ? 'pausado' : f.status, pausas }).eq('id', f.id)
    setModalPausa(null)
    setPausaForm({ inicio: '', fim: '', motivo: 'Férias' })
    carregar()
  }

  async function reativar(f) {
    const pausas = (f.pausas || []).map(p => ({ ...p, fim: p.fim || new Date().toISOString().slice(0, 10) }))
    await supabase.from('rh_funcionarios').update({ status: 'ativo', pausas }).eq('id', f.id)
    carregar()
  }

  function abrirDemissao(f) {
    if (f.is_owner) {
      alert('Este funcionário está marcado como dono/sócio e não pode ser demitido.')
      return
    }
    setModalDemissao(f)
    setDemissaoForm({ data_saida: new Date().toISOString().slice(0, 10) })
  }

  async function confirmarDemissao() {
    if (!modalDemissao) return
    if (modalDemissao.is_owner) { alert('Este funcionário está marcado como dono/sócio e não pode ser demitido.'); return }
    if (!demissaoForm.data_saida) { alert('Informe a data de demissão.'); return }

    await supabase
      .from('rh_funcionarios')
      .update({ status: 'demitido', data_saida: demissaoForm.data_saida })
      .eq('id', modalDemissao.id)

    setModalDemissao(null)
    setDemissaoForm({ data_saida: new Date().toISOString().slice(0, 10) })
    carregar()
  }

  const correspondeBusca = (f) =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    f.cpf.includes(busca.replace(/\D/g, ''))

  const ativos = funcionarios.filter(f => f.is_owner || f.status === 'ativo')
  const pausados = funcionarios.filter(f => !f.is_owner && f.status === 'pausado')
  const demitidos = funcionarios.filter(f => !f.is_owner && f.status === 'demitido')
  const grupos = { ativos, pausados, demitidos }
  const filtrados = (grupos[filtroStatus] || []).filter(correspondeBusca)
  const tituloLista = { ativos: 'Funcionários ativos', pausados: 'Funcionários pausados', demitidos: 'Funcionários demitidos' }[filtroStatus]
  const vazioLista = { ativos: 'Nenhum funcionário ativo encontrado.', pausados: 'Nenhum funcionário pausado encontrado.', demitidos: 'Nenhum funcionário demitido encontrado.' }[filtroStatus]

  const statusVisual = (f) => f.is_owner ? 'ativo' : f.status
  const corStatus = { ativo: '#16a34a', pausado: '#d97706', demitido: '#dc2626' }
  const bgStatus = { ativo: '#f0fdf4', pausado: '#fffbeb', demitido: '#fef2f2' }

  return (
    <div>
      <h2 style={h2}>Funcionários</h2>

      {/* Modal pausa */}
      {modalPausa && (
        <div style={overlay}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 340 }}>
            <div style={{ fontWeight: 700, marginBottom: 16 }}>Pausar {modalPausa.nome.split(' ')[0]}</div>
            <label style={lbl}>Data de início</label>
            <input style={inp} type="date" value={pausaForm.inicio} onChange={e => setPausaForm(p => ({ ...p, inicio: e.target.value }))} />
            <label style={lbl}>Data final <span style={{ color: '#888', fontWeight: 400 }}>(opcional)</span></label>
            <input style={inp} type="date" value={pausaForm.fim} onChange={e => setPausaForm(p => ({ ...p, fim: e.target.value }))} />
            <label style={lbl}>Motivo</label>
            <input style={inp} placeholder="Ex: Férias, Licença..." value={pausaForm.motivo} onChange={e => setPausaForm(p => ({ ...p, motivo: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => pausar(modalPausa)} style={btnRed}>Confirmar</button>
              <button onClick={() => setModalPausa(null)} style={btnGray}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal demissão */}
      {modalDemissao && (
        <div style={overlay}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 360 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Demitir {modalDemissao.nome.split(' ')[0]}</div>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
              A partir desta data, o funcionário sai do quadro ativo e não participa de novas comissões nem zonas.
            </div>
            <label style={lbl}>Data de demissão</label>
            <input
              style={inp}
              type="date"
              value={demissaoForm.data_saida}
              onChange={e => setDemissaoForm({ data_saida: e.target.value })}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={confirmarDemissao} style={btnRed}>Confirmar demissão</button>
              <button onClick={() => setModalDemissao(null)} style={btnGray}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal edição/novo */}
      {modal && (
        <div style={overlay}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>
              {modal === 'novo' ? 'Novo funcionário' : `Editar - ${modal.nome?.split(' ')[0]}`}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Nome completo</label>
                <input style={inp} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="NOME COMPLETO" />
              </div>
              <div>
                <label style={lbl}>CPF</label>
                <input style={inp} value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: formatCPF(e.target.value) }))} placeholder="000.000.000-00" />
              </div>
              <div>
                <label style={lbl}>Data de nascimento</label>
                <input style={inp} type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Data de admissão</label>
                <input style={inp} type="date" value={form.data_admissao} onChange={e => setForm(f => ({ ...f, data_admissao: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Horário de entrada</label>
                <input style={inp} type="time" value={form.horario_entrada} onChange={e => setForm(f => ({ ...f, horario_entrada: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Cargo</label>
                <input style={inp} value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Cozinheiro" />
              </div>
              <div>
                <label style={lbl}>Departamento</label>
                <input style={inp} value={form.departamento} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} placeholder="Ex: Cozinha" />
              </div>
              <label style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_owner} onChange={e => setForm(f => ({ ...f, is_owner: e.target.checked }))} />
                Não participa do rateio de comissão (dono/sócio)
              </label>
            </div>

            {msg && (
              <div style={{ borderRadius: 8, padding: '10px 14px', marginTop: 12, background: msg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.tipo === 'ok' ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 600 }}>
                {msg.texto}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={salvar} disabled={salvando} style={{ ...btnRed, flex: 1 }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setModal(null)} style={btnGray}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 12, border: '1px solid #e5e7eb', position: 'sticky', top: 12 }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 700, margin: '2px 8px 10px' }}>Funcionários</div>
          <button onClick={() => setFiltroStatus('ativos')} style={menuBtn(filtroStatus === 'ativos')}>
            <span>Ativos</span>
            <strong>{ativos.length}</strong>
          </button>
          <button onClick={() => setFiltroStatus('pausados')} style={menuBtn(filtroStatus === 'pausados')}>
            <span>Pausados</span>
            <strong>{pausados.length}</strong>
          </button>
          <button onClick={() => setFiltroStatus('demitidos')} style={menuBtn(filtroStatus === 'demitidos')}>
            <span>Demitidos</span>
            <strong>{demitidos.length}</strong>
          </button>
        </div>

        <div>
          {/* Busca + botão */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input style={{ ...inp, flex: 1, marginBottom: 0 }} placeholder="Buscar por nome ou CPF" value={busca} onChange={e => setBusca(e.target.value)} />
            <button onClick={abrirNovo} style={{ background: '#e63946', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Novo</button>
          </div>

          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{tituloLista}</div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', color: '#888', fontSize: 13, textAlign: 'center' }}>
              {vazioLista}
            </div>
          ) : filtrados.map(f => (
            <div key={f.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', marginBottom: 10, opacity: statusVisual(f) === 'demitido' ? 0.78 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{f.nome}</div>
                  <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                    {f.cargo}{f.departamento ? ` - ${f.departamento}` : ''}
                    {f.data_admissao && ` - Admissão: ${new Date(f.data_admissao + 'T12:00').toLocaleDateString('pt-BR')}`}
                  </div>
                  {f.data_nascimento && (
                    <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                      Nascimento: {new Date(f.data_nascimento + 'T12:00').toLocaleDateString('pt-BR')}
                    </div>
                  )}
                  <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                    Entrada: <strong>{f.horario_entrada || '16:00'}</strong>
                  </div>
                  {statusVisual(f) === 'demitido' && (
                    <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                      Demissão: {f.data_saida ? new Date(f.data_saida + 'T12:00').toLocaleDateString('pt-BR') : 'sem data informada'}
                    </div>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <span style={{ background: bgStatus[statusVisual(f)], color: corStatus[statusVisual(f)], borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                      {statusVisual(f)?.toUpperCase()}
                    </span>
                    {f.is_owner && (
                      <span style={{ marginLeft: 6, background: '#eef2ff', color: '#4338ca', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                        FORA DO RATEIO
                      </span>
                    )}
                  </div>
                </div>
                {statusVisual(f) !== 'demitido' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => abrirEditar(f)} style={btnAcao}>Editar</button>
                    {!f.is_owner && f.status === 'ativo' && <button onClick={() => { setModalPausa(f); setPausaForm({ inicio: '', fim: '', motivo: 'Férias' }) }} style={btnAcao}>Pausar</button>}
                    {!f.is_owner && f.status === 'pausado' && <button onClick={() => reativar(f)} style={{ ...btnAcao, color: '#16a34a' }}>Reativar</button>}
                    {!f.is_owner && <button onClick={() => abrirDemissao(f)} style={{ ...btnAcao, color: '#dc2626' }}>Demitir</button>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const menuBtn = (active) => ({
  width: '100%',
  border: 'none',
  background: active ? '#fce4e6' : 'transparent',
  color: active ? '#e63946' : '#444',
  borderRadius: 8,
  padding: '9px 10px',
  marginBottom: 4,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 13,
  fontWeight: active ? 700 : 500,
  cursor: 'pointer'
})

const h2 = { margin: '0 0 16px', fontSize: 18, fontWeight: 700 }
const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }
const btnRed = { padding: '11px 20px', background: '#e63946', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }
const btnGray = { padding: '11px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }
const btnAcao = { background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }


