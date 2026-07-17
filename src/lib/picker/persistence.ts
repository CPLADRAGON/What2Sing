import type {ImportedSong} from '@/lib/importers/qq';
import {safeGetItem, safeRemoveItem, safeSetItem} from '@/lib/safe-storage';
import {supabase} from '@/lib/supabase';
import {deserializeLibrary, LIBRARY_STORAGE_KEY, mergePickedSongs, serializeLibrary, type SongLibrary} from './library';
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

  safeSetItem(SUPABASE_SESSION_ID_KEY, data.id);
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

  const existingId = safeGetItem(SUPABASE_SESSION_ID_KEY);
  const payload = {
    user_id: user.id,
    name: 'Imported deck',
    order_mode: 'ordered' as const,
    songs: {deck: songs, defaultDeck: songs},
    liked: [] as ImportedSong[],
    skipped: [] as ImportedSong[],
    current_index: 0,
    updated_at: new Date().toISOString()
  };

  if (existingId) {
    const {error} = await supabase.from('picker_sessions').update(payload).eq('id', existingId).eq('user_id', user.id);

    if (!error) {
      return {saved: true, id: existingId};
    }
  }

  const {data, error} = await supabase
    .from('picker_sessions')
    .insert(payload)
    .select('id')
    .single();

  if (error || !data) {
    return {saved: false, reason: 'database-error'};
  }

  safeSetItem(SUPABASE_SESSION_ID_KEY, data.id as string);
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

  const existingId = safeGetItem(SUPABASE_SESSION_ID_KEY);
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

  safeSetItem(SUPABASE_SESSION_ID_KEY, data.id as string);
  return {saved: true, id: data.id as string};
}

export function clearStoredPickerSessionIds() {
  safeRemoveItem(SUPABASE_SESSION_ID_KEY);
  safeRemoveItem(PICKER_STORAGE_KEY);
}

export async function loadLibraryForCurrentUser(): Promise<SongLibrary | null> {
  if (!supabase) {
    return null;
  }

  const {data: sessionData} = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    return null;
  }

  const {data, error} = await supabase
    .from('song_libraries')
    .select('songs, batches, picked_songs, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return deserializeLibrary(JSON.stringify({
    songs: data.songs,
    batches: data.batches,
    pickedSongs: data.picked_songs,
    updatedAt: data.updated_at
  }));
}

export async function saveLibraryForCurrentUser(library: SongLibrary): Promise<PersistenceResult> {
  if (!supabase) {
    return {saved: false, reason: 'missing-client'};
  }

  const {data: sessionData} = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    return {saved: false, reason: 'signed-out'};
  }

  const payload = {
    user_id: user.id,
    songs: library.songs,
    batches: library.batches,
    picked_songs: library.pickedSongs,
    updated_at: new Date().toISOString()
  };

  const {error} = await supabase
    .from('song_libraries')
    .upsert(payload, {onConflict: 'user_id'});

  if (error) {
    return {saved: false, reason: 'database-error'};
  }

  return {saved: true};
}

export function chooseSyncedLibrary(localLib: SongLibrary | null, remoteLib: SongLibrary | null): SongLibrary | null {
  if (!localLib) {
    return remoteLib;
  }

  if (!remoteLib) {
    return localLib;
  }

  const remoteIsNewer = Date.parse(remoteLib.updatedAt) > Date.parse(localLib.updatedAt);
  const newer = remoteIsNewer ? remoteLib : localLib;
  const older = remoteIsNewer ? localLib : remoteLib;
  // Sync is deliberately additive for picks: this prevents losing curated songs,
  // but a pick deleted on one device may reappear from another stale device.
  const merged = mergePickedSongs(newer, older);

  if (merged === newer) {
    return newer;
  }

  return {...merged, updatedAt: newer.updatedAt};
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
