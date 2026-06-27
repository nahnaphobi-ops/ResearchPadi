import { useEffect, useState } from 'react';

interface AdinkraSymbol {
  id: string;
  name: string;
  path: string;
}

const ADINKRA_SYMBOLS: AdinkraSymbol[] = [
  {
    id: 'gye-nyame',
    name: 'Gye Nyame',
    path: 'M50 10 C35 10 25 20 25 35 C25 50 35 55 45 55 L45 70 L35 85 L45 85 L55 70 L55 55 C65 55 75 50 75 35 C75 20 65 10 50 10 Z M50 20 C60 20 65 25 65 35 C65 45 60 45 50 45 C40 45 35 45 35 35 C35 25 40 20 50 20 Z',
  },
  {
    id: 'sankofa',
    name: 'Sankofa',
    path: 'M50 15 C40 15 30 25 30 35 C30 45 40 50 50 60 C60 50 70 45 70 35 C70 25 60 15 50 15 Z M50 25 C55 25 60 30 60 35 C60 40 55 40 50 45 C45 40 40 40 40 35 C40 30 45 25 50 25 Z M45 55 L35 70 L25 85 L35 80 L45 65 Z M55 55 L65 70 L75 85 L65 80 L55 65 Z',
  },
  {
    id: 'dwennimmen',
    name: 'Dwennimmen',
    path: 'M50 10 C30 10 15 25 15 45 C15 65 30 80 50 90 C70 80 85 65 85 45 C85 25 70 10 50 10 Z M50 20 C65 20 75 30 75 45 C75 60 65 70 50 80 C35 70 25 60 25 45 C25 30 35 20 50 20 Z M35 35 C25 35 20 45 25 55 L35 55 C30 50 30 40 35 35 Z M65 35 C75 35 80 45 75 55 L65 55 C70 50 70 40 65 35 Z',
  },
  {
    id: 'adinkrahene',
    name: 'Adinkrahene',
    path: 'M50 5 C25 5 5 25 5 50 C5 75 25 95 50 95 C75 95 95 75 95 50 C95 25 75 5 50 5 Z M50 15 C70 15 85 30 85 50 C85 70 70 85 50 85 C30 85 15 70 15 50 C15 30 30 15 50 15 Z M50 25 C60 25 70 35 70 50 C70 65 60 75 50 75 C40 75 30 65 30 50 C30 35 40 25 50 25 Z M50 35 C55 35 60 40 60 50 C60 60 55 65 50 65 C45 65 40 60 40 50 C40 40 45 35 50 35 Z',
  },
  {
    id: 'nsoromma',
    name: 'Nsoromma',
    path: 'M50 5 L58 35 L90 35 L64 55 L72 85 L50 65 L28 85 L36 55 L10 35 L42 35 Z',
  },
  {
    id: 'akoma',
    name: 'Akoma',
    path: 'M50 85 L15 50 C5 35 15 15 35 15 C45 15 50 25 50 30 C50 25 55 15 65 15 C85 15 95 35 85 50 Z',
  },
  {
    id: 'funtumfunefu',
    name: 'Funtumfunefu',
    path: 'M25 40 C25 25 40 20 50 30 C60 20 75 25 75 40 C75 55 60 60 50 50 C40 60 25 55 25 40 Z M25 55 C25 40 40 35 50 45 C60 35 75 40 75 55 C75 70 60 75 50 65 C40 75 25 70 25 55 Z M35 45 L45 45 L45 55 L35 55 Z M55 45 L65 45 L65 55 L55 55 Z',
  },
  {
    id: 'nkyinkyim',
    name: 'Nkyinkyim',
    path: 'M15 25 L35 25 L35 45 L55 45 L55 25 L75 25 L75 65 L55 65 L55 85 L35 85 L35 65 L15 65 Z',
  },
];

interface FloatingSymbol {
  symbol: AdinkraSymbol;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

function generateFloatingSymbols(count: number): FloatingSymbol[] {
  const symbols: FloatingSymbol[] = [];
  for (let i = 0; i < count; i++) {
    symbols.push({
      symbol: ADINKRA_SYMBOLS[i % ADINKRA_SYMBOLS.length],
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 40 + Math.random() * 60,
      opacity: 0.03 + Math.random() * 0.05,
      duration: 15 + Math.random() * 20,
      delay: Math.random() * 10,
    });
  }
  return symbols;
}

interface AdinkraBackgroundProps {
  count?: number;
  className?: string;
}

export default function AdinkraBackground({ count = 12, className = '' }: AdinkraBackgroundProps) {
  const [floatingSymbols, setFloatingSymbols] = useState<FloatingSymbol[]>([]);

  useEffect(() => {
    setFloatingSymbols(generateFloatingSymbols(count));
  }, [count]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <svg className="hidden" aria-hidden="true">
        <defs>
          {ADINKRA_SYMBOLS.map((symbol) => (
            <symbol key={symbol.id} id={symbol.id} viewBox="0 0 100 100">
              <path d={symbol.path} fill="currentColor" />
            </symbol>
          ))}
        </defs>
      </svg>

      {floatingSymbols.map((item, index) => (
        <div
          key={`${item.symbol.id}-${index}`}
          className="absolute"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            width: `${item.size}px`,
            height: `${item.size}px`,
            opacity: item.opacity,
            animation: `adinkra-float ${item.duration}s ease-in-out ${item.delay}s infinite`,
          }}
        >
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full text-blue-900"
            aria-hidden="true"
          >
            <use href={`#${item.symbol.id}`} />
          </svg>
        </div>
      ))}

      <style>{`
        @keyframes adinkra-float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          25% {
            transform: translateY(-15px) rotate(5deg);
          }
          50% {
            transform: translateY(-25px) rotate(-3deg);
          }
          75% {
            transform: translateY(-10px) rotate(2deg);
          }
        }
      `}</style>
    </div>
  );
}
