<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\AuditLog;
use App\Models\Choir;
use App\Models\CulturalCategory;
use App\Models\Parish;
use App\Models\Position;
use App\Models\Setting;
use App\Models\User;
use Tests\TestCase;

class AdminTest extends TestCase
{
    public function test_member_list_search_and_filters(): void
    {
        $this->actingAs($this->admin(['name' => 'Admin Zulmira']));
        $coroB = Choir::where('name', 'Coro B')->first();
        $ana = User::factory()->chorister($coroB)->create(['name' => 'Ana Bela Fictícia', 'phone' => '923111222']);
        $joao = User::factory()->create(['name' => 'João Poeta Fictício', 'phone' => '944555666']);
        $poet = CulturalCategory::where('name', 'Poeta')->first();
        $joao->culturalCategories()->attach($poet);

        $this->get('/membros?q=Bela')->assertSee('Ana Bela Fictícia')->assertDontSee('João Poeta Fictício');
        $this->get('/membros?q=944555')->assertSee('João Poeta Fictício')->assertDontSee('Ana Bela Fictícia');
        $this->get('/membros?q=%2B244 923 111 222')->assertSee('Ana Bela Fictícia');
        $this->get('/membros?choir_id='.$coroB->id)->assertSee('Ana Bela Fictícia')->assertDontSee('João Poeta Fictício');
        $this->get('/membros?category_id='.$poet->id)->assertSee('João Poeta Fictício')->assertDontSee('Ana Bela Fictícia');
        $this->get('/membros?voice_type_id='.$ana->voice_type_id)->assertSee('Ana Bela Fictícia');
        $this->get('/membros?area_id='.$joao->area_id)->assertSee('João Poeta Fictício');
        $pos = Position::where('name', 'Tesoureiro')->first();
        $ana->positions()->attach($pos);
        $this->get('/membros?position_id='.$pos->id)->assertSee('Ana Bela Fictícia')->assertDontSee('João Poeta Fictício');
        // Pesquisa com caracteres especiais não rebenta (consultas parametrizadas)
        $this->get("/membros?q=' OR 1=1 --")->assertOk()->assertSee('0</strong> membro(s)', false);
    }

    public function test_block_and_unblock(): void
    {
        $this->actingAs($this->admin());
        $u = $this->member();
        $this->post(route('members.block', $u))->assertRedirect();
        $this->assertTrue($u->fresh()->isBlocked());
        $this->post(route('members.unblock', $u))->assertRedirect();
        $this->assertFalse($u->fresh()->isBlocked());
        $this->assertDatabaseHas('audit_logs', ['operation' => 'block', 'auditable_id' => $u->id]);
        $this->assertDatabaseHas('audit_logs', ['operation' => 'unblock', 'auditable_id' => $u->id]);
    }

    public function test_delete_requires_confirmation(): void
    {
        $this->actingAs($this->admin());
        $u = $this->member(['phone' => '923000111']);
        $this->delete(route('members.destroy', $u), ['confirm_phone' => '923000999'])->assertSessionHasErrors('confirm_phone');
        $this->assertModelExists($u);

        $this->delete(route('members.destroy', $u), ['confirm_phone' => '923 000 111'])->assertRedirect(route('members.index'));
        $this->assertModelMissing($u);
        $this->assertDatabaseHas('audit_logs', ['operation' => 'delete', 'auditable_type' => 'User', 'auditable_id' => $u->id]);
    }

    public function test_lookup_lists_crud(): void
    {
        $this->actingAs($this->admin());
        $this->post('/configuracoes/listas/paroquias', ['name' => 'Paróquia Fictícia', 'sort' => 2])->assertRedirect();
        $p = Parish::where('name', 'Paróquia Fictícia')->sole();
        $this->put("/configuracoes/listas/paroquias/{$p->id}", ['name' => 'Paróquia Renomeada', 'sort' => 3, 'active' => '0'])->assertRedirect();
        $this->assertFalse($p->fresh()->active);
        $this->delete("/configuracoes/listas/paroquias/{$p->id}")->assertRedirect();
        $this->assertModelMissing($p);

        // Coros vêm da base de dados: um terceiro coro aparece logo nas opções.
        $this->post('/configuracoes/listas/coros', ['name' => 'Coro C'])->assertRedirect();
        $this->get('/minha-ficha')->assertSee('Coro C');

        // Item em uso não pode ser eliminado
        $area = Area::first();
        $this->member(['area_id' => $area->id]);
        $this->delete("/configuracoes/listas/areas/{$area->id}")->assertSessionHasErrors('list');
        $this->assertModelExists($area);

        // A categoria "Corista" é protegida
        $c = CulturalCategory::where('is_choir_member', true)->first();
        $this->delete("/configuracoes/listas/categorias/{$c->id}")->assertSessionHasErrors('list');

        $this->get('/configuracoes/listas/inexistente')->assertNotFound();
    }

    public function test_settings_update_is_audited(): void
    {
        $this->actingAs($this->admin());
        $this->put('/configuracoes', ['otp_validity_minutes' => 7, 'institution_name' => 'Instituição X', 'group_name' => 'Grupo Y'])->assertRedirect();
        $this->assertSame(7, Setting::otpValidityMinutes());
        $log = AuditLog::where('operation', 'settings')->sole();
        $this->assertSame('5', $log->old_values['otp_validity_minutes']);
        $this->assertSame('7', $log->new_values['otp_validity_minutes']);

        $this->put('/configuracoes', ['otp_validity_minutes' => 99, 'institution_name' => 'X', 'group_name' => 'Y'])->assertSessionHasErrors('otp_validity_minutes');
    }

    public function test_org_chart_shows_occupants_and_vacant_positions(): void
    {
        $this->actingAs($this->admin());
        $u = User::factory()->chorister()->create(['name' => 'Mestre Fictício']);
        $u->positions()->attach(Position::where('name', 'Mestre do Coro')->value('id'));

        $this->get('/organograma')->assertOk()
            ->assertSeeInOrder(['Direcção da Instituição', 'Coordenação Cultural', 'Responsável do Coro e Adjunto',
                'Secretaria', 'Direcção Musical', 'Tesouraria', 'Banda', 'Coristas', 'Coro A', 'Coro B'])
            ->assertSee('Mestre Fictício')
            ->assertSee('Vago');
    }
}
