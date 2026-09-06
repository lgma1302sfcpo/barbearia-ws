declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    SITE_PIN: string;
    SITE_SESSION_SECRET: string;
  }
}
