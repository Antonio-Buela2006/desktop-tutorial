@php
    $cards = [
        'members' => ['Total de membros', 'bg-granite text-white'],
        'choristers' => ['Coristas', 'bg-hill text-white'],
        'culture_makers' => ['Fazedores de cultura', 'bg-rust text-white'],
        'men' => ['Homens', 'bg-white'],
        'women' => ['Mulheres', 'bg-white'],
        'baptized' => ['Baptizados', 'bg-white'],
        'not_baptized' => ['Não baptizados', 'bg-white'],
    ];
@endphp
<x-layouts.app title="Dashboard">
    <x-slot:heading>Dashboard</x-slot:heading>
    <div x-data="liveStats(@js(route('dashboard.stats')), @js($stats))">
        <p class="-mt-3 mb-4 flex items-center gap-2 text-xs text-granite-600" aria-live="polite">
            <span class="inline-block h-2 w-2 rounded-full bg-hill" :class="loading && 'animate-pulse'"></span>
            Actualizado automaticamente · <span x-text="s.generated_at">{{ $stats['generated_at'] }}</span>
            <button type="button" class="underline" @click="refresh()">Actualizar agora</button>
        </p>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            @foreach ($cards as $key => [$label, $cls])
                <div class="card p-3 {{ $cls }}">
                    <p class="text-xs font-semibold opacity-90">{{ $label }}</p>
                    <p class="mt-1 text-3xl font-bold" x-text="s.totals.{{ $key }}" data-total="{{ $key }}">{{ $stats['totals'][$key] }}</p>
                </div>
            @endforeach
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-2">
            <section class="card p-4">
                <h2 class="section-title mb-3">Coristas por coro</h2>
                <ul class="space-y-2">
                    <template x-for="c in s.by_choir" :key="c.name">
                        <li>
                            <div class="flex justify-between text-sm"><span x-text="c.name"></span><strong x-text="c.total"></strong></div>
                            <div class="h-3 rounded-full bg-stone"><div class="h-3 rounded-full bg-hill" :style="`width:${pct(c.total, max(s.by_choir))}%`"></div></div>
                        </li>
                    </template>
                </ul>
            </section>
            <section class="card p-4">
                <h2 class="section-title mb-3">Coristas por tipo de voz</h2>
                <ul class="space-y-2">
                    <template x-for="v in s.by_voice" :key="v.name">
                        <li>
                            <div class="flex justify-between text-sm"><span x-text="v.name"></span><strong x-text="v.total"></strong></div>
                            <div class="h-3 rounded-full bg-stone"><div class="h-3 rounded-full bg-granite" :style="`width:${pct(v.total, max(s.by_voice))}%`"></div></div>
                        </li>
                    </template>
                </ul>
            </section>
            <section class="card p-4">
                <h2 class="section-title mb-3">Por área</h2>
                <div class="table-wrap"><table class="table">
                    <thead><tr><th scope="col">Área</th><th scope="col" class="text-right">Membros</th><th scope="col" class="text-right">Coristas</th><th scope="col" class="text-right">Artistas</th></tr></thead>
                    <tbody class="divide-y divide-stone-200">
                        <template x-for="a in s.by_area" :key="a.name">
                            <tr><td x-text="a.name"></td><td class="text-right" x-text="a.members"></td><td class="text-right" x-text="a.choristers"></td><td class="text-right" x-text="a.artists"></td></tr>
                        </template>
                    </tbody>
                </table></div>
                <p class="hint">"Artistas" = fazedores de cultura (com pelo menos uma categoria além de Corista).</p>
            </section>
            <section class="card p-4">
                <h2 class="section-title mb-3">Por categoria cultural</h2>
                <ul class="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                    <template x-for="c in s.by_category" :key="c.name">
                        <li class="flex justify-between border-b border-stone-200 py-1 text-sm"><span x-text="c.name"></span><strong x-text="c.total"></strong></li>
                    </template>
                </ul>
            </section>
        </div>
    </div>
</x-layouts.app>
