<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\User;

/**
 * Permissões sobre fichas de membros.
 *  - Administrador Geral: tudo.
 *  - Responsável do Coro: consulta todos, edita dados de coristas/membros (não de administradores
 *    nem de outros responsáveis); nunca altera perfis, cargos ou bloqueios.
 *  - Corista/Membro: só vê e edita a própria ficha.
 */
class UserPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->isStaff();
    }

    public function view(User $actor, User $target): bool
    {
        return $actor->isStaff() || $actor->is($target);
    }

    public function update(User $actor, User $target): bool
    {
        if ($actor->isAdmin() || $actor->is($target)) {
            return true;
        }

        return $actor->isChoirManager() && $target->hasRole(Role::MEMBER);
    }

    /** Perfil de acesso e cargos: só o administrador, e nunca o seu próprio perfil. */
    public function manageAccess(User $actor, User $target): bool
    {
        return $actor->isAdmin();
    }

    public function changeRole(User $actor, User $target): bool
    {
        // Impede que o administrador se despromova e deixe o sistema sem administrador.
        return $actor->isAdmin() && ! $actor->is($target);
    }

    public function block(User $actor, User $target): bool
    {
        return $actor->isAdmin() && ! $actor->is($target);
    }

    public function delete(User $actor, User $target): bool
    {
        return $actor->isAdmin() && ! $actor->is($target);
    }
}
