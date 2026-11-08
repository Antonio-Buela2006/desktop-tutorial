@php
    // Imagem de fundo institucional: coloque o ficheiro em public/images/fundo.jpg
    $bg = file_exists(public_path('images/fundo.jpg')) ? asset('images/fundo.jpg') : null;
@endphp
<!DOCTYPE html>
<html lang="pt-AO">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#2f3330">
    <title>{{ $title ?? 'Entrar' }} · {{ \App\Models\Setting::get('group_name') }}</title>
    <link rel="icon" href="{{ asset('favicon.svg') }}" type="image/svg+xml">
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen">
    <div class="relative flex min-h-screen flex-col">
        <div class="absolute inset-0 -z-10 bg-granite">
            @if ($bg)
                <img src="{{ $bg }}" alt="" class="h-full w-full object-cover opacity-60">
            @else
                <svg class="absolute bottom-0 h-1/2 w-full" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 200 L0 120 Q120 40 240 100 T400 80 L400 200 Z" fill="#4f7a34" opacity=".85"/>
                    <path d="M0 200 L0 160 Q160 100 400 150 L400 200 Z" fill="#3f6229"/>
                </svg>
            @endif
            <div class="absolute inset-0 bg-gradient-to-b from-granite/70 via-granite/40 to-granite/80"></div>
        </div>

        <header class="px-4 pt-8 text-center text-white">
            <div class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg">
                <x-logo class="h-12 w-12" />
            </div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-stone">{{ \App\Models\Setting::get('institution_name') }}</p>
            <h1 class="mt-1 font-serif text-2xl font-bold">{{ \App\Models\Setting::get('group_name') }}</h1>
        </header>

        <main @class(['mx-auto w-full flex-1 px-4 py-6', 'max-w-md' => ! ($wide ?? false), 'max-w-2xl' => $wide ?? false])>
            @if ($wide ?? false)
                {{ $slot }}
            @else
                <div class="card overflow-hidden">
                    <div class="stripe"></div>
                    <div class="p-5 sm:p-6">{{ $slot }}</div>
                </div>
            @endif
        </main>

        <footer class="pb-6 text-center text-xs text-stone">
            <x-star class="mx-auto mb-1 h-4 w-4 text-white" />
            Os seus dados são tratados apenas para a gestão interna do grupo.
        </footer>
    </div>
</body>
</html>
