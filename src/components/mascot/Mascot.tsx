export type Mood = "idle" | "happy" | "sad" | "thinking" | "celebrate" | "sleepy" | "worried";

type Props = {
  mood?: Mood;
  size?: number; // width in px
  animate?: boolean;
  wiggle?: boolean;
  className?: string;
};

const INK = "#14303F";

/** The bird mascot, drawn as SVG so it stays sharp and animates cheaply. */
export default function Mascot({ mood = "idle", size = 120, animate = true, wiggle = false, className }: Props) {
  const happyEyes = mood === "happy" || mood === "celebrate";
  const closedEyes = mood === "sleepy";
  const lookUp = mood === "thinking";
  const wide = mood === "worried";

  return (
    <svg
      className={`mascot ${className ?? ""}`}
      data-mood={mood}
      data-animate={animate ? "true" : "false"}
      data-wiggle={wiggle ? "true" : "false"}
      viewBox="-10 -10 220 250"
      width={size}
      height={(size * 250) / 220}
      role="img"
      aria-label="Edu Hub bird mascot"
    >
      <defs>
        <clipPath id="m-bodyClip">
          <ellipse cx="100" cy="156" rx="56" ry="52" />
        </clipPath>
        <radialGradient id="m-bodyG" cx="40%" cy="28%" r="85%">
          <stop offset="0" stopColor="#86CFEC" />
          <stop offset="1" stopColor="#4BADDC" />
        </radialGradient>
      </defs>

      <ellipse cx="100" cy="220" rx="50" ry="7" fill={INK} opacity="0.13" />

      <g className="m-body m-part">
        {/* feet */}
        <ellipse cx="82" cy="210" rx="14" ry="6.5" fill="#F5C94A" />
        <ellipse cx="118" cy="210" rx="14" ry="6.5" fill="#F5C94A" />

        {/* wings */}
        <g className="m-wing-l m-part">
          <path d="M54 132 C40 118 22 116 10 126 C6 132 10 140 18 142 C30 146 44 150 56 152 Z" fill="#58B6E0" />
          <path d="M10 126 C6 132 10 140 18 142 C23 136 21 128 10 126 Z" fill="#DDF1F9" />
        </g>
        <g className="m-wing-r m-part">
          <path d="M146 132 C160 118 178 116 190 126 C194 132 190 140 182 142 C170 146 156 150 144 152 Z" fill="#58B6E0" />
          <path d="M190 126 C194 132 190 140 182 142 C177 136 179 128 190 126 Z" fill="#DDF1F9" />
        </g>

        {/* body */}
        <ellipse cx="100" cy="156" rx="56" ry="52" fill="url(#m-bodyG)" />
        <g clipPath="url(#m-bodyClip)">
          <ellipse cx="100" cy="212" rx="66" ry="32" fill="#FFFFFF" />
        </g>
        <path d="M100 134 C94 146 88 152 88 160 a12 12 0 0 0 24 0 C112 152 106 146 100 134 Z" fill="#DC2640" />
        <ellipse cx="95.5" cy="160" rx="2.6" ry="4.2" fill="#fff" opacity="0.35" />

        {/* head */}
        <g className="m-head m-part">
          <g className="m-crest m-part">
            <path d="M86 58 C80 38 88 18 112 6 C117 26 119 46 114 60 Z" fill="#58B6E0" />
            <path d="M95 25 C100 14 109 8 116 7 C119 15 117 24 112 31 C106 29 100 29 95 25 Z" fill="#DDF1F9" />
          </g>
          <ellipse cx="100" cy="90" rx="58" ry="50" fill="url(#m-bodyG)" />
          <path
            d="M100 126 C70 126 46 110 46 88 C46 70 62 60 80 62 C90 63 96 68 100 72 C104 68 110 63 120 62 C138 60 154 70 154 88 C154 110 130 126 100 126 Z"
            fill="#FFFFFF"
          />

          {/* cheeks when happy */}
          {happyEyes && (
            <>
              <ellipse cx="64" cy="104" rx="7" ry="4.5" fill="#FF9DB0" opacity="0.55" />
              <ellipse cx="136" cy="104" rx="7" ry="4.5" fill="#FF9DB0" opacity="0.55" />
            </>
          )}

          {/* eyes */}
          {happyEyes || closedEyes ? (
            <g fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round">
              {happyEyes ? (
                <>
                  <path d="M68 92 Q78 78 88 92" />
                  <path d="M112 92 Q122 78 132 92" />
                </>
              ) : (
                <>
                  <path d="M68 88 Q78 98 88 88" />
                  <path d="M112 88 Q122 98 132 88" />
                </>
              )}
            </g>
          ) : (
            <g className="m-eyes m-part">
              {[78, 122].map((cx) => (
                <g key={cx}>
                  <ellipse cx={cx} cy="88" rx={wide ? 11 : 10} ry={wide ? 15 : 13} fill={INK} />
                  <ellipse cx={cx + (lookUp ? -1 : 0.5)} cy={lookUp ? 85 : 90} rx={wide ? 7.5 : 6.5} ry={wide ? 11 : 9.5} fill="#30B6CC" />
                  <ellipse cx={cx + (lookUp ? 0.5 : 2.6)} cy={lookUp ? 80 : 84.5} rx="3.1" ry="3.8" fill="#fff" />
                </g>
              ))}
            </g>
          )}

          {/* sad brows + tear */}
          {mood === "sad" && (
            <g stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none">
              <path d="M64 77 L88 70" />
              <path d="M136 77 L112 70" />
            </g>
          )}
          {mood === "sad" && <path d="M70 104 C67 110 67 114 70 114 C73 114 73 110 70 104 Z" fill="#7CC8EA" />}
          {mood === "worried" && <path d="M142 66 C138 74 138 80 142 80 C146 80 146 74 142 66 Z" fill="#7CC8EA" />}

          {/* beak */}
          <ellipse cx="100" cy="106" rx="25" ry="18" fill="#F7E27C" />
          <ellipse cx="93" cy="99" rx="10" ry="5.5" fill="#FFF3B0" opacity="0.75" />
          {happyEyes ? (
            <path d="M86 110 Q100 124 114 110 Q100 116 86 110 Z" fill="#D9762B" />
          ) : mood === "sad" ? (
            <path d="M89 114 Q100 108 111 114" stroke="#E5C84F" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M89 110 Q100 116 111 110" stroke="#E5C84F" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          )}
        </g>

        {/* extras */}
        {mood === "celebrate" && (
          <g>
            {[
              [24, 40, "#F2C94C"],
              [176, 36, "#E0283F"],
              [40, 8, "#4DB1DE"],
              [160, 6, "#F2C94C"],
              [10, 90, "#E0283F"],
              [190, 88, "#4DB1DE"],
            ].map(([x, y, c], i) => (
              <rect
                key={i}
                className="m-confetti"
                style={{ animationDelay: `${i * 0.18}s` }}
                x={x as number}
                y={y as number}
                width="8"
                height="8"
                rx="2"
                fill={c as string}
              />
            ))}
          </g>
        )}
        {mood === "sleepy" && (
          <g fill={INK} fontWeight="700" fontFamily="system-ui, sans-serif">
            <text className="m-zzz" x="150" y="40" fontSize="22">z</text>
            <text className="m-zzz" x="166" y="22" fontSize="16" style={{ animationDelay: "0.5s" }}>z</text>
          </g>
        )}
        {mood === "thinking" && (
          <g fill={INK} opacity="0.75">
            <circle cx="158" cy="44" r="4" />
            <circle cx="170" cy="30" r="5.5" />
            <circle cx="186" cy="12" r="7.5" />
          </g>
        )}
      </g>
    </svg>
  );
}