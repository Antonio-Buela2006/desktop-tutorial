@if ($paginator->hasPages())
    <nav class="mt-4 flex items-center justify-between gap-2 text-sm" aria-label="Paginação">
        @if ($paginator->onFirstPage())
            <span class="btn-outline opacity-50" aria-disabled="true">Anterior</span>
        @else
            <a class="btn-outline" href="{{ $paginator->previousPageUrl() }}" rel="prev">Anterior</a>
        @endif
        <span class="text-granite-600">Página {{ $paginator->currentPage() }} de {{ $paginator->lastPage() }} · {{ $paginator->total() }} registos</span>
        @if ($paginator->hasMorePages())
            <a class="btn-outline" href="{{ $paginator->nextPageUrl() }}" rel="next">Seguinte</a>
        @else
            <span class="btn-outline opacity-50" aria-disabled="true">Seguinte</span>
        @endif
    </nav>
@endif
