import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Send, ArrowLeft } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { getAgent, sendMessage, getHistory } from '../lib/api'
import '../styles/chat.css'

export default function Chat() {
  const { agentId }         = useParams()
  const [agent, setAgent]   = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const sessionId             = useRef(uuidv4())
  const bottomRef             = useRef(null)

  useEffect(() => {
    async function init() {
      const { data } = await getAgent(agentId)
      setAgent(data)
      const { data: history } = await getHistory(agentId, sessionId.current)
      setMessages(history.map(m => ({ role: m.role, content: m.content })))
    }
    init()
  }, [agentId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    try {
      const { data } = await sendMessage(agentId, { message: text, session_id: sessionId.current })
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al obtener respuesta.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat">
      <header className="chat__header">
        <Link to="/builder"><ArrowLeft size={18} /></Link>
        <div>
          <div className="chat__title">{agent?.name ?? '...'}</div>
          <div className="chat__model">{agent?.model?.split('/').pop()}</div>
        </div>
      </header>

      <div className="chat__messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <div className="message__avatar">
              {m.role === 'user' ? 'TU' : 'AI'}
            </div>
            <div className="message__bubble">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <div className="message__avatar">AI</div>
            <div className="message__bubble">
              <div className="message__typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat__input">
        <textarea
          rows={1}
          placeholder="Escribe un mensaje... (Enter para enviar)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>
          <Send size={15} /> Enviar
        </button>
      </div>
    </div>
  )
}