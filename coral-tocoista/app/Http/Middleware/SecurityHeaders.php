<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $h = $response->headers;
        $h->set('X-Content-Type-Options', 'nosniff');
        $h->set('X-Frame-Options', 'DENY');
        $h->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $h->set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
        $h->set('Cross-Origin-Opener-Policy', 'same-origin');
        // Alpine.js avalia expressões com Function(): exige 'unsafe-eval' em script-src.
        $vite = app()->environment('local') ? ' http://localhost:5173 ws://localhost:5173' : '';
        $h->set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-eval'{$vite}; "
            ."style-src 'self' 'unsafe-inline'{$vite}; img-src 'self' data: blob:; font-src 'self'; "
            ."connect-src 'self'{$vite}; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'");
        if ($request->isSecure()) {
            $h->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }
        // Fichas pessoais não devem ficar em cache do browser/proxies.
        if ($request->user()) {
            $h->set('Cache-Control', 'no-store, private');
        }

        return $response;
    }
}
