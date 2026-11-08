{{--
    Formulário da ficha em 4 passos. Usado no cadastro, em "Minha ficha" e na edição pelo staff.
    Variáveis: $member, $action, $method, $registration (bool), listas de FormOptions.
--}}
@php
    $registration = $registration ?? false;
    $selectedCats = collect(old('categories', $member->exists ? $member->culturalCategories->pluck('id')->all() : []))->map(fn ($v) => (int) $v)->all();
    $date = fn ($f) => old($f, $member->{$f}?->format('Y-m-d'));
    // Abrir no passo onde está o primeiro erro.
    $stepFields = [
        1 => ['name', 'photo', 'sex', 'birth_date', 'marital_status', 'phone_alt', 'email', 'address', 'profession', 'education'],
        2 => ['church_admission_date', 'baptized', 'baptism_date', 'parish_id', 'area_id'],
        3 => ['is_choir_member', 'choir_id', 'voice_type_id', 'is_instrumentalist', 'instrument', 'choir_join_date'],
        4 => ['categories', 'consent'],
    ];
    $initialStep = 1;
    foreach ($stepFields as $s => $fields) {
        if (collect($fields)->contains(fn ($f) => $errors->has($f) || $errors->has($f.'.*'))) { $initialStep = $s; break; }
    }
    $steps = [1 => 'Dados pessoais', 2 => 'Dados religiosos', 3 => 'Dados corais', 4 => 'Cultura'];
    $choirCategory = $categories->firstWhere('is_choir_member', true);
@endphp

