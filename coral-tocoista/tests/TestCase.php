<?php

namespace Tests;

use App\Models\Area;
use App\Models\Choir;
use App\Models\User;
use App\Models\VoiceType;
use App\Services\Otp\OtpSender;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected string $seeder = ReferenceDataSeeder::class;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    /** Último código enviado pelo driver "log" (os testes nunca lêem o hash). */
    protected function lastOtp(): ?string
    {
        return app(OtpSender::class)->lastCode;
    }

    protected function admin(array $attrs = []): User
    {
        return User::factory()->admin()->create($attrs);
    }

    protected function manager(array $attrs = []): User
    {
        return User::factory()->choirManager()->create($attrs);
    }

    protected function member(array $attrs = []): User
    {
        return User::factory()->create($attrs);
    }

    /** Dados mínimos válidos de uma ficha. */
    protected function validProfile(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Maria Fictícia Teste',
            'area_id' => Area::first()->id,
            'sex' => 'F',
            'is_choir_member' => '0',
            'baptized' => '0',
            'is_instrumentalist' => '0',
        ], $overrides);
    }

    protected function choristerProfile(array $overrides = []): array
    {
        return $this->validProfile(array_merge([
            'is_choir_member' => '1',
            'choir_id' => Choir::first()->id,
            'voice_type_id' => VoiceType::first()->id,
            'choir_join_date' => '2020-05-10',
        ], $overrides));
    }
}
