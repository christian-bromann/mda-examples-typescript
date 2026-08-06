# X API setup (read-only)

This agent calls the official X API v2 with one secret: an **app-only Bearer
Token**. That token is issued to an **App** inside a **Project** on your X
developer account. You do **not** need user OAuth or write access — this example
never posts.

## What you need

1. An [X account](https://x.com/)
2. Access to the [X Developer Portal](https://developer.x.com/en/portal/dashboard)
   (sign in with that X account; new developers may need to apply / accept terms
   and attach billing depending on current X policy)
3. A **Project** with an **App** under it
4. That app’s **Bearer Token** → `X_BEARER_TOKEN` in `.env`

## Step-by-step

### 1. Open the Developer Portal

Go to [developer.x.com/en/portal/dashboard](https://developer.x.com/en/portal/dashboard)
and sign in.

If you have never used the portal, complete the developer onboarding / use-case
form first. Approval can be quick or take longer depending on X’s review.

### 2. Create a Project (if you do not have one)

In the portal sidebar, open **Projects & Apps** (wording may vary slightly).

1. Click **Create Project** (or use the onboarding wizard).
2. Give it a name (e.g. `marketing-assistant`).
3. Pick a use-case category that matches “reading public posts to draft my own
   content” — be honest; do not claim you will resell the firehose.
4. Finish the project prompts.

### 3. Create an App inside that Project

Still under the project:

1. Click **Create App** (or **Add App**).
2. Name the app (e.g. `marketing-assistant-read`).
3. Confirm creation.

You **must** create an App — the Bearer Token belongs to the App, not to your
personal X login by itself.

### 4. Copy the Bearer Token

1. Open your App in the portal.
2. Go to the **Keys and tokens** tab (sometimes under authentication / keys).
3. Find **Bearer Token** (under Authentication Tokens / App-only).
4. Click **Generate** or **Regenerate**.
5. Copy the value immediately and store it somewhere safe — portals often show
   it only once.

You do **not** need API Key/Secret or Access Token/Secret for this example.
Those are for user-context or write flows we do not use.

### 5. Put it in `.env`

In `marketing-assistant/.env`:

```bash
X_BEARER_TOKEN=AAAAAAAAAAAAAAAAAAAAA...your_token...
```

For deploy, set the same value as a LangSmith / GitHub Actions secret named
`X_BEARER_TOKEN`.

### 6. Quick sanity check (optional)

```bash
curl -sS "https://api.x.com/2/tweets/search/recent?query=langgraph&max_results=10" \
  -H "Authorization: Bearer $X_BEARER_TOKEN"
```

A JSON payload with `data` (or an empty result set) means the token works. `401`
/ `403` usually means a bad token, missing product access, or billing/tier
limits on the app.

## App permissions

For search + public timelines, **Read** is enough. Leave write / DM permissions
off.

If the portal asks you to set **User authentication settings**, you can skip
that for this example — app-only Bearer auth does not use a callback URL.

## Cost

X often bills pay-per-use for API reads. Keep morning scans light (few queries,
small `maxResults`). Check the current plan and usage in the developer console
before relying on a daily cron.

## Security

Treat the Bearer Token like a password. Never commit it. Prefer `.env` locally
and deployment / Actions secrets for hosted runs. If it leaks, **Regenerate** it
in **Keys and tokens**.
