@php
    $fmt = fn ($v) => is_array($v) ? implode(', ', array_map(fn ($x) => is_array($x) ? json_encode($x, JSON_UNESCAPED_UNICODE) : (string) $x, $v)) : (is_bool($v) ? ($v ? 'sim' : 'não') : (string) ($v ?? '—'));
@endphp
<x-layouts.app title="Auditoria">
    <x-slot:heading>Auditoria</x-slot:heading>
    <form method="GET" class="card mb-4 grid gap-3 p-4 sm:grid-cols-5" role="search">
        <x-select name="user_id" label="Utilizador" :options="$users->pluck('name', 'id')" :value="$filters['user_id'] ?? ''" placeholder="Todos" />
        <x-select name="operation" label="Operação" :options="$operations" :value="$filters['operation'] ?? ''" placeholder="Todas" />
        <x-field name="from" label="De" type="date" :value="$filters['from'] ?? ''" />
        <x-field name="to" label="Até" type="date" :value="$filters['to'] ?? ''" />
        <div class="flex items-end gap-2"><button class="btn-primary">Filtrar</button><a href="{{ route('audit.index') }}" class="btn-outline">Limpar</a></div>
    </form>

    <ul class="space-y-2">
        @forelse ($logs as $log)
            <li class="card p-3 text-sm">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span class="badge bg-granite text-white">{{ $log->operationLabel() }}</span>
                    <time class="font-semibold" datetime="{{ $log->created_at->toIso8601String() }}">{{ $log->created_at->format('d/m/Y H:i:s') }}</time>
                    <span>{{ $log->user_name ?? 'Visitante' }}</span>
                    @if ($log->auditable_type)<span class="text-granite-600">{{ $log->auditable_type }} #{{ $log->auditable_id }}</span>@endif
                    <span class="text-xs text-granite-600">IP {{ $log->ip }}</span>
                </div>
                @if ($log->description)<p class="mt-1">{{ $log->description }}</p>@endif
                @if ($log->old_values || $log->new_values)
                    @php $keys = array_unique(array_merge(array_keys($log->old_values ?? []), array_keys($log->new_values ?? []))); @endphp
                    <details class="mt-2">
                        <summary class="cursor-pointer font-semibold text-hill-700">Valores ({{ count($keys) }})</summary>
                        <div class="table-wrap mt-2"><table class="table">
                            <thead><tr><th scope="col">Campo</th><th scope="col">Antes</th><th scope="col">Depois</th></tr></thead>
                            <tbody class="divide-y divide-stone-200">
                                @foreach ($keys as $k)
                                    <tr><td class="font-mono text-xs">{{ $k }}</td>
                                        <td class="text-rust-700">{{ $fmt(($log->old_values ?? [])[$k] ?? null) }}</td>
                                        <td class="text-hill-700">{{ $fmt(($log->new_values ?? [])[$k] ?? null) }}</td></tr>
                                @endforeach
                            </tbody>
                        </table></div>
                    </details>
                @endif
            </li>
        @empty
            <li class="card p-4 text-center">Sem registos.</li>
        @endforelse
    </ul>
    {{ $logs->links() }}
</x-layouts.app>
