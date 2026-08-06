# Creating `SLACK_USER_TOKEN`

Authored Slack tools (`search_slack_messages`, `get_slack_thread`) call the Slack
Web API with a **user** token (`xoxp-…`) from `SLACK_USER_TOKEN`.

That token is separate from `SLACK_BOT_TOKEN` (`xoxb-…`), which is only for
Events + DM delivery (`channels/slack.ts`).

## What the token can see

After you authorize as yourself in a workspace, the token can search/read only
what **your Slack user** can already see: channels you’re in, your DMs/MPIMs,
etc. It is not workspace-wide admin access.

## One-time setup

### 1. Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create an
   **internal** app (or reuse the same app as the bot).
2. Ensure the app has a **bot user** declared (even a minimal bot scope like
   `users:read`) if you also use this app for Events.
3. Under **OAuth & Permissions → Redirect URLs**, add a URI you can read a query
   string from, for example `https://localhost`.
4. Under **User Token Scopes**, add at least:

   - `search:read`
   - `channels:history`
   - `groups:history`
   - `im:history`
   - `mpim:history`
   - `users:read`

5. Copy **Client ID** and **Client Secret** from **Basic Information**.

Leave **token rotation** off unless you plan to implement refresh yourself.

### 2. Authorize (user OAuth)

Use the **user-token** authorize endpoint. On this endpoint the query param is
**`scope=`**, not `user_scope=`.

```text
https://slack.com/oauth/v2_user/authorize?client_id=CLIENT_ID&redirect_uri=https%3A%2F%2Flocalhost&scope=search%3Aread%2Cchannels%3Ahistory%2Cgroups%3Ahistory%2Cim%3Ahistory%2Cmpim%3Ahistory%2Cusers%3Aread
```

After approval, the browser lands on your redirect with `?code=...`.

### 3. Exchange the code for `xoxp-…`

```bash
export SLACK_CLIENT_ID="…"
export SLACK_CLIENT_SECRET="…"
export CODE="…"
export REDIRECT_URI="https://localhost"

curl -sS -X POST https://slack.com/api/oauth.v2.user.access \
  -d client_id="$SLACK_CLIENT_ID" \
  -d client_secret="$SLACK_CLIENT_SECRET" \
  -d code="$CODE" \
  -d redirect_uri="$REDIRECT_URI"
```

From a successful JSON response (`"ok": true`), take `access_token` (`xoxp-…`).
That value is `SLACK_USER_TOKEN`.

### 4. Store the token

- Local: `daily-update/.env` → `SLACK_USER_TOKEN=xoxp-…` (gitignored)
- Deploy: set the same secret on the Managed Deep Agents deployment

Never commit the token. If it is pasted into chat or logs, revoke/re-auth and
replace it.

## References

- Token exchange: [`oauth.v2.user.access`](https://docs.slack.dev/reference/methods/oauth.v2.user.access)
- Search: [`search.messages`](https://docs.slack.dev/reference/methods/search.messages)
