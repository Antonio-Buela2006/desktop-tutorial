<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Parish extends LookupModel
{
    use HasFactory;

    protected $table = 'parishes';

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
