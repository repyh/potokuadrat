import { describe, expect, it } from "vitest";
import { Toast, type ToastItem } from "./toast";

describe("Toast component (UI feedback)", () => {
  it("renders toast with correct tone and content", () => {
    const item: ToastItem = {
      id: "toast-1",
      tone: "danger",
      title: "Sync failed",
      message: "Google Drive was unreachable.",
    };

    let dismissedId = "";
    const element = Toast({
      toast: item,
      onDismiss: (id) => {
        dismissedId = id;
      },
    });

    expect(element).toBeDefined();
    expect(element.props.role).toBe("alert");
    expect(dismissedId).toBe("");
  });

  it("assigns status role for neutral/success tones", () => {
    const item: ToastItem = {
      id: "toast-2",
      tone: "success",
      title: "Link copied",
    };

    const element = Toast({
      toast: item,
      onDismiss: () => {},
    });

    expect(element.props.role).toBe("status");
  });
});
