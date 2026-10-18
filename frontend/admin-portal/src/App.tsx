import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { DataPage } from './components/DataPage';
import { Layout } from './components/Layout';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { LogsPage } from './pages/LogsPage';
import { EncountersPage, MedicationsPage, PatientsPage, RecordsPage } from './pages/ResourcePages';

export function App() {
  const { professional, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center">Carregando sessão...</div>;
  if (!professional) return <LoginPage />;
  return <Routes><Route element={<Layout />}>
    <Route index element={<DashboardPage />} />
    <Route path="patients" element={<PatientsPage />} />
    <Route path="records" element={<RecordsPage />} />
    <Route path="encounters" element={<EncountersPage />} />
    <Route path="medications" element={<MedicationsPage />} />
    <Route path="professionals" element={<DataPage title="Profissionais" endpoint="/professionals" columns={[["display_name","Nome"],["license_type","Tipo"],["license_number","Identificador"],["email","E-mail"]]} />} />
    <Route path="admin/logs" element={<LogsPage />} />
    <Route path="api-docs" element={<ApiDocsPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route></Routes>;
}
