<?php

namespace Tests\Feature;

use App\Models\CulturalCategory;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    /** Simula a validação OTP de um número novo. */
    private function verify(string $phone = '931234567'): void
    {
        $this->post('/entrar', ['phone' => $phone]);
        $this->post('/entrar/codigo', ['code' => $this->lastOtp()])->assertRedirect(route('register'));
    }

    private function register(array $data)
    {
        return $this->post('/cadastro', $data + ['consent' => '1']);
    }

    public function test_registration_requires_validated_phone(): void
    {
        $this->get('/cadastro')->assertRedirect('/entrar');
        $this->post('/cadastro', $this->validProfile(['consent' => '1']))->assertRedirect('/entrar');
        $this->assertSame(0, User::count());
    }

    public function test_new_number_registers_end_to_end_and_first_user_becomes_admin(): void
    {
        $this->verify();
        $this->register($this->validProfile())->assertRedirect(route('dashboard'));

        $user = User::sole();
        $this->assertAuthenticatedAs($user);
        $this->assertSame('931234567', $user->phone);
        $this->assertTrue($user->isAdmin(), 'O primeiro número validado deve ficar Administrador Geral.');
        $this->assertNotNull($user->consent_at);
    }

    public function test_second_user_becomes_regular_member(): void
    {
        $this->admin();
        $this->verify();
        $this->register($this->validProfile())->assertRedirect(route('profile.edit'));
        $this->assertTrue(User::where('phone', '931234567')->sole()->hasRole(Role::MEMBER));
    }

    public function test_required_fields_name_and_area(): void
    {
        $this->verify();
        $this->register(['is_choir_member' => '0'])->assertSessionHasErrors(['name', 'area_id']);
        $this->assertSame(0, User::count());
    }

    public function test_consent_is_mandatory(): void
    {
        $this->verify();
        $this->post('/cadastro', $this->validProfile())->assertSessionHasErrors('consent');
        $this->assertSame(0, User::count());
    }

    public function test_non_chorister_registers_without_choir_or_voice(): void
    {
        $poet = CulturalCategory::where('name', 'Poeta')->first();
        $this->verify();
        $this->register($this->validProfile([
            // mesmo que venham valores de coro, são descartados para quem não é corista
            'choir_id' => '', 'voice_type_id' => '', 'categories' => [$poet->id],
        ]))->assertSessionHasNoErrors();

        $u = User::sole();
        $this->assertFalse($u->is_choir_member);
        $this->assertNull($u->choir_id);
        $this->assertNull($u->voice_type_id);
        $this->assertNull($u->choir_join_date);
        $this->assertSame(['Poeta'], $u->culturalCategories->pluck('name')->all());
    }

    public function test_chorister_cannot_register_without_choir_voice_and_join_date(): void
    {
        $this->verify();
        $this->register($this->validProfile(['is_choir_member' => '1']))
            ->assertSessionHasErrors(['choir_id', 'voice_type_id', 'choir_join_date']);
        $this->assertSame(0, User::count());
    }

    public function test_chorister_automatically_gets_corista_category_and_position(): void
    {
        $this->verify();
        $this->register($this->choristerProfile())->assertSessionHasNoErrors();

        $u = User::sole();
        $this->assertTrue($u->culturalCategories->contains('name', 'Corista'));
        $this->assertTrue($u->positions->contains('name', 'Corista'));
    }

    public function test_leaving_the_choir_removes_choir_data_and_category(): void
    {
        $u = User::factory()->chorister()->create();
        $this->actingAs($u)->put('/minha-ficha', $this->choristerProfile())->assertSessionHasNoErrors();
        $this->assertTrue($u->fresh()->culturalCategories->contains('name', 'Corista'));

        $this->put('/minha-ficha', $this->validProfile(['choir_id' => $u->choir_id]))->assertSessionHasNoErrors();
        $u->refresh();
        $this->assertNull($u->choir_id);
        $this->assertFalse($u->culturalCategories->contains('name', 'Corista'));
        $this->assertFalse($u->positions->contains('name', 'Corista'));
    }

    public function test_baptism_date_only_kept_when_baptized(): void
    {
        $this->verify();
        $this->register($this->validProfile(['baptized' => '0', 'baptism_date' => '2010-01-01']))->assertSessionHasNoErrors();
        $this->assertNull(User::sole()->baptism_date);

        $u = User::sole();
        $this->put('/minha-ficha', $this->validProfile(['baptized' => '1', 'baptism_date' => '15/08/2012']))->assertSessionHasNoErrors();
        $this->assertSame('15/08/2012', $u->fresh()->baptism_date->format('d/m/Y'));
    }

    public function test_dates_accept_dd_mm_yyyy_and_reject_future(): void
    {
        $this->verify();
        $this->register($this->validProfile(['birth_date' => '31/12/2090']))->assertSessionHasErrors('birth_date');
        $this->register($this->validProfile(['birth_date' => '25/12/1990']))->assertSessionHasNoErrors();
        $this->assertSame('1990-12-25', User::sole()->birth_date->format('Y-m-d'));
    }

    public function test_phone_belongs_to_a_single_registration(): void
    {
        $this->member(['phone' => '931234567']);
        // Um número já cadastrado entra directamente (não volta a abrir cadastro).
        $this->post('/entrar', ['phone' => '931234567']);
        $this->post('/entrar/codigo', ['code' => $this->lastOtp()])->assertRedirect(route('profile.edit'));
        $this->assertSame(1, User::where('phone', '931234567')->count());

        $this->expectException(UniqueConstraintViolationException::class);
        User::factory()->create(['phone' => '931234567']);
    }

    public function test_photo_is_resized_and_stored_privately(): void
    {
        Storage::fake('local');
        $this->verify();
        $this->register($this->validProfile(['photo' => UploadedFile::fake()->image('eu.png', 1600, 1200)]))->assertSessionHasNoErrors();

        $u = User::sole();
        Storage::disk('local')->assertExists($u->photo_path);
        [$w, $h] = getimagesizefromstring(Storage::disk('local')->get($u->photo_path));
        $this->assertSame([600, 450], [$w, $h]);
        $this->get(route('members.photo', $u))->assertOk()->assertHeader('Content-Type', 'image/jpeg');
    }

    public function test_photo_over_2mb_or_not_image_is_rejected(): void
    {
        $this->verify();
        $this->register($this->validProfile(['photo' => UploadedFile::fake()->image('big.jpg')->size(2500)]))->assertSessionHasErrors('photo');
        $this->register($this->validProfile(['photo' => UploadedFile::fake()->create('x.php', 10, 'application/x-php')]))->assertSessionHasErrors('photo');
        $this->assertSame(0, User::count());
    }

    public function test_registration_form_renders_all_steps(): void
    {
        $this->verify();
        $this->get('/cadastro')->assertOk()
            ->assertSee('1. Dados pessoais')->assertSee('2. Dados religiosos')
            ->assertSee('3. Dados corais')->assertSee('4. Fazedor de cultura')
            ->assertSee('Autorizo o tratamento');
    }
}
