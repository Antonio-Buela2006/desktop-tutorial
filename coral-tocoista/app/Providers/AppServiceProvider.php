<?php

namespace App\Providers;

use App\Models\User;
use App\Services\Otp\LogOtpSender;
use App\Services\Otp\OtpSender;
use App\Services\Otp\WhatsAppOtpSender;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Escolha do driver de envio do OTP (OTP_DRIVER=whatsapp|log).
        $this->app->singleton(OtpSender::class, function () {
            return match (config('otp.driver')) {
                'whatsapp' => new WhatsAppOtpSender(config('otp.whatsapp')),
                default => new LogOtpSender,
            };
        });
    }

    public function boot(): void
    {
        Paginator::defaultView('pagination.simple');

        if ($this->app->isProduction()) {
            URL::forceScheme('https');
        }

        // Permissões gerais (as permissões sobre fichas estão em UserPolicy).
        Gate::define('admin', fn (User $u) => $u->isAdmin());
        Gate::define('staff', fn (User $u) => $u->isStaff());

        // Limites de pedidos
        RateLimiter::for('otp-request', fn (Request $r) => Limit::perHour(config('otp.ip_requests_per_hour'))->by('otp-ip:'.$r->ip()));
        RateLimiter::for('otp-verify', fn (Request $r) => Limit::perMinute(10)->by('otp-verify:'.$r->ip()));
        RateLimiter::for('exports', fn (Request $r) => Limit::perMinute(20)->by('export:'.($r->user()?->id ?: $r->ip())));
    }
}
