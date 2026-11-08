<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Choir;
use App\Models\CulturalCategory;
use App\Models\User;
use App\Models\VoiceType;
use App\Services\ReportService;
use Illuminate\Routing\Middleware\ThrottleRequests;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class DashboardReportsTest extends TestCase
{
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = $this->admin(['sex' => 'M']);
        $coroA = Choir::where('name', 'Coro A')->first();
        $coroB = Choir::where('name', 'Coro B')->first();
        $soprano = VoiceType::where('name', 'Soprano')->first();
        User::factory()->count(3)->chorister($coroA, $soprano)->baptized()->create(['sex' => 'F']);
        User::factory()->count(2)->chorister($coroB)->create(['sex' => 'M']);
        $painters = User::factory()->count(2)->create(['sex' => 'F']);
        $painter = CulturalCategory::where('name', 'Pintor')->first();
        foreach ($painters as $p) {
            $p->culturalCategories()->attach($painter);
        }
    }

    private function stats(): array
    {
        return $this->actingAs($this->admin)->getJson('/dashboard/dados')->assertOk()->json();
    }

    public function test_dashboard_totals_are_correct(): void
    {
        $s = $this->stats();
        $this->assertSame(['members' => 8, 'choristers' => 5, 'culture_makers' => 2, 'men' => 3, 'women' => 5,
            'baptized' => 3, 'not_baptized' => 5], $s['totals']);
        $this->assertSame([['name' => 'Coro A', 'total' => 3], ['name' => 'Coro B', 'total' => 2]], $s['by_choir']);
        $this->assertGreaterThanOrEqual(3, collect($s['by_voice'])->firstWhere('name', 'Soprano')['total']);
        $this->assertSame(5, collect($s['by_voice'])->sum('total'));
        $this->assertSame(8, collect($s['by_area'])->sum('members'));
        $this->assertSame(5, collect($s['by_area'])->sum('choristers'));
        $this->assertSame(2, collect($s['by_area'])->sum('artists'));
        $this->assertSame(2, collect($s['by_category'])->firstWhere('name', 'Pintor')['total']);

        $this->get('/dashboard')->assertOk()->assertSee('Total de membros')->assertSee('Fazedores de cultura');
    }

    public function test_dashboard_totals_match_list_and_reports(): void
    {
        $s = $this->stats();
        $this->get('/membros')->assertSee($s['totals']['members'].'</strong> membro(s)', false);

        $service = app(ReportService::class);
        $this->assertCount($s['totals']['choristers'], $service->build('coristas')['rows']);
        $this->assertCount($s['totals']['culture_makers'], $service->build('fazedores')['rows']);
        foreach (Choir::all() as $c) {
            $this->assertCount(collect($s['by_choir'])->firstWhere('name', $c->name)['total'], $service->build('coro', ['id' => $c->id])['rows']);
        }
    }

    public function test_dashboard_changes_immediately_after_an_update(): void
    {
        $before = $this->stats()['totals'];
        $poet = User::factory()->create(['sex' => 'M']);
        $this->actingAs($poet)->put('/minha-ficha', $this->validProfile([
            'name' => $poet->name, 'sex' => 'M', 'categories' => [CulturalCategory::where('name', 'Poeta')->value('id')],
        ]))->assertSessionHasNoErrors();

        $after = $this->stats()['totals'];
        $this->assertSame($before['members'] + 1, $after['members']);
        $this->assertSame($before['culture_makers'] + 1, $after['culture_makers']);
        $this->assertSame($before['men'] + 1, $after['men']);
    }

    public function test_all_reports_download_as_valid_pdf_and_xlsx(): void
    {
        // 11 relatórios x 2 formatos ultrapassa o limite de 20 exportações/minuto (testado à parte).
        $this->withoutMiddleware(ThrottleRequests::class);
        $this->actingAs($this->admin);
        $keys = collect(ReportService::REPORTS)->flatMap(fn ($g) => array_keys($g));
        foreach ($keys as $key) {
            $q = $key === 'coro' ? '?id='.Choir::first()->id : '';

            $pdf = $this->get("/relatorios/{$key}.pdf{$q}");
            $pdf->assertOk()->assertHeader('content-type', 'application/pdf');
            $this->assertStringStartsWith('%PDF-', $pdf->getContent(), "PDF inválido: {$key}");

            $xlsx = $this->get("/relatorios/{$key}.xlsx{$q}");
            $xlsx->assertOk();
            $this->assertStringContainsString('spreadsheetml', $xlsx->headers->get('content-type'));
            $file = $xlsx->getFile()->getPathname();
            $sheet = IOFactory::createReader('Xlsx')->load($file)->getActiveSheet();
            $expected = app(ReportService::class)->build($key, ['id' => Choir::first()->id]);
            $this->assertSame($expected['headings'][0], $sheet->getCell('A1')->getValue(), "Cabeçalho XLSX: {$key}");
            $this->assertSame(count($expected['rows']) + 1, $sheet->getHighestDataRow(), "Linhas XLSX: {$key}");
        }
        $this->assertSame($keys->count() * 2, AuditLog::where('operation', 'export')->count());
    }

    public function test_exports_are_rate_limited(): void
    {
        $this->actingAs($this->admin);
        for ($i = 0; $i < 20; $i++) {
            $this->get('/relatorios/fazedores-estatisticas.xlsx')->assertOk();
        }
        $this->get('/relatorios/fazedores-estatisticas.xlsx')->assertStatus(429);
    }

    public function test_choir_report_lists_only_that_choir(): void
    {
        $coroB = Choir::where('name', 'Coro B')->first();
        $rows = app(ReportService::class)->build('coro', ['id' => $coroB->id])['rows'];
        $this->assertCount(2, $rows);
        $this->assertSame(['Coro B'], collect($rows)->pluck(6)->unique()->values()->all());
    }

    public function test_age_bands(): void
    {
        $this->assertSame('Menos de 18', ReportService::ageBand(15));
        $this->assertSame('18 a 25', ReportService::ageBand(18));
        $this->assertSame('51 ou mais', ReportService::ageBand(80));
        $this->assertSame('Sem data de nascimento', ReportService::ageBand(null));
    }

    public function test_leadership_report_marks_vacant_positions(): void
    {
        $rows = app(ReportService::class)->build('lideranca')['rows'];
        $this->assertContains('Vago', collect($rows)->pluck(2)->all());
    }

    public function test_unknown_report_is_404_and_members_cannot_export(): void
    {
        $this->actingAs($this->admin)->get('/relatorios/inexistente.pdf')->assertNotFound();
        $this->actingAs($this->member())->get('/relatorios/coristas.xlsx')->assertForbidden();
    }
}
