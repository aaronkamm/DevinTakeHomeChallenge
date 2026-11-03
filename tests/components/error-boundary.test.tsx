// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RootError from "@/app/error";
import RefundDetailError from "@/app/refunds/[id]/error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const error = Object.assign(new Error("connect ECONNREFUSED"), { digest: "abc123" });

beforeEach(() => {
  refresh.mockReset();
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
});
