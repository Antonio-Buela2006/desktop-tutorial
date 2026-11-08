<?php

namespace App\Models;

use App\Support\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Position extends Model
{
    use Auditable;

    /** Grupos usados no relatório de liderança. */
    public const LEADERSHIP_GROUPS = [
        'responsaveis' => 'Responsáveis do Coro',
        'secretarios' => 'Secretários',
        'mestres' => 'Mestres do Coro',
        'tesoureiros' => 'Tesoureiros',
        'banda' => 'Banda',
    ];

    protected $fillable = ['org_unit_id', 'name', 'leadership_group', 'is_leadership', 'sort'];

    protected $casts = ['is_leadership' => 'boolean'];

    public function orgUnit(): BelongsTo
    {
        return $this->belongsTo(OrgUnit::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }
}
