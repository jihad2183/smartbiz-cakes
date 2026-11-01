import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { LanguageProvider, useLanguage } from "@/hooks/use-language";

describe("Customer language preference", () => {
  beforeEach(() => localStorage.clear());

  it("translates customer navigation and persists Bangla across provider remounts", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LanguageProvider>{children}</LanguageProvider>
    );
    const first = renderHook(() => useLanguage(), { wrapper });
    expect(first.result.current.t("myOrders")).toBe("My orders");

    act(() => first.result.current.setLanguage("bn"));
    expect(first.result.current.t("myOrders")).toBe("আমার অর্ডার");
    expect(localStorage.getItem("smartcake-language")).toBe("bn");

    first.unmount();
    const second = renderHook(() => useLanguage(), { wrapper });
    await waitFor(() => expect(second.result.current.language).toBe("bn"));
    expect(second.result.current.t("myOrders")).toBe("আমার অর্ডার");
  });
});
