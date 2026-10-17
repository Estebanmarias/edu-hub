// Students sign in with a username. Supabase Auth needs an email, so we derive a
// private one from the username. No email is ever sent to it.
export const EMAIL_DOMAIN = "eduhub.app";
export const USERNAME_RE = /^[a-z0-9._-]{3,20}$/;

export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
