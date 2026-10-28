import { POUND_OPTIONS } from "@/hooks/use-cart";

export function PoundSelect({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (p: number) => void;
  id?: string;
}) {
  return (
    <select
      id={id}
      aria-label="Cake size in pounds"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-9 rounded-md border border-input bg-card px-2 text-sm"
    >
      {POUND_OPTIONS.map((p) => (
        <option key={p} value={p}>
          {p} lb
        </option>
      ))}
    </select>
  );
}
