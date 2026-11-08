@props(['name', 'label', 'model', 'value' => false])
{{-- Pergunta sim/não com botões grandes (fáceis de tocar no telemóvel). --}}
<fieldset {{ $attributes->only('class') }}>
    <legend class="label">{{ $label }}</legend>
    <div class="grid grid-cols-2 gap-2">
        @foreach ([1 => 'Sim', 0 => 'Não'] as $v => $t)
            <label class="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-semibold has-[:checked]:border-hill has-[:checked]:bg-hill-50 has-[:checked]:text-hill-700 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-rust">
                <input type="radio" class="sr-only" name="{{ $name }}" value="{{ $v }}" x-model.boolean="{{ $model }}"
                    @checked((bool) old($name, $value) === (bool) $v)> {{ $t }}
            </label>
        @endforeach
    </div>
</fieldset>
