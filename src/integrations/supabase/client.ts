const API_URL = import.meta.env.VITE_API_URL || 'https://api.getinopay.com';
const TOKEN_KEY = 'inopay_token';
const USER_KEY = 'inopay_user';

type AuthChangeCallback = (event: string, session: any) => void;
const authListeners: AuthChangeCallback[] = [];

function notifyAuthChange(event: string, session: any) { authListeners.forEach(cb => cb(event, session)); }
function getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
function setToken(token: string, user: any) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); notifyAuthChange('SIGNED_IN', { access_token: token, user }); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); notifyAuthChange('SIGNED_OUT', null); }
function getStoredUser(): any | null { try { const r = localStorage.getItem(USER_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) return { data: { user: null, session: null }, error: { message: data.error || 'Erreur de connexion' } };
      setToken(data.token, data.user);
      return { data: { user: data.user, session: { access_token: data.token, user: data.user } }, error: null };
    } catch (e: any) { return { data: { user: null, session: null }, error: { message: e.message } }; }
  },
  async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
    try {
      const meta = options?.data || {};
      const res = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name: meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim(), ...meta }) });
      const data = await res.json();
      if (!res.ok) return { data: { user: null, session: null }, error: { message: data.error || 'Erreur inscription' } };
      setToken(data.token, data.user);
      return { data: { user: data.user, session: { access_token: data.token, user: data.user } }, error: null };
    } catch (e: any) { return { data: { user: null, session: null }, error: { message: e.message } }; }
  },
  async signOut() { clearToken(); return { error: null }; },
  async getUser() {
    const token = getToken();
    if (!token) return { data: { user: null }, error: null };
    const user = getStoredUser();
    if (user) return { data: { user }, error: null };
    try {
      const res = await apiFetch('/auth/me');
      if (!res.ok) { clearToken(); return { data: { user: null }, error: null }; }
      const data = await res.json();
      return { data: { user: data.user }, error: null };
    } catch { return { data: { user: null }, error: null }; }
  },
  async getSession() {
    const token = getToken(); const user = getStoredUser();
    if (!token || !user) return { data: { session: null }, error: null };
    return { data: { session: { access_token: token, user } }, error: null };
  },
  async updateUser(updates: any) {
    try {
      const res = await apiFetch('/auth/update', { method: 'PATCH', body: JSON.stringify(updates) });
      const data = await res.json();
      if (!res.ok) return { data: { user: null }, error: { message: data.error } };
      return { data: { user: data.user }, error: null };
    } catch (e: any) { return { data: { user: null }, error: { message: e.message } }; }
  },
  async resetPasswordForEmail(email: string, options?: any) {
    try { await apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, redirect_to: options?.redirectTo }) }); return { data: {}, error: null }; }
    catch (e: any) { return { data: {}, error: { message: e.message } }; }
  },
  onAuthStateChange(callback: AuthChangeCallback) {
    authListeners.push(callback);
    const token = getToken(); const user = getStoredUser();
    if (token && user) setTimeout(() => callback('SIGNED_IN', { access_token: token, user }), 0);
    else setTimeout(() => callback('SIGNED_OUT', null), 0);
    return { data: { subscription: { unsubscribe() { const i = authListeners.indexOf(callback); if (i > -1) authListeners.splice(i, 1); } } } };
  },
  mfa: {
    async listFactors() { return { data: { totp: [], phone: [], all: [] }, error: null }; },
    async enroll() { return { data: null, error: { message: 'MFA non disponible' } }; },
    async challenge() { return { data: null, error: { message: 'MFA non disponible' } }; },
    async verify() { return { data: null, error: { message: 'MFA non disponible' } }; },
    async unenroll() { return { data: null, error: null }; },
    async getAuthenticatorAssuranceLevel() { return { data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }; },
  },
};

