<?php

namespace App\Services;

use App\Models\Area;
use App\Models\Choir;
use App\Models\CulturalCategory;
use App\Models\Position;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Gera os dados de cada relatório num formato neutro (título, cabeçalhos, linhas),
 * usado tanto para PDF como para XLSX — garante que ambos mostram exactamente o mesmo.
 * Quando há agrupamento, a 1.ª coluna é o grupo e as linhas vêm ordenadas por ele.
 */
class ReportService
{
    public const REPORTS = [
        'Coro' => [
            'coristas' => 'Lista geral de coristas',
            'coro' => 'Coristas por coro',
            'por-voz' => 'Coristas por tipo de voz',
            'por-area' => 'Coristas por área',
            'faixa-etaria' => 'Coristas por faixa etária',
            'por-paroquia' => 'Coristas por paróquia',
        ],
        'Liderança' => [
            'lideranca' => 'Liderança (responsáveis, secretários, mestres, tesoureiros, banda)',
        ],
        'Fazedores de cultura' => [
            'fazedores' => 'Lista geral de fazedores de cultura',
            'fazedores-categoria' => 'Fazedores de cultura por categoria',
            'fazedores-area' => 'Fazedores de cultura por área',
            'fazedores-estatisticas' => 'Estatísticas dos fazedores de cultura',
        ],
    ];

    public const AGE_BANDS = [[0, 17, 'Menos de 18'], [18, 25, '18 a 25'], [26, 35, '26 a 35'], [36, 50, '36 a 50'], [51, 200, '51 ou mais']];

    public static function exists(string $key): bool
    {
        return collect(self::REPORTS)->flatMap(fn ($g) => $g)->has($key);
    }

    public static function title(string $key): string
    {
        return collect(self::REPORTS)->flatMap(fn ($g) => $g)->get($key, $key);
    }

    /** @return array{title:string, subtitle:?string, headings:array, rows:array, grouped:bool} */
    public function build(string $key, array $params = []): array
    {
        if (! self::exists($key)) {
            throw new NotFoundHttpException;
        }

        return match ($key) {
            'coristas' => $this->table('Lista geral de coristas', null, $this->choristers()->get()),
            'coro' => $this->choirReport((int) ($params['id'] ?? 0)),
            'por-voz' => $this->grouped('Coristas por tipo de voz', 'Voz', $this->choristers()->get(), fn ($u) => $u->voiceType?->name ?? 'Sem voz'),
            'por-area' => $this->grouped('Coristas por área', 'Área', $this->choristers()->get(), fn ($u) => $u->area?->name ?? '—'),
            'por-paroquia' => $this->grouped('Coristas por paróquia', 'Paróquia', $this->choristers()->get(), fn ($u) => $u->parish?->name ?? 'Sem paróquia'),
            'faixa-etaria' => $this->grouped('Coristas por faixa etária', 'Faixa etária', $this->choristers()->get(), fn ($u) => self::ageBand($u->age)),
            'lideranca' => $this->leadership(),
            'fazedores' => $this->makers('Lista geral de fazedores de cultura', $this->cultureMakers()->get()),
            'fazedores-categoria' => $this->makersByCategory(),
            'fazedores-area' => $this->makersGrouped(),
            'fazedores-estatisticas' => $this->makersStats(),
        };
    }

    public static function ageBand(?int $age): string
    {
        if ($age === null) {
            return 'Sem data de nascimento';
        }
        foreach (self::AGE_BANDS as [$min, $max, $label]) {
            if ($age >= $min && $age <= $max) {
                return $label;
            }
        }

        return '—';
    }

    // ---- Consultas base (as mesmas definições do dashboard) -----------

    private function choristers(): Builder
    {
        return User::with('area', 'choir', 'voiceType', 'parish')->where('is_choir_member', true)->orderBy('name');
    }

    private function cultureMakers(): Builder
    {
        return User::with(['area', 'culturalCategories' => fn ($q) => $q->where('is_choir_member', false)])
            ->cultureMakers()->orderBy('name');
    }

    // ---- Construtores ---------------------------------------------------

    private const MEMBER_HEADINGS = ['Nº', 'Nome', 'Telefone', 'Sexo', 'Idade', 'Área', 'Coro', 'Voz'];

    private function memberRow(int $i, User $u): array
    {
        return [$i, $u->name, $u->phone_formatted, $u->sex ?? '', $u->age ?? '', $u->area?->name ?? '',
            $u->choir?->name ?? '', $u->voiceType?->name ?? ''];
    }

    private function table(string $title, ?string $subtitle, Collection $users): array
    {
        $rows = $users->values()->map(fn ($u, $i) => $this->memberRow($i + 1, $u))->all();

        return ['title' => $title, 'subtitle' => $subtitle ?? 'Total: '.count($rows), 'headings' => self::MEMBER_HEADINGS, 'rows' => $rows, 'grouped' => false];
    }

