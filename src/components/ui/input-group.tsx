import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const InputGroup = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center w-full relative", className)}
        {...props}
    />
))
InputGroup.displayName = "InputGroup"

const InputGroupAddon = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { align?: "block-start" | "center" | "block-end" }
>(({ className, align = "center", ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "flex items-center px-3",
            align === "block-start" && "items-start pt-2",
            align === "block-end" && "items-end pb-2",
            className
        )}
        {...props}
    />
))
InputGroupAddon.displayName = "InputGroupAddon"

const InputGroupButton = React.forwardRef<
    HTMLButtonElement,
    React.ComponentProps<typeof Button>
>(({ className, ...props }, ref) => (
    <Button
        ref={ref}
        className={cn("rounded-l-none", className)}
        {...props}
    />
))
InputGroupButton.displayName = "InputGroupButton"

const InputGroupTextarea = React.forwardRef<
    HTMLTextAreaElement,
    React.ComponentProps<typeof Textarea>
>(({ className, ...props }, ref) => (
    <Textarea
        ref={ref}
        className={cn("min-h-[40px] resize-none py-3", className)}
        {...props}
    />
))
InputGroupTextarea.displayName = "InputGroupTextarea"

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea }
