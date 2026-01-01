
import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  color?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, color = '#3b82f6' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (isActive) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const baseRadius = Math.min(centerX, centerY) * 0.4;
        
        for (let i = 0; i < 360; i += 1) {
          const angle = (i * Math.PI) / 180;
          const noise = isActive ? Math.sin(phase + angle * 4) * 5 + Math.cos(phase * 1.5 + angle * 2) * 5 : 0;
          const r = baseRadius + noise;
          const x = centerX + r * Math.cos(angle);
          const y = centerY + r * Math.sin(angle);
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        
        ctx.closePath();
        ctx.stroke();
        
        // Draw secondary circle
        ctx.beginPath();
        ctx.strokeStyle = color + '66';
        ctx.lineWidth = 1;
        for (let i = 0; i < 360; i += 1) {
          const angle = (i * Math.PI) / 180;
          const noise = isActive ? Math.cos(phase * 0.8 + angle * 3) * 8 : 0;
          const r = (baseRadius * 1.2) + noise;
          const x = centerX + r * Math.cos(angle);
          const y = centerY + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

        phase += 0.05;
      } else {
        // Draw flat line or static circle
        ctx.beginPath();
        ctx.strokeStyle = '#475569';
        ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.4, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [isActive, color]);

  return <canvas ref={canvasRef} width={200} height={200} className="w-full h-full max-w-[200px]" />;
};

export default AudioVisualizer;
