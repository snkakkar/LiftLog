"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/account-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type NavLink = { href: string; label: string };

export function NavHeader({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop nav: visible from md up */}
      <nav className="hidden md:flex items-center gap-4">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {label}
          </Link>
        ))}
        <AccountMenu />
      </nav>

      {/* Mobile nav: hamburger + dropdown */}
      <div className="flex md:hidden items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[min(90vw,320px)] p-0 gap-0">
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle>Menu</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col px-6 pb-6">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="py-3 text-sm text-muted-foreground hover:text-foreground border-b border-border last:border-0"
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <div className="pt-3 mt-2 border-t border-border">
                <AccountMenu />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
