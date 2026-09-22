import { cn } from "@/lib/utils/cn";

type PastryStillLifeProps = {
  className?: string;
};

export function PastryStillLife({ className }: PastryStillLifeProps) {
  return (
    <svg
      viewBox="0 0 720 720"
      role="img"
      aria-labelledby="pastry-still-life-title pastry-still-life-description"
      className={cn("h-auto w-full", className)}
    >
      <title id="pastry-still-life-title">
        Celebration pastry illustration
      </title>
      <desc id="pastry-still-life-description">
        An abstract editorial illustration of a frosted cake, pastry box, and
        ribbon.
      </desc>
      <defs>
        <linearGradient id="cake-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8e9cf" />
          <stop offset="1" stopColor="#e8c68e" />
        </linearGradient>
        <linearGradient id="berry-glaze" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b94770" />
          <stop offset="1" stopColor="#762044" />
        </linearGradient>
        <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow
            dx="0"
            dy="22"
            stdDeviation="18"
            floodColor="#3b2319"
            floodOpacity="0.16"
          />
        </filter>
      </defs>

      <path
        d="M66 519c104 92 241 135 396 112 82-12 147-41 194-87"
        fill="none"
        stroke="#8c2850"
        strokeWidth="18"
        strokeLinecap="round"
        opacity="0.2"
      />
      <path
        d="M543 126c-35 63-20 124 39 181 47 46 55 94 24 144"
        fill="none"
        stroke="#8c2850"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M551 115c18 12 37 12 57 0-3 26-12 43-28 52-16-9-26-26-29-52Z"
        fill="#f0d6a0"
        stroke="#6d1c3e"
        strokeWidth="5"
      />

      <g filter="url(#soft-shadow)">
        <path
          d="M118 406 302 318l184 91-181 106Z"
          fill="#fffdf9"
          stroke="#c6b2a5"
          strokeWidth="5"
        />
        <path
          d="m118 406 4 130 181 104 2-125Z"
          fill="#f2e4d6"
          stroke="#c6b2a5"
          strokeWidth="5"
        />
        <path
          d="m305 515 181-106-2 127-181 104Z"
          fill="#ead7c5"
          stroke="#c6b2a5"
          strokeWidth="5"
        />
        <path
          d="m302 318 3 197M211 362l184 100"
          fill="none"
          stroke="#8c2850"
          strokeWidth="10"
          opacity="0.85"
        />
      </g>

      <g filter="url(#soft-shadow)">
        <ellipse
          cx="342"
          cy="382"
          rx="165"
          ry="51"
          fill="#d9b779"
          opacity="0.45"
        />
        <path
          d="M218 260h250v118c0 40-56 72-125 72s-125-32-125-72V260Z"
          fill="url(#cake-side)"
          stroke="#6d1c3e"
          strokeWidth="6"
        />
        <ellipse
          cx="343"
          cy="260"
          rx="125"
          ry="63"
          fill="url(#berry-glaze)"
          stroke="#6d1c3e"
          strokeWidth="6"
        />
        <path
          d="M229 265c18 8 24 26 25 52 1 19 10 30 25 30 18 0 24-14 26-37 2-21 12-31 29-31 18 0 27 12 29 35 2 22 10 33 25 33 18 0 28-13 29-40 1-23 14-36 37-39"
          fill="none"
          stroke="#8c2850"
          strokeWidth="17"
          strokeLinecap="round"
        />
        <path
          d="M278 220c20-18 42-28 66-29 28-1 52 8 73 27"
          fill="none"
          stroke="#f5d8df"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <circle cx="301" cy="214" r="14" fill="#f0d6a0" />
        <circle cx="385" cy="209" r="12" fill="#f0d6a0" />
      </g>

      <path
        d="M105 180c33-25 65-26 95-1 31 26 62 23 94-8"
        fill="none"
        stroke="#8c2850"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle cx="105" cy="180" r="8" fill="#8c2850" />
      <circle cx="294" cy="171" r="8" fill="#8c2850" />
    </svg>
  );
}
