<?php

namespace App\Http\Controllers;

use App\Exports\ReportExport;
use App\Models\Choir;
use App\Models\Setting;
use App\Services\ReportService;
use App\Support\Audit;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\View\View;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends Controller
{
    public function index(): View
    {
        return view('reports.index', [
            'reports' => ReportService::REPORTS,
            'choirs' => Choir::active()->ordered()->get(),
        ]);
    }

    public function download(Request $request, string $report, string $format, ReportService $service): Response
    {
        abort_unless(ReportService::exists($report), 404);
        $params = ['id' => $request->integer('id')];
        $data = $service->build($report, $params);
        $file = Str::slug($data['title']).'-'.now()->format('Ymd-His').'.'.$format;

        Audit::log('export', null, null, ['relatorio' => $report, 'formato' => $format, 'parametros' => array_filter($params), 'linhas' => count($data['rows'])],
            "Exportação: {$data['title']} ({$format})");

        if ($format === 'xlsx') {
            return Excel::download(new ReportExport($data), $file, \Maatwebsite\Excel\Excel::XLSX);
        }

        return Pdf::loadView('reports.pdf', [
            'report' => $data,
            'institution' => Setting::get('institution_name'),
            'group' => Setting::get('group_name'),
            'author' => $request->user()->name,
        ])->setOption('enable_font_subsetting', true)
            ->setPaper('a4', count($data['headings']) > 6 ? 'landscape' : 'portrait')->download($file);
    }
}
