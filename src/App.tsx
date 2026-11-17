import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { Button, Spinner } from './components/ui'
import { FinishJob } from './installer/FinishJob'
import { InstallerLayout } from './installer/InstallerLayout'
import { JobDetail } from './installer/JobDetail'
import { Me } from './installer/Me'
import { Today } from './installer/Today'
import { Wholesale } from './installer/Wholesale'
import { Login } from './pages/Login'
import { PublicRequest } from './pages/PublicRequest'

// Työnjohdon näkymät ladataan erikseen: asentajan puhelimelle ei tarvitse ladata karttaa ja hallintaa.
const named = <T extends Record<string, unknown>>(p: Promise<T>, name: keyof T) =>
  p.then((m) => ({ default: m[name] as React.ComponentType }))
const AdminLayout = lazy(() => named(import('./admin/AdminLayout'), 'AdminLayout'))
const Billing = lazy(() => named(import('./admin/Billing'), 'Billing'))
const Dashboard = lazy(() => named(import('./admin/Dashboard'), 'Dashboard'))
const Jobs = lazy(() => named(import('./admin/Jobs'), 'Jobs'))
const JobView = lazy(() => named(import('./admin/JobView'), 'JobView'))
const NewJob = lazy(() => named(import('./admin/NewJob'), 'NewJob'))
const Planner = lazy(() => named(import('./admin/Planner'), 'Planner'))
const Products = lazy(() => named(import('./admin/Products'), 'Products'))
const QuoteEditor = lazy(() => named(import('./admin/QuoteEditor'), 'QuoteEditor'))
const QuotePrint = lazy(() => named(import('./admin/QuoteEditor'), 'QuotePrint'))
const Requests = lazy(() => named(import('./admin/Requests'), 'Requests'))
const RequestView = lazy(() => named(import('./admin/Requests'), 'RequestView'))
const Team = lazy(() => named(import('./admin/Team'), 'Team'))
const TestCodes = lazy(() => named(import('./pages/TestCodes'), 'TestCodes'))

function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { session, loading, role, org, signOut } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/kirjaudu" replace />
  if (!org || !role) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="mb-4">Käyttäjätunnustasi ei ole liitetty mihinkään yritykseen. Pyydä työnjohtoa lisäämään sinut.</p>
        <Button onClick={() => void signOut()}>Kirjaudu ulos</Button>
      </div>
    )
  }
  if (admin && role !== 'admin') return <Navigate to="/asentaja" replace />
  return <>{children}</>
}

function Home() {
  const { role } = useAuth()
  return <Navigate to={role === 'admin' ? '/hallinta' : '/asentaja'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/kirjaudu" element={<Login />} />
          <Route path="/pyynto/:slug" element={<PublicRequest />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
          <Route
            path="/testikoodit"
            element={
              <RequireAuth>
                <TestCodes />
              </RequireAuth>
            }
          />
          <Route
            path="/asentaja"
            element={
              <RequireAuth>
                <InstallerLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Today />} />
            <Route path="tyo/:id" element={<JobDetail />} />
            <Route path="tyo/:id/valmis" element={<FinishJob />} />
            <Route path="tukku" element={<Wholesale />} />
            <Route path="mina" element={<Me />} />
          </Route>
          <Route
            path="/hallinta/tarjoukset/:id/tulosta"
            element={
              <RequireAuth admin>
                <QuotePrint />
              </RequireAuth>
            }
          />
          <Route
            path="/hallinta"
            element={
              <RequireAuth admin>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="suunnittelu" element={<Planner />} />
            <Route path="tyot" element={<Jobs />} />
            <Route path="tyot/uusi" element={<NewJob />} />
            <Route path="tyot/:id" element={<JobView />} />
            <Route path="pyynnot" element={<Requests />} />
            <Route path="pyynnot/:id" element={<RequestView />} />
            <Route path="tarjoukset/:id" element={<QuoteEditor />} />
            <Route path="laskutus" element={<Billing />} />
            <Route path="tuotteet" element={<Products />} />
            <Route path="tiimi" element={<Team />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
