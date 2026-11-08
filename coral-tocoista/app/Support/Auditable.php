<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;

/**
 * Regista automaticamente criação, edição e eliminação na auditoria,
 * com os valores antes e depois.
 */
trait Auditable
{
    public static function bootAuditable(): void
    {
        static::created(function (Model $m) {
            Audit::log('create', $m, null, $m->auditFilter($m->getAttributes()));
        });

        static::updated(function (Model $m) {
            $changes = $m->auditFilter($m->getChanges());
            if ($changes === []) {
                return;
            }
            $old = array_intersect_key($m->getOriginal(), $changes);
            Audit::log('update', $m, $m->auditFilter($old), $changes);
        });

        static::deleted(function (Model $m) {
            Audit::log('delete', $m, $m->auditFilter($m->getAttributes()), null);
        });
    }

    public function auditFilter(array $values): array
    {
        $exclude = array_merge(['updated_at', 'created_at'], $this->auditExclude ?? []);
        $out = [];
        foreach (array_diff_key($values, array_flip($exclude)) as $k => $v) {
            $out[$k] = $v instanceof \DateTimeInterface ? $v->format('Y-m-d H:i:s') : $v;
        }

        return $out;
    }
}
