<x-layouts.guest title="Cadastro" :wide="true">
    <div class="card mb-4 overflow-hidden">
        <div class="stripe"></div>
        <div class="p-4 sm:p-5">
            <h2 class="font-serif text-xl font-bold">Cadastro de membro</h2>
            <p class="mt-1 text-sm text-granite-600">Preencha os 4 passos. Os campos com <span class="text-rust">*</span> são obrigatórios.</p>
        </div>
    </div>
    <x-flash />
    @include('members._form', ['action' => route('register.store'), 'registration' => true])
</x-layouts.guest>
