import { describe, expect, it } from "vitest";
import { runBusyAction } from "../templates/auth/supabase-react-vite/src/run-busy-action.js";

describe("generated Supabase busy action", () => {
  it("always clears busy state and reports a rejected request", async () => {
    let busy = false;
    let reportedError: unknown;

    await runBusyAction(
      async () => {
        expect(busy).toBe(true);
        throw new Error("network unavailable");
      },
      (value) => {
        busy = value;
      },
      (cause) => {
        reportedError = cause;
      },
    );

    expect(busy).toBe(false);
    expect(reportedError).toEqual(new Error("network unavailable"));
  });

  it("clears busy state after a successful request without reporting an error", async () => {
    let busy = false;
    const reportedErrors: unknown[] = [];

    await runBusyAction(
      async () => {
        expect(busy).toBe(true);
      },
      (value) => {
        busy = value;
      },
      (cause) => reportedErrors.push(cause),
    );

    expect(busy).toBe(false);
    expect(reportedErrors).toEqual([]);
  });
});
