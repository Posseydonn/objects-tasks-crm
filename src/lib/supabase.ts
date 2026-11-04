import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../supabase/database.types';
// SDK expects structurally indexable row types; the shared contract uses interfaces.
type Tables = Database['public']['Tables'];
type ClientDatabase = Omit<Database, 'public'> & { public: Omit<Database['public'], 'Tables'> & {
  Tables: { [T in keyof Tables]: Omit<Tables[T], 'Row'> & { Row: { [K in keyof Tables[T]['Row']]: Tables[T]['Row'][K] } } }
} };
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configurationError = !url || !key ? 'Не настроено подключение к сервису. Укажите переменные окружения из .env.example.' : null;
// Только публичный ключ. Права доступа определяются RLS и RPC в базе.
export const supabase = !configurationError ? createClient<ClientDatabase>(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;
