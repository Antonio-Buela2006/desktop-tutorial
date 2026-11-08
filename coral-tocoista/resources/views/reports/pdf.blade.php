<!DOCTYPE html>
<html lang="pt-AO">
<head>
<meta charset="utf-8">
<title>{{ $report['title'] }}</title>
<style>
    @page { margin: 70px 32px 50px 32px; }
    body { font-family: DejaVu Sans, sans-serif; font-size: 9.5px; color: #2f3330; }
    header { position: fixed; top: -55px; left: 0; right: 0; border-bottom: 3px solid #4f7a34; padding-bottom: 6px; }
    header .inst { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #555b56; }
    header .grp { font-size: 13px; font-weight: bold; }
    header .star { color: #b8481a; }
    footer { position: fixed; bottom: -35px; left: 0; right: 0; font-size: 8px; color: #555b56; border-top: 1px solid #d3d6cf; padding-top: 4px; }
    h1 { font-size: 15px; margin: 0 0 2px; }
    .sub { color: #555b56; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #2f3330; color: #fff; text-align: left; padding: 4px; }
    td { padding: 3px 4px; border-bottom: 1px solid #e4e6e1; }
    tr.group td { background: #e6efdf; font-weight: bold; color: #3f6229; border-bottom: 1px solid #4f7a34; }
    .pagenum:before { content: counter(page); }
</style>
</head>
<body>
<header>
    <div class="inst">{{ $institution }}</div>
    <div class="grp"><span class="star">&#10040;</span> {{ $group }}</div>
</header>
<footer>
    Gerado em {{ now()->format('d/m/Y H:i') }} por {{ $author }} · Documento interno com dados pessoais — não divulgar · Página <span class="pagenum"></span>
</footer>

<h1>{{ $report['title'] }}</h1>
<div class="sub">{{ $report['subtitle'] }}</div>

@php $headings = $report['grouped'] ? array_slice($report['headings'], 1) : $report['headings']; $current = null; @endphp
<table>
    <thead><tr>@foreach ($headings as $h)<th>{{ $h }}</th>@endforeach</tr></thead>
    <tbody>
    @forelse ($report['rows'] as $row)
        @if ($report['grouped'])
            @if ($row[0] !== $current)
                @php $current = $row[0]; @endphp
                <tr class="group"><td colspan="{{ count($headings) }}">{{ $report['headings'][0] }}: {{ $current }}</td></tr>
            @endif
            @php $row = array_slice($row, 1); @endphp
        @endif
        <tr>@foreach ($row as $cell)<td>{{ $cell }}</td>@endforeach</tr>
    @empty
        <tr><td colspan="{{ count($headings) }}">Sem registos.</td></tr>
    @endforelse
    </tbody>
</table>
</body>
</html>
