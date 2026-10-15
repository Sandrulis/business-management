"use client";

export function EmailFrame({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!looksLikeHtml(trimmed)) {
    return <p className="whitespace-pre-wrap text-sm leading-6">{trimmed}</p>;
  }
  return (
    <iframe
      aria-label="E-pasta teksts"
      sandbox="allow-same-origin"
      srcDoc={emailDocument(trimmed)}
      className="h-96 w-full rounded-xl border border-[#e4efe8] bg-white"
      onLoad={(event) => {
        const frame = event.currentTarget;
        const height = frame.contentDocument?.documentElement.scrollHeight ?? 0;
        if (height > 0) frame.style.height = `${Math.min(Math.max(height, 160), 900)}px`;
      }}
    />
  );
}

function looksLikeHtml(text: string) {
  return /<!doctype\s+html|<html[\s>]|<body[\s>]|<table[\s>]|<div[\s>]/i.test(text);
}

function emailDocument(source: string) {
  const safe = source
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  if (/<html[\s>]/i.test(safe)) {
    if (/<head[\s>]/i.test(safe)) return safe.replace(/<head([^>]*)>/i, `<head$1><base target="_blank">`);
    return safe.replace(/<html([^>]*)>/i, `<html$1><head><base target="_blank"></head>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:16px;font:15px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;color:#143028}</style></head><body>${safe}</body></html>`;
}
