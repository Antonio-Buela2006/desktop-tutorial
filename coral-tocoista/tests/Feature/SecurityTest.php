<?php

namespace Tests\Feature;

use App\Services\Otp\OtpDeliveryException;
use App\Services\Otp\OtpSender;
use App\Services\Otp\OtpService;
use App\Services\Otp\WhatsAppOtpSender;
use App\Support\Phone;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    public function test_security_headers_are_present(): void
    {
        $r = $this->get('/entrar');
        $r->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $this->assertStringContainsString("frame-ancestors 'none'", $r->headers->get('Content-Security-Policy'));
        $this->assertStringContainsString("object-src 'none'", $r->headers->get('Content-Security-Policy'));
    }

    public function test_authenticated_pages_are_not_cached(): void
    {
        $this->actingAs($this->member())->get('/minha-ficha')->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_csrf_is_enforced(): void
    {
        // Os testes desactivam o CSRF por omissão; voltamos a activá-lo aqui.
        $this->app->instance(ValidateCsrfToken::class, new class($this->app, $this->app['encrypter']) extends ValidateCsrfToken
        {
            protected function runningUnitTests(): bool
            {
                return false;
            }
        });
        $this->post('/entrar', ['phone' => '923456789'])->assertStatus(419);
    }

    public function test_user_content_is_escaped(): void
    {
        $admin = $this->admin();
        $this->member(['name' => '<script>alert(1)</script>Fictício']);
        $this->actingAs($admin)->get('/membros')->assertOk()
            ->assertDontSee('<script>alert(1)</script>', false)
            ->assertSee('&lt;script&gt;alert(1)&lt;/script&gt;', false);
    }

    public function test_phone_normalization(): void
    {
        $this->assertSame('923456789', Phone::normalize('+244 923 456 789'));
        $this->assertSame('923456789', Phone::normalize('00244923456789'));
        $this->assertSame('923456789', Phone::normalize('244923456789'));
        $this->assertSame('923456789', Phone::normalize('923-456-789'));
        $this->assertNull(Phone::normalize('823456789'));
        $this->assertNull(Phone::normalize('9234567890'));
        $this->assertSame('+244 923 456 789', Phone::format('923456789'));
    }

    public function test_whatsapp_driver_sends_authentication_template(): void
    {
        Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.X']]], 200)]);
        $sender = new WhatsAppOtpSender(['token' => 'tok', 'phone_number_id' => '123', 'template' => 'codigo_acesso', 'language' => 'pt_PT', 'api_version' => 'v21.0']);
        $sender->send('923456789', '482913', 5);

        Http::assertSent(function ($req) {
            return $req->url() === 'https://graph.facebook.com/v21.0/123/messages'
                && $req->hasHeader('Authorization', 'Bearer tok')
                && $req['to'] === '244923456789'
                && $req['template']['name'] === 'codigo_acesso'
                && $req['template']['components'][0]['parameters'][0]['text'] === '482913';
        });
    }

    public function test_whatsapp_failure_is_reported_to_user_without_leaking(): void
    {
        config(['otp.driver' => 'whatsapp', 'otp.whatsapp.token' => 'x', 'otp.whatsapp.phone_number_id' => '1']);
        $this->app->forgetInstance(OtpSender::class);
        $this->app->forgetInstance(OtpService::class);
        Http::fake(['graph.facebook.com/*' => Http::response(['error' => ['message' => 'bad']], 400)]);

        $this->post('/entrar', ['phone' => '923456789'])
            ->assertSessionHasErrors(['phone' => 'Não foi possível enviar o código agora. Tente novamente dentro de alguns minutos.']);
    }

    public function test_whatsapp_not_configured_throws(): void
    {
        $this->expectException(OtpDeliveryException::class);
        (new WhatsAppOtpSender([]))->send('923456789', '123456', 5);
    }
}
