"use client";

import type { InputHTMLAttributes } from "react";
import { parseDateDDMMYYYY } from "@/lib/date";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export default function DateInput({ value, onChange, ...props }: DateInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode="text"
      placeholder="dd/mm/yyyy"
      title="Enter a valid date in dd/mm/yyyy format"
      pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
      maxLength={10}
      value={value}
      ref={(input) => {
        input?.setCustomValidity(
          value && !parseDateDDMMYYYY(value) ? "Enter a valid date in dd/mm/yyyy format." : ""
        );
      }}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