class QueryBuilder {
  private table: string; private _filters: string[] = []; private _select = '*';
  private _order: string | null = null; private _limit: number | null = null;
  private _single = false; private _maybeSingle = false; private _head = false;
  private _count: string | null = null; private _method: string = 'GET';
  private _body: any = null; private _upsert = false;
  constructor(table: string) { this.table = table; }
  select(columns = '*', options?: any) { this._select = columns; if (options?.count) this._count = options.count; if (options?.head) this._head = true; return this; }
  insert(data: any, options?: any) { this._method = 'POST'; this._body = data; if (options?.onConflict) this._upsert = true; return this; }
  upsert(data: any, _options?: any) { this._method = 'POST'; this._body = data; this._upsert = true; return this; }
  update(data: any) { this._method = 'PATCH'; this._body = data; return this; }
  delete() { this._method = 'DELETE'; return this; }
  eq(col: string, val: any) { this._filters.push(`${col}=eq.${encodeURIComponent(val)}`); return this; }
  neq(col: string, val: any) { this._filters.push(`${col}=neq.${encodeURIComponent(val)}`); return this; }
  gt(col: string, val: any) { this._filters.push(`${col}=gt.${encodeURIComponent(val)}`); return this; }
  gte(col: string, val: any) { this._filters.push(`${col}=gte.${encodeURIComponent(val)}`); return this; }
  lt(col: string, val: any) { this._filters.push(`${col}=lt.${encodeURIComponent(val)}`); return this; }
  lte(col: string, val: any) { this._filters.push(`${col}=lte.${encodeURIComponent(val)}`); return this; }
  like(col: string, val: string) { this._filters.push(`${col}=like.${encodeURIComponent(val)}`); return this; }
  ilike(col: string, val: string) { this._filters.push(`${col}=ilike.${encodeURIComponent(val)}`); return this; }
  in(col: string, vals: any[]) { this._filters.push(`${col}=in.(${vals.map(v => encodeURIComponent(v)).join(',')})`); return this; }
  is(col: string, val: any) { this._filters.push(`${col}=is.${val}`); return this; }
  not(col: string, op: string, val: any) { this._filters.push(`${col}=not.${op}.${encodeURIComponent(val)}`); return this; }
  contains(col: string, val: any) { this._filters.push(`${col}=cs.${encodeURIComponent(JSON.stringify(val))}`); return this; }
  order(col: string, options?: { ascending?: boolean }) { this._order = `${col}${options?.ascending === false ? '.desc' : '.asc'}`; return this; }
  limit(n: number) { this._limit = n; return this; }
  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }
  async then(resolve: (value: any) => any, reject?: (reason?: any) => any) {
    try { return resolve(await this._execute()); } catch (e) { if (reject) return reject(e); throw e; }
  }
  private async _execute(): Promise<any> {
    let path = `/api/${this.table}`;
    const params: string[] = [];
    if (this._select && this._select !== '*') params.push(`select=${encodeURIComponent(this._select)}`);
    if (this._filters.length) params.push(this._filters.join('&'));
    if (this._order) params.push(`order=${this._order}`);
    if (this._limit) params.push(`limit=${this._limit}`);
    if (this._count) params.push(`count=${this._count}`);
    if (this._upsert) params.push('upsert=true');
    if (params.length) path += '?' + params.join('&');
    const options: RequestInit = { method: this._method };
    if (this._body) options.body = JSON.stringify(this._body);
    try {
      const res = await apiFetch(path, options);
      if (this._head) { const count = parseInt(res.headers.get('X-Total-Count') || '0'); return { data: null, error: null, count }; }
      if (!res.ok) { const err = await res.json().catch(() => ({})); return { data: null, error: { message: err.error || `HTTP ${res.status}`, code: res.status } }; }
      if (res.status === 204) return { data: null, error: null };
      const data = await res.json();
      if (this._single) { const item = Array.isArray(data) ? data[0] : data; if (!item) return { data: null, error: { message: 'No rows found', code: 'PGRST116' } }; return { data: item, error: null }; }
      if (this._maybeSingle) { return { data: Array.isArray(data) ? data[0] || null : data || null, error: null }; }
      if (this._count) { return { data, error: null, count: Array.isArray(data) ? data.length : 0 }; }
      return { data, error: null };
    } catch (e: any) { return { data: null, error: { message: e.message || 'Erreur réseau' } }; }
  }
}

const functions = {
  async invoke(name: string, options?: { body?: any }) {
    try {
      const res = await apiFetch(`/functions/${name}`, { method: 'POST', body: options?.body ? JSON.stringify(options.body) : undefined });
      const data = await res.json().catch(() => null);
      if (!res.ok) return { data: null, error: { message: data?.error || `HTTP ${res.status}` } };
      return { data, error: null };
    } catch (e: any) { return { data: null, error: { message: e.message } }; }
  },
};

async function rpc(fnName: string, params?: any) {
  try {
    const res = await apiFetch(`/rpc/${fnName}`, { method: 'POST', body: params ? JSON.stringify(params) : undefined });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { data: null, error: { message: data?.error || `HTTP ${res.status}` } };
    return { data, error: null };
  } catch (e: any) { return { data: null, error: { message: e.message } }; }
}

export const supabase = {
  auth, functions, rpc,
  from: (table: string) => new QueryBuilder(table),
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
  removeAllChannels: () => {},
};

export type SupabaseClient = typeof supabase;

// Override channel pour supporter .on().on() en chaîne
(supabase as any).channel = (name: string) => {
  const handlers: any[] = [];
  const channelObj = {
    on: (_event: string, _filter: any, _callback?: any) => channelObj,
    subscribe: (_callback?: any) => ({ unsubscribe: () => {} }),
    unsubscribe: () => {},
    send: () => {},
  };
  return channelObj;
};
(supabase as any).removeChannel = () => {};
(supabase as any).removeAllChannels = () => {};
(supabase as any).getChannels = () => [];
