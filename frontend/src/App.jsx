import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Builder from './pages/Builder'
import Chat from './pages/Chat'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/builder" replace />} />
        <Route path="/builder" element={<Builder />} />
        <Route path="/chat/:agentId" element={<Chat />} />
      </Routes>
    </BrowserRouter>
  )
}