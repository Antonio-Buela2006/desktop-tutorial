@props(['class' => 'h-10 w-10'])
{{-- Logótipo: dois blocos de pedra em equilíbrio, sobre a colina, com a Estrela da Alva (8 pontas). --}}
<svg {{ $attributes->merge(['class' => $class]) }} viewBox="0 0 48 48" role="img" aria-label="Logótipo">
    <path d="M2 44 Q24 30 46 44 Z" fill="#4f7a34"/>
    <rect x="11" y="27" width="26" height="11" rx="3" fill="#2f3330"/>
    <rect x="16" y="16" width="17" height="11" rx="3" transform="rotate(-6 24 21)" fill="#8a908b"/>
    <g transform="translate(29 1) scale(0.55)">
        <polygon fill="#b8481a" points="12.00,2.00 13.68,7.93 19.07,4.93 16.07,10.32 22.00,12.00 16.07,13.68 19.07,19.07 13.68,16.07 12.00,22.00 10.32,16.07 4.93,19.07 7.93,13.68 2.00,12.00 7.93,10.32 4.93,4.93 10.32,7.93"/>
    </g>
</svg>
