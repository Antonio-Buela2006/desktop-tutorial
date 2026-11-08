<x-layouts.app :title="$own ? 'Minha ficha' : 'Editar ficha'">
    <x-slot:heading>{{ $own ? 'Minha ficha' : 'Editar ficha: '.$member->name }}</x-slot:heading>
    @if ($own)
        <p class="-mt-3 mb-4 text-sm text-granite-600">Perfil: <strong>{{ $member->role->name }}</strong>
            @if ($member->positions->isNotEmpty()) · Cargos: <strong>{{ $member->positions->pluck('name')->implode(', ') }}</strong>@endif
            <span class="block text-xs">O perfil, os cargos e o estado da conta só podem ser alterados pela administração.</span></p>
    @endif
    <div class="mx-auto max-w-3xl">
        @include('members._form', ['action' => $action, 'method' => 'PUT', 'phone' => $member->phone_formatted])
    </div>
</x-layouts.app>
