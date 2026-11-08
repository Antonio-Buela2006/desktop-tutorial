@php
    // Percorre o organograma nível a nível a partir da base de dados.
    $children = fn ($u) => $units->where('parent_id', $u->id)->sortBy('sort')->values();
    $line = '<div class="mx-auto h-6 w-0.5 bg-granite-400" aria-hidden="true"></div>';
@endphp
<x-layouts.app title="Organograma">
    <x-slot:heading>Organograma institucional</x-slot:heading>
    <div class="overflow-x-auto pb-4">
        <div class="mx-auto flex min-w-fit flex-col items-center">
            @foreach ($roots as $root)
                @php $level = collect([$root]); $depth = 0; @endphp
                @while ($level->isNotEmpty())
                    @php
                        $regular = $level->where('shows_choirs', false);
                        $choirUnits = $level->where('shows_choirs', true);
                    @endphp
                    @if ($regular->isNotEmpty())
                        @if ($depth > 0){!! $line !!}@endif
                        <div class="flex flex-col items-center gap-3 sm:flex-row sm:items-stretch">
                            @foreach ($regular as $u)
                                <x-org-node :unit="$u" :tone="$depth === 0 ? 'bg-granite text-white' : ($depth < 3 ? 'bg-hill text-white' : 'bg-white')" />
                            @endforeach
                        </div>
                    @endif
                    @foreach ($choirUnits as $u)
                        {!! $line !!}
                        <div class="card p-3 text-center">
                            <p class="font-serif font-bold">{{ $u->name }}</p>
                            <p class="text-sm">{{ $choristers }} corista(s)</p>
                        </div>
                        {!! $line !!}
                        <div class="flex flex-wrap justify-center gap-3">
                            @foreach ($choirs as $c)
                                <div class="card border-hill p-3 text-center">
                                    <p class="font-serif font-bold text-hill-700">{{ $c->name }}</p>
                                    <p class="text-sm">{{ $c->total }} corista(s)</p>
                                </div>
                            @endforeach
                        </div>
                    @endforeach
                    @php
                        $level = $regular->flatMap(fn ($u) => $children($u))->sortBy(fn ($u) => [$u->shows_choirs ? 1 : 0, $u->sort])->values();
                        $depth++;
                    @endphp
                @endwhile
            @endforeach
        </div>
    </div>
    <p class="text-sm text-granite-600">Os cargos são atribuídos na ficha de cada membro (Membros › Ver › Perfil e cargos).</p>
</x-layouts.app>
