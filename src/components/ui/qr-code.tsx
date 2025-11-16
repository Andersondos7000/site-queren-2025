"use client"

import * as React from "react"
import { useState, useEffect } from "react";
import qrcode from "qrcode-generator";
import { cn } from "@/lib/utils";

interface QRCodeProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  level?: "L" | "M" | "Q" | "H";
  includeMargin?: boolean;
  className?: string;
}

// Componente QR Code simples para uso direto
export function QRCode({
  value,
  size = 200,
  fgColor = "#000000",
  bgColor = "#ffffff",
  level = "M",
  includeMargin = true,
  className,
}: QRCodeProps) {
  const [qrSvg, setQrSvg] = useState<string>("");

  useEffect(() => {
    if (value) {
      try {
        // Mapear níveis de correção de erro
        const errorCorrectionMap = {
          'L': 'L',
          'M': 'M',
          'Q': 'Q',
          'H': 'H',
        };

        // Criar QR code
        const qr = qrcode(0, errorCorrectionMap[level]);
        qr.addData(value);
        qr.make();

        // Gerar SVG
        const cellSize = Math.floor(size / qr.getModuleCount());
        const margin = includeMargin ? cellSize * 2 : 0;
        const svgSize = size + (margin * 2);
        
        let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" xmlns="http://www.w3.org/2000/svg" style="shape-rendering: crispEdges;">`;
        
        // Fundo
        svg += `<rect width="${svgSize}" height="${svgSize}" fill="${bgColor}"/>`;
        
        // Módulos do QR code
        for (let row = 0; row < qr.getModuleCount(); row++) {
          for (let col = 0; col < qr.getModuleCount(); col++) {
            if (qr.isDark(row, col)) {
              const x = margin + (col * cellSize);
              const y = margin + (row * cellSize);
              svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fgColor}"/>`;
            }
          }
        }
        
        svg += '</svg>';
        setQrSvg(svg);
      } catch (error) {
        console.error('Erro ao gerar QR code:', error);
        setQrSvg('');
      }
    }
  }, [value, size, fgColor, bgColor, level, includeMargin]);

  return (
    <div className={cn("flex items-center justify-center", className)}>
      {qrSvg ? (
        <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
      ) : (
        <div 
          style={{ width: size, height: size, backgroundColor: bgColor }}
          className="flex items-center justify-center text-gray-500"
        >
          QR Code
        </div>
      )}
    </div>
  );
}