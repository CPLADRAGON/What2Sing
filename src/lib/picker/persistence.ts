import type {ImportedSong} from '@/lib/importers/qq';
import {supabase} from '@/lib/supabase';
import {PICKER_STORAGE_KEY, type PickerState} from './session';

const SUPABASE_SESSION_ID_KEY = 'ktv-picker:supabase-session-id';

type PersistenceResult = {
  saved: boolean;
  reason?: 'missing-client' | 'signed-out' | 'database-error';
  id?: string;
};

export async function saveImportedDeckForCurrentUser(songs: ImportedSong[]): Promise<PersistenceResult> {
  if (!supabase) {
    return {saved: false, reason: 'missing-client'};
  }

  const {data: sessionData} = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    return {saved: false, reason: 'signed-out'};
  }

  const {data, error} = await supabase
    .from('picker_sessions')
    .insert({
      user_id: user.id,
      name: 'Imported deck',
      order_mode: 'ordered',
      songs,
      liked: [],
      skipped: [],
      current_index: 0
    })
    .select('id')
    .single();

  if (error || !data) {
    return {saved: false, reason: 'database-error'};
  }

  window.localStorage.setItem(SUPABASE_SESSION_ID_KEY, data.id as string);
  return {saved: true, id: data.id as string};
}

export async function savePickerStateForCurrentUser(state: PickerState): Promise<PersistenceResult> {
  if (!supabase) {
    return {saved: false, reason: 'missing-client'};
  }

  const {data: sessionData} = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    return {saved: false, reason: 'signed-out'};
  }

  const existingId = window.localStorage.getItem(SUPABASE_SESSION_ID_KEY);
  const payload = {
    user_id: user.id,
    name: 'KTV picker session',
    order_mode: state.orderMode,
    songs: state.deck,
    liked: state.liked,
    skipped: state.skipped,
    current_index: state.currentIndex,
    updated_at: new Date().toISOString()
  };

  if (existingId) {
    const {error} = await supabase.from('picker_sessions').update(payload).eq('id', existingId).eq('user_id', user.id);

    if (!error) {
      return {saved: true, id: existingId};
    }
  }

  const {data, error} = await supabase.from('picker_sessions').insert(payload).select('id').single();

  if (error || !data) {
    return {saved: false, reason: 'database-error'};
  }

  window.localStorage.setItem(SUPABASE_SESSION_ID_KEY, data.id as string);
  return {saved: true, id: data.id as string};
}

export function clearStoredPickerSessionIds() {
  window.localStorage.removeItem(SUPABASE_SESSION_ID_KEY);
  window.localStorage.removeItem(PICKER_STORAGE_KEY);
}
