import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AdminError from "./error";

const SECRET = "connect ECONNREFUSED 172.18.0.2:5432";
const DIGEST = "4182374981";

function render(error: Error & { digest?: string }): string {
  return renderToStaticMarkup(createElement(AdminError, { error, reset: () => {} }));
}

describe("admin error boundary", () => {
  it("shows the digest and never the error message", () => {
    const markup = render(Object.assign(new Error(SECRET), { digest: DIGEST }));

    expect(markup).not.toContain(SECRET);
    expect(markup).not.toContain("ECONNREFUSED");
    expect(markup).toContain(DIGEST);
    expect(markup).toContain("Dashboard unavailable");
  });

  it("offers a retry control when there is no digest", () => {
    const markup = render(new Error(SECRET));

    expect(markup).not.toContain(SECRET);
    expect(markup).toContain("Reload dashboard");
    expect(markup).toContain("server log");
  });
});
