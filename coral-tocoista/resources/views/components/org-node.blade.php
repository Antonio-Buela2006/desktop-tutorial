@props(['unit', 'tone' => 'bg-white'])
<div class="card min-w-[11rem] max-w-xs p-3 text-center {{ $tone }}">
    <p class="font-serif font-bold">{{ $unit->name }}</p>
    @foreach ($unit->positions as $p)
        <div class="mt-2 border-t border-current/10 pt-2 text-sm">
            <p class="text-xs uppercase tracking-wide opacity-80">{{ $p->name }}</p>
            @forelse ($p->users as $u)
                <p class="font-semibold">{{ $u->name }}</p>
            @empty
                <p class="font-semibold italic opacity-70">Vago</p>
            @endforelse
        </div>
    @endforeach
</div>
