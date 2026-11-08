<x-layouts.guest title="Entrar">
    <h2 class="font-serif text-xl font-bold">Entrar ou cadastrar-se</h2>
    <p class="mt-1 text-sm text-granite-600">Introduza o seu número de telefone. Vamos enviar um código de 6 dígitos pelo WhatsApp.</p>

    <form method="POST" action="{{ route('login.send') }}" class="mt-5 space-y-4" novalidate>
        @csrf
        <div>
            <label for="phone" class="label">Número de telefone</label>
            <div class="flex">
                <span class="inline-flex items-center rounded-l-lg border border-r-0 border-stone-300 bg-stone-50 px-3 text-sm font-semibold">+244</span>
                <input id="phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" required
                    placeholder="923 456 789" value="{{ old('phone') }}" maxlength="16" autofocus
                    @class(['input rounded-l-none', 'input-error' => $errors->has('phone')])
                    aria-describedby="phone_hint @error('phone') phone_err @enderror" @error('phone') aria-invalid="true" @enderror>
            </div>
            <p id="phone_hint" class="hint">9 dígitos, a começar por 9.</p>
            @error('phone')<p id="phone_err" class="error" role="alert">{{ $message }}</p>@enderror
        </div>
        <button class="btn-primary w-full">Receber código</button>
    </form>

    @if (session('otp_phone'))
        <p class="mt-4 text-center text-sm"><a class="font-semibold text-hill-700 underline" href="{{ route('login.code') }}">Já recebi um código</a></p>
    @endif
</x-layouts.guest>
