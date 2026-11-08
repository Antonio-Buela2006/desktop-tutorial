@php
    $hasActive = in_array($table, ['areas', 'parishes', 'voice_types', 'cultural_categories', 'choirs']);
    $hasSort = $table !== 'roles';
    $isPositions = $table === 'positions';
    $isRoles = $table === 'roles';
@endphp
<x-layouts.app :title="$def['label']">
    <x-slot:heading>{{ $def['label'] }}</x-slot:heading>
    <x-slot:actions><a href="{{ route('settings.edit') }}" class="btn-outline">Voltar às configurações</a></x-slot:actions>

    @if ($isRoles)
        <p class="mb-3 text-sm text-granite-600">Os perfis definem as permissões e são fixos (Administrador Geral, Responsável do Coro, Corista/Membro). Pode alterar o nome e a descrição.</p>
    @endif

    <div class="space-y-2">
        @foreach ($items as $item)
            <div class="card p-3">
                <form method="POST" action="{{ route('lookups.update', [$def['key'], $item->id]) }}" class="grid items-end gap-2 sm:grid-cols-12">
                    @csrf @method('PUT')
                    <div class="sm:col-span-5">
                        <label class="label" for="n{{ $item->id }}">Nome</label>
                        <input id="n{{ $item->id }}" name="name" value="{{ $item->name }}" class="input" required maxlength="120">
                    </div>
                    @if ($isRoles)
                        <div class="sm:col-span-5"><label class="label" for="d{{ $item->id }}">Descrição</label>
                            <input id="d{{ $item->id }}" name="description" value="{{ $item->description }}" class="input" maxlength="255"></div>
                    @endif
                    @if ($hasSort)
                        <div class="sm:col-span-2"><label class="label" for="s{{ $item->id }}">Ordem</label>
                            <input id="s{{ $item->id }}" name="sort" type="number" min="0" max="999" value="{{ $item->sort }}" class="input"></div>
                    @endif
                    @if ($isPositions)
                        <div class="sm:col-span-3"><label class="label" for="g{{ $item->id }}">Sector (liderança)</label>
                            <select id="g{{ $item->id }}" name="leadership_group" class="input">
                                <option value="">— Não é liderança —</option>
                                @foreach ($leadershipGroups as $k => $l)<option value="{{ $k }}" @selected($item->leadership_group === $k)>{{ $l }}</option>@endforeach
                            </select></div>
                    @endif
                    @if ($hasActive)
                        <label class="flex min-h-[44px] items-center gap-2 text-sm sm:col-span-2"><input type="hidden" name="active" value="0"><input type="checkbox" name="active" value="1" class="rounded text-hill" @checked($item->active)> Activo</label>
                    @endif
                    <div class="flex gap-2 sm:col-span-12 sm:justify-end">
                        @isset($item->users_count)<span class="mr-auto self-center text-xs text-granite-600">{{ $item->users_count }} membro(s)</span>@endisset
                        <button class="btn-primary">Gravar</button>
                    </div>
                </form>
                @unless ($isRoles)
                    <form method="POST" action="{{ route('lookups.destroy', [$def['key'], $item->id]) }}" class="mt-2 text-right" x-data @submit="if (!confirm('Eliminar «{{ addslashes($item->name) }}»?')) $event.preventDefault()">
                        @csrf @method('DELETE')
                        <button class="text-sm font-semibold text-rust-700 underline">Eliminar</button>
                    </form>
                @endunless
            </div>
        @endforeach
    </div>

    @unless ($isRoles)
        <form method="POST" action="{{ route('lookups.store', $def['key']) }}" class="card mt-4 grid items-end gap-2 p-3 sm:grid-cols-12">
            @csrf
            <h2 class="section-title sm:col-span-12">Adicionar</h2>
            <div class="sm:col-span-6"><label class="label" for="new_name">Nome</label><input id="new_name" name="name" class="input" required maxlength="120"></div>
            <div class="sm:col-span-2"><label class="label" for="new_sort">Ordem</label><input id="new_sort" name="sort" type="number" min="0" max="999" value="0" class="input"></div>
            @if ($isPositions)
                <div class="sm:col-span-4"><label class="label" for="new_group">Sector (liderança)</label>
                    <select id="new_group" name="leadership_group" class="input"><option value="">— Não é liderança —</option>
                        @foreach ($leadershipGroups as $k => $l)<option value="{{ $k }}">{{ $l }}</option>@endforeach</select></div>
            @endif
            <div class="sm:col-span-12 sm:text-right"><button class="btn-primary">Adicionar</button></div>
        </form>
    @endunless
</x-layouts.app>
