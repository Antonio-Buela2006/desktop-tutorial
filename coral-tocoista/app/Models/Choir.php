<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Choir extends LookupModel
{
    protected $fillable = ['name', 'sort', 'active', 'cultural_group_id'];

    public function group(): BelongsTo
    {
        return $this->belongsTo(CulturalGroup::class, 'cultural_group_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
