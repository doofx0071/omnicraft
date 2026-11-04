import { describe, expect, it, vi } from "vitest";

const CANCEL = vi.hoisted(() => Symbol("clack:cancel"));
vi.mock("@clack/prompts", () => ({ isCancel: (value: unknown) => value === CANCEL }));

import { CancelledError } from "./cancel.js";
import { confirmOrYes } from "./confirm.js";

function makeConfirm(result: boolean | symbol) {
  return vi.fn(() => Promise.resolve(result));
}

describe("confirmOrYes", () => {
  it("accepts the install without prompting under --yes", async () => {
    const confirm = makeConfirm(true);

    await expect(confirmOrYes(true, "Install dependencies now?", confirm)).resolves.toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("prompts with the install as the default when not using --yes", async () => {
    const confirm = makeConfirm(true);

    await expect(confirmOrYes(false, "Install dependencies now?", confirm)).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledWith({ message: "Install dependencies now?", initialValue: true });
  });

  it("returns the declined answer", async () => {
    const confirm = makeConfirm(false);

    await expect(confirmOrYes(false, "Install dependencies now?", confirm)).resolves.toBe(false);
  });

  it("unwinds a cancelled prompt as a CancelledError", async () => {
    const confirm = makeConfirm(CANCEL);

    await expect(confirmOrYes(false, "Install dependencies now?", confirm)).rejects.toThrow(
      CancelledError,
    );
  });
});
