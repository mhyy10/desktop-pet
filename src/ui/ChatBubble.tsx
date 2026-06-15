import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import type { ChatMessage } from '../pet/types'
import './ChatBubble.css'

interface ChatBubbleProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  onClose: () => void
  petName?: string
}

export function ChatBubble({ messages, onSend, onClose, petName = '小光' }: ChatBubbleProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="chat-bubble">
      <div className="chat-header">
        <span className="chat-name">💬 {petName}</span>
        <button className="chat-close" onClick={onClose}>✕</button>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg ${msg.role}`}>
            {msg.role === 'pet' && <span className="msg-avatar">✨</span>}
            <div className="msg-content">{msg.content}</div>
            {msg.role === 'user' && <span className="msg-avatar">🧑</span>}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <input
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="跟小光说点什么…"
        />
        <button className="chat-send" onClick={handleSend} disabled={!input.trim()}>
          ➤
        </button>
      </div>
    </div>
  )
}
