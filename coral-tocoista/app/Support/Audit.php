<?php

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

final class Audit
{
    /** Utilizador a registar quando ainda não há sessão (ex.: no próprio cadastro). */
    private static ?Model $actingAs = null;

    public static function actingAs(?Model $user): void
    {
        self::$actingAs = $user;
    }

    public static function log(string $operation, ?Model $subject = null, ?array $old = null, ?array $new = null, ?string $description = null): AuditLog
    {
        $user = Auth::user() ?? self::$actingAs;
        $request = app()->bound('request') ? request() : null;

        return AuditLog::create([
            'user_id' => $user?->getKey(),
            'user_name' => $user?->name,
            'operation' => $operation,
            'auditable_type' => $subject ? class_basename($subject) : null,
            'auditable_id' => $subject?->getKey(),
            'description' => $description ? mb_substr($description, 0, 255) : null,
            'old_values' => $old ?: null,
            'new_values' => $new ?: null,
            'ip' => $request?->ip(),
            'user_agent' => $request ? mb_substr((string) $request->userAgent(), 0, 255) : null,
            'created_at' => now(),
        ]);
    }
}
