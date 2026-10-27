import { Activity, BookOpen, ClipboardList, FileHeart, LogOut, Menu, Pill, ScrollText, Stethoscope, Users, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const links = [
  ['/', 'Dashboard', Activity], ['/patients', 'Pacientes', Users], ['/records', 'Prontuários', FileHeart],
  ['/encounters', 'Atendimentos', ClipboardList], ['/medications', 'Medicamentos', Pill],
  ['/professionals', 'Profissionais', Stethoscope], ['/admin/logs', 'Histórico de Logs', ScrollText],
  ['/api-docs', 'Documentação das APIs', BookOpen],
] as const;

export function Layout() {
  const { professional, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const fieldClientUrl = import.meta.env.VITE_FIELD_CLIENT_URL ?? 'medicalfield://open';
  return <div className="min-h-screen bg-slate-50">
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 lg:pl-72">
      <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Abrir menu">{open ? <X /> : <Menu />}</button>
      <div><p className="text-sm text-slate-500">Portal Administrativo</p><p className="font-semibold">{professional?.display_name ?? professional?.displayName}</p></div>
      <button className="btn-secondary" onClick={logout}><LogOut size={17} /> Sair</button>
    </header>
    <aside className={`fixed inset-y-0 left-0 z-20 w-64 border-r bg-slate-950 text-white transition-transform ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5"><FileHeart className="text-teal-400" /><strong>MedicalField</strong></div>
      <nav className="space-y-1 p-3">{links.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} target={to === '/admin/logs' ? '_blank' : undefined}
        className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${isActive ? 'bg-teal-700' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`} onClick={() => setOpen(false)}>
        <Icon size={18} />{label}</NavLink>)}</nav>
      <div className="absolute bottom-4 inset-x-3"><a className="btn w-full bg-slate-800 text-white hover:bg-slate-700" href={fieldClientUrl} title="Abre o aplicativo instalado neste computador">Abrir Cliente do Socorrista</a></div>
    </aside>
    <main className="pt-20 lg:pl-64"><div className="mx-auto max-w-7xl p-4 lg:p-8"><Outlet /></div></main>
  </div>;
}

