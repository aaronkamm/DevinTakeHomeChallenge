// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RootError from "@/app/error";
import GlobalError from "@/app/global-error";
import RefundDetailError from "@/app/refunds/[id]/error";

const refresh = vi.fn();
const push = vi.fn();
let pathname = "/refunds/rf_0001";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }), usePathname: () => pathname }));
// next/font needs the Next compiler; the class names don't matter here.
vi.mock("@/app/fonts", () => ({ fontVariables: "font-vars" }));

const error = Object.assign(new Error("connect ECONNREFUSED"), { digest: "abc123" });

beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  pathname = "/refunds/rf_0001";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("error boundaries", () => {
  it("shows a friendly message and a way back to the browse page", () => {
    render(<RootError error={error} reset={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText(/usually temporary/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Refunds" })).toHaveAttribute("href", "/");
  });

  it("Try again refreshes the route and calls reset", () => {
    const reset = vi.fn();
    render(<RootError error={error} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(refresh).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
  });

  it("Return to Refunds on the browse page itself also retries", () => {
    const reset = vi.fn();
    const { unmount } = render(<RootError error={error} reset={reset} />);
    fireEvent.click(screen.getByRole("link", { name: "Return to Refunds" }));
    expect(reset).not.toHaveBeenCalled();
    unmount();

    pathname = "/";
    render(<RootError error={error} reset={reset} />);
    fireEvent.click(screen.getByRole("link", { name: "Return to Refunds" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
  });

  it("Return to Refunds from a filtered browse page clears the filters and resets", () => {
    pathname = "/";
    window.history.pushState({}, "", "/?status=pending");
    const reset = vi.fn();
    render(<RootError error={error} reset={reset} />);
    const link = screen.getByRole("link", { name: "Return to Refunds" });

    fireEvent.click(link, { ctrlKey: true });
    expect(reset).not.toHaveBeenCalled();

    fireEvent.click(link);
    expect(push).toHaveBeenCalledWith("/");
    expect(refresh).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalledOnce();
    window.history.pushState({}, "", "/");
  });

  it("shows the error message and digest outside production", () => {
    render(<RootError error={error} reset={vi.fn()} />);

    expect(screen.getByText("connect ECONNREFUSED")).toBeInTheDocument();
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it("hides error details in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<RootError error={error} reset={vi.fn()} />);

    expect(screen.queryByText("connect ECONNREFUSED")).not.toBeInTheDocument();
    expect(screen.queryByText("abc123")).not.toBeInTheDocument();
  });

  it("uses a refund-specific heading on the detail page", () => {
    render(<RefundDetailError error={error} reset={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Couldn't load this refund" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Refunds/ })).toHaveAttribute("href", "/");
  });

  it("global error renders its own document with the same recovery screen", () => {
    const reset = vi.fn();
    // Rendered into a div here, so React warns about <html> nesting; console.error is silenced.
    render(<GlobalError error={error} reset={reset} />);

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Refunds" })).toHaveAttribute("href", "/");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
  });
});
