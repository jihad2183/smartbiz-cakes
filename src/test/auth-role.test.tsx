import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { savePendingProfileLocation } from "@/lib/delivery-location";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  authCallback: vi.fn(),
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
    sessionStorage.clear();
    mocks.getUser.mockReset().mockResolvedValue({ data: { user }, error: null });
    mocks.onAuthStateChange.mockReset().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mocks.authCallback.mockReset();
    mocks.onAuthStateChange.mockImplementation(
      (callback: (event: string, session: { user: typeof user } | null) => void) => {
        mocks.authCallback.mockImplementation(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    );
    mocks.rpc.mockReset().mockResolvedValue({ data: false, error: null });
  });

  it("waits for Supabase to restore its initial session before treating the user as signed out", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.loading).toBe(true);
    act(() => mocks.authCallback("INITIAL_SESSION", null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.roleError).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("recognizes an approved admin role returned by Supabase", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() => mocks.authCallback("INITIAL_SESSION", { user }));

    await waitFor(() => expect(result.current.isAdmin).toBe(true));
    expect(result.current.roleError).toBeNull();
  });

  it("surfaces role lookup failures instead of treating them as an unapproved account", async () => {
    const roleError = new Error("Role lookup unavailable");
    mocks.rpc.mockResolvedValue({ data: null, error: roleError });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() => mocks.authCallback("INITIAL_SESSION", { user }));

    await waitFor(() => expect(result.current.roleError).toBe(roleError.message));
    expect(result.current.isAdmin).toBe(false);

    let refreshed: { isAdmin: boolean; error: string | null } | undefined;
    await act(async () => {
      refreshed = await result.current.refresh();
    });
    expect(refreshed).toEqual({ isAdmin: false, error: roleError.message });
  });

  it("saves a pending OAuth location through the null-only profile RPC after sign-in", async () => {
    const point = { latitude: 23.7, longitude: 90.4 };
    savePendingProfileLocation(point, "Dhaka");
    renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() => mocks.authCallback("INITIAL_SESSION", { user }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("has_role", expect.any(Object)));

    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("save_profile_location_if_missing", {
        _latitude: point.latitude,
        _longitude: point.longitude,
        _address: "Dhaka",
      }),
    );
    expect(sessionStorage.getItem("smartcake-pending-profile-location")).toBeNull();

    act(() => mocks.authCallback("SIGNED_IN", { user }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(3));
    expect(
      mocks.rpc.mock.calls.filter(([name]) => name === "save_profile_location_if_missing"),
    ).toHaveLength(1);
  });

  it("ignores an outdated initial-session event when a newer sign-in arrives", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    act(() => {
      mocks.authCallback("INITIAL_SESSION", null);
      mocks.authCallback("SIGNED_IN", { user });
    });

    await waitFor(() => expect(result.current.user).toEqual(user));
    expect(result.current.loading).toBe(false);
  });
});
