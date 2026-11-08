<x-layouts.guest title="Código de acesso">
    <h2 class="font-serif text-xl font-bold">Introduza o código</h2>
    <p class="mt-1 text-sm text-granite-600">Enviámos um código de 6 dígitos para <strong class="whitespace-nowrap">{{ $phone }}</strong>.</p>

    @if (session('status'))<p class="mt-3 rounded-lg bg-hill-50 px-3 py-2 text-sm text-hill-700" role="status">{{ session('status') }}</p>@endif

    @if ($debugCode)
        <p class="mt-3 rounded-lg border border-dashed border-rust bg-rust-100 px-3 py-2 text-sm text-rust-700">
            <strong>Modo de teste:</strong> o seu código é <strong class="tracking-widest">{{ $debugCode }}</strong>
        </p>
    @endif

    <form method="POST" action="{{ route('login.verify') }}" class="mt-5 space-y-4" novalidate>
        @csrf
        <div>
            <label for="code" class="label">Código de 6 dígitos</label>
            <input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="\d{6}" maxlength="6" required autofocus
                @class(['input text-center text-2xl tracking-[0.5em]', 'input-error' => $errors->has('code')])
                @error('code') aria-invalid="true" aria-describedby="code_err" @enderror>
            @error('code')<p id="code_err" class="error" role="alert">{{ $message }}</p>@enderror
        </div>
        <button class="btn-primary w-full">Confirmar</button>
    </form>

    <div class="mt-5 border-t border-stone-200 pt-4 text-center text-sm" x-data="countdown({{ $wait }})">
        <form method="POST" action="{{ route('login.send') }}">
            @csrf
            <input type="hidden" name="phone" value="{{ session('otp_phone') }}">
            <button class="font-semibold text-hill-700 underline disabled:text-granite-400 disabled:no-underline" :disabled="left > 0">
                Pedir novo código <span x-show="left > 0" x-text="'(' + left + ' s)'"></span>
            </button>
        </form>
        <a href="{{ route('login') }}" class="mt-2 inline-block text-granite-600 underline">Mudar de número</a>
    </div>
</x-layouts.guest>
