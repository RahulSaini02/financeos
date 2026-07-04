/**
 * AI Agent — live end-to-end tests.
 *
 * These call the real /api/ai-agent endpoint, which invokes the Anthropic API
 * and consumes AI rate-limit quota, so they only run when explicitly enabled:
 *
 *   RUN_AGENT_LIVE=1 npx playwright test agent-live --project authenticated
 *
 * The write test uses the CANCEL path, so no user data is modified.
 */
import { test, expect, APIResponse, APIRequestContext } from "@playwright/test";

const EMAIL = process.env.TEST_USER_EMAIL ?? "";
const PASSWORD = process.env.TEST_USER_PASSWORD ?? "";
const LIVE = !!process.env.RUN_AGENT_LIVE;

interface SseEvent {
  event: string;
  text?: string;
  toolName?: string;
  toolUseId?: string;
  summary?: string;
  actionId?: string;
  preview?: string;
  reason?: string;
  message?: string;
}

async function parseSse(res: APIResponse): Promise<SseEvent[]> {
  const body = await res.text();
  const events: SseEvent[] = [];
  for (const line of body.split("\n\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      events.push(JSON.parse(line.slice(6)) as SseEvent);
    } catch {
      /* ignore malformed frames */
    }
  }
  return events;
}

const streamedText = (events: SseEvent[]) =>
  events.filter((e) => e.event === "text_delta").map((e) => e.text ?? "").join("");

// The app enforces AI rate limits: 5 calls/minute and 20 calls/day per user.
// A per-minute 429 is waited out once; a daily-limit 429 skips the test with
// a clear message instead of failing — quota exhaustion is not a code defect.
async function skipIfDailyLimit(res: APIResponse): Promise<void> {
  const body = (await res.json().catch(() => ({}))) as { code?: string };
  test.skip(
    body.code === "DAILY_LIMIT_REACHED",
    "Test user's daily AI quota is exhausted — re-run after midnight UTC",
  );
}

async function postAgent(request: APIRequestContext, data: Record<string, unknown>): Promise<APIResponse> {
  let res = await request.post("/api/ai-agent", { data, timeout: 150_000 });
  if (res.status() === 429) {
    await skipIfDailyLimit(res);
    await new Promise((r) => setTimeout(r, 61_000));
    res = await request.post("/api/ai-agent", { data, timeout: 150_000 });
    if (res.status() === 429) await skipIfDailyLimit(res);
  }
  return res;
}

test.describe("AI Agent — live loop", () => {
  test.skip(!EMAIL || !PASSWORD, "TEST_USER_EMAIL / TEST_USER_PASSWORD not set");
  test.skip(!LIVE, "RUN_AGENT_LIVE not set — live agent tests are opt-in");
  test.describe.configure({ timeout: 180_000 });

  test("read loop: answers a net worth question using tools", async ({ request }) => {
    const res = await postAgent(request, {
      messages: [{ role: "user", content: "What is my net worth right now?" }],
      timezone: "America/Los_Angeles",
      sessionId: `e2e-live-${Date.now()}`,
    });
    expect(res.status()).toBe(200);
    const events = await parseSse(res);

    // The agent must have used at least one tool and finished cleanly
    expect(events.some((e) => e.event === "tool_start")).toBe(true);
    expect(events.some((e) => e.event === "done" && e.reason === "end_turn")).toBe(true);
    expect(events.some((e) => e.event === "error")).toBe(false);
    expect(streamedText(events).length).toBeGreaterThan(20);
  });

  test("write loop: pending action → cancel → resumed acknowledgment", async ({ request }) => {
    const sessionId = `e2e-live-${Date.now()}`;
    const res = await postAgent(request, {
      messages: [
        {
          role: "user",
          content:
            "Create a savings goal called 'E2E Probe Goal' with a $500 target. Do it now without asking follow-up questions.",
        },
      ],
      timezone: "America/Los_Angeles",
      sessionId,
    });
    expect(res.status()).toBe(200);
    const events = await parseSse(res);
    expect(events.some((e) => e.event === "error")).toBe(false);

    const pending = events.find((e) => e.event === "pending_action");
    expect(pending, `expected a pending_action event, got: ${JSON.stringify(events.map((e) => e.event))}`).toBeTruthy();
    expect(pending!.actionId).toBeTruthy();
    // Preview must show the resolved action, not raw tool input
    expect(pending!.preview ?? "").toContain("E2E Probe Goal");
    expect(events.some((e) => e.event === "done" && e.reason === "awaiting_confirmation")).toBe(true);

    // Cancel — no data is written
    const cancelRes = await request.post("/api/ai-agent/confirm", {
      data: { action_id: pending!.actionId, confirmed: false, timezone: "America/Los_Angeles" },
    });
    expect(cancelRes.status()).toBe(200);

    // Resume: the model must see the rejection and stream an acknowledgment
    const resumeRes = await postAgent(request, { resumeActionId: pending!.actionId, timezone: "America/Los_Angeles", sessionId });
    expect(resumeRes.status()).toBe(200);
    const resumeEvents = await parseSse(resumeRes);
    expect(resumeEvents.some((e) => e.event === "error")).toBe(false);
    expect(resumeEvents.some((e) => e.event === "done" && e.reason === "end_turn")).toBe(true);
    expect(streamedText(resumeEvents).length).toBeGreaterThan(5);

    // Replay guard: the same action cannot be resumed twice
    const replayRes = await postAgent(request, { resumeActionId: pending!.actionId, timezone: "America/Los_Angeles", sessionId });
    expect(replayRes.status()).toBe(409);
  });

  test("web search: finance question triggers server-side search", async ({ request }) => {
    const res = await postAgent(request, {
      messages: [
        {
          role: "user",
          content:
            "Use web search to find the current US national average savings account APY, then tell me the number.",
        },
      ],
      timezone: "America/Los_Angeles",
      sessionId: `e2e-live-${Date.now()}`,
    });
    expect(res.status()).toBe(200);
    const events = await parseSse(res);
    expect(events.some((e) => e.event === "error")).toBe(false);
    expect(events.some((e) => e.event === "tool_start" && e.toolName === "web_search")).toBe(true);
    expect(events.some((e) => e.event === "done" && e.reason === "end_turn")).toBe(true);
    expect(streamedText(events).length).toBeGreaterThan(20);
  });
});
