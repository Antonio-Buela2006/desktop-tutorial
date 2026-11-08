<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Area extends LookupModel
{
    use HasFactory;

    protected $table = 'areas';

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
