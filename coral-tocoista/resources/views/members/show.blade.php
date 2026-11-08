@php
    $d = fn ($v) => $v?->format('d/m/Y') ?? '—';
    $yn = fn ($v) => $v ? 'Sim' : 'Não';
    $rows = [
        'Dados pessoais' => ['Telefone' => $member->phone_formatted, 'Telefone alternativo' => \App\Support\Phone::format($member->phone_alt) ?: '—',
            'E-mail' => $member->email ?: '—', 'Sexo' => ['M' => 'Masculino', 'F' => 'Feminino'][$member->sex] ?? '—',
            'Data de nascimento' => $d($member->birth_date).($member->age !== null ? " ({$member->age} anos)" : ''),
            'Estado civil' => $member->marital_status ?: '—', 'Morada' => $member->address ?: '—',
            'Profissão' => $member->profession ?: '—', 'Formação académica' => $member->education ?: '—'],
        'Dados religiosos' => ['Área' => $member->area?->name, 'Paróquia' => $member->parish?->name ?? '—',
            'Admissão na Igreja' => $d($member->church_admission_date), 'Baptizado' => $yn($member->baptized),
            'Data de baptismo' => $d($member->baptism_date)],
        'Dados corais' => ['Corista' => $yn($member->is_choir_member), 'Coro' => $member->choir?->name ?? '—',
            'Tipo de voz' => $member->voiceType?->name ?? '—', 'Ingresso no coro' => $d($member->choir_join_date),
            'Instrumentista' => $yn($member->is_instrumentalist), 'Instrumento' => $member->instrument ?: '—'],
    ];
@endphp
<x-layouts.app :title="$member->name">
    <x-slot:heading>{{ $member->name }}</x-slot:heading>
    <x-slot:actions>
        <div class="flex flex-wrap gap-2">
            <a href="{{ route('members.index') }}" class="btn-outline">Voltar</a>
            @can('update', $member)<a href="{{ route('members.edit', $member) }}" class="btn-primary">Editar ficha</a>@endcan
        </div>
    </x-slot:actions>

    <div class="grid gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-2">
            <div class="card flex items-center gap-4 p-4">
                <div class="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-stone">
                    @if ($member->photo_path)<img src="{{ route('members.photo', $member) }}" alt="Fotografia de {{ $member->name }}" class="h-full w-full object-cover">@endif
                </div>
                <div>
                    <p class="text-sm">Perfil: <strong>{{ $member->role->name }}</strong></p>
                    <p class="text-sm">Cargos: <strong>{{ $member->positions->pluck('name')->implode(', ') ?: 'Nenhum' }}</strong></p>
                    <p class="text-sm">Categorias: <strong>{{ $member->culturalCategories->pluck('name')->implode(', ') ?: 'Nenhuma' }}</strong></p>
                    <p class="text-xs text-granite-600">Consentimento: {{ $member->consent_at?->format('d/m/Y H:i') ?? 'não registado' }} ·
                        Última entrada: {{ $member->last_login_at?->format('d/m/Y H:i') ?? '—' }}</p>
                    @if ($member->isBlocked())<p class="badge mt-1 bg-rust-100 text-rust-700">Bloqueado desde {{ $member->blocked_at->format('d/m/Y H:i') }}</p>@endif
                </div>
            </div>
            @foreach ($rows as $section => $fields)
                <section class="card p-4">
                    <h2 class="section-title mb-2">{{ $section }}</h2>
                    <dl class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                        @foreach ($fields as $k => $v)
                            <div><dt class="text-granite-600">{{ $k }}</dt><dd class="font-semibold">{{ $v }}</dd></div>
                        @endforeach
                    </dl>
                </section>
            @endforeach
        </div>

        @can('manageAccess', $member)
            <aside class="space-y-4">
                <form method="POST" action="{{ route('members.access', $member) }}" class="card space-y-3 p-4">
                    @csrf @method('PUT')
                    <h2 class="section-title">Perfil e cargos</h2>
                    @can('changeRole', $member)
                        <x-select name="role_id" label="Perfil de acesso" :options="$roles->pluck('name', 'id')" :value="$member->role_id" placeholder="—" />
                    @else
                        <p class="text-sm text-granite-600">Não pode alterar o seu próprio perfil de acesso.</p>
                    @endcan
                    <fieldset>
                        <legend class="label">Cargos</legend>
                        @foreach ($positions as $p)
                            @if ($p->name === 'Corista')
                                <p class="py-1 text-sm text-granite-600"><input type="checkbox" disabled @checked($member->is_choir_member) class="rounded"> Corista (automático)</p>
                            @else
                                <label class="flex items-center gap-2 py-1 text-sm"><input type="checkbox" name="positions[]" value="{{ $p->id }}" class="rounded text-hill" @checked($member->positions->contains($p))> {{ $p->name }}</label>
                            @endif
                        @endforeach
                    </fieldset>
                    <button class="btn-primary w-full">Gravar perfil e cargos</button>
                </form>

                @can('block', $member)
                    <div class="card space-y-3 p-4">
                        <h2 class="section-title">Estado da conta</h2>
                        <form method="POST" action="{{ route($member->isBlocked() ? 'members.unblock' : 'members.block', $member) }}">
                            @csrf
                            <button class="{{ $member->isBlocked() ? 'btn-primary' : 'btn-dark' }} w-full">{{ $member->isBlocked() ? 'Desbloquear' : 'Bloquear acesso' }}</button>
                        </form>
                    </div>
                @endcan

                @can('delete', $member)
                    <form method="POST" action="{{ route('members.destroy', $member) }}" class="card space-y-3 border-rust/40 p-4" x-data="{ open: {{ $errors->has('confirm_phone') ? 'true' : 'false' }} }">
                        @csrf @method('DELETE')
                        <h2 class="section-title text-rust-700">Eliminar membro</h2>
                        <button type="button" class="btn-outline w-full" @click="open = true" x-show="!open">Eliminar…</button>
                        <div x-show="open" x-cloak class="space-y-2">
                            <p class="text-sm">Esta acção é <strong>definitiva</strong>. Para confirmar, escreva o telefone do membro (<strong>{{ $member->phone }}</strong>).</p>
                            <x-field name="confirm_phone" label="Telefone do membro" inputmode="numeric" autocomplete="off" />
                            <button class="btn-danger w-full">Confirmo: eliminar definitivamente</button>
                        </div>
                    </form>
                @endcan
            </aside>
        @endcan
    </div>
</x-layouts.app>
