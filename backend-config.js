/* Public Supabase project settings only. NEVER put a service_role or secret key here. */
window.ARCHIVE_BACKEND = {
  supabaseUrl: 'https://dnmudtsrnbwdhnncncfa.supabase.co',
  supabaseAnonKey: 'sb_publishable_LwQ59X2raRL2LFNAJM-_Bg_7wER3oGp'
};
window.archiveBackendReady = () => {
  const c = window.ARCHIVE_BACKEND || {};
  return !!(c.supabaseUrl && c.supabaseAnonKey && c.supabaseUrl.startsWith('https://') && c.supabaseAnonKey.startsWith('sb_publishable_'));
};
