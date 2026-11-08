<?php

namespace App\Services;

use App\Models\Area;
use App\Models\Choir;
use App\Models\CulturalCategory;
use App\Models\User;
use App\Models\VoiceType;

/**
 * Totais do dashboard. Usa SEMPRE consultas directas à base de dados (sem cache),
 * para que qualquer alteração se reflicta imediatamente e bata certo com as listas
 * e relatórios (que usam as mesmas definições/scopes).
 */
class StatsService
{
    public function all(): array
    {
        $cultureMaker = fn ($q) => $q->where('is_choir_member', false);

        return [
            'totals' => [
                'members' => User::count(),
                'choristers' => User::where('is_choir_member', true)->count(),
                'culture_makers' => User::cultureMakers()->count(),
                'men' => User::where('sex', 'M')->count(),
                'women' => User::where('sex', 'F')->count(),
                'baptized' => User::where('baptized', true)->count(),
                'not_baptized' => User::where('baptized', false)->count(),
            ],
            'by_choir' => Choir::ordered()
                ->withCount(['users as total' => fn ($q) => $q->where('is_choir_member', true)])
                ->get()->map(fn ($c) => ['name' => $c->name, 'total' => $c->total])->all(),
            'by_voice' => VoiceType::ordered()
                ->withCount(['users as total' => fn ($q) => $q->where('is_choir_member', true)])
                ->get()->map(fn ($v) => ['name' => $v->name, 'total' => $v->total])->all(),
            'by_area' => Area::ordered()
                ->withCount([
                    'users as members',
                    'users as choristers' => fn ($q) => $q->where('is_choir_member', true),
                    'users as artists' => fn ($q) => $q->whereHas('culturalCategories', $cultureMaker),
                ])
                ->get()->map(fn ($a) => ['name' => $a->name, 'members' => $a->members,
                    'choristers' => $a->choristers, 'artists' => $a->artists])->all(),
            'by_category' => CulturalCategory::ordered()->withCount('users as total')
                ->get()->map(fn ($c) => ['name' => $c->name, 'total' => $c->total])->all(),
            'generated_at' => now()->format('d/m/Y H:i:s'),
        ];
    }
}