<form method="POST" action="{{ $action }}" enctype="multipart/form-data" novalidate
    x-data="memberForm({ step: {{ $initialStep }}, total: 4,
        isChorister: {{ old('is_choir_member', $member->is_choir_member) ? 'true' : 'false' }},
        baptized: {{ old('baptized', $member->baptized) ? 'true' : 'false' }},
        instrumentalist: {{ old('is_instrumentalist', $member->is_instrumentalist) ? 'true' : 'false' }} })"
    @submit="submit($event)">
    @csrf
    @if (($method ?? 'POST') !== 'POST') @method($method) @endif

    {{-- Indicador de passos --}}
    <ol class="card mb-4 grid grid-cols-4 gap-1 p-2 text-center text-[11px] font-semibold sm:text-xs" aria-label="Passos do formulário">
        @foreach ($steps as $n => $label)
            <li>
                <button type="button" @click="go({{ $n }})" class="w-full" :aria-current="step === {{ $n }} ? 'step' : null">
                    <span class="mb-1 block h-1.5 rounded-full" :class="step >= {{ $n }} ? 'bg-hill' : 'bg-stone-200'"></span>
                    <span :class="step === {{ $n }} ? 'text-hill-700' : 'text-granite-600'">{{ $n }}. {{ $label }}</span>
                </button>
            </li>
        @endforeach
    </ol>

    {{-- PASSO 1: pessoais --}}
    <section data-step="1" x-show="step === 1" class="card space-y-4 p-4 sm:p-6">
        <h2 tabindex="-1" class="section-title">1. Dados pessoais</h2>

        <div class="flex items-center gap-4">
            <div class="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-stone-200 bg-stone">
                <template x-if="preview"><img :src="preview" alt="Pré-visualização da fotografia" class="h-full w-full object-cover"></template>
                @if ($member->exists && $member->photo_path)
                    <img x-show="!preview" src="{{ route('members.photo', $member) }}" alt="Fotografia actual" class="h-full w-full object-cover">
                @else
                    <svg x-show="!preview" class="h-full w-full text-stone-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5c0-3-4-5.5-9-5.5Z"/></svg>
                @endif
            </div>
            <div class="min-w-0 flex-1">
                <label for="f_photo" class="label">Fotografia</label>
                <input id="f_photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" @change="photo($event)"
                    class="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-stone file:px-3 file:py-2 file:font-semibold">
                <p class="hint">JPG, PNG ou WEBP, até 2 MB.</p>
                <p class="error" x-show="photoError" x-text="photoError" role="alert"></p>
                @error('photo')<p class="error">{{ $message }}</p>@enderror
                @if ($member->exists && $member->photo_path)
                    <label class="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" name="remove_photo" value="1" class="rounded"> Remover fotografia actual</label>
                @endif
            </div>
        </div>

        <x-field name="name" label="Nome completo" :value="$member->name" required maxlength="160" minlength="3" autocomplete="name" />

        <div>
            <span class="label">Telefone</span>
            <p class="input bg-stone-50">{{ $member->exists ? $member->phone_formatted : $phone }} <span class="badge ml-1 bg-hill-100 text-hill-700">validado</span></p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
            <x-select name="sex" label="Sexo" :options="['M' => 'Masculino', 'F' => 'Feminino']" :value="$member->sex" />
            <x-field name="birth_date" label="Data de nascimento" type="date" :value="$date('birth_date')" max="{{ now()->format('Y-m-d') }}" hint="dd/mm/aaaa" />
            <x-select name="marital_status" label="Estado civil" :options="array_combine($maritalStatuses, $maritalStatuses)" :value="$member->marital_status" />
            <x-field name="phone_alt" label="Telefone alternativo" type="tel" inputmode="numeric" :value="$member->phone_alt" pattern="9[0-9]{8}" maxlength="9" hint="Opcional. 9 dígitos." />
            <x-field name="email" label="E-mail" type="email" :value="$member->email" autocomplete="email" maxlength="160" />
            <x-field name="profession" label="Profissão" :value="$member->profession" maxlength="120" />
        </div>
        <x-field name="education" label="Formação académica" :value="$member->education" maxlength="120" hint="Ex.: Ensino médio, Licenciatura em Gestão" />
        <x-field name="address" label="Morada" :value="$member->address" maxlength="255" autocomplete="street-address" hint="Bairro, rua, município" />
    </section>

    {{-- PASSO 2: religiosos --}}
    <section data-step="2" x-show="step === 2" x-cloak class="card space-y-4 p-4 sm:p-6">
        <h2 tabindex="-1" class="section-title">2. Dados religiosos</h2>
        <div class="grid gap-4 sm:grid-cols-2">
            <x-select name="area_id" label="Área" :options="$areas->pluck('name', 'id')" :value="$member->area_id" required />
            <x-select name="parish_id" label="Paróquia" :options="$parishes->pluck('name', 'id')" :value="$member->parish_id" />
            <x-field name="church_admission_date" label="Data de admissão na Igreja" type="date" :value="$date('church_admission_date')" max="{{ now()->format('Y-m-d') }}" />
        </div>
        <x-yesno name="baptized" label="É baptizado(a)?" model="baptized" :value="$member->baptized" />
        <div x-show="baptized" x-cloak>
            <x-field name="baptism_date" label="Data de baptismo" type="date" :value="$date('baptism_date')" max="{{ now()->format('Y-m-d') }}" x-bind:disabled="!baptized" />
        </div>
    </section>

    {{-- PASSO 3: corais --}}
    <section data-step="3" x-show="step === 3" x-cloak class="card space-y-4 p-4 sm:p-6">
        <h2 tabindex="-1" class="section-title">3. Dados corais</h2>
        <x-yesno name="is_choir_member" label="Canta no coro (é corista)?" model="isChorister" :value="$member->is_choir_member" />
        <p class="hint" x-show="!isChorister">Não faz mal: poetas, fotógrafos, músicos e outros fazedores de cultura cadastram-se sem coro.</p>

        <div x-show="isChorister" x-cloak class="grid gap-4 rounded-lg bg-hill-50 p-3 sm:grid-cols-3">
            <x-select name="choir_id" label="Coro" :options="$choirs->pluck('name', 'id')" :value="$member->choir_id" x-bind:required="isChorister" x-bind:disabled="!isChorister" />
            <x-select name="voice_type_id" label="Tipo de voz" :options="$voices->pluck('name', 'id')" :value="$member->voice_type_id" x-bind:required="isChorister" x-bind:disabled="!isChorister" />
            <x-field name="choir_join_date" label="Data de ingresso no coro" type="date" :value="$date('choir_join_date')" max="{{ now()->format('Y-m-d') }}" x-bind:required="isChorister" x-bind:disabled="!isChorister" />
            <p class="hint sm:col-span-3">Coro, tipo de voz e data de ingresso são obrigatórios para coristas.</p>
        </div>

        <x-yesno name="is_instrumentalist" label="Toca algum instrumento?" model="instrumentalist" :value="$member->is_instrumentalist" />
        <div x-show="instrumentalist" x-cloak>
            <x-field name="instrument" label="Instrumento(s)" :value="$member->instrument" maxlength="120" hint="Ex.: batuque, viola, teclado" x-bind:disabled="!instrumentalist" />
        </div>
    </section>

    {{-- PASSO 4: culturais + consentimento --}}
    <section data-step="4" x-show="step === 4" x-cloak class="card space-y-4 p-4 sm:p-6">
        <h2 tabindex="-1" class="section-title">4. Fazedor de cultura</h2>
        <fieldset>
            <legend class="label">Que actividades culturais exerce? (pode escolher várias)</legend>
            <div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                @foreach ($categories as $cat)
                    @if ($cat->is_choir_member)
                        <label class="flex min-h-[44px] items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-granite-600">
                            <input type="checkbox" disabled class="rounded text-hill" :checked="isChorister"> {{ $cat->name }}
                            <span class="sr-only">(atribuída automaticamente a coristas)</span>
                        </label>
                    @else
                        <label class="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm has-[:checked]:border-hill has-[:checked]:bg-hill-50">
                            <input type="checkbox" name="categories[]" value="{{ $cat->id }}" class="rounded text-hill focus:ring-hill" @checked(in_array($cat->id, $selectedCats))> {{ $cat->name }}
                        </label>
                    @endif
                @endforeach
            </div>
            @if ($choirCategory)<p class="hint">A categoria "{{ $choirCategory->name }}" é atribuída automaticamente a quem é corista.</p>@endif
            @error('categories.*')<p class="error">{{ $message }}</p>@enderror
        </fieldset>

        @if ($registration)
            <div class="rounded-lg border border-granite/20 bg-stone-50 p-3">
                <label class="flex items-start gap-3 text-sm">
                    <input type="checkbox" name="consent" value="1" required class="mt-1 h-5 w-5 rounded text-hill focus:ring-hill" @checked(old('consent'))>
                    <span>Autorizo o tratamento dos meus <strong>dados pessoais e religiosos</strong> para a gestão interna do grupo coral e dos fazedores de cultura. Os dados só são visíveis para a administração e para mim, e posso pedir a sua correcção ou eliminação.</span>
                </label>
                @error('consent')<p class="error">{{ $message }}</p>@enderror
            </div>
        @endif
    </section>

    {{-- Navegação --}}
    <div class="sticky bottom-0 -mx-4 mt-4 flex gap-2 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        <button type="button" class="btn-outline flex-1 sm:flex-none" x-show="step > 1" @click="go(step - 1)">Anterior</button>
        <button type="button" class="btn-primary flex-1 sm:flex-none" x-show="step < total" @click="go(step + 1)">Seguinte</button>
        <button type="submit" class="btn-primary flex-1 sm:flex-none" x-show="step === total" x-cloak>{{ $registration ? 'Concluir cadastro' : 'Gravar ficha' }}</button>
        @unless ($registration)
            <button type="submit" class="btn-outline hidden sm:inline-flex" x-show="step < total">Gravar já</button>
        @endunless
    </div>
</form>
