# Morning Digest

Run the daily activity digest (America/Los_Angeles). Determine the window per
instructions.md step 1: previous 24 hours normally, but on Monday the previous
72 hours so Friday, Saturday and Sunday are all covered in one consolidated
weekend catch-up. Follow instructions.md end-to-end:

1. review memory first — read /memories/agent/AGENTS.md and the last few
   /memories/agent/daily/*.md files for continuity and recent themes (labels
   are not fixed — regroup when my contributions shift),
2. use Slack tools (search_slack_messages / get_slack_thread) for discussion
   framing over the same window — themes, decisions, blockers — not as a
   substitute for GitHub or Linear facts; do not send Slack messages yourself,
3. gather GitHub activity with the GitHub tools (get_github_user,
   list_github_events, search_github_pull_requests, search_github_issues,
   search_github_commits),
4. gather Linear activity with the Linear tools (get_linear_user,
   search_linear_issues, search_linear_comments) over the same window —
   skip Linear only if the API key is missing/unauthorized,
5. choose workstream headings that best fit the window's contributions; use
   Slack context to frame bullets; update the living map in AGENTS.md when the
   mix changes,
6. write "/memories/agent/daily/YYYY-MM-DD.md" and update the AGENTS.md index,
7. end with a concise standup-ready Slack message (that final message is
   auto-posted to my DM — do not call Slack chat APIs yourself).
