# SSO Implementation Resume File
**Created**: 2026-01-19
**Updated**: 2026-01-26
**Status**: FIXED - Ready for Testing
**Priority**: HIGH - Verify SSO flow works

---

## FIX APPLIED (Jan 26, 2026)

**Root cause**: voyo-fork uses simpler `returnUrl` flow, voyo-music was using broken `from` flow.

**Solution**: Updated voyo-music to support BOTH flows (matching voyo-fork's working approach):

1. **handleSSOCallback()** now checks for:
   - `dashAuth` param FIRST (base64 citizen data - simpler, no DB call)
   - Falls back to `sso_token` if dashAuth not present

2. **openCommandCenterForSSO()** now uses `returnUrl` flow (proven working in voyo-fork)

Commits:
- `690f345` - Fix SSO: Support both dashAuth and sso_token flows
- `d75f15f` - Fix auth storage format compatibility across all components

## IMMEDIATE NEXT ACTION
**Test the complete SSO flow:**
1. Go to https://voyo-music.vercel.app (clear localStorage first)
2. Click profile → "Sign In with DASH"
3. Should redirect to Command Center with `?returnUrl=...&app=V`
4. Enter DASH ID + PIN, click Sign In
5. Should redirect back to VOYO with `?dashAuth=base64...`
6. VOYO should auto-sign-in and clean URL

---

## What We Built
Bidirectional SSO between VOYO and Command Center:
```
VOYO → Command Center (with ?from=voyo) → Sign in → VOYO (with ?sso_token=xxx) → Auto signed in
```

## Files Changed

### VOYO (voyo-music) - /home/dash/voyo-music/
| File | Changes |
|------|---------|
| `src/lib/dash-auth.tsx:325-400` | `exchangeSSOToken()`, `handleSSOCallback()`, `openCommandCenterForSSO()` |
| `src/App.tsx:932-943` | Calls `handleSSOCallback()` on startup |
| `src/components/universe/UniversePanel.tsx:280-302` | Single "Sign In with DASH" button |
| `src/components/profile/ProfilePage.tsx:157-160` | Uses `openCommandCenterForSSO()` |

### Command Center (dash-command) - /home/dash/dash-command/
| File | Changes |
|------|---------|
| `src/lib/supabase.ts` | `generateSSOToken()`, `buildSSORedirectUrl()` |
| `src/App.tsx:329-331` | SignInPage receives `fromApp`, `prefilledDashId` as props |
| `src/App.tsx:3881-3889` | Parses `from` param at App level |
| `src/App.tsx:3904-3909` | Auto-navigates to signin when `from` present |
| `src/App.tsx:369-383` | `handleSignIn` generates token and redirects |
| `supabase/sso_migration.sql` | SQL for sso_tokens table (ALREADY RUN) |

---

## SSO Flow (Step by Step)

```
1. VOYO: User clicks "Sign In with DASH"
   → openCommandCenterForSSO() in dash-auth.tsx:405
   → Redirects to: https://dash-command.vercel.app?from=voyo

2. Command Center: App.tsx loads
   → useMemo parses from=voyo (line 3882-3889)
   → useEffect auto-navigates to signin (line 3904-3909)
   → SignInPage receives fromApp="voyo" as prop

3. User enters DASH ID + PIN, clicks Sign In
   → handleSignIn() at line 358
   → Calls signIn() to verify credentials
   → If success AND fromApp exists:
      → generateSSOToken(user.core_id, fromApp) - line 372
      → buildSSORedirectUrl(token, fromApp) - line 375
      → window.location.href = redirectUrl - line 377

4. Redirect to VOYO with token
   → URL: https://voyo-music.vercel.app?sso_token=xxx

5. VOYO: App.tsx loads
   → handleSSOCallback() runs in useEffect (line 932-943)
   → Exchanges token via exchangeSSOToken()
   → Stores user in localStorage
   → User is signed in
```

---

## SQL Migration (ALREADY DONE IN SUPABASE)
```sql
-- Table
CREATE TABLE sso_tokens (token, dash_id, target_app, expires_at, used)

-- RPC Functions
generate_sso_token(p_dash_id, p_target_app) → returns {success, token}
exchange_sso_token(p_token) → returns {success, user}
```

---

## Debug Checklist

### On Command Center (after clicking sign in):
- [ ] Console shows `[DASH SSO] Sign in complete, redirecting to: voyo`
- [ ] Console shows `[DASH SSO] Redirecting with token to: https://voyo-music.vercel.app?sso_token=xxx`
- [ ] If NOT: Check if `fromApp` is undefined (param not captured)

### On VOYO (after redirect):
- [ ] URL has `?sso_token=xxx` parameter
- [ ] Console shows `[DASH SSO] Found token, exchanging...`
- [ ] Console shows `[DASH SSO] Auto sign-in successful!`

### Common Issues:
1. **fromApp is undefined** → App.tsx not parsing `from` param correctly
2. **Token generation fails** → Check Supabase RPC, might need to re-run migration
3. **Token exchange fails** → Token expired (60 sec) or already used

---

## Test URLs
- VOYO: https://voyo-music.vercel.app
- Command Center: https://dash-command.vercel.app
- Direct SSO test: https://dash-command.vercel.app?from=voyo

---

## Deployments
```bash
# VOYO - auto-deploys on GitHub push
cd /home/dash/voyo-music && git push

# Command Center - manual via Vercel CLI
cd /home/dash/dash-command && vercel --prod --yes
```

---

## Other Fixes Done This Session
- Hub.tsx: Moved Add Friend button to DASH card (grey, smaller)
- ClassicMode.tsx: Fixed VOYO Feed tab navigation (was going to player instead of feed)
- UniversePanel: Stats page shows first by default
- Unified all sign-in paths to use SSO redirect
