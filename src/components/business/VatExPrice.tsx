import { cn } from "@/lib/utils";

type Props = {
  amount: number;
  unit?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showIncVat?: boolean;
  className?: string;
};

/**
 * Business prices are displayed EX-VAT with an explicit "+ VAT" tag and
 * an optional "inc. VAT" secondary line. Keeps semantic tokens only.
 */
export const VatExPrice = ({ amount, unit = "/mo", size = "lg", showIncVat = true, className }: Props) => {
  const incVat = amount * 1.2;
  const sizes: Record<string, string> = {
    sm: "text-2xl",
    md: "text-3xl",
    lg: "text-4xl",
    xl: "text-6xl",
  };
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-baseline gap-2">
        <span className={cn("font-display leading-none", sizes[size])}>
          £{amount.toFixed(2)}
        </span>
        <span className="text-sm font-medium text-muted-foreground">{unit}</span>
        <span className="text-xs font-mono px-1.5 py-0.5 border-2 border-foreground bg-secondary uppercase tracking-wider">
          + VAT
        </span>
      </div>
      {showIncVat && (
        <span className="text-xs text-muted-foreground mt-1">
          £{incVat.toFixed(2)}{unit} inc. VAT
        </span>
      )}
    </div>
  );
};

export default VatExPrice;