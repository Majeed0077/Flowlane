import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b glass">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center">
          <Image
            src="/Logo.png"
            alt="Flowlane"
            width={140}
            height={36}
            className="h-9 w-auto object-contain"
            priority
          />
        </div>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="#home" className="hover:text-foreground">Home</Link>
          <Link href="#services" className="hover:text-foreground">Services</Link>
          <Link href="#about" className="hover:text-foreground">About</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/signin">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button>Sign up</Button>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
