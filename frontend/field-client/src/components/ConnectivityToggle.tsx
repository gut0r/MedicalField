import { Cloud,CloudOff } from 'lucide-react';
import { connectivity,useConnectivity } from '../connectivity';

export function ConnectivityToggle(){const state=useConnectivity();return <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${state.effectiveOnline?'border-emerald-300 bg-emerald-50':'border-amber-300 bg-amber-50'}`}><span>{state.effectiveOnline?<Cloud size={18}/>:<CloudOff size={18}/>}</span><div><p className="text-xs text-slate-500">Simular Conectividade</p><p className="text-sm font-semibold">{state.label}</p></div><button type="button" role="switch" aria-checked={state.simulatedOnline} onClick={()=>connectivity.setSimulatedOnline(!state.simulatedOnline)} className={`relative ml-auto h-7 w-12 rounded-full transition ${state.simulatedOnline?'bg-teal-700':'bg-slate-400'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${state.simulatedOnline?'left-6':'left-1'}`}/></button></div>;}

