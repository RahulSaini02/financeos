/**
 * AI Agent API — unauthenticated contract tests.
 * The agent endpoints must reject anonymous requests with 401 JSON,
 * never a redirect and never a stream.
 */
import { test, expect } from "@playwright/test";

test.describe("AI Agent API — unauthenticated", () => {
  test("POST /api/ai-agent returns 401", async ({ request }) => {
    const res = await request.post("/api/ai-agent", {
      data: { messages: [{ role: "user", content: "hi" }] },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/ai-agent/confirm returns 401", async ({ request }) => {
    const res = await request.post("/api/ai-agent/confirm", {
      data: { action_id: "00000000-0000-0000-0000-000000000000", confirmed: true },
    });
    expect(res.status()).toBe(401);
  });
});
