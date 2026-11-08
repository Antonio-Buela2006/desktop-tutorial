<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class CulturalGroup extends LookupModel
{
    protected $fillable = ['name', 'active'];

    public function choirs(): HasMany
    {
        return $this->hasMany(Choir::class);
    }
}
