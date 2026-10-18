import { ClipboardPlus, Database, Home, LogOut, RefreshCw, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ConnectivityToggle } from './ConnectivityToggle';

const links = [
  ['/', 'Início', Home], ['/patients', 'Pacientes', Users], ['/local-data', 'Dados', Database],
  ['/encounters/new', 'Atendimento', ClipboardPlus], ['/sync', 'Sincronizar', RefreshCw],
] as const;

export function Layout() {
  const { professional, logout } = useAuth();
  return <div className="min-h-screen pb-20">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 p-4">
      <div><strong className="text-lg text-teal-800">MedicalField</strong><p className="text-xs text-slate-500">Cliente do Socorrista • {professional?.display_name ?? professional?.displayName}</p></div>
      <div className="ml-auto"><ConnectivityToggle /></div><button className="btn-secondary" onClick={logout}><LogOut size={17} />Sair</button>
    </div></header>
    <main className="mx-auto max-w-6xl p-4"><Outlet /></main>
    <nav className="fixed inset-x-0 bottom-0 border-t bg-white"><div className="mx-auto grid max-w-3xl grid-cols-5">{links.map(([to,label,Icon]) => <NavLink key={to} to={to} end={to === '/'} className={({isActive}) => `flex flex-col items-center gap-1 p-3 text-xs ${isActive ? 'text-teal-700' : 'text-slate-500'}`}><Icon size={20}/>{label}</NavLink>)}</div></nav>
  </div>;
}
