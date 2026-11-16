import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import styles from "./ImageCropEditor.module.css";

type Shape = "product" | "banner";
type Vec = { x: number; y: number };
interface Props {
  file: File;
  shape: Shape;
  onApply(file: File): void;
  onCancel(): void;
}
const SIZES = { product: { width: 1200, height: 1200 }, banner: { width: 1600, height: 900 } };

export function ImageCropEditor({ file, shape, onApply, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const dragRef = useRef<Vec | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<Vec>({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const size = SIZES[shape];

  useEffect(() => {
    let alive = true;
    setReady(false);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        !file.size || file.size > 12 * 1024 * 1024) {
      setError("Use PNG, JPEG ou WebP até 12 MB.");
      return;
    }
    void createImageBitmap(file).then((bmp) => {
      if (!alive) { bmp.close(); return; }
      if (!bmp.width || !bmp.height || Math.max(bmp.width, bmp.height) > 12000) {
        bmp.close();
        setError("As dimensões dessa imagem não são válidas.");
        return;
      }
      bitmapRef.current = bmp;
      setReady(true);
    }).catch(() => { if (alive) setError("Não foi possível abrir a imagem."); });
    return () => {
      alive = false;
      bitmapRef.current?.close();
      bitmapRef.current = null;
    };
  }, [file]);

  function bounds(magnification: number) {
    const bmp = bitmapRef.current;
    if (!bmp) return { width: 0, height: 0, x: 0, y: 0 };
    const scale = Math.max(size.width / bmp.width, size.height / bmp.height) * magnification;
    const width = bmp.width * scale;
    const height = bmp.height * scale;
    return { width, height, x: Math.max(0, (width - size.width) / 2),
      y: Math.max(0, (height - size.height) / 2) };
  }

  useEffect(() => {
    const bmp = bitmapRef.current;
    const canvas = canvasRef.current;
    if (!ready || !bmp || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const b = bounds(zoom);
    const x = Math.max(-b.x, Math.min(b.x, position.x));
    const y = Math.max(-b.y, Math.min(b.y, position.y));
    context.clearRect(0, 0, size.width, size.height);
    context.imageSmoothingQuality = "high";
    context.drawImage(bmp, (size.width - b.width) / 2 + x,
      (size.height - b.height) / 2 + y, b.width, b.height);
  }, [ready, zoom, position, size.width, size.height]);

  function move(dx: number, dy: number) {
    const b = bounds(zoom);
    setPosition((previous) => ({
      x: Math.max(-b.x, Math.min(b.x, previous.x + dx)),
      y: Math.max(-b.y, Math.min(b.y, previous.y + dy)),
    }));
  }
  function changeZoom(nextZoom: number) {
    const value = Math.max(1, Math.min(3, nextZoom));
    const b = bounds(value);
    setZoom(value);
    setPosition((previous) => ({
      x: Math.max(-b.x, Math.min(b.x, previous.x)),
      y: Math.max(-b.y, Math.min(b.y, previous.y)),
    }));
  }
  function drag(event: ReactPointerEvent<HTMLCanvasElement>) {
    const previous = dragRef.current;
    const rectangle = event.currentTarget.getBoundingClientRect();
    if (!previous || !rectangle.width || !rectangle.height) return;
    move((event.clientX - previous.x) * size.width / rectangle.width,
      (event.clientY - previous.y) * size.height / rectangle.height);
    dragRef.current = { x: event.clientX, y: event.clientY };
  }

  async function apply() {
    if (!ready || !canvasRef.current) return;
    setBusy(true);
    setError("");
    try {
      const canvas = canvasRef.current;
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Não foi possível gerar WebP.")),
          "image/webp", 0.82));
      if (blob.size > 5 * 1024 * 1024) throw new Error("A imagem resultante excede 5 MB.");
      onApply(new File([blob], "foto-ajustada.webp", { type: "image/webp" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao ajustar imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.editor} aria-label="Editor de enquadramento">
      <h3>Enquadrar imagem</h3>
      <p className={styles.hint}>Arraste a foto para centralizar. Use o controle de zoom para aproximar ou afastar.</p>
      <canvas
        ref={canvasRef} width={size.width} height={size.height}
        className={styles.canvas} style={{ aspectRatio: `${size.width} / ${size.height}` }}
        role="img" aria-label="Prévia do enquadramento"
        onPointerDown={(event) => {
          if (!ready || busy) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={drag}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
      />
      <div className={styles.zoom}>
        <Button size="icon" variant="outline" aria-label="Afastar imagem"
          onClick={() => changeZoom(zoom - 0.1)} disabled={!ready || busy || zoom <= 1}><ZoomOut size={16}/></Button>
        <label htmlFor="editor-zoom">Zoom {Math.round(zoom * 100)}%</label>
        <input id="editor-zoom" type="range" min={1} max={3} step={0.05}
          value={zoom} onChange={(event) => changeZoom(Number(event.target.value))}
          disabled={!ready || busy}/>
        <Button size="icon" variant="outline" aria-label="Aproximar imagem"
          onClick={() => changeZoom(zoom + 0.1)} disabled={!ready || busy || zoom >= 3}><ZoomIn size={16}/></Button>
      </div>
      <div className={styles.buttons} aria-label="Posicionamento da imagem">
        <Button size="icon" variant="outline" aria-label="Mover para cima" onClick={() => move(0,-40)} disabled={!ready || busy}><ArrowUp size={16}/></Button>
        <Button size="icon" variant="outline" aria-label="Mover para baixo" onClick={() => move(0,40)} disabled={!ready || busy}><ArrowDown size={16}/></Button>
        <Button size="icon" variant="outline" aria-label="Mover para esquerda" onClick={() => move(-40,0)} disabled={!ready || busy}><ArrowLeft size={16}/></Button>
        <Button size="icon" variant="outline" aria-label="Mover para direita" onClick={() => move(40,0)} disabled={!ready || busy}><ArrowRight size={16}/></Button>
        <Button size="sm" variant="outline" onClick={() => { changeZoom(1); setPosition({x:0,y:0}); }} disabled={!ready || busy}><RotateCcw size={16}/> Redefinir</Button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className={styles.buttons}>
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button onClick={() => void apply()} disabled={!ready || busy}>{busy ? "Processando…" : "Aplicar enquadramento"}</Button>
      </div>
    </section>
  );
}
