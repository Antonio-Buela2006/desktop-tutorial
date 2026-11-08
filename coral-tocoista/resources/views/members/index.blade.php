<x-layouts.app title="Membros">
    <x-slot:heading>Membros</x-slot:heading>

    <form method="GET" class="card mb-4 p-4" x-data="{ more: {{ collect($filters)->except('q')->filter()->isNotEmpty() ? 'true' : 'false' }} }" role="search">
        <div class="flex gap-2">
            <div class="flex-1">
                <label for="q" class="sr-only">Pesquisar por nome ou telefone</label>
                <input id="q" name="q" type="search" value="{{ $filters['q'] ?? '' }}" placeholder="Pesquisar por nome ou telefone" class="input">
            </div>
            <button class="btn-primary">Pesquisar</button>
        </div>
        <button type="button" class="mt-2 text-sm font-semibold text-hill-700 underline" @click="more = !more" :aria-expanded="more">Filtros</button>
        <div x-show="more" x-cloak class="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <x-select name="parish_id" label="Paróquia" :options="$parishes->pluck('name', 'id')" :value="$filters['parish_id'] ?? ''" placeholder="Todas" />
            <x-select name="area_id" label="Área" :options="$areas->pluck('name', 'id')" :value="$filters['area_id'] ?? ''" placeholder="Todas" />
            <x-select name="choir_id" label="Coro" :options="$choirs->pluck('name', 'id')" :value="$filters['choir_id'] ?? ''" placeholder="Todos" />
            <x-select name="voice_type_id" label="Voz" :options="$voices->pluck('name', 'id')" :value="$filters['voice_type_id'] ?? ''" placeholder="Todas" />
            <x-select name="position_id" label="Cargo" :options="$positions->pluck('name', 'id')" :value="$filters['position_id'] ?? ''" placeholder="Todos" />
            <x-select name="category_id" label="Categoria cultural" :options="$categories->pluck('name', 'id')" :value="$filters['category_id'] ?? ''" placeholder="Todas" />
            <x-select name="role_id" label="Perfil" :options="$roles->pluck('name', 'id')" :value="$filters['role_id'] ?? ''" placeholder="Todos" />
            <x-select name="state" label="Estado" :options="['blocked' => 'Bloqueados']" :value="$filters['state'] ?? ''" placeholder="Todos" />
            <div class="flex items-end gap-2 sm:col-span-3 lg:col-span-4">
                <button class="btn-primary">Aplicar filtros</button>
                <a href="{{ route('members.index') }}" class="btn-outline">Limpar</a>
            </div>
        </div>
    </form>

    <p class="mb-2 text-sm text-granite-600"><strong>{{ $members->total() }}</strong> membro(s) encontrado(s).</p>

    {{-- Telemóvel: cartões; ecrã largo: tabela --}}
    <ul class="space-y-2 md:hidden">
        @forelse ($members as $m)
            <li><a href="{{ route('members.show', $m) }}" class="card block p-3 hover:border-hill">
                <span class="flex items-center justify-between gap-2"><strong>{{ $m->name }}</strong>
                    @if ($m->isBlocked())<span class="badge bg-rust-100 text-rust-700">Bloqueado</span>@endif</span>
                <span class="block text-sm text-granite-600">{{ $m->phone_formatted }} · {{ $m->area?->name }}</span>
                @if ($m->is_choir_member)<span class="block text-xs text-hill-700">{{ $m->choir?->name }} · {{ $m->voiceType?->name }}</span>@endif
            </a></li>
        @empty
            <li class="card p-4 text-center text-sm">Nenhum membro encontrado.</li>
        @endforelse
    </ul>
    <div class="card hidden overflow-x-auto md:block">
        <table class="table">
            <thead><tr><th scope="col">Nome</th><th scope="col">Telefone</th><th scope="col">Área</th><th scope="col">Coro</th><th scope="col">Voz</th><th scope="col">Perfil</th><th scope="col"><span class="sr-only">Acções</span></th></tr></thead>
            <tbody class="divide-y divide-stone-200">
                @forelse ($members as $m)
                    <tr>
                        <td class="font-semibold">{{ $m->name }} @if ($m->isBlocked())<span class="badge ml-1 bg-rust-100 text-rust-700">Bloqueado</span>@endif</td>
                        <td class="whitespace-nowrap">{{ $m->phone_formatted }}</td>
                        <td>{{ $m->area?->name }}</td>
                        <td>{{ $m->is_choir_member ? $m->choir?->name : '—' }}</td>
                        <td>{{ $m->voiceType?->name ?? '—' }}</td>
                        <td>{{ $m->role?->name }}</td>
                        <td class="text-right"><a class="font-semibold text-hill-700 underline" href="{{ route('members.show', $m) }}">Ver<span class="sr-only"> {{ $m->name }}</span></a></td>
                    </tr>
                @empty
                    <tr><td colspan="7" class="py-6 text-center">Nenhum membro encontrado.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
    {{ $members->links() }}
</x-layouts.app>
