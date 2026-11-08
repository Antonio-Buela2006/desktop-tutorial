<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\OtpCode;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class OtpAuthTest extends TestCase
{
    private function requestCode(string $phone = '923456789')
    {
        return $this->post('/entrar', ['phone' => $phone]);
    }

    public function test_login_page_is_public(): void
    {
        $this->get('/entrar')->assertOk()->assertSee('Receber código');
    }

    public function test_code_is_six_digits_and_stored_only_as_hash(): void
    {
        $this->requestCode('+244 923 456 789')->assertRedirect('/entrar/codigo');

        $code = $this->lastOtp();
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        $otp = OtpCode::where('phone', '923456789')->sole();
        $this->assertNotSame($code, $otp->code_hash);
        $this->assertStringNotContainsString($code, $otp->code_hash);
        $this->assertTrue(Hash::check($code, $otp->code_hash));
    }

    public function test_invalid_phone_is_rejected(): void
    {
        foreach (['123', '823456789', '92345678', 'abc'] as $bad) {
            $this->requestCode($bad)->assertSessionHasErrors('phone');
        }
        $this->assertSame(0, OtpCode::count());
    }

    public function test_existing_member_logs_in_and_goes_to_own_profile(): void
    {
        $user = $this->member(['phone' => '923456789']);
        $this->requestCode();
        $this->post('/entrar/codigo', ['code' => $this->lastOtp()])->assertRedirect(route('profile.edit'));

        $this->assertAuthenticatedAs($user);
        $this->assertDatabaseHas('audit_logs', ['operation' => 'login', 'user_id' => $user->id]);
    }

    public function test_new_number_opens_registration_with_validated_phone(): void
    {
        $this->requestCode('912000111');
        $this->post('/entrar/codigo', ['code' => $this->lastOtp()])->assertRedirect(route('register'));
        $this->assertGuest();
        $this->get('/cadastro')->assertOk()->assertSee('+244 912 000 111');
    }

    public function test_three_wrong_codes_lock_the_code(): void
    {
        $this->requestCode();
        $good = $this->lastOtp();
        $bad = $good === '000000' ? '111111' : '000000';

        $this->post('/entrar/codigo', ['code' => $bad])->assertSessionHasErrors(['code' => 'Código incorrecto. Restam 2 tentativa(s).']);
        $this->post('/entrar/codigo', ['code' => $bad])->assertSessionHasErrors('code');
        $this->post('/entrar/codigo', ['code' => $bad])->assertSessionHasErrors('code');

        // Mesmo o código certo já não serve.
        $this->post('/entrar/codigo', ['code' => $good])->assertSessionHasErrors('code');
        $this->assertGuest();
        $this->assertNotNull(OtpCode::sole()->invalidated_at);
        $this->assertSame(3, OtpCode::sole()->attempts);
        $this->assertSame(3, AuditLog::where('operation', 'otp_failed')->count());
    }

    public function test_expired_code_is_refused(): void
    {
        $this->requestCode();
        $code = $this->lastOtp();
        $this->travel(6)->minutes();

        $this->post('/entrar/codigo', ['code' => $code])->assertSessionHasErrors(['code' => 'O código expirou. Peça um novo código.']);
        $this->assertGuest();
    }

    public function test_validity_is_configurable_by_admin_setting(): void
    {
        Setting::put('otp_validity_minutes', '10');
        $this->requestCode();
        $code = $this->lastOtp();
        $this->travel(8)->minutes();
        $this->post('/entrar/codigo', ['code' => $code])->assertRedirect(route('register'));
    }

    public function test_only_one_code_per_minute_per_number(): void
    {
        $this->requestCode()->assertRedirect('/entrar/codigo');
        $this->requestCode()->assertSessionHasErrors('phone');
        $this->assertSame(1, OtpCode::count());

        $this->travel(61)->seconds();
        $this->requestCode()->assertRedirect('/entrar/codigo');
        $this->assertSame(2, OtpCode::count());
        // O pedido novo anula o anterior.
        $this->assertNotNull(OtpCode::orderBy('id')->first()->invalidated_at);
    }

    public function test_requests_are_rate_limited_per_ip(): void
    {
        RateLimiter::clear('otp-ip:127.0.0.1');
        config(['otp.ip_requests_per_hour' => 3]);
        foreach (['911111111', '911111112', '911111113'] as $p) {
            $this->requestCode($p)->assertRedirect();
        }
        $this->requestCode('911111114')->assertStatus(429);
    }

    public function test_blocked_user_does_not_receive_a_code(): void
    {
        User::factory()->blocked()->create(['phone' => '923456789']);
        $this->requestCode()->assertSessionHasErrors(['phone' => 'Este número está bloqueado. Contacte a administração.']);
        $this->assertSame(0, OtpCode::count());
        $this->assertNull($this->lastOtp());
    }

    public function test_debug_code_shown_only_when_app_debug_true(): void
    {
        config(['app.debug' => false]);
        $this->requestCode();
        $this->get('/entrar/codigo')->assertDontSee('Modo de teste');

        config(['app.debug' => true]);
        $this->travel(61)->seconds();
        $this->requestCode();
        $this->get('/entrar/codigo')->assertSee('Modo de teste')->assertSee($this->lastOtp());
    }

    public function test_logout(): void
    {
        $this->actingAs($this->member())->post('/sair')->assertRedirect('/entrar');
        $this->assertGuest();
    }
}
