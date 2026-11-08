<?php

namespace App\Models;

use App\Support\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrgUnit extends Model
{
    use Auditable;

    protected $fillable = ['parent_id', 'name', 'shows_choirs', 'sort'];

    protected $casts = ['shows_choirs' => 'boolean'];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort');
    }

    public function positions(): HasMany
    {
        return $this->hasMany(Position::class)->orderBy('sort');
    }
}
