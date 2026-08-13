'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

/**
 * Reusable path-drawing tool: thick red line + arrowhead over any base still.
 * Used by Drone Tracing Shot, Continuous Shot with Path, and future workflows.
 * Exports base + drawing as JPEG data URL (720x1280, 9:16) for Seedance refs.
 */

export interface PathDrawingCanvasHandle {
  /** Merge base image + drawn path into a JPEG data URL (throws if no image). */
  exportAnnotatedImage: () => string;
  undo: () => void;
  clear: () => void;
}

interface PathDrawingCanvasProps {
  /** Same-origin image URL (proxied Replicate URL or data URL) to avoid canvas taint */
  imageUrl: string;
  /** Notifies the parent whether at least one stroke has been drawn */
  onPathChange?: (hasPath: boolean) => void;
}

type Point = { x: number; y: number };

const EXPORT_WIDTH = 720;
const EXPORT_HEIGHT = 1280;
const STROKE_COLOR = '#FF1A1A';

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Point[][],
  width: number,
  height: number
) {
  ctx.clearRect(0, 0, width, height);
  const lineWidth = Math.max(width * 0.012, 4);
  ctx.strokeStyle = STROKE_COLOR;
  ctx.fillStyle = STROKE_COLOR;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of strokes) {
    if (stroke.length < 2) {
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x * width, stroke[0].y * height, lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(stroke[0].x * width, stroke[0].y * height);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x * width, stroke[i].y * height);
    }
    ctx.stroke();
  }

  // Arrowhead at the end of the last stroke to show flight direction
  const last = strokes[strokes.length - 1];
  if (last && last.length >= 2) {
    // Use a point a bit back from the tip for a stable direction
    const tip = last[last.length - 1];
    const backIndex = Math.max(last.length - 6, 0);
    const back = last[backIndex];
    const tipX = tip.x * width;
    const tipY = tip.y * height;
    const angle = Math.atan2(tipY - back.y * height, tipX - back.x * width);
    const headLength = lineWidth * 3.2;

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - headLength * Math.cos(angle - Math.PI / 6),
      tipY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      tipX - headLength * Math.cos(angle + Math.PI / 6),
      tipY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }
}

const PathDrawingCanvas = forwardRef<PathDrawingCanvasHandle, PathDrawingCanvasProps>(
  function PathDrawingCanvas({ imageUrl, onPathChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const drawCanvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const strokesRef = useRef<Point[][]>([]);
    const drawingRef = useRef(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState<string | null>(null);

    const redraw = useCallback(() => {
      const canvas = drawCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      drawStrokes(ctx, strokesRef.current, canvas.width, canvas.height);
    }, []);

    // Load base image (same-origin, so the export canvas stays untainted)
    useEffect(() => {
      setImageLoaded(false);
      setImageError(null);
      strokesRef.current = [];
      onPathChange?.(false);

      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setImageLoaded(true);
      };
      img.onerror = () => setImageError('Failed to load the image for drawing.');
      img.src = imageUrl;

      return () => {
        img.onload = null;
        img.onerror = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imageUrl]);

    // Size the drawing canvas to the rendered element and repaint strokes
    useEffect(() => {
      if (!imageLoaded) return;
      const canvas = drawCanvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const resize = () => {
        const rect = container.getBoundingClientRect();
        canvas.width = Math.max(Math.round(rect.width), 1);
        canvas.height = Math.max(Math.round(rect.height), 1);
        redraw();
      };

      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      return () => observer.disconnect();
    }, [imageLoaded, redraw]);

    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = drawCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
        y: Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1),
      };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!imageLoaded) return;
      e.preventDefault();
      drawCanvasRef.current?.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      strokesRef.current = [...strokesRef.current, [getPoint(e)]];
      redraw();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const strokes = strokesRef.current;
      const current = strokes[strokes.length - 1];
      current.push(getPoint(e));
      redraw();
    };

    const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      try {
        drawCanvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      redraw();
      onPathChange?.(strokesRef.current.length > 0);
    };

    useImperativeHandle(ref, () => ({
      exportAnnotatedImage: () => {
        const img = imageRef.current;
        if (!img) {
          throw new Error('Base image is not loaded yet');
        }

        const canvas = document.createElement('canvas');
        canvas.width = EXPORT_WIDTH;
        canvas.height = EXPORT_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas is not supported in this browser');
        }

        // Cover-fit the base image into the 9:16 export frame
        const scale = Math.max(EXPORT_WIDTH / img.width, EXPORT_HEIGHT / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        ctx.drawImage(
          img,
          (EXPORT_WIDTH - drawWidth) / 2,
          (EXPORT_HEIGHT - drawHeight) / 2,
          drawWidth,
          drawHeight
        );

        drawStrokesOnTop(ctx);
        return canvas.toDataURL('image/jpeg', 0.9);

        function drawStrokesOnTop(target: CanvasRenderingContext2D) {
          const overlay = document.createElement('canvas');
          overlay.width = EXPORT_WIDTH;
          overlay.height = EXPORT_HEIGHT;
          const overlayCtx = overlay.getContext('2d')!;
          drawStrokes(overlayCtx, strokesRef.current, EXPORT_WIDTH, EXPORT_HEIGHT);
          target.drawImage(overlay, 0, 0);
        }
      },
      undo: () => {
        strokesRef.current = strokesRef.current.slice(0, -1);
        redraw();
        onPathChange?.(strokesRef.current.length > 0);
      },
      clear: () => {
        strokesRef.current = [];
        redraw();
        onPathChange?.(false);
      },
    }));

    if (imageError) {
      return (
        <div className="w-full aspect-[9/16] bg-gray-800 rounded-lg flex items-center justify-center">
          <p className="text-xs text-red-400 text-center px-4">{imageError}</p>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className="relative w-full aspect-[9/16] bg-gray-900 rounded-lg overflow-hidden select-none"
      >
        {imageLoaded && imageRef.current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Aerial view for flight path drawing"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-[#D1FE17] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <canvas
          ref={drawCanvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />
      </div>
    );
  }
);

export default PathDrawingCanvas;
