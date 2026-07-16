import Image from "next/image";
import Link from "next/link";
import { CONTA } from "@/lib/mock";
import { Tutorial } from "@/components/tutorial";

export function Cabecalho() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Image
            src={CONTA.personaUrl}
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-full object-cover object-top ring-1 ring-border"
          />
          <span className="truncate text-sm font-medium">{CONTA.handle}</span>
        </Link>
        <div className="ml-auto">
          <Tutorial />
        </div>
      </div>
    </header>
  );
}
