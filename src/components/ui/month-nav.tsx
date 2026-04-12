import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface MonthNavProps {
  year: number;
  month: number; // 1-indexed
  onChange: (year: number, month: number) => void;
  className?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MonthNav({ year, month, onChange, className }: MonthNavProps) {
  function prevMonth() {
    if (month === 1) {
      onChange(year - 1, 12);
    } else {
      onChange(year, month - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      onChange(year + 1, 1);
    } else {
      onChange(year, month + 1);
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button variant="ghost" size="sm" onClick={prevMonth} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium min-w-[140px] text-center">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Button variant="ghost" size="sm" onClick={nextMonth} aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
