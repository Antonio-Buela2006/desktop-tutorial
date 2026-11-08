@php
    $u = auth()->user();
    $nav = [];
    if ($u->isStaff()) {
        $nav[] = ['dashboard', 'Dashboard', 'dashboard'];
        $nav[] = ['members.index', 'Membros', 'members.*'];
        $nav[] = ['orgchart', 'Organograma', 'orgchart'];
        $nav[] = ['reports.index', 'Relatórios', 'reports.*'];
    }
    if ($u->isAdmin()) {
        $nav[] = ['settings.edit', 'Configurações', 'settings.*|lookups.*'];
        $nav[] = ['audit.index', 'Auditoria', 'audit.*'];
    }
    $nav[] = ['profile.edit', 'Minha ficha', 'profile.*'];
    $isActive = fn ($p) => collect(explode('|', $p))->contains(fn ($x) => request()->routeIs($x));
@endphp
<!DOCTYPE html>
<html lang="pt-AO">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#2f3330">
    <title>{{ $title ?? 'Início' }} · {{ \App\Models\Setting::get('group_name') }}</title>
    <link rel="icon" href="{{ asset('favicon.svg') }}" type="image/svg+xml">
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen">
    <a href="#conteudo" class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Saltar para o conteúdo</a>
    <header class="bg-granite text-white" x-data="{ open: false }">
        <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <a href="{{ route('home') }}" class="flex min-w-0 items-center gap-2">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white"><x-logo class="h-8 w-8" /></span>
                <span class="min-w-0 leading-tight">
                    <span class="block truncate text-[11px] uppercase tracking-wider text-stone-300">{{ \App\Models\Setting::get('institution_name') }}</span>
                    <span class="block truncate font-serif font-bold">{{ \App\Models\Setting::get('group_name') }}</span>
                </span>
            </a>
            <button type="button" class="btn border border-white/30 text-white lg:hidden" @click="open = !open" :aria-expanded="open" aria-controls="menu">
                <span class="sr-only">Abrir menu</span>
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3 5h14v2H3zM3 9h14v2H3zM3 13h14v2H3z"/></svg>
            </button>
        </div>
        <nav id="menu" class="border-t border-white/10 lg:block" :class="open ? 'block' : 'hidden'" aria-label="Menu principal">
            <ul class="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2 lg:flex-row lg:items-center">
                @foreach ($nav as [$route, $label, $pattern])
                    <li><a href="{{ route($route) }}" @class(['block rounded-md px-3 py-2 text-sm font-semibold',
                        'bg-hill text-white' => $isActive($pattern), 'text-stone hover:bg-white/10' => ! $isActive($pattern)])
                        @if ($isActive($pattern)) aria-current="page" @endif>{{ $label }}</a></li>
                @endforeach
                <li class="lg:ml-auto">
                    <form method="POST" action="{{ route('logout') }}">@csrf
                        <button class="w-full rounded-md px-3 py-2 text-left text-sm text-stone hover:bg-white/10">Sair ({{ \Illuminate\Support\Str::limit($u->name, 18) }})</button>
                    </form>
                </li>
            </ul>
        </nav>
        <div class="stripe"></div>
    </header>

    <main id="conteudo" class="mx-auto max-w-6xl px-4 py-6">
        @isset($heading)
            <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
                <h1 class="flex items-center gap-2 font-serif text-2xl font-bold"><x-star class="h-5 w-5 text-rust" /> {{ $heading }}</h1>
                {{ $actions ?? '' }}
            </div>
        @endisset
        <x-flash />
        {{ $slot }}
    </main>

    <footer class="mx-auto max-w-6xl px-4 pb-8 pt-4 text-center text-xs text-granite-600">
        {{ \App\Models\Setting::get('institution_name') }} · {{ now()->format('Y') }}
    </footer>
</body>
</html>
