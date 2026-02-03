import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Variable } from "lucide-react";

interface VariableHelperProps {
  onInsert: (variable: string) => void;
}

const VARIABLES = [
  { key: "first_name", label: "First Name", description: "Customer's first name" },
  { key: "last_name", label: "Last Name", description: "Customer's surname" },
  { key: "full_name", label: "Full Name", description: "Complete name" },
  { key: "account_number", label: "Account Number", description: "OCC account number" },
  { key: "email", label: "Email", description: "Customer's email" },
  { key: "phone", label: "Phone", description: "Customer's phone" },
  { key: "support_email", label: "Support Email", description: "OCCTA support email" },
  { key: "support_phone", label: "Support Phone", description: "OCCTA support phone" },
  { key: "company_name", label: "Company Name", description: "OCCTA Limited" },
];

export const VariableHelper = ({ onInsert }: VariableHelperProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Variable className="h-3 w-3" />
          Insert Variable
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-1">
          <p className="text-sm font-medium">Available Variables</p>
          <p className="text-xs text-muted-foreground">
            Click to insert into your template
          </p>
        </div>
        <div className="mt-3 grid gap-1">
          {VARIABLES.map((variable) => (
            <button
              key={variable.key}
              onClick={() => onInsert(`{{${variable.key}}}`)}
              className="flex items-start gap-3 rounded-md px-2 py-2 text-left transition hover:bg-muted"
            >
              <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {`{{${variable.key}}}`}
              </code>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{variable.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {variable.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
