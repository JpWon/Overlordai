/* Overlord AI — Supabase sign-in, browser only.
 *
 * No server: signInWithOAuth hands the visitor to the provider, and Supabase
 * sends the session back in the URL fragment (implicit flow), which the client
 * picks up on load. The page therefore only ever needs the public anon key.
 *
 * Requires, in order: assets/vendor/supabase-js.js, assets/auth-config.js
 */
(() => {
  const cfg  = window.OVERLORD_SUPABASE || {};
  const lib  = window.supabase;
  const PROVIDERS = { google: 'google', facebook: 'facebook', apple: 'apple' };

  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const redirectTo = isLocal
    ? location.origin + '/dashboard.html'
    : (cfg.redirectTo || location.origin.replace(/\/$/, '') + '/dashboard.html');

  /* A key worth using is long; anything shorter is the empty placeholder. */
  const configured = Boolean(lib && cfg.url && cfg.anonKey && cfg.anonKey.length > 40);

  let client = null;
  if (configured) {
    client = lib.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit'
      }
    });
  }

  const provider = name => PROVIDERS[String(name || '').toLowerCase()] || null;

  /* Hands the browser to the provider. On success this function never returns —
     the page navigates away. */
  async function signIn(name) {
    const p = provider(name);
    if (!p) throw new Error('unknown provider "' + name + '"');
    if (!configured) throw new Error('sign-in is not configured on this host yet');
    const { error } = await client.auth.signInWithOAuth({
      provider: p,
      options: { redirectTo }
    });
    if (error) throw error;
  }

  async function session() {
    if (!configured) return null;
    const { data } = await client.auth.getSession();
    return data ? data.session : null;
  }

  /* scope:'local' on purpose — signing out on this machine must not kill the
     session on the user's other devices. */
  async function signOut() {
    if (!configured) return;
    await client.auth.signOut({ scope: 'local' });
  }

  function onChange(cb) {
    if (!configured) return { data: { subscription: { unsubscribe() {} } } };
    return client.auth.onAuthStateChange((_event, s) => cb(s));
  }

  /* Email + Password Sign In */
  async function signInWithEmail(email, password) {
    if (!configured) throw new Error('sign-in is not configured on this host yet');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  /* Email + Password Sign Up */
  async function signUpWithEmail(email, password, displayName) {
    if (!configured) throw new Error('sign-in is not configured on this host yet');
    const options = { emailRedirectTo: redirectTo };
    /* Apple's hand-off returns no name, so the create-account page collects one and
       we keep it on the user record here. */
    if (displayName) options.data = { display_name: String(displayName).trim() };
    const { data, error } = await client.auth.signUp({ email, password, options });
    if (error) throw error;
    return data;
  }

  /* Password reset: Supabase emails a recovery link; the landing page picks the
     session up out of the URL, same implicit flow as the provider hand-off. */
  async function resetPassword(email) {
    if (!configured) throw new Error('sign-in is not configured on this host yet');
    const { data, error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return data;
  }

  /* Send the confirmation email again, for the "check your inbox" pane. */
  async function resendConfirmation(email) {
    if (!configured) throw new Error('sign-in is not configured on this host yet');
    const { data, error } = await client.auth.resend({
      type: 'signup', email, options: { emailRedirectTo: redirectTo }
    });
    if (error) throw error;
    return data;
  }

  /* Passwordless Magic Link / OTP */
  async function signInWithOtp(email) {
    if (!configured) throw new Error('sign-in is not configured on this host yet');
    const { data, error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true }
    });
    if (error) throw error;
    return data;
  }

  window.OverlordAuth = {
    configured, redirectTo, gateDashboard: Boolean(cfg.gateDashboard),
    signIn, signInWithEmail, signUpWithEmail, signInWithOtp, session, signOut, onChange, provider,
    resetPassword, resendConfirmation,
    /* escape hatch for the per-page code */
    client: () => client
  };
})();
