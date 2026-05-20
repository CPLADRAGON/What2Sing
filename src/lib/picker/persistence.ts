import type {ImportedSong} from '@/lib/importers/qq';
import {supabase} from '@/lib/supabase';
import {deserializePickerState, PICKER_STORAGE_KEY, type PickerState} from './session';

const SUPABASE_SESSION_ID_KEY = 'ktv-picker:supabase-session-id';

type PersistenceResult = {
  saved: boolean;
  reason?: 'missing-client' | 'signed-out' | 'database-error';
  id?: string;
};

type SupabasePickerSessionRow = {
  id?: string;
  order_mode: unknown;
  songs: unknown;
  liked: unknown;
  skipped: unknown;
  current_index: unknown;
  updated_at: unknown;
};

type PersistedSongsPayload = {
  deck: ImportedSong[];
  defaultDeck: ImportedSong[];
};

type RemotePickerSessionResult = {
  state: PickerState;
  id: string;
};

export async function loadLatestPickerStateForCurrentUser(): Promise<RemotePickerSessionResult | null> {
  if (!supabase) {
    return null;
  }

  const {data: sessionData} = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    return null;
  }

  const {data, error} = await supabase
    .from('picker_sessions')
    .select('id, order_mode, songs, liked, skipped, current_index, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', {ascending: false})
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const state = pickerStateFromSessionRow(data as SupabasePickerSessionRow);

  if (!state || typeof data.id !== 'string') {
    return null;
  }

  window.localStorage.setItem(SUPABASE_SESSION_ID_KEY, data.id);
  return {state, id: data.id};
}

export function pickerStateFromSessionRow(row: SupabasePickerSessionRow): PickerState | null {
  const songsPayload = normalizePersistedSongsPayload(row.songs);

  return deserializePickerState(JSON.stringify({
    deck: songsPayload.deck,
    defaultDeck: songsPayload.defaultDeck,
    currentIndex: row.current_index,
    liked: row.liked,
    skipped: row.skipped,
    orderMode: row.order_mode,
    updatedAt: row.updated_at
  }));
}

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
      songs: {deck: songs, defaultDeck: songs},
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
    songs: {deck: state.deck, defaultDeck: state.defaultDeck},
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

function normalizePersistedSongsPayload(value: unknown): PersistedSongsPayload {
  if (Array.isArray(value)) {
    return {deck: value as ImportedSong[], defaultDeck: value as ImportedSong[]};
  }

  if (value && typeof value === 'object' && 'deck' in value) {
    const payload = value as Partial<PersistedSongsPayload>;
    const deck = Array.isArray(payload.deck) ? payload.deck : [];
    const defaultDeck = Array.isArray(payload.defaultDeck) ? payload.defaultDeck : deck;

    return {deck, defaultDeck};
  }

  return {deck: [], defaultDeck: []};
}
