import { useSyncExternalStore } from 'react';

export interface ConnectivityState { simulatedOnline:boolean; physicallyOnline:boolean; effectiveOnline:boolean; label:string; }
type Listener = () => void;

/**
 * Observer Pattern: componentes se inscrevem no estado de rede. O modo Offline
 * sempre prevalece sobre `navigator.onLine`, evitando chamadas durante o teste.
 */
class ConnectivitySubject {
  private listeners = new Set<Listener>();
  private simulatedOnline = localStorage.getItem('medicalfield.simulatedOnline') !== 'false';
  private state: ConnectivityState = this.calculate();

  constructor() {
    window.addEventListener('online', () => this.notify());
    window.addEventListener('offline', () => this.notify());
  }
  private calculate(): ConnectivityState {
    const physicallyOnline = navigator.onLine;
    const effectiveOnline = this.simulatedOnline && physicallyOnline;
    return { simulatedOnline:this.simulatedOnline, physicallyOnline, effectiveOnline,
      label: !this.simulatedOnline ? 'Offline simulado' : physicallyOnline ? 'Online' : 'Sem conexão real' };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: Listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  setSimulatedOnline(value:boolean) { this.simulatedOnline=value; localStorage.setItem('medicalfield.simulatedOnline', String(value)); this.notify(); }
  private notify() { this.state=this.calculate(); this.listeners.forEach((listener) => listener()); }
}

export const connectivity = new ConnectivitySubject();
export function useConnectivity() { return useSyncExternalStore(connectivity.subscribe, connectivity.getSnapshot); }

