import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Search, X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn, normalizePostcode } from "@/lib/utils";

export interface AdvancedSearchFilters {
  name: string;
  postcode: string;
  dob: Date | undefined;
  matchMode: "any" | "all";
}

interface CustomerAdvancedSearchProps {
  filters: AdvancedSearchFilters;
  onFiltersChange: (filters: AdvancedSearchFilters) => void;
  onSearch: () => void;
  onClear: () => void;
  isSearching?: boolean;
}

export const CustomerAdvancedSearch = ({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
  isSearching = false,
}: CustomerAdvancedSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters = filters.name || filters.postcode || filters.dob;

  const updateFilter = <K extends keyof AdvancedSearchFilters>(
    key: K,
    value: AdvancedSearchFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleClear = () => {
    onClear();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  return (
    <div className="border-2 border-foreground bg-card">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span className="font-display text-sm uppercase">Advanced Search</span>
          {hasActiveFilters && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* Collapsible Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t-2 border-foreground/20 space-y-4">
              {/* Search Fields */}
              <div className="grid gap-4 md:grid-cols-3">
                {/* Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="search-name" className="text-sm font-medium">
                    Name
                  </Label>
                  <Input
                    id="search-name"
                    placeholder="e.g. John Smith"
                    value={filters.name}
                    onChange={(e) => updateFilter("name", e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="border-2 border-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Partial match, case-insensitive
                  </p>
                </div>

                {/* Postcode Field */}
                <div className="space-y-2">
                  <Label htmlFor="search-postcode" className="text-sm font-medium">
                    Postcode
                  </Label>
                  <Input
                    id="search-postcode"
                    placeholder="e.g. HD3 3WU"
                    value={filters.postcode}
                    onChange={(e) => updateFilter("postcode", e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    className="border-2 border-foreground font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    From latest order
                  </p>
                </div>

                {/* DOB Field */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date of Birth</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal border-2 border-foreground",
                          !filters.dob && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {filters.dob ? format(filters.dob, "dd/MM/yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-2 border-foreground" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={filters.dob}
                        onSelect={(date) => updateFilter("dob", date)}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                        captionLayout="dropdown-buttons"
                        fromYear={1920}
                        toYear={new Date().getFullYear()}
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">Exact match</p>
                </div>
              </div>

              {/* Match Mode */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2 border-t border-foreground/10">
                <Label className="text-sm font-medium">Match Mode:</Label>
                <RadioGroup
                  value={filters.matchMode}
                  onValueChange={(value) => updateFilter("matchMode", value as "any" | "all")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="any" id="match-any" />
                    <Label htmlFor="match-any" className="cursor-pointer">
                      ANY (OR)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="match-all" />
                    <Label htmlFor="match-all" className="cursor-pointer">
                      ALL (AND)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="text-muted-foreground"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={onSearch}
                  disabled={isSearching}
                  className="border-2 border-foreground"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerAdvancedSearch;
