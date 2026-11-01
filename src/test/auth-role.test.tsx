import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    rpc: mocks.rpc,
  },
}));

const user = { id: "customer-uuid" };

describe("administrator role verification", () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ data: { user }, error: null });
    mocks.onAuthStateChange.mockReset().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mocks.rpc.mockReset().mockResolvedValue({ data: false, error: null });
  });

  it("treats a missing initial session as signed out", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: Object.assign(new Error("Auth session missing!"), {
        name: "AuthSessionMissingError",
      }),
    });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.roleError).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("recognizes an approved admin role returned by Supabase", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.isAdmin).toBe(true));
    expect(result.current.roleError).toBeNull();
  });

  it("surfaces role lookup failures instead of treating them as an unapproved account", async () => {
    const roleError = new Error("Role lookup unavailable");
    mocks.rpc.mockResolvedValue({ data: null, error: roleError });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.roleError).toBe(roleError.message));
    expect(result.current.isAdmin).toBe(false);

    let refreshed: { isAdmin: boolean; error: string | null } | undefined;
    await act(async () => {
      refreshed = await result.current.refresh();
    });
    expect(refreshed).toEqual({ isAdmin: false, error: roleError.message });
  });
});
