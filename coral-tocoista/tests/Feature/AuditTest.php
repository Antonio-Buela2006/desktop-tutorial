<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\AuditLog;
use App\Models\CulturalCategory;
use App\Models\Position;
use App\Models\Role;
use Tests\TestCase;

class AuditTest extends TestCase
{
    public function test_profile_edit_is_audited_with_before_and_after(): void
    {
        $u = $this->member(['name' => 'Nome Antigo', 'profession' => 'Professor']);
        $this->actingAs($u)->put('/minha-ficha', $this->validProfile(['name' => 'Nome Novo', 'profession' => 'Enfermeiro', 'area_id' => $u->area_id]))
            ->assertSessionHasNoErrors();

        $log = AuditLog::where('operation', 'update')->where('auditable_type', 'User')->where('auditable_id', $u->id)
            ->whereNotNull('old_values->name')->latest('id')->firstOrFail();
        $this->assertSame($u->id, $log->user_id);
        $this->assertSame('Nome Antigo', $log->old_values['name']);
        $this->assertSame('Nome Novo', $log->new_values['name']);
        $this->assertSame('Professor', $log->old_values['profession']);
        $this->assertSame('Enfermeiro', $log->new_values['profession']);
        $this->assertSame('127.0.0.1', $log->ip);
        $this->assertNotNull($log->created_at);
    }

    public function test_registration_creation_is_audited_by_the_new_member(): void
    {
        $this->post('/entrar', ['phone' => '955000111']);
        $this->post('/entrar/codigo', ['code' => $this->lastOtp()]);
        $this->post('/cadastro', $this->validProfile(['consent' => '1']));

        $log = AuditLog::where('operation', 'create')->where('auditable_type', 'User')->sole();
        $this->assertSame('955000111', $log->new_values['phone']);
        $this->assertSame($log->auditable_id, $log->user_id);
        $this->assertDatabaseHas('audit_logs', ['operation' => 'login', 'user_id' => $log->auditable_id]);
    }

    public function test_categories_and_positions_changes_are_audited(): void
    {
        $admin = $this->admin();
        $u = $this->member();
        $this->actingAs($admin)->put(route('members.update', $u), $this->validProfile([
            'area_id' => $u->area_id, 'categories' => [CulturalCategory::where('name', 'Fotógrafo')->value('id')],
        ]));
        $log = AuditLog::where('description', 'like', 'Alteração de categorias%')->sole();
        $this->assertSame([], $log->old_values['categorias']);
        $this->assertSame(['Fotógrafo'], $log->new_values['categorias']);
        $this->assertSame($admin->id, $log->user_id);

        $this->put(route('members.access', $u), ['positions' => [Position::where('name', 'Tesoureiro')->value('id')]]);
        $log = AuditLog::where('description', 'like', 'Alteração de cargos%')->sole();
        $this->assertSame(['Tesoureiro'], $log->new_values['cargos']);
    }

    public function test_role_change_and_lookup_change_are_audited(): void
    {
        $this->actingAs($this->admin());
        $u = $this->member();
        $this->put(route('members.access', $u), ['role_id' => Role::idFor('responsavel')]);
        $log = AuditLog::where('operation', 'update')->where('auditable_id', $u->id)->whereNotNull('new_values->role_id')->sole();
        $this->assertSame(Role::idFor('membro'), $log->old_values['role_id']);

        $area = Area::first();
        $this->put("/configuracoes/listas/areas/{$area->id}", ['name' => 'Área Renomeada', 'sort' => 1, 'active' => '1']);
        $log = AuditLog::where('auditable_type', 'Area')->where('operation', 'update')->sole();
        $this->assertSame('Área 1', $log->old_values['name']);
        $this->assertSame('Área Renomeada', $log->new_values['name']);
    }

    public function test_audit_screen_filters(): void
    {
        $admin = $this->admin(['name' => 'Admin Auditor']);
        $this->actingAs($admin);
        $this->get('/relatorios/coristas.xlsx');
        $u = $this->member(['name' => 'Membro Editado']);

        $this->get('/auditoria?operation=export')->assertOk()->assertSee('Exportação: Lista geral de coristas')->assertDontSee('Membro Editado');
        $this->get('/auditoria?user_id='.$admin->id)->assertOk()->assertSee('Admin Auditor');
        $this->get('/auditoria?from='.now()->addDay()->format('Y-m-d'))->assertOk()->assertSee('Sem registos.');
        $this->get('/auditoria?to='.now()->format('Y-m-d'))->assertOk()->assertSee('Exportação');
    }

    public function test_otp_code_never_appears_in_audit(): void
    {
        $this->post('/entrar', ['phone' => '955000222']);
        $code = $this->lastOtp();
        foreach (AuditLog::all() as $log) {
            $this->assertStringNotContainsString($code, json_encode([$log->old_values, $log->new_values, $log->description]));
        }
    }
}
