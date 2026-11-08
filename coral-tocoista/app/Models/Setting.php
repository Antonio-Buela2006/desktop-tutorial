<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    public const DEFAULTS = [
        'otp_validity_minutes' => '5',
        'institution_name' => 'Igreja de Nosso Senhor Jesus Cristo no Mundo',
        'group_name' => 'Grupo Coral e Fazedores de Cultura',
    ];

    protected $fillable = ['key', 'value'];

    public static function get(string $key, ?string $default = null): ?string
    {
        $all = Cache::rememberForever('settings.all', fn () => static::pluck('value', 'key')->all());

        return $all[$key] ?? $default ?? (self::DEFAULTS[$key] ?? null);
    }

    public static function put(string $key, ?string $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
        Cache::forget('settings.all');
    }

    public static function otpValidityMinutes(): int
    {
        return max(1, min(30, (int) static::get('otp_validity_minutes')));
    }
}
