<?php

namespace Tests\Feature;

use App\Models\Position;
use App\Models\Role;
use App\Models\User;
use Tests\TestCase;

class PermissionsTest extends TestCase
{
    private const STAFF_PAGES = ['/dashboard', '/dashboard/dados', '/membros', '/organograma', '/relatorios', '/relatorios/coristas.pdf'];

    private const ADMIN_PAGES = ['/configuracoes', '/configuracoes/listas/areas', '/auditoria'];

    public function test_guests_are_redirected_to_login(): void
    {
        foreach (array_merge(self::STAFF_PAGES, self::ADMIN_PAGES, ['/minha-ficha']) as $url) {
            $this->get($url)->assertRedirect('/entrar');
        }
    }

    public function test_member_sees_only_own_profile(): void
    {
        $me = $this->member();
        $other = $this->member();

        $this->actingAs($me)->get('/minha-ficha')->assertOk()->assertSee($me->name);
        $this->get(route('members.show', $other))->assertForbidden();
        $this->get(route('members.edit', $other))->assertForbidden();
        $this->put(route('members.update', $other), $this->validProfile())->assertForbidden();
        $this->get(route('members.photo', $other))->assertForbidden();
        foreach (array_merge(self::STAFF_PAGES, self::ADMIN_PAGES) as $url) {
            $this->get($url)->assertForbidden();
        }
        $this->assertNotSame('Maria Fictícia Teste', $other->fresh()->name);
    }

    public function test_member_cannot_change_own_role_positions_or_state(): void
    {
        $me = $this->member();
        $adminRole = Role::idFor(Role::ADMIN);
        $leader = Position::where('name', 'Responsável do Coro')->first();

        $this->actingAs($me)->put('/minha-ficha', $this->validProfile([
            'role_id' => $adminRole, 'positions' => [$leader->id], 'blocked_at' => null,
            'phone' => '999999999', 'consent_at' => null,
        ]))->assertSessionHasNoErrors();

        $me->refresh();
        $this->assertSame(Role::idFor(Role::MEMBER), $me->role_id);
        $this->assertFalse($me->positions->contains($leader));
        $this->assertNotSame('999999999', $me->phone);
        $this->assertNotNull($me->consent_at);

        $this->put(route('members.access', $me), ['role_id' => $adminRole])->assertForbidden();
        $this->post(route('members.block', $me))->assertForbidden();
        $this->delete(route('members.destroy', $me))->assertForbidden();
        $this->assertFalse($me->fresh()->isAdmin());
    }

    public function test_choir_manager_can_consult_and_edit_choristers(): void
    {
        $mgr = $this->manager();
        $chorister = User::factory()->chorister()->create();

        $this->actingAs($mgr);
        foreach (self::STAFF_PAGES as $url) {
            $this->get($url)->assertOk();
        }
        $this->get(route('members.show', $chorister))->assertOk();
        $this->put(route('members.update', $chorister), $this->choristerProfile(['name' => 'Nome Corrigido']))
            ->assertRedirect(route('members.show', $chorister));
        $this->assertSame('Nome Corrigido', $chorister->fresh()->name);
    }

    public function test_choir_manager_cannot_manage_admin_areas(): void
    {
        $mgr = $this->manager();
        $target = $this->member();
        $admin = $this->admin();

        $this->actingAs($mgr);
        foreach (self::ADMIN_PAGES as $url) {
            $this->get($url)->assertForbidden();
        }
        $this->post('/configuracoes/listas/areas', ['name' => 'Área nova'])->assertForbidden();
        $this->put('/configuracoes', ['otp_validity_minutes' => 9])->assertForbidden();
        $this->put(route('members.access', $target), ['role_id' => Role::idFor(Role::ADMIN)])->assertForbidden();
        $this->post(route('members.block', $target))->assertForbidden();
        $this->delete(route('members.destroy', $target), ['confirm_phone' => $target->phone])->assertForbidden();
        // Não edita a ficha do administrador.
        $this->get(route('members.edit', $admin))->assertForbidden();
        $this->put(route('members.update', $admin), $this->validProfile())->assertForbidden();
        $this->assertTrue($target->fresh()->hasRole(Role::MEMBER));
        $this->assertDatabaseHas('areas', ['name' => 'Área 1']);
        $this->assertDatabaseMissing('areas', ['name' => 'Área nova']);
    }

    public function test_admin_can_do_everything(): void
    {
        $admin = $this->admin();
        $target = $this->member();
        $this->actingAs($admin);
        foreach (array_merge(self::STAFF_PAGES, self::ADMIN_PAGES) as $url) {
            $this->get($url)->assertOk();
        }
        $this->put(route('members.access', $target), [
            'role_id' => Role::idFor(Role::CHOIR_MANAGER),
            'positions' => [Position::where('name', 'Secretário')->value('id')],
        ])->assertRedirect();
        $target->refresh();
        $this->assertTrue($target->isChoirManager());
        $this->assertTrue($target->positions->contains('name', 'Secretário'));
    }

    public function test_admin_cannot_change_own_role_block_or_delete_self(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin)->put(route('members.access', $admin), ['role_id' => Role::idFor(Role::MEMBER)])->assertForbidden();
        $this->post(route('members.block', $admin))->assertForbidden();
        $this->delete(route('members.destroy', $admin), ['confirm_phone' => $admin->phone])->assertForbidden();
        $this->assertTrue($admin->fresh()->isAdmin());
    }

    public function test_blocked_user_loses_session_immediately(): void
    {
        $u = $this->member();
        $this->actingAs($u)->get('/minha-ficha')->assertOk();
        $u->forceFill(['blocked_at' => now()])->save();
        $this->get('/minha-ficha')->assertRedirect('/entrar');
        $this->assertGuest();
    }
}
