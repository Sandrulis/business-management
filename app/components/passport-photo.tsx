"use client";

import { useInvoices } from "@/app/components/invoice-state";
import { Crop, ImagePlus, RefreshCw, Trash2, X } from "lucide-react";
import { DragEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const RATIO = 35 / 45;
const OUTPUT_WIDTH = 420;
const OUTPUT_HEIGHT = 540;

type Box = { x: number; y: number; w: number; h: number; scale: number };
type Frame = { x: number; y: number; w: number };

export function PassportPhoto({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { notify } = useInvoices();
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef("");
  const [source, setSource] = useState("");
  const [dragging, setDragging] = useState(false);
  const [cropping, setCropping] = useState(false);

  useEffect(() => {
    if (!value) {
      sourceRef.current = "";
      setSource("");
    }
  }, [value]);

  async function take(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const dataUrl = await readImageFile(file);
      sourceRef.current = dataUrl;
      setSource(dataUrl);
      onChange(dataUrl);
    } catch {
      notify("Attēlu neizdevās nolasīt.", "error");
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void take(event.dataTransfer.files[0]);
  }

  return (
    <div>
      <p className="text-sm font-medium">Foto</p>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-2 rounded-2xl border border-dashed p-3 ${dragging ? "border-[#1a6b4a] bg-[#e7f6ec]" : "border-[#c5d9cd] bg-[#f7fbf8]"}`}
      >
        {value ? (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setCropping(true)} className="shrink-0 overflow-hidden rounded-xl" aria-label="Izgriezt foto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="" className="aspect-[35/45] w-24 object-cover" />
            </button>
            <div className="min-w-0">
              <p className="text-sm text-[#5f756a]">Nospied foto, lai izgrieztu pases proporcijā 35×45.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setCropping(true)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#1a6b4a]">
                  <Crop className="size-4 shrink-0" aria-hidden="true" />
                  Izgriezt
                </button>
                <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#1e3a2f]">
                  <RefreshCw className="size-4 shrink-0" aria-hidden="true" />
                  Nomainīt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sourceRef.current = "";
                    setSource("");
                    onChange("");
                  }}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#b42318]"
                >
                  <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                  Noņemt
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 py-6 text-sm text-[#5f756a]">
            <ImagePlus className="size-6 text-[#1a6b4a]" aria-hidden="true" />
            Ievelc attēlu vai izvēlies failu
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            void take(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {cropping ? (
        <CropDialog
          src={source || value}
          onCancel={() => setCropping(false)}
          onApply={(next) => {
            onChange(next);
            setCropping(false);
          }}
        />
      ) : null}
    </div>
  );
}

function CropDialog({
  src,
  onCancel,
  onApply,
}: {
  src: string;
  onCancel: () => void;
  onApply: (value: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageBox, setImageBox] = useState<Box | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      onCancelRef.current();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  function place(image: HTMLImageElement) {
    const stage = stageRef.current;
    if (!stage || !image.naturalWidth) return;
    const box = fitImage(image.naturalWidth, image.naturalHeight, stage.clientWidth, stage.clientHeight);
    setImageBox(box);
    setFrame(passportFrame(box));
  }

  function apply() {
    const image = imageRef.current;
    if (!image || !imageBox || !frame) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return;
    const sx = Math.max(0, (frame.x - imageBox.x) / imageBox.scale);
    const sy = Math.max(0, (frame.y - imageBox.y) / imageBox.scale);
    const sw = Math.min(image.naturalWidth - sx, frame.w / imageBox.scale);
    const sh = Math.min(image.naturalHeight - sy, frame.w / RATIO / imageBox.scale);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    context.drawImage(image, sx, sy, sw, sh, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    onApply(canvas.toDataURL("image/jpeg", 0.92));
  }

  function beginDrag(event: ReactPointerEvent, mode: "move" | "resize") {
    if (!frame || !imageBox) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = frame;
    const bounds = imageBox;
    function move(ev: PointerEvent) {
      setFrame(clampFrame(start, bounds, mode, ev.clientX - startX, ev.clientY - startY));
    }
    function end() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button type="button" aria-label="Aizvērt" className="absolute inset-0 bg-[#12382c]/45" onClick={onCancel} />
      <div className="relative z-[1] w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl">
        <h2 className="text-lg font-semibold">Izgriezt foto</h2>
        <p className="mt-1 text-sm text-[#5f756a]">Rāmis ir pases foto proporcijā 35×45. Velc rāmi, stūris maina izmēru.</p>
        <div ref={stageRef} className="relative mt-4 h-[min(420px,55vh)] w-full overflow-hidden rounded-2xl bg-[#10241c]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(event) => place(event.currentTarget)}
            className="absolute max-w-none select-none"
            style={imageBox ? { left: imageBox.x, top: imageBox.y, width: imageBox.w, height: imageBox.h } : { opacity: 0 }}
          />
          {frame ? (
            <div
              className="absolute cursor-move touch-none border-2 border-white shadow-[0_0_0_9999px_rgba(8,20,16,0.62)]"
              style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.w / RATIO }}
              onPointerDown={(event) => beginDrag(event, "move")}
            >
              <button
                type="button"
                aria-label="Mainīt izmēru"
                className="absolute -right-2 -bottom-2 size-4 rounded-sm border border-[#143028] bg-white"
                onPointerDown={(event) => beginDrag(event, "resize")}
              />
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
            <X className="size-4 shrink-0" aria-hidden="true" />
            Atcelt
          </button>
          <button type="button" onClick={apply} disabled={!frame} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]">
            <Crop className="size-4 shrink-0" aria-hidden="true" />
            Izgriezt
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function fitImage(naturalW: number, naturalH: number, boxW: number, boxH: number): Box {
  const scale = Math.min(boxW / naturalW, boxH / naturalH);
  const w = naturalW * scale;
  const h = naturalH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h, scale };
}

function passportFrame(image: Box): Frame {
  let w = image.w;
  let h = w / RATIO;
  if (h > image.h) {
    h = image.h;
    w = h * RATIO;
  }
  return { x: image.x + (image.w - w) / 2, y: image.y + (image.h - h) / 2, w };
}

function clampFrame(start: Frame, image: Box, mode: "move" | "resize", dx: number, dy: number): Frame {
  if (mode === "move") {
    const h = start.w / RATIO;
    return {
      x: Math.min(Math.max(start.x + dx, image.x), image.x + image.w - start.w),
      y: Math.min(Math.max(start.y + dy, image.y), image.y + image.h - h),
      w: start.w,
    };
  }
  let w = Math.max(48, start.w + dx);
  const maxW = image.x + image.w - start.x;
  const maxH = image.y + image.h - start.y;
  if (w > maxW) w = maxW;
  if (w / RATIO > maxH) w = maxH * RATIO;
  return { x: start.x, y: start.y, w };
}

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    image.src = url;
  });
}
