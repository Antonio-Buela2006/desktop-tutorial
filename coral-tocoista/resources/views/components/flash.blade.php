@if (session('status'))
    <div role="status" class="mb-4 flex items-start gap-2 rounded-lg border border-hill/30 bg-hill-50 px-4 py-3 text-sm text-hill-700">
        <x-star class="mt-0.5 h-4 w-4 shrink-0 text-hill" /> <span>{{ session('status') }}</span>
    </div>
@endif
@if ($errors->any() && ($summary ?? true))
    <div role="alert" class="mb-4 rounded-lg border border-rust/40 bg-rust-100 px-4 py-3 text-sm text-rust-700">
        <p class="font-semibold">Corrija os seguintes pontos:</p>
        <ul class="mt-1 list-disc pl-5">
            @foreach ($errors->all() as $e)<li>{{ $e }}</li>@endforeach
        </ul>
    </div>
@endif
