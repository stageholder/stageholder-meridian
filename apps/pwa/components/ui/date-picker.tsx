"use client"

import * as React from "react"
import { CalendarIcon, XIcon } from "lucide-react"
import { format, parseISO } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  /** ISO date string (YYYY-MM-DD) or empty string */
  value: string
  /** Called with ISO date string or empty string */
  onChange: (value: string) => void
  placeholder?: string
  /** Allow clearing the date */
  clearable?: boolean
  /** Disable dates after this */
  maxDate?: Date
  className?: string
  id?: string
}

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  clearable = true,
  maxDate,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selected = value ? parseISO(value) : undefined

  function handleSelect(date: Date | undefined) {
    if (date) {
      const iso = format(date, "yyyy-MM-dd")
      onChange(iso)
    } else {
      onChange("")
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          {value ? format(parseISO(value), "MMM d, yyyy") : placeholder}
          {clearable && value && (
            <XIcon
              className="ml-auto size-3.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onChange("")
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected}
          disabled={maxDate ? { after: maxDate } : undefined}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
