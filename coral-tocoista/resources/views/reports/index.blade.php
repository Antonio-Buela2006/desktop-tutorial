<x-layouts.app title="Relatórios">
    <x-slot:heading>Relatórios</x-slot:heading>
    <div class="grid gap-4 lg:grid-cols-3">
        @foreach ($reports as $group => $items)
            <section class="card p-4">
                <h2 class="section-title mb-3">{{ $group }}</h2>
                <ul class="divide-y divide-stone-200">
                    @foreach ($items as $key => $label)
                        @if ($key === 'coro')
                            @foreach ($choirs as $c)
                                <li class="flex items-center justify-between gap-2 py-2">
                                    <span class="text-sm font-semibold">{{ $c->name }}</span>
                                    <span class="flex shrink-0 gap-1">
                                        <a class="btn-outline min-h-[40px] px-3" href="{{ route('reports.download', ['report' => $key, 'format' => 'pdf', 'id' => $c->id]) }}">PDF<span class="sr-only"> {{ $c->name }}</span></a>
                                        <a class="btn-outline min-h-[40px] px-3" href="{{ route('reports.download', ['report' => $key, 'format' => 'xlsx', 'id' => $c->id]) }}">Excel<span class="sr-only"> {{ $c->name }}</span></a>
                                    </span>
                                </li>
                            @endforeach
                        @else
                            <li class="flex items-center justify-between gap-2 py-2">
                                <span class="text-sm font-semibold">{{ $label }}</span>
                                <span class="flex shrink-0 gap-1">
                                    <a class="btn-outline min-h-[40px] px-3" href="{{ route('reports.download', ['report' => $key, 'format' => 'pdf']) }}">PDF<span class="sr-only"> {{ $label }}</span></a>
                                    <a class="btn-outline min-h-[40px] px-3" href="{{ route('reports.download', ['report' => $key, 'format' => 'xlsx']) }}">Excel<span class="sr-only"> {{ $label }}</span></a>
                                </span>
                            </li>
                        @endif
                    @endforeach
                </ul>
            </section>
        @endforeach
    </div>
    <p class="mt-4 text-sm text-granite-600">Cada exportação fica registada na auditoria.</p>
</x-layouts.app>
