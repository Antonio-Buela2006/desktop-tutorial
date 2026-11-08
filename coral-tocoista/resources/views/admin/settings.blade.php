<x-layouts.app title="Configurações">
    <x-slot:heading>Configurações</x-slot:heading>
    <div class="grid gap-4 lg:grid-cols-2">
        <section class="card space-y-3 p-4" x-data="copyLink()">
            <h2 class="section-title">Link de cadastro e entrada</h2>
            <p class="text-sm text-granite-600">Partilhe este link (por exemplo no grupo de WhatsApp). Cada membro entra com o seu telefone e um código.</p>
            <div class="flex gap-2">
                <label for="link" class="sr-only">Link</label>
                <input id="link" class="input" readonly value="{{ $loginLink }}">
                <button type="button" class="btn-dark" @click="copy(@js($loginLink))"><span x-text="copied ? 'Copiado!' : 'Copiar'">Copiar</span></button>
            </div>
        </section>

        <form method="POST" action="{{ route('settings.update') }}" class="card space-y-3 p-4">
            @csrf @method('PUT')
            <h2 class="section-title">Gerais</h2>
            <x-field name="otp_validity_minutes" label="Validade do código OTP (minutos)" type="number" min="1" max="30" :value="$settings['otp_validity_minutes']" required hint="Entre 1 e 30 minutos. Por defeito: 5." />
            <x-field name="institution_name" label="Nome da instituição" :value="$settings['institution_name']" required maxlength="160" />
            <x-field name="group_name" label="Nome do grupo" :value="$settings['group_name']" required maxlength="160" />
            <button class="btn-primary">Gravar configurações</button>
        </form>

        <section class="card p-4 lg:col-span-2">
            <h2 class="section-title mb-3">Listas parametrizáveis</h2>
            <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                @foreach ($lists as $key => $def)
                    <li><a href="{{ route('lookups.index', $key) }}" class="btn-outline w-full justify-start">{{ $def['label'] }}</a></li>
                @endforeach
            </ul>
        </section>
    </div>
</x-layouts.app>
