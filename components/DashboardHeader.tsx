"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";

interface DashboardHeaderProps {
  onDateRangeChange?: (range: string) => void;
  onRefresh?: () => void;
  dealFilter?: "all" | "ai-os";
  onDealFilterChange?: (filter: "all" | "ai-os") => void;
}

export function DashboardHeader({
  onDateRangeChange,
  onRefresh,
  dealFilter = "all",
  onDealFilterChange,
}: DashboardHeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = saved === "dark" || (!saved && prefersDark);
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-primary-foreground">M51</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            M51 OS Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Revenue, meetings, and conversion metrics
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Deal filter toggle */}
        <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
          <button
            onClick={() => onDealFilterChange?.("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              dealFilter === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Alle
          </button>
          <button
            onClick={() => onDealFilterChange?.("ai-os")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              dealFilter === "ai-os"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            AI OS
          </button>
        </div>

        <Select
          defaultValue="30d"
          onValueChange={(v) => onDateRangeChange?.(v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="year">This year</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </Button>
      </div>
    </div>
  );
}
