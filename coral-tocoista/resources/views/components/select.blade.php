@props(['name', 'label', 'options' => [], 'value' => null, 'required' => false, 'placeholder' => 'Escolha...', 'id' => null])
@php
    $id = $id ?? 'f_'.$name;
    $selected = (string) old($name, $value);
    $hasError = $errors->has($name);
@endphp
<div {{ $attributes->only('class') }}>
    <label for="{{ $id }}" class="label">{{ $label }} @if ($required)<span class="text-rust" aria-hidden="true">*</span><span class="sr-only">(obrigatório)</span>@endif</label>
    <select id="{{ $id }}" name="{{ $name }}" @class(['input', 'input-error' => $hasError]) @required($required)
        @if ($hasError) aria-invalid="true" aria-describedby="{{ $id }}_err" @endif {{ $attributes->except('class') }}>
        <option value="">{{ $placeholder }}</option>
        @foreach ($options as $key => $text)
            <option value="{{ $key }}" @selected($selected === (string) $key)>{{ $text }}</option>
        @endforeach
    </select>
    @error($name)<p id="{{ $id }}_err" class="error">{{ $message }}</p>@enderror
</div>