    private function choirReport(int $id): array
    {
        $choir = Choir::findOrFail($id);

        return $this->table("Coristas — {$choir->name}", null, $this->choristers()->where('choir_id', $choir->id)->get());
    }

    private function grouped(string $title, string $groupLabel, Collection $users, callable $groupOf): array
    {
        $rows = [];
        $groups = $users->groupBy($groupOf)->sortKeys();
        foreach ($groups as $group => $members) {
            foreach ($members->values() as $i => $u) {
                $rows[] = array_merge([$group], $this->memberRow($i + 1, $u));
            }
        }
        $summary = $groups->map(fn ($m, $g) => "{$g}: ".$m->count())->implode(' · ');

        return ['title' => $title, 'subtitle' => 'Total: '.$users->count().' — '.$summary,
            'headings' => array_merge([$groupLabel], self::MEMBER_HEADINGS), 'rows' => $rows, 'grouped' => true];
    }

    private function leadership(): array
    {
        $rows = [];
        $positions = Position::where('is_leadership', true)->with(['users' => fn ($q) => $q->with('choir')->orderBy('name')])->orderBy('sort')->get();
        foreach ($positions as $p) {
            $group = Position::LEADERSHIP_GROUPS[$p->leadership_group] ?? 'Outros';
            if ($p->users->isEmpty()) {
                $rows[] = [$group, $p->name, 'Vago', '', ''];
            }
            foreach ($p->users as $u) {
                $rows[] = [$group, $p->name, $u->name, $u->phone_formatted, $u->choir?->name ?? ''];
            }
        }

        return ['title' => 'Liderança do Grupo Coral', 'subtitle' => 'Responsáveis, secretários, mestres, tesoureiros e banda',
            'headings' => ['Sector', 'Cargo', 'Nome', 'Telefone', 'Coro'], 'rows' => $rows, 'grouped' => true];
    }

    private function makers(string $title, Collection $users): array
    {
        $rows = $users->values()->map(fn ($u, $i) => [$i + 1, $u->name, $u->phone_formatted, $u->area?->name ?? '',
            $u->culturalCategories->pluck('name')->implode(', ')])->all();

        return ['title' => $title, 'subtitle' => 'Total: '.count($rows),
            'headings' => ['Nº', 'Nome', 'Telefone', 'Área', 'Categorias'], 'rows' => $rows, 'grouped' => false];
    }

    private function makersByCategory(): array
    {
        $rows = [];
        $cats = CulturalCategory::where('is_choir_member', false)->ordered()
            ->with(['users' => fn ($q) => $q->with('area')->orderBy('name')])->get();
        foreach ($cats as $c) {
            foreach ($c->users->values() as $i => $u) {
                $rows[] = [$c->name, $i + 1, $u->name, $u->phone_formatted, $u->area?->name ?? ''];
            }
        }

        return ['title' => 'Fazedores de cultura por categoria', 'subtitle' => 'Um membro pode aparecer em várias categorias',
            'headings' => ['Categoria', 'Nº', 'Nome', 'Telefone', 'Área'], 'rows' => $rows, 'grouped' => true];
    }

    private function makersGrouped(): array
    {
        $rows = [];
        $users = $this->cultureMakers()->get();
        foreach ($users->groupBy(fn ($u) => $u->area?->name ?? '—')->sortKeys() as $area => $members) {
            foreach ($members->values() as $i => $u) {
                $rows[] = [$area, $i + 1, $u->name, $u->phone_formatted, $u->culturalCategories->pluck('name')->implode(', ')];
            }
        }

        return ['title' => 'Fazedores de cultura por área', 'subtitle' => 'Total: '.$users->count(),
            'headings' => ['Área', 'Nº', 'Nome', 'Telefone', 'Categorias'], 'rows' => $rows, 'grouped' => true];
    }

    private function makersStats(): array
    {
        $rows = [];
        $total = User::cultureMakers()->count();
        $rows[] = ['Geral', 'Total de fazedores de cultura', $total];
        foreach (CulturalCategory::where('is_choir_member', false)->ordered()->withCount('users')->get() as $c) {
            $rows[] = ['Por categoria', $c->name, $c->users_count];
        }
        foreach (Area::ordered()->withCount(['users' => fn ($q) => $q->cultureMakers()])->get() as $a) {
            $rows[] = ['Por área', $a->name, $a->users_count];
        }
        $rows[] = ['Por sexo', 'Homens', User::cultureMakers()->where('sex', 'M')->count()];
        $rows[] = ['Por sexo', 'Mulheres', User::cultureMakers()->where('sex', 'F')->count()];
        $rows[] = ['Coro', 'Também são coristas', User::cultureMakers()->where('is_choir_member', true)->count()];

        return ['title' => 'Estatísticas dos fazedores de cultura', 'subtitle' => "Total: {$total}",
            'headings' => ['Indicador', 'Descrição', 'Quantidade'], 'rows' => $rows, 'grouped' => true];
    }
}
