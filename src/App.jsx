// Force rebuild - v2
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Home from './pages/Home'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import Calendar from './pages/Calendar'
import Tasks from './pages/Tasks'
import UnmatchedEmails from './pages/UnmatchedEmails'
import Settings from './pages/Settings'
import Ironmongery from './pages/Ironmongery'
import ReferenceData from './pages/ReferenceData'
import DefaultsAndParts from './pages/DefaultsAndParts'
import Import from './pages/Import'
import Login from './pages/Login'
import PricingPage            from './pages/PricingPage'
import PriceFileDetail        from './pages/PriceFileDetail'
import PriceRulesEditor       from './pages/pricing/PriceRulesEditor'
import InstallLabourEditor     from './pages/pricing/InstallLabourEditor'
import ManufactureLabourEditor from './pages/pricing/ManufactureLabourEditor'
import PartsEditor             from './pages/pricing/PartsEditor'
import DrawingBoardTest        from './drawingBoard/DrawingBoardTest.jsx'
import DrawingBoard            from './pages/DrawingBoard.jsx'
import QuoteMatrixPage         from './pages/QuoteMatrixPage.jsx'
import PricingBenchmark        from './pages/dev/PricingBenchmark.jsx'
import SqlConsole             from './pages/dev/SqlConsole.jsx'
import ValidationRules         from './pages/ValidationRules.jsx'
import TemplateManager         from './pages/TemplateManager.jsx'
import './App.css'

function AppRoutes() {
  const { session } = useAuth()

  // Still loading initial session
  if (session === undefined) return null

  if (!session) return <Login />

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/leads" element={<Leads />} />
      <Route path="/leads/:id" element={<LeadDetail />} />
      <Route path="/leads/:id/quotes" element={<QuoteMatrixPage />} />
      <Route path="/leads/:id/quotes/:quoteId" element={<QuoteMatrixPage />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/unmatched-emails" element={<UnmatchedEmails />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/ironmongery" element={<Ironmongery />} />
      <Route path="/import" element={<Import />} />
      <Route path="/pricing"                     element={<PricingPage />} />
      <Route path="/pricing/:fileId"             element={<PriceFileDetail />} />
      <Route path="/pricing/:fileId/price"       element={<PriceRulesEditor />} />
      <Route path="/pricing/:fileId/install"     element={<InstallLabourEditor />} />
      <Route path="/pricing/:fileId/manufacture" element={<ManufactureLabourEditor />} />
      <Route path="/pricing/:fileId/parts"       element={<PartsEditor />} />
      <Route path="/reference-data"               element={<ReferenceData />} />
      <Route path="/defaults"                     element={<DefaultsAndParts />} />
      <Route path="/validation"                   element={<ValidationRules />} />
      <Route path="/templates"                    element={<TemplateManager />} />
      <Route path="/drawing-board/:drawingId"      element={<DrawingBoard />} />
      <Route path="/dev/drawing-board-test"       element={<DrawingBoardTest />} />
      <Route path="/dev/pricing-benchmark"        element={<PricingBenchmark />} />
      {/* Step AT: read-only SQL for the reviewer. No nav link — a tool, not
          a feature. Normal app login applies and the read-only guards are in
          the database function, not in the page. */}
      <Route path="/dev/sql"                      element={<SqlConsole />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <div className="app">
        <AppRoutes />
      </div>
    </AuthProvider>
  )
}

export default App
