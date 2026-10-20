/** The mascot as a plain SVG string (no animation), used for app icons. */
export const BIRD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 220 250" width="220" height="250">
<defs>
<clipPath id="bc"><ellipse cx="100" cy="156" rx="56" ry="52"/></clipPath>
<radialGradient id="bg" cx="40%" cy="28%" r="85%"><stop offset="0" stop-color="#86CFEC"/><stop offset="1" stop-color="#4BADDC"/></radialGradient>
</defs>
<ellipse cx="82" cy="210" rx="14" ry="6.5" fill="#F5C94A"/><ellipse cx="118" cy="210" rx="14" ry="6.5" fill="#F5C94A"/>
<path d="M54 132 C40 118 22 116 10 126 C6 132 10 140 18 142 C30 146 44 150 56 152 Z" fill="#58B6E0"/>
<path d="M10 126 C6 132 10 140 18 142 C23 136 21 128 10 126 Z" fill="#DDF1F9"/>
<path d="M146 132 C160 118 178 116 190 126 C194 132 190 140 182 142 C170 146 156 150 144 152 Z" fill="#58B6E0"/>
<path d="M190 126 C194 132 190 140 182 142 C177 136 179 128 190 126 Z" fill="#DDF1F9"/>
<ellipse cx="100" cy="156" rx="56" ry="52" fill="url(#bg)"/>
<g clip-path="url(#bc)"><ellipse cx="100" cy="212" rx="66" ry="32" fill="#FFFFFF"/></g>
<path d="M100 134 C94 146 88 152 88 160 a12 12 0 0 0 24 0 C112 152 106 146 100 134 Z" fill="#DC2640"/>
<path d="M86 58 C80 38 88 18 112 6 C117 26 119 46 114 60 Z" fill="#58B6E0"/>
<path d="M95 25 C100 14 109 8 116 7 C119 15 117 24 112 31 C106 29 100 29 95 25 Z" fill="#DDF1F9"/>
<ellipse cx="100" cy="90" rx="58" ry="50" fill="url(#bg)"/>
<path d="M100 126 C70 126 46 110 46 88 C46 70 62 60 80 62 C90 63 96 68 100 72 C104 68 110 63 120 62 C138 60 154 70 154 88 C154 110 130 126 100 126 Z" fill="#FFFFFF"/>
<g><ellipse cx="78" cy="88" rx="10" ry="13" fill="#14303F"/><ellipse cx="78.5" cy="90" rx="6.5" ry="9.5" fill="#30B6CC"/><ellipse cx="80.6" cy="84.5" rx="3.1" ry="3.8" fill="#fff"/></g>
<g><ellipse cx="122" cy="88" rx="10" ry="13" fill="#14303F"/><ellipse cx="122.5" cy="90" rx="6.5" ry="9.5" fill="#30B6CC"/><ellipse cx="124.6" cy="84.5" rx="3.1" ry="3.8" fill="#fff"/></g>
<ellipse cx="100" cy="106" rx="25" ry="18" fill="#F7E27C"/><ellipse cx="93" cy="99" rx="10" ry="5.5" fill="#FFF3B0" opacity="0.75"/>
<path d="M89 110 Q100 116 111 110" stroke="#E5C84F" stroke-width="2.2" fill="none" stroke-linecap="round"/>
</svg>`;

export const birdDataUri = () => `data:image/svg+xml;base64,${Buffer.from(BIRD_SVG).toString("base64")}`;