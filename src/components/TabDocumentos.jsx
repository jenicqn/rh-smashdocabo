import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

const CATEGORIAS = ['Regulamento interno', 'Manual de crises', 'Comunicado', 'Treinamento', 'Outro']

export default function TabDocumentos() {
  const fileRef = useRef(null)
  const [documentos, setDocumentos] = useState([])
  const [form, setForm] = useState({ titulo: '', categoria: CATEGORIAS[0], descricao: '', url: '' })
  const [arquivo, setArquivo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { carregarDocumentos() }, [])

  async function carregarDocumentos() {
    setLoading(true)
    const { data } = await supabase
      .from('rh_documentos_empresa')
      .select('*')
      .order('created_at', { ascending: false })

    setDocumentos(data || [])
    setLoading(false)
  }

  function alterar(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  async function obterUrlDocumento() {
    if (!arquivo) return form.url.trim()

    const nomeSeguro = arquivo.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]+/g, '-')
      .toLowerCase()
    const path = `${Date.now()}-${nomeSeguro}`

    const { error } = await supabase.storage
      .from('documentos-empresa')
      .upload(path, arquivo, { upsert: true, contentType: arquivo.type || undefined })

    if (error) throw error

    const { data } = supabase.storage
      .from('documentos-empresa')
      .getPublicUrl(path)

    return data.publicUrl
  }

  async function salvar(e) {
    e.preventDefault()
    setMsg(null)

    if (!form.titulo.trim()) {
      setMsg({ tipo: 'erro', texto: 'Informe o título do documento.' })
      return
    }

    if (!arquivo && !form.url.trim()) {
      setMsg({ tipo: 'erro', texto: 'Selecione um arquivo ou informe um link.' })
      return
    }

    setSalvando(true)
    try {
      const url = await obterUrlDocumento()
      const { error } = await supabase
        .from('rh_documentos_empresa')
        .insert({
          titulo: form.titulo.trim(),
          categoria: form.categoria,
          descricao: form.descricao.trim() || null,
          url,
          ativo: true,
        })

      if (error) throw error

      setForm({ titulo: '', categoria: CATEGORIAS[0], descricao: '', url: '' })
      setArquivo(null)
      if (fileRef.current) fileRef.current.value = ''
      setMsg({ tipo: 'ok', texto: 'Documento publicado no portal do funcionário.' })
      carregarDocumentos()
      setTimeout(() => setMsg(null), 3000)
    } catch (error) {
      setMsg({ tipo: 'erro', texto: error.message || 'Não foi possível salvar o documento.' })
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(doc) {
    await supabase
      .from('rh_documentos_empresa')
      .update({ ativo: !doc.ativo })
      .eq('id', doc.id)
    carregarDocumentos()
  }

  async function remover(doc) {
    if (!confirm(`Remover "${doc.titulo}" do portal?`)) return
    await supabase.from('rh_documentos_empresa').delete().eq('id', doc.id)
    carregarDocumentos()
  }

  return (
    <div>
      <h2 style={h2}>Documentos do portal</h2>
      <p style={{ margin: '-6px 0 16px', color: '#666', fontSize: 13 }}>
        Publique regulamentos, manuais e comunicados para os funcionários consultarem pelo portal.
      </p>

      {msg && (
        <div style={{ borderRadius: 8, padding: '10px 14px', marginBottom: 12, background: msg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.tipo === 'ok' ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 600 }}>
          {msg.texto}
        </div>
      )}

      <form onSubmit={salvar} style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 180px', gap: 10, marginBottom: 10 }}>
          <label style={label}>
            Título
            <input value={form.titulo} onChange={e => alterar('titulo', e.target.value)} style={inp} placeholder="Ex.: Regulamento interno" />
          </label>
          <label style={label}>
            Categoria
            <select value={form.categoria} onChange={e => alterar('categoria', e.target.value)} style={inp}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <label style={label}>
          Descrição
          <textarea value={form.descricao} onChange={e => alterar('descricao', e.target.value)} style={{ ...inp, minHeight: 74, resize: 'vertical' }} placeholder="Resumo curto do documento" />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <label style={label}>
            Anexar arquivo
            <input ref={fileRef} type="file" onChange={e => setArquivo(e.target.files?.[0] || null)} style={inp} />
          </label>
          <label style={label}>
            Ou informar link
            <input value={form.url} onChange={e => alterar('url', e.target.value)} style={inp} placeholder="https://..." />
          </label>
        </div>

        <button disabled={salvando} style={btnPrimary(salvando)}>
          {salvando ? 'Publicando...' : 'Publicar documento'}
        </button>
      </form>

      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Documentos cadastrados</div>
        {loading ? (
          <div style={empty}>Carregando...</div>
        ) : documentos.length === 0 ? (
          <div style={empty}>Nenhum documento publicado ainda.</div>
        ) : documentos.map(doc => (
          <div key={doc.id} style={docRow}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{doc.titulo}</div>
              <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{doc.categoria} · {doc.ativo ? 'Visível' : 'Oculto'}</div>
              {doc.descricao && <div style={{ color: '#777', fontSize: 12, marginTop: 5 }}>{doc.descricao}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <a href={doc.url} target="_blank" rel="noreferrer" style={btnLink}>Abrir</a>
              <button onClick={() => alternarAtivo(doc)} style={btnGhost}>{doc.ativo ? 'Ocultar' : 'Mostrar'}</button>
              <button onClick={() => remover(doc)} style={btnDanger}>Remover</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const h2 = { margin: '0 0 16px', fontSize: 18, fontWeight: 700 }
const card = { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }
const label = { display: 'block', color: '#555', fontSize: 12, fontWeight: 700 }
const inp = { width: '100%', marginTop: 5, padding: '9px 10px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13, boxSizing: 'border-box', outline: 'none', background: '#fff' }
const empty = { color: '#888', fontSize: 13, textAlign: 'center', padding: 24 }
const docRow = { display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }
const btnPrimary = (disabled) => ({ marginTop: 14, background: disabled ? '#ccc' : '#e63946', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 800, cursor: disabled ? 'default' : 'pointer' })
const btnGhost = { background: '#f3f4f6', color: '#555', border: 'none', borderRadius: 7, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }
const btnDanger = { background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 7, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }
const btnLink = { background: '#1a1a1a', color: '#fff', borderRadius: 7, padding: '7px 10px', fontSize: 12, textDecoration: 'none' }
