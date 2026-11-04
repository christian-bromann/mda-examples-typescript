import assert from "node:assert/strict";
import test from "node:test";

import { getAgentInputError as accountError } from "../account-concierge/input-validation.js";
import { getAgentInputError as dailyError } from "../daily-update/input-validation.js";
import { getAgentInputError as marketingError } from "../marketing-assistant/input-validation.js";
import { getAgentInputError as policyError } from "../policy-desk/input-validation.js";
import {
  getAgentInputError as tweetError,
  hasGitHubIssueOrPullRequest,
} from "../tweet-composer/input-validation.js";

const genericError = "Please provide a request.";
const validators = [accountError, dailyError, marketingError, policyError];

test("accepts non-empty text across the general-purpose example validators", () => {
  for (const validate of validators) {
    assert.equal(validate([{ type: "human", content: "Help me with this." }], genericError), undefined);
  }
});

test("returns a clear error for missing, blank, or empty-block user input", () => {
  for (const validate of validators) {
    assert.equal(validate([], genericError), genericError);
    assert.equal(validate([{ type: "human", content: " \n " }], genericError), genericError);
    assert.equal(validate([{ type: "human", content: [{ type: "text", text: "  " }] }], genericError), genericError);
  }
});

test("ignores non-user messages when locating the latest user input", () => {
  assert.equal(
    accountError([{ type: "human", content: "A real question" }, { type: "ai", content: "answer" }], genericError),
    undefined
  );
  assert.equal(accountError([{ type: "ai", content: "not user input" }], genericError), genericError);
});

test("accepts supported multimodal file and image content but rejects empty file blocks", () => {
  assert.equal(
    policyError([{ type: "human", content: [{ type: "file", data: "cGRm", mime_type: "application/pdf" }] }], genericError),
    undefined
  );
  assert.equal(
    policyError([{ type: "human", content: [{ type: "file", data: "", mime_type: "application/pdf" }] }], genericError),
    genericError
  );
  assert.equal(
    accountError([{ type: "human", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,abc" } }] }], genericError),
    undefined
  );
});

test("requires a GitHub pull request or issue reference for Tweet Composer", () => {
  const error = "Provide a GitHub PR or issue.";
  assert.equal(tweetError([{ type: "human", content: "Draft a launch tweet for https://github.com/acme/widget/pull/42" }], error, hasGitHubIssueOrPullRequest), undefined);
  assert.equal(tweetError([{ type: "human", content: "Please make me a tweet" }], error, hasGitHubIssueOrPullRequest), error);
  assert.equal(hasGitHubIssueOrPullRequest("acme/widget#42"), true);
  assert.equal(hasGitHubIssueOrPullRequest("https://github.com/acme/widget/issues/8"), true);
  assert.equal(hasGitHubIssueOrPullRequest("https://github.com/acme/widget"), false);
});
