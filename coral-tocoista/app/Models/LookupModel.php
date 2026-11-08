<?php

namespace App\Models;

use App\Support\Auditable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Base para as listas parametrizáveis (áreas, paróquias, vozes, ...).
 */
abstract class LookupModel extends Model
{
    use Auditable;

    protected $fillable = ['name', 'sort', 'active'];

    protected $casts = ['active' => 'boolean', 'sort' => 'integer'];

    public function scopeOrdered(Builder $q): Builder
    {
        return $q->orderBy('sort')->orderBy('name');
    }

    public function scopeActive(Builder $q): Builder
    {
        return $q->where('active', true);
    }
}
