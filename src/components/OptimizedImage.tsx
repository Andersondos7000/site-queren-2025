import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  onError?: () => void;
  onLoad?: () => void;
  square?: boolean; // Nova prop para forçar enquadramento quadrado
  priority?: boolean; // Nova prop para imagens prioritárias
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className,
  fallbackSrc = '/placeholder.svg',
  onError,
  onLoad,
  square = false,
  priority = false
}) => {
  const [imageSrc, setImageSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset states when src changes
  useEffect(() => {
    setImageSrc(src);
    setIsLoading(true);
    setHasError(false);
  }, [src]);

  // Preload critical images
  useEffect(() => {
    if (priority && src) {
      const preloadLink = document.createElement('link');
      preloadLink.rel = 'preload';
      preloadLink.as = 'image';
      preloadLink.href = getOptimizedSrc(src);
      document.head.appendChild(preloadLink);
      
      return () => {
        document.head.removeChild(preloadLink);
      };
    }
  }, [src, priority]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleImageError = () => {
    setIsLoading(false);
    
    // Strategy 1: Try a local fallback image first
    const localFallback = '/yupp-generated-image-144120.webp';
    if (imageSrc !== localFallback) {
      setImageSrc(localFallback);
      return;
    }

    // Strategy 2: Try the default fallbackSrc if the local one also fails
    if (imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc);
      return;
    }
    
    // Final fallback: show error state
    setHasError(true);
    onError?.();
  };

  // Optimize image sources for better compatibility
  const getOptimizedSrc = (originalSrc: string) => {
    // Check if originalSrc is valid
    if (!originalSrc || typeof originalSrc !== 'string') {
      return fallbackSrc;
    }

    // For Supabase Storage images, add cache headers and optimization
    if (originalSrc.includes('supabase.co/storage')) {
      try {
        const url = new URL(originalSrc);
        // Use a stable cache parameter based on the image URL to avoid constant changes
        const stableCache = originalSrc.split('/').pop()?.split('.')[0]?.slice(-6) || '123456';
        url.searchParams.set('t', stableCache); // Stable cache parameter
        url.searchParams.set('quality', '85'); // Optimize quality
        return url.toString();
      } catch (error) {
        console.warn('Failed to optimize Supabase URL:', originalSrc);
      }
    }

    // For Unsplash images, ALWAYS use a proxy service to avoid ORB issues
    if (originalSrc.includes('images.unsplash.com') || originalSrc.includes('unsplash.com')) {
      try {
        // Extract dimensions from the original URL
        const url = new URL(originalSrc);
        const width = url.searchParams.get('w') || '400';
        const height = url.searchParams.get('h') || width;
        
        // Extract image ID for consistent seeding
        const match = originalSrc.match(/photo-([a-zA-Z0-9_-]+)/);
        const seed = match ? match[1].slice(0, 8) : Math.random().toString(36).substr(2, 8);
        
        // Use Picsum Photos as a reliable CORS-friendly alternative
        return `https://picsum.photos/${width}/${height}?random=${seed}`;
      } catch (error) {
        console.warn('Failed to parse Unsplash URL, using fallback:', originalSrc);
        // If URL parsing fails, use a default Picsum image
        return 'https://picsum.photos/400/400?random=fallback';
      }
    }

    // For other image sources, return as-is
    return originalSrc;
  };

  const optimizedSrc = getOptimizedSrc(imageSrc);

  return (
    <div className={cn(
      'relative overflow-hidden',
      square ? 'aspect-square' : '',
      className
    )}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="text-gray-400 text-sm">Carregando...</div>
        </div>
      )}
      
      <img
        ref={imgRef}
        src={optimizedSrc}
        alt={alt}
        className={cn(
          'w-full h-full object-cover transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100',
          hasError ? 'opacity-50' : ''
        )}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading={priority ? "eager" : "lazy"}
        referrerPolicy="no-referrer"
        decoding="async"
      />
      
      {hasError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-gray-500 text-sm text-center p-4">
            <div>Imagem não disponível</div>
            <div className="text-xs mt-1">Usando placeholder</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;