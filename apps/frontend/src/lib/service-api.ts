export type ServiceDesk = { id: number; name: string; active: boolean; createdAt?: string };
export type QueuePerson = { id: number; visitorName: string; queuedAt: string };
export type CurrentService = { id: number; visitorName: string; calledAt: string; deskId: number | null; deskName: string | null };
export type CentralData = {
  sector: { id: number; name: string; usesDesks: boolean };
  desks: ServiceDesk[];
  queue: QueuePerson[];
  current: CurrentService | null;
};
export type DisplayCall = {
  id: number; queueId: number; visitorName: string; sectorId: number;
  sectorName: string; deskId: number | null; deskName: string | null; calledAt: string;
};
export type DisplayData = { current: DisplayCall | null; recent: DisplayCall[] };
export type CompleteAndCallNextResult = {
  success: boolean;
  exitRegistered: boolean;
  calledNext: boolean;
  queueId: number | null;
};
export type CompleteResult = {
  success: boolean;
  exitRegistered: boolean;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = localStorage.getItem('auth_token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...init, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? 'Não foi possível concluir a operação');
  return body as T;
}

export const serviceApi = {
  central: (sectorId?: number) => api<CentralData>(`/service/central${sectorId ? `?sectorId=${sectorId}` : ''}`),
  callNext: (data: { sectorId?: number; deskId?: number | null }) => api<{ success: boolean; queueId: number }>('/service/call-next', { method: 'POST', body: JSON.stringify(data) }),
  recall: (id: number, sectorId?: number) => api<{ success: boolean }>(`/service/queue/${id}/recall${sectorId ? `?sectorId=${sectorId}` : ''}`, { method: 'POST' }),
  complete: (id: number, sectorId?: number) => api<CompleteResult>(`/service/queue/${id}/complete${sectorId ? `?sectorId=${sectorId}` : ''}`, { method: 'POST' }),
  completeAndCallNext: (id: number, data: { sectorId?: number; deskId?: number | null }) =>
    api<CompleteAndCallNextResult>(`/service/queue/${id}/complete-and-call-next`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  display: () => api<DisplayData>('/service/display'),
  desks: (sectorId: number) => api<ServiceDesk[]>(`/sectors/${sectorId}/desks`),
  createDesk: (sectorId: number, data: { name: string; active?: boolean }) => api<ServiceDesk>(`/sectors/${sectorId}/desks`, { method: 'POST', body: JSON.stringify(data) }),
  updateDesk: (sectorId: number, id: number, data: Partial<Pick<ServiceDesk, 'name' | 'active'>>) => api<ServiceDesk>(`/sectors/${sectorId}/desks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDesk: (sectorId: number, id: number) => api<{ success: boolean }>(`/sectors/${sectorId}/desks/${id}`, { method: 'DELETE' }),
};
