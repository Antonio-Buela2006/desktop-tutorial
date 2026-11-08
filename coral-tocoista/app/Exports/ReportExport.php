<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** Exportação XLSX real (Office Open XML) de qualquer relatório do ReportService. */
class ReportExport implements FromArray, ShouldAutoSize, WithHeadings, WithStyles, WithTitle
{
    public function __construct(private array $report) {}

    public function array(): array
    {
        return $this->report['rows'];
    }

    public function headings(): array
    {
        return $this->report['headings'];
    }

    public function title(): string
    {
        // Os nomes das folhas Excel têm no máximo 31 caracteres e não aceitam alguns símbolos.
        return mb_substr(preg_replace('/[\\\\\/\?\*\[\]:]/', '', $this->report['title']), 0, 31);
    }

    public function styles(Worksheet $sheet): array
    {
        $sheet->freezePane('A2');

        return [1 => ['font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '2F3330']]]];
    }
}
