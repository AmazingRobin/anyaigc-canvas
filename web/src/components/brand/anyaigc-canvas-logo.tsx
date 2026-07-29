import Image from "next/image";

export function AnyAIGCCanvasLogo({ className }: { className?: string }) {
    return <Image src="/anyaigc-canvas-logo.png" alt="AnyAIGC Canvas" width={680} height={390} className={className} priority />;
}
