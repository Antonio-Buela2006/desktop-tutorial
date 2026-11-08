<?php

namespace App\Services;

use App\Models\CulturalCategory;
use App\Models\Position;
use App\Models\Role;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Centraliza a gravação da ficha do membro e as regras de negócio associadas.
 */
class MemberService
{
    /** Cria um novo membro a partir de um telefone já validado por OTP. */
    public function register(string $phone, array $data, ?UploadedFile $photo = null): User
    {
        try {
            return DB::transaction(function () use ($phone, $data, $photo) {
                // Regra: o primeiro número validado no sistema torna-se Administrador Geral.
                // lockForUpdate evita que dois cadastros simultâneos fiquem ambos admin.
                $isFirst = ! User::query()->lockForUpdate()->exists();

                $user = new User;
                $user->fill($this->applyRules($data));
                $user->phone = $phone;
                $user->role_id = Role::idFor($isFirst ? Role::ADMIN : Role::MEMBER);
                $user->consent_at = now(); // consentimento obrigatório (validado no FormRequest)
                Audit::actingAs($user); // ainda sem sessão: a auditoria regista o próprio membro
                $user->save();

                if ($photo) {
                    $this->storePhoto($user, $photo);
                }
                $this->syncCategories($user, $data['categories'] ?? []);

                return $user;
            });
        } finally {
            Audit::actingAs(null);
        }
    }

    public function update(User $user, array $data, ?UploadedFile $photo = null, bool $removePhoto = false): User
    {
        return DB::transaction(function () use ($user, $data, $photo, $removePhoto) {
            $user->fill($this->applyRules($data));
            $user->save();

            if ($removePhoto) {
                $this->deletePhoto($user);
            }
            if ($photo) {
                $this->storePhoto($user, $photo);
            }
            $this->syncCategories($user, $data['categories'] ?? []);

            return $user;
        });
    }

    /**
     * Regras de negócio sobre os campos:
     *  - quem não é corista não fica com coro, voz nem data de ingresso;
     *  - data de baptismo só se baptizado = sim;
     *  - instrumento só se instrumentista = sim.
     */
    public function applyRules(array $data): array
    {
        $data = array_intersect_key($data, array_flip(User::PROFILE_FIELDS));

        foreach (['baptized', 'is_choir_member', 'is_instrumentalist'] as $bool) {
            if (array_key_exists($bool, $data)) {
                $data[$bool] = (bool) $data[$bool];
            }
        }
        if (array_key_exists('is_choir_member', $data) && ! $data['is_choir_member']) {
            $data['choir_id'] = $data['voice_type_id'] = $data['choir_join_date'] = null;
        }
        if (array_key_exists('baptized', $data) && ! $data['baptized']) {
            $data['baptism_date'] = null;
        }
        if (array_key_exists('is_instrumentalist', $data) && ! $data['is_instrumentalist']) {
            $data['instrument'] = null;
        }

        return $data;
    }

    /**
     * Sincroniza as categorias culturais. Quem é corista recebe sempre a categoria
     * "Corista" (e o cargo "Corista"); quem deixa de ser corista perde-os.
     */
    public function syncCategories(User $user, array $categoryIds): void
    {
        $choirCat = CulturalCategory::choirCategory();
        $ids = collect($categoryIds)->map(fn ($id) => (int) $id)
            ->reject(fn ($id) => $choirCat && $id === $choirCat->id);
        if ($choirCat && $user->is_choir_member) {
            $ids->push($choirCat->id);
        }
        $this->syncAudited($user, 'culturalCategories', $ids->unique()->values()->all(), 'categorias');

        $choirPos = Position::where('name', 'Corista')->first();
        if ($choirPos) {
            $user->is_choir_member
                ? $user->positions()->syncWithoutDetaching([$choirPos->id])
                : $user->positions()->detach($choirPos->id);
        }
    }

    /** Só o administrador chama isto (verificado na Policy). */
    public function syncPositions(User $user, array $positionIds): void
    {
        $ids = collect($positionIds)->map(fn ($id) => (int) $id);
        $choirPos = Position::where('name', 'Corista')->value('id');
        if ($choirPos) {
            $ids = $ids->reject(fn ($id) => $id === $choirPos);
            if ($user->is_choir_member) {
                $ids->push($choirPos);
            }
        }
        $this->syncAudited($user, 'positions', $ids->unique()->values()->all(), 'cargos');
    }

    public function setRole(User $user, int $roleId): void
    {
        $user->role_id = $roleId;
        $user->save(); // auditado pelo trait Auditable
    }

    public function setBlocked(User $user, bool $blocked): void
    {
        $before = $user->blocked_at?->format('Y-m-d H:i:s');
        $user->blocked_at = $blocked ? now() : null;
        $user->saveQuietly();
        Audit::log($blocked ? 'block' : 'unblock', $user, ['blocked_at' => $before],
            ['blocked_at' => $user->blocked_at?->format('Y-m-d H:i:s')], $user->name);

        if ($blocked) {
            DB::table('sessions')->where('user_id', $user->id)->delete(); // termina sessões abertas
        }
    }

    public function delete(User $user): void
    {
        DB::transaction(function () use ($user) {
            $user->load('positions', 'culturalCategories');
            $this->deletePhoto($user, audit: false);
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $user->delete(); // auditado com todos os valores anteriores
        });
    }

    // ---- Fotografia ----------------------------------------------------

    /**
     * Redimensiona para no máximo 600x600 e re-codifica em JPEG.
     * A re-codificação remove metadados (EXIF/GPS) e qualquer conteúdo embebido.
     */
    public function storePhoto(User $user, UploadedFile $file): void
    {
        $src = @imagecreatefromstring(file_get_contents($file->getRealPath()));
        if (! $src) {
            throw new \InvalidArgumentException('Imagem inválida.');
        }
        [$w, $h] = [imagesx($src), imagesy($src)];
        $scale = min(1, 600 / max($w, $h));
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));
        $dst = imagecreatetruecolor($nw, $nh);
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);

        ob_start();
        imagejpeg($dst, null, 82);
        $jpeg = ob_get_clean();
        imagedestroy($src);
        imagedestroy($dst);

        $old = $user->photo_path;
        $path = 'photos/'.$user->id.'-'.Str::random(20).'.jpg';
        Storage::disk('local')->put($path, $jpeg); // disco privado: servido só a quem tem permissão
        $user->photo_path = $path;
        $user->save();
        if ($old) {
            Storage::disk('local')->delete($old);
        }
    }

    public function deletePhoto(User $user, bool $audit = true): void
    {
        if (! $user->photo_path) {
            return;
        }
        Storage::disk('local')->delete($user->photo_path);
        $user->photo_path = null;
        $audit ? $user->save() : $user->saveQuietly();
    }

    // ---- Auxiliar ------------------------------------------------------

    private function syncAudited(User $user, string $relation, array $ids, string $label): void
    {
        $before = $user->{$relation}()->pluck('name')->sort()->values()->all();
        $result = $user->{$relation}()->sync($ids);
        if ($result['attached'] || $result['detached']) {
            $after = $user->{$relation}()->pluck('name')->sort()->values()->all();
            Audit::log('update', $user, [$label => $before], [$label => $after], "Alteração de {$label}: {$user->name}");
        }
        $user->unsetRelation($relation);
    }
}
