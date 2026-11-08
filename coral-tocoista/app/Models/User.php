<?php

namespace App\Models;

use App\Support\Auditable;
use App\Support\Phone;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * Membro da instituição (e utilizador do sistema).
 *
 * IMPORTANTE (segurança): role_id, blocked_at e consent_at NÃO estão em $fillable,
 * pelo que nunca podem ser alterados por atribuição em massa a partir de um
 * formulário. Só o código do administrador os altera explicitamente.
 */
class User extends Authenticatable
{
    use Auditable, HasFactory, Notifiable;

    /** Campos que o próprio membro (ou o Responsável do Coro) pode editar. */
    public const PROFILE_FIELDS = [
        'name', 'phone_alt', 'email', 'sex', 'birth_date', 'marital_status', 'address',
        'profession', 'education', 'church_admission_date', 'baptized', 'baptism_date',
        'parish_id', 'area_id', 'is_choir_member', 'choir_id', 'voice_type_id',
        'is_instrumentalist', 'instrument', 'choir_join_date',
    ];

    public const MARITAL_STATUSES = ['Solteiro(a)', 'Casado(a)', 'União de facto', 'Divorciado(a)', 'Viúvo(a)'];

    protected $fillable = self::PROFILE_FIELDS;

    protected $hidden = ['remember_token'];

    /** Campos que não interessam à auditoria. */
    protected array $auditExclude = ['remember_token', 'last_login_at', 'updated_at', 'created_at'];

    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
            'church_admission_date' => 'date',
            'baptism_date' => 'date',
            'choir_join_date' => 'date',
            'baptized' => 'boolean',
            'is_choir_member' => 'boolean',
            'is_instrumentalist' => 'boolean',
            'consent_at' => 'datetime',
            'blocked_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    // ---- Relações -------------------------------------------------------

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    public function parish(): BelongsTo
    {
        return $this->belongsTo(Parish::class);
    }

    public function choir(): BelongsTo
    {
        return $this->belongsTo(Choir::class);
    }

    public function voiceType(): BelongsTo
    {
        return $this->belongsTo(VoiceType::class);
    }

    public function positions(): BelongsToMany
    {
        return $this->belongsToMany(Position::class)->withTimestamps()->orderBy('sort');
    }

    public function culturalCategories(): BelongsToMany
    {
        return $this->belongsToMany(CulturalCategory::class)->withTimestamps()->orderBy('sort');
    }

    // ---- Perfis ---------------------------------------------------------

    public function hasRole(string $slug): bool
    {
        return $this->role?->slug === $slug;
    }

    public function isAdmin(): bool
    {
        return $this->hasRole(Role::ADMIN);
    }

    public function isChoirManager(): bool
    {
        return $this->hasRole(Role::CHOIR_MANAGER);
    }

    /** Administrador ou Responsável do Coro. */
    public function isStaff(): bool
    {
        return $this->isAdmin() || $this->isChoirManager();
    }

    public function isBlocked(): bool
    {
        return $this->blocked_at !== null;
    }

    // ---- Apresentação ---------------------------------------------------

    public function getPhoneFormattedAttribute(): string
    {
        return Phone::format($this->phone);
    }

    public function getAgeAttribute(): ?int
    {
        return $this->birth_date?->age;
    }

    // ---- Scopes de pesquisa --------------------------------------------

    /** Fazedor de cultura: tem pelo menos uma categoria cultural além de "Corista". */
    public function scopeCultureMakers(Builder $q): Builder
    {
        return $q->whereHas('culturalCategories', fn ($c) => $c->where('is_choir_member', false));
    }

    public function scopeFilter(Builder $q, array $f): Builder
    {
        if (! empty($f['q'])) {
            $term = trim($f['q']);
            $digits = Phone::digits($term);
            $q->where(function ($w) use ($term, $digits) {
                $w->where('name', 'like', '%'.addcslashes($term, '%_\\').'%');
                if (strlen($digits) >= 3) {
                    $w->orWhere('phone', 'like', '%'.substr($digits, -9).'%');
                }
            });
        }
        foreach (['parish_id', 'area_id', 'choir_id', 'voice_type_id', 'role_id'] as $col) {
            if (! empty($f[$col])) {
                $q->where($col, (int) $f[$col]);
            }
        }
        if (! empty($f['position_id'])) {
            $q->whereHas('positions', fn ($p) => $p->where('positions.id', (int) $f['position_id']));
        }
        if (! empty($f['category_id'])) {
            $q->whereHas('culturalCategories', fn ($c) => $c->where('cultural_categories.id', (int) $f['category_id']));
        }
        if (($f['state'] ?? '') === 'blocked') {
            $q->whereNotNull('blocked_at');
        }

        return $q;
    }
}
