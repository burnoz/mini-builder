import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Wrench, Trash2, MessageSquare, Plus, Link, Upload, Loader2 } from 'lucide-react'
import { createAgent, listAgents, updateAgent, deleteAgent, ingestPdf } from '../lib/api'
import '../styles/builder.css'
// ... rest of imports

const MODELS = [
    { value: 'google/gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' },
    { value: 'nvidia/nemotron-3-nano-30b-a3b:free', label: 'Nemotron 3 Nano 30B (free)' },
    { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    { value: 'mistralai/mistral-7b-instruct', label: 'Mistral 7B' },
]

const TOOLS = [
    { id: 'rag', label: 'Knowledge Base', icon: '🗂️' },
    { id: 'websearch', label: 'Web Search', icon: '🌐' },
]

const defaultConfig = () => ({
    name: '',
    model: MODELS[0].value,
    system_prompt: 'Eres un asistente útil.',
    tools: [],
    tool_configs: {}
})

function normalizeAgentToConfig(agent) {
    return {
        name: agent?.name ?? '',
        model: agent?.model ?? MODELS[0].value,
        system_prompt: agent?.system_prompt ?? 'Eres un asistente útil.',
        tools: Array.isArray(agent?.tools) ? agent.tools : [],
        tool_configs: agent?.tool_configs && typeof agent.tool_configs === 'object' ? agent.tool_configs : {}
    }
}

function coerceNumber(value, fallback) {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

function normalizeConfigForSave(config) {
    const rag = config.tool_configs?.rag ?? {}
    const websearch = config.tool_configs?.websearch ?? {}

    return {
        ...config,
        name: config.name.trim(),
        system_prompt: config.system_prompt?.trim() || 'Eres un asistente útil.',
        tool_configs: {
            ...config.tool_configs,
            rag: {
                ...rag,
                threshold: coerceNumber(rag.threshold, 0.3),
                top_k: Math.max(1, Math.round(coerceNumber(rag.top_k, 5)))
            },
            websearch: {
                ...websearch,
                max_results: Math.max(1, Math.round(coerceNumber(websearch.max_results, 5))),
                region: websearch.region || 'mx-es'
            }
        }
    }
}

export default function Builder() {
    const [agents, setAgents] = useState([])
    const [config, setConfig] = useState(defaultConfig())
    const [editingId, setEditingId] = useState(null)
    const [toast, setToast] = useState(null)
    const [isUploading, setIsUploading] = useState(false)
    const toolConfigRefs = useRef({})
// ... rest of state and effects

    async function handleFileUpload(e) {
        const file = e.target.files[0]
        if (!file) return
        if (file.type !== 'application/pdf') {
            return showToast('Solo se admiten archivos PDF', 'error')
        }

        setIsUploading(true)
        try {
            await ingestPdf(file)
            showToast('Documento indexado correctamente')
        } catch (err) {
            console.error(err)
            showToast('Error al indexar documento', 'error')
        } finally {
            setIsUploading(false)
            e.target.value = '' // Reset input
        }
    }
    const previousToolsRef = useRef([])
    const navigate = useNavigate()

    useEffect(() => { fetchAgents() }, [])

    useEffect(() => {
        const newlyEnabledTool = config.tools.find(toolId => !previousToolsRef.current.includes(toolId))
        if (newlyEnabledTool) {
            requestAnimationFrame(() => {
                toolConfigRefs.current[newlyEnabledTool]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            })
        }
        previousToolsRef.current = config.tools
    }, [config.tools])

    async function fetchAgents() {
        try {
            const { data } = await listAgents()
            setAgents(data)
        } catch (err) {
            console.error('Error cargando agentes:', err)
        }
    }

    function showToast(msg, type = 'success') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    function selectAgent(agent) {
        setEditingId(agent.id)
        setConfig(normalizeAgentToConfig(agent))
    }

    function resetForm() {
        setEditingId(null)
        setConfig(defaultConfig())
    }

    function toggleTool(toolId) {
        setConfig(prev => {
            const tools = prev.tools.includes(toolId)
                ? prev.tools.filter(t => t !== toolId)
                : [...prev.tools, toolId]
            return { ...prev, tools }
        })
    }

    function setToolConfig(toolId, key, value) {
        setConfig(prev => ({
            ...prev,
            tool_configs: {
                ...(prev.tool_configs ?? {}),
                [toolId]: { ...(prev.tool_configs?.[toolId] ?? {}), [key]: value }
            }
        }))
    }

    async function handleSave() {
        if (!config.name.trim()) return showToast('El nombre es requerido', 'error')
        const payload = normalizeConfigForSave(config)
        try {
            if (editingId) {
                await updateAgent(editingId, payload)
                showToast('Agente actualizado')
            } else {
                const { data } = await createAgent(payload)
                setEditingId(data.id)
                showToast('Agente creado')
            }
            fetchAgents()
        } catch {
            showToast('Error al guardar', 'error')
        }
    }

    async function handleDelete(id, e) {
        e.stopPropagation()
        await deleteAgent(id)
        if (editingId === id) resetForm()
        fetchAgents()
    }

    return (
        <div className="builder">

            {/* Sidebar */}
            <aside className="builder__sidebar">
                <h2>Agentes</h2>
                <button className="btn-new" onClick={resetForm}>
                    <Plus size={14} style={{ marginRight: 6 }} />Nuevo agente
                </button>
                {agents.map(a => (
                    <div
                        key={a.id}
                        className={`agent-item ${editingId === a.id ? 'active' : ''}`}
                        onClick={() => selectAgent(a)}
                    >
                        <div>
                            <div className="agent-item__name">{a.name}</div>
                            <div className="agent-item__model">{a.model.split('/').pop()}</div>
                        </div>
                        <div className="agent-item__actions">
                            <button onClick={() => navigate(`/chat/${a.id}`)} title="Chatear">
                                <MessageSquare size={14} />
                            </button>
                            <button className="btn-danger" onClick={(e) => handleDelete(a.id, e)} title="Eliminar">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </aside>

            {/* Canvas */}
            <main className="builder__canvas">
                <h1>{editingId ? 'Editar agente' : 'Nuevo agente'}</h1>

                {/* Agent block */}
                <div className="block">
                    <div className="block__header">
                        <Bot size={18} color="var(--accent)" />
                        <span>Agente</span>
                    </div>
                    <div className="block__body">
                        <div className="field">
                            <label>Nombre</label>
                            <input
                                placeholder="Mi asistente"
                                value={config.name}
                                onChange={e => setConfig({ ...config, name: e.target.value })}
                            />
                        </div>
                        <div className="field">
                            <label>Modelo</label>
                            <select
                                value={config.model}
                                onChange={e => setConfig({ ...config, model: e.target.value })}
                            >
                                {MODELS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="field">
                            <label>System Prompt</label>
                            <textarea
                                rows={4}
                                placeholder="Eres un asistente útil..."
                                value={config.system_prompt ?? ''}
                                onChange={e => setConfig({ ...config, system_prompt: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Connector */}
                <div className="connector">
                    <div className="connector__line" />
                    <Link size={14} />
                    <span>Herramientas conectadas</span>
                    <div className="connector__line" />
                </div>

                {/* Tools block */}
                <div className="block">
                    <div className="block__header">
                        <Wrench size={18} color="var(--accent)" />
                        <span>Herramientas</span>
                    </div>
                    <div className="block__body">
                        <div className="field">
                            <label>Activar herramientas</label>
                            <div className="tools-grid">
                                {TOOLS.map(t => (
                                    <button
                                        key={t.id}
                                        className={`tool-toggle ${config.tools.includes(t.id) ? 'active' : ''}`}
                                        onClick={() => toggleTool(t.id)}
                                    >
                                        {t.icon} {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* RAG config */}
                        {config.tools.includes('rag') && (
                            <div
                                className="tool-config"
                                ref={el => { toolConfigRefs.current.rag = el }}
                            >
                                <div className="tool-config__header">🗂️ Knowledge Base — configuración</div>
                                <div className="tool-config__body">
                                    <div className="field">
                                        <label>Threshold de similitud (0–1)</label>
                                        <input
                                            type="number" min="0" max="1" step="0.05"
                                            value={config.tool_configs.rag?.threshold ?? ''}
                                            onChange={e => setToolConfig('rag', 'threshold', e.target.value)}
                                        />
                                    </div>
                                    <div className="field">
                                        <label>Fragmentos a recuperar</label>
                                        <input
                                            type="number" min="1" max="20"
                                            value={config.tool_configs.rag?.top_k ?? ''}
                                            onChange={e => setToolConfig('rag', 'top_k', e.target.value)}
                                        />
                                    </div>
                                    <div className="field">
                                        <label>Cargar documentos (PDF)</label>
                                        <div className="upload-zone">
                                            <input
                                                type="file"
                                                id="file-upload"
                                                accept=".pdf"
                                                onChange={handleFileUpload}
                                                style={{ display: 'none' }}
                                                disabled={isUploading}
                                            />
                                            <button
                                                className="btn btn-secondary upload-btn"
                                                onClick={() => document.getElementById('file-upload').click()}
                                                disabled={isUploading}
                                            >
                                                {isUploading ? (
                                                    <Loader2 size={14} className="spin" style={{ marginRight: 6 }} />
                                                ) : (
                                                    <Upload size={14} style={{ marginRight: 6 }} />
                                                )}
                                                {isUploading ? 'Indexando...' : 'Subir PDF'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Web search config */}
                        {config.tools.includes('websearch') && (
                            <div
                                className="tool-config"
                                ref={el => { toolConfigRefs.current.websearch = el }}
                            >
                                <div className="tool-config__header">🌐 Web Search — configuración</div>
                                <div className="tool-config__body">
                                    <div className="field">
                                        <label>Resultados máximos</label>
                                        <input
                                            type="number" min="1" max="10"
                                            value={config.tool_configs.websearch?.max_results ?? ''}
                                            onChange={e => setToolConfig('websearch', 'max_results', e.target.value)}
                                        />
                                    </div>
                                    <div className="field">
                                        <label>Región</label>
                                        <select
                                            value={config.tool_configs.websearch?.region ?? 'mx-es'}
                                            onChange={e => setToolConfig('websearch', 'region', e.target.value)}
                                        >
                                            <option value="mx-es">México (es)</option>
                                            <option value="es-es">España (es)</option>
                                            <option value="us-en">USA (en)</option>
                                            <option value="wt-wt">Global</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="builder__actions">
                    {editingId && (
                        <button className="btn btn-secondary" onClick={() => navigate(`/chat/${editingId}`)}>
                            <MessageSquare size={14} style={{ marginRight: 6 }} />Chatear
                        </button>
                    )}
                    <button className="btn btn-ghost" onClick={resetForm}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        {editingId ? 'Guardar cambios' : 'Crear agente'}
                    </button>
                </div>
            </main>

            {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
        </div>
    )
}