import test from "node:test";
import assert from "node:assert/strict";
import { createGitHubIssue } from "./core/githubClient.js";

// ── Happy path ────────────────────────────────────────────────

test("createGitHubIssue returns url and number on success", async () => {
  const mockResponse = {
    html_url: "https://github.com/owner/repo/issues/42",
    number: 42,
  };
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify(mockResponse), { status: 201, headers: { "content-type": "application/json" } });

  const result = await createGitHubIssue("owner", "repo", "Test title", "Test body", "gh-token", mockFetch);

  assert.equal(result.url, "https://github.com/owner/repo/issues/42");
  assert.equal(result.number, 42);
});

test("createGitHubIssue sends POST to correct GitHub API URL", async () => {
  let capturedUrl = "";
  const mockFetch: typeof fetch = async (url) => {
    capturedUrl = url.toString();
    return new Response(JSON.stringify({ html_url: "https://github.com/acme/widget/issues/1", number: 1 }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  await createGitHubIssue("acme", "widget", "title", "body", "token", mockFetch);
  assert.equal(capturedUrl, "https://api.github.com/repos/acme/widget/issues");
});

test("createGitHubIssue sends Authorization header with Bearer token", async () => {
  let capturedAuth = "";
  const mockFetch: typeof fetch = async (_url, init) => {
    capturedAuth = (init?.headers as Record<string, string>)["Authorization"] ?? "";
    return new Response(JSON.stringify({ html_url: "https://github.com/o/r/issues/5", number: 5 }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  await createGitHubIssue("o", "r", "t", "b", "my-secret-pat", mockFetch);
  assert.equal(capturedAuth, "Bearer my-secret-pat");
});

test("createGitHubIssue sends correct JSON body with title and body", async () => {
  let capturedBody: Record<string, unknown> = {};
  const mockFetch: typeof fetch = async (_url, init) => {
    capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
    return new Response(JSON.stringify({ html_url: "https://github.com/o/r/issues/7", number: 7 }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  await createGitHubIssue("o", "r", "Issue title", "Issue body text", "tok", mockFetch);
  assert.equal(capturedBody["title"], "Issue title");
  assert.equal(capturedBody["body"], "Issue body text");
});

test("createGitHubIssue URL-encodes owner and repo in the path", async () => {
  let capturedUrl = "";
  const mockFetch: typeof fetch = async (url) => {
    capturedUrl = url.toString();
    return new Response(JSON.stringify({ html_url: "https://github.com/my%20org/my%20repo/issues/2", number: 2 }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  await createGitHubIssue("my org", "my repo", "t", "b", "tok", mockFetch);
  assert.ok(capturedUrl.includes("my%20org"), "owner should be URL-encoded");
  assert.ok(capturedUrl.includes("my%20repo"), "repo should be URL-encoded");
});

// ── Error handling ────────────────────────────────────────────

test("createGitHubIssue throws on non-OK HTTP response", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response("Not Found", { status: 404 });

  await assert.rejects(
    () => createGitHubIssue("owner", "repo", "title", "body", "token", mockFetch),
    /GitHub API error \(404\)/
  );
});

test("createGitHubIssue throws on 401 Unauthorized", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ message: "Bad credentials" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    () => createGitHubIssue("owner", "repo", "title", "body", "bad-token", mockFetch),
    /GitHub API error \(401\)/
  );
});

test("createGitHubIssue throws on 422 Unprocessable Entity", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ message: "Validation Failed" }), {
      status: 422,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    () => createGitHubIssue("owner", "repo", "title", "body", "token", mockFetch),
    /GitHub API error \(422\)/
  );
});

test("createGitHubIssue throws if html_url is missing from response", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ number: 3 }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    () => createGitHubIssue("owner", "repo", "title", "body", "token", mockFetch),
    /missing html_url or number/
  );
});

test("createGitHubIssue throws if number is missing from response", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ html_url: "https://github.com/o/r/issues/9" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    () => createGitHubIssue("owner", "repo", "title", "body", "token", mockFetch),
    /missing html_url or number/
  );
});
