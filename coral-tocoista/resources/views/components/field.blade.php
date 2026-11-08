@props(['name', 'label', 'type' => 'text', 'value' => null, 'required' => false, 'hint' => null, 'id' => null])
@php
    $id = $id ?? 'f_'.$name;
    $hasError = $errors->has($name);
@endphp
<div {{ $attributes->only('class') }}>
    <label for="{{ $id }}" class="label">{{ $label }} @if ($required)<span class="text-rust" aria-hidden="true">*</span><span class="sr-only">(obrigatório)</span>@endif</label>
    <input id="{{ $id }}" name="{{ $name }}" type="{{ $type }}" value="{{ old($name, $value) }}"
        @class(['input', 'input-error' => $hasError]) @required($required)
        @if ($hasError) aria-invalid="true" aria-describedby="{{ $id }}_err" @elseif ($hint) aria-describedby="{{ $id }}_hint" @endif
        {{ $attributes->except('class') }}>
    @if ($hint && ! $hasError)<p id="{{ $id }}_hint" class="hint">{{ $hint }}</p>@endif
    @error($name)<p id="{{ $id }}_err" class="error">{{ $message }}</p>@enderror
</div>
