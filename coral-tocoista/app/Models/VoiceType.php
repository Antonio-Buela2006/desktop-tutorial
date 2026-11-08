<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VoiceType extends LookupModel
{
    use HasFactory;

    protected $table = 'voice_types';

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
