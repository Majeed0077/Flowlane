import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 py-10 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>© 2026 Flowlane. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <Link href="#home">Home</Link>
          <Link href="#services">Services</Link>
          <Link href="#about">About</Link>
        </div>
      </div>
    </footer>
  );
}
