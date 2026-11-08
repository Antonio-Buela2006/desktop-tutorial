<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CulturalCategory extends LookupModel
{
    protected $fillable = ['name', 'sort', 'active', 'is_choir_member'];

    protected $casts = ['active' => 'boolean', 'sort' => 'integer', 'is_choir_member' => 'boolean'];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    /** Categoria atribuída automaticamente a todos os coristas. */
    public static function choirCategory(): ?self
    {
        return static::where('is_choir_member', true)->first();
    }
}
