import { useState, useEffect } from "react";
import { TextField, InputAdornment, Tooltip } from "@mui/material";
import type { TextFieldProps } from "@mui/material";
import { evalMath } from "../utils/form";

const ALLOWED = /^[\d\s+\-*/.(),]*$/;

type MathTextFieldProps = Omit<TextFieldProps, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
  onEvaluated?: (value: string) => void;
};

/**
 * A TextField that accepts numbers and basic math expressions (+, -, *, /, parentheses).
 * Press Enter to evaluate the expression. Result replaces the input value.
 * Only allows digits, operators, dots, commas, and parentheses.
 */
export default function MathTextField({
  value,
  onChange,
  decimals = 2,
  onEvaluated,
  slotProps,
  ...rest
}: MathTextFieldProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [hasExpr, setHasExpr] = useState(false);

  useEffect(() => {
    setDisplayValue(value);
    setHasExpr(false);
  }, [value]);

  const handleChange = (raw: string) => {
    // Filter to only allowed characters
    const filtered = raw.split("").filter((ch) => ALLOWED.test(ch)).join("");
    setDisplayValue(filtered);
    // Check if it contains math operators (not just a plain number)
    const isMath = /[+\-*/()]/.test(filtered.replace(/^-/, "")); // ignore leading minus
    setHasExpr(isMath);
    if (!isMath) {
      onChange(filtered);
    }
  };

  const evaluate = () => {
    const result = evalMath(displayValue, decimals);
    if (result !== null) {
      const str = String(result);
      setDisplayValue(str);
      setHasExpr(false);
      onChange(str);
      onEvaluated?.(str);
    }
  };

  return (
    <TextField
      {...rest}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={(e) => handleChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && hasExpr) {
          e.preventDefault();
          evaluate();
        }
        // Block non-allowed characters
        if (e.key.length === 1 && !ALLOWED.test(e.key)) {
          e.preventDefault();
        }
      }}
      slotProps={{
        ...slotProps,
        inputLabel: {
          shrink: true,
          ...((slotProps as { inputLabel?: Record<string, unknown> })?.inputLabel ?? {}),
        },
        input: {
          ...((slotProps as { input?: Record<string, unknown> })?.input ?? {}),
          ...(hasExpr ? {
            endAdornment: (
              <Tooltip title="Press Enter to calculate">
                <InputAdornment position="end" sx={{ cursor: "default", fontSize: "0.7rem", color: "primary.main" }}>=</InputAdornment>
              </Tooltip>
            ),
          } : {}),
        },
      }}
    />
  );
}
