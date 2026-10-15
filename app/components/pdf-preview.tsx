"use client";

import { useEffect, useRef, useState } from "react";

export function PdfPreview({ src, name, bare = false }: { src: string; name: string; bare?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;

    async function render() {
      hostRef.current?.replaceChildren();
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const response = await fetch(src);
      if (!response.ok) throw new Error("pdf");
      const data = new Uint8Array(await response.arrayBuffer());
      const task = pdfjs.getDocument({ data });
      destroy = () => {
        void task.destroy();
      };
      const pdf = await task.promise;
      const host = hostRef.current;
      if (cancelled || !host) return;
      host.replaceChildren();
      const width = Math.max(host.clientWidth - 24, 320);
      for (let number = 1; number <= pdf.numPages; number += 1) {
        const page = await pdf.getPage(number);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / base.width });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) continue;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.className = "w-full rounded-xl bg-white shadow-sm";
        host.append(canvas);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (cancelled) return;
      }
      if (!cancelled) setStatus("ready");
    }

    setStatus("loading");
    render().catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [src]);

  return (
    <div className={bare ? "rounded-xl bg-[#eef5f0] p-3" : "mt-4 rounded-3xl border border-[#d3e4da] bg-[#eef5f0] p-3"}>
      {status === "loading" ? <p className="px-2 py-6 text-sm text-[#5f756a]">Ielādē PDF...</p> : null}
      {status === "error" ? (
        <p className="px-2 py-6 text-sm text-[#5f756a]">
          PDF neizdevās parādīt.{" "}
          <a href={src} target="_blank" rel="noreferrer" className="font-semibold text-[#1a6b4a]">
            Atvērt {name}
          </a>
        </p>
      ) : null}
      <div ref={hostRef} className="space-y-3" />
    </div>
  );
}
