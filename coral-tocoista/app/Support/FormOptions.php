<?php

namespace App\Support;

use App\Models\Area;
use App\Models\Choir;
use App\Models\CulturalCategory;
use App\Models\Parish;
use App\Models\Position;
use App\Models\Role;
use App\Models\User;
use App\Models\VoiceType;

/** Opções dos formulários e filtros, sempre lidas da base de dados. */
final class FormOptions
{
    public static function member(): array
    {
        return [
            'areas' => Area::active()->ordered()->get(['id', 'name']),
            'parishes' => Parish::active()->ordered()->get(['id', 'name']),
            'choirs' => Choir::active()->ordered()->get(['id', 'name']),
            'voices' => VoiceType::active()->ordered()->get(['id', 'name']),
            'categories' => CulturalCategory::active()->ordered()->get(['id', 'name', 'is_choir_member']),
            'maritalStatuses' => User::MARITAL_STATUSES,
        ];
    }

    public static function filters(): array
    {
        return self::member() + [
            'positions' => Position::orderBy('sort')->get(['id', 'name']),
            'roles' => Role::orderBy('id')->get(['id', 'name']),
        ];
    }
}
