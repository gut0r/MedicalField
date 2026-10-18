import { Navigate,Route,Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { LocalDataPage } from './pages/LocalDataPage';
import { NewEncounterPage } from './pages/NewEncounterPage';
import { PatientsPage } from './pages/PatientsPage';
import { SyncPage } from './pages/SyncPage';

export function App(){const{professional,loading}=useAuth();if(loading)return <div className="grid min-h-screen place-items-center">Carregando sessão...</div>;if(!professional)return <LoginPage/>;return <Routes><Route element={<Layout/>}><Route index element={<DashboardPage/>}/><Route path="patients" element={<PatientsPage/>}/><Route path="local-data" element={<LocalDataPage/>}/><Route path="encounters/new" element={<NewEncounterPage/>}/><Route path="sync" element={<SyncPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes>;}

