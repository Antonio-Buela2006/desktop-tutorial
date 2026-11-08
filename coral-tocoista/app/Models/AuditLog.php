<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    public const UPDATED_AT = null;

    public const OPERATIONS = [
        'create' => 'Criação',
        'update' => 'Edição',
        'delete' => 'Eliminação',
        'login' => 'Entrada',
        'logout' => 'Saída',
        'export' => 'Exportação',
        'settings' => 'Configuração',
        'block' => 'Bloqueio',
        'unblock' => 'Desbloqueio',
        'otp_request' => 'Pedido de código',
        'otp_failed' => 'Código errado',
    ];

    protected $fillable = ['user_id', 'user_name', 'operation', 'auditable_type', 'auditable_id',
        'description', 'old_values', 'new_values', 'ip', 'user_agent', 'created_at'];

    protected $casts = ['old_values' => 'array', 'new_values' => 'array', 'created_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function operationLabel(): string
    {
        return self::OPERATIONS[$this->operation] ?? $this->operation;
    }
}
