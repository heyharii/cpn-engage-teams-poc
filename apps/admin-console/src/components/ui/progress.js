import { jsx as _jsx } from "react/jsx-runtime";
import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
function Progress({ className, value, ...props }) {
    return (_jsx(ProgressPrimitive.Root, { "data-slot": "progress", className: cn("relative flex h-3 w-full items-center overflow-x-hidden rounded-full bg-muted", className), ...props, children: _jsx(ProgressPrimitive.Indicator, { "data-slot": "progress-indicator", className: "size-full flex-1 bg-primary transition-all", style: { transform: `translateX(-${100 - (value || 0)}%)` } }) }));
}
export { Progress };
