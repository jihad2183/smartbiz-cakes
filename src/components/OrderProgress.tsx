import { Link } from "@tanstack/react-router";
import { useLanguage } from "@/hooks/use-language";

export function OrderProgress({ step }: { step: "cart" | "checkout" }) {
  const { t } = useLanguage();
  const steps = [
    { label: t("menu"), to: "/cakes" as const, active: false },
    { label: t("cart"), to: "/cart" as const, active: step === "cart" },
    { label: t("checkout"), to: "/checkout" as const, active: step === "checkout" },
  ];

  return (
    <nav aria-label="Order progress" className="mb-6">
      <ol className="mx-auto flex max-w-xl items-center justify-between">
        {steps.map((item, index) => (
          <li key={item.label} className="flex flex-1 items-center last:flex-none">
            <Link
              to={item.to}
              className={`flex items-center gap-2 text-sm ${
                item.active ? "font-semibold text-primary" : "text-muted-foreground"
              }`}
              aria-current={item.active ? "step" : undefined}
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-full border ${
                  item.active ? "border-primary bg-primary text-primary-foreground" : "border-input"
                }`}
              >
                {index + 1}
              </span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
            {index < steps.length - 1 && <span className="mx-3 h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}
