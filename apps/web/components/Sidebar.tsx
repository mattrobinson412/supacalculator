import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@workspace/ui/lib/utils"
import {
  Home,
  FileText,
  Save,
  Menu,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@workspace/ui/components/sheet"

const items = [
  { title: "Dashboard", href: "/", icon: Home },
  { title: "Calculator", href: "/estimates", icon: FileText },
  { title: "My Estimates", href: "/saved-estimates", icon: Save }, // If separate saved list needed
]

export function Sidebar({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname()

  const content = (
    <div className={cn("flex flex-col gap-2 p-4", mobile && "h-full")}>
      <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-lg font-semibold transition-all hover:bg-accent hover:text-accent-foreground">
        
        <span><span className="font-bold text-xl text-gradient">S</span>upaCalculator</span>
      </Link>
      <nav className="grid gap-2 p-2">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )

  if (mobile) {
    return (
      <Sheet>
        <SheetTrigger className="md:hidden">
          <Menu className="h-6 w-6" />
        </SheetTrigger>
        <SheetContent side="left" className="w-[300px] p-0">
          {content}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside className="hidden w-64 flex-col border-r bg-card md:flex">
      {content}
    </aside>
  )
}