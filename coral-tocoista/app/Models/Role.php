<?php

namespace App\Models;

use App\Support\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    use Auditable;

    public const ADMIN = 'admin';

    public const CHOIR_MANAGER = 'responsavel';

    public const MEMBER = 'membro';

    protected $fillable = ['slug', 'name', 'description'];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public static function idFor(string $slug): int
    {
        return (int) static::where('slug', $slug)->value('id');
    }
}
