import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f] disabled:pointer-events-none disabled:opacity-50",
  { variants: {
    variant: {
      primary: "bg-[#d6ad60] text-[#080e1c] shadow-[0_10px_30px_rgba(214,173,96,0.16)] hover:-translate-y-0.5 hover:bg-[#e6c47f]",
      secondary: "border border-white/14 bg-white/[0.045] text-white hover:border-sky-300/40 hover:bg-white/[0.08]",
      ghost: "text-slate-300 hover:bg-white/[0.06] hover:text-white",
    },
    size: { default: "h-11", sm: "min-h-9 px-4 text-[0.82rem]", lg: "min-h-13 px-6 text-base" },
  }, defaultVariants: { variant: "primary", size: "default" } },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
