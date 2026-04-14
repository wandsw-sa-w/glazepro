import { Routes, Route, Navigate } from 'react-router-dom'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import './App.css'

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Navigate to="/leads" replace />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/leads/:id" element={<LeadDetail />} />
      </Routes>
    </div>
  )
}

export default App
