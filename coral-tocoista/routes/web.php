<?php

use App\Http\Controllers\Admin\LookupController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\AuditController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\MemberController;
use App\Http\Controllers\OrgChartController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RegistrationController;
use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

// ---- Entrada (link partilhado pelo administrador) ------------------------
Route::middleware('guest')->group(function () {
    Route::get('/entrar', [AuthController::class, 'showPhone'])->name('login');
    Route::post('/entrar', [AuthController::class, 'sendCode'])->middleware('throttle:otp-request')->name('login.send');
    Route::get('/entrar/codigo', [AuthController::class, 'showCode'])->name('login.code');
    Route::post('/entrar/codigo', [AuthController::class, 'verifyCode'])->middleware('throttle:otp-verify')->name('login.verify');
    Route::get('/cadastro', [RegistrationController::class, 'create'])->name('register');
    Route::post('/cadastro', [RegistrationController::class, 'store'])->name('register.store');
});

Route::get('/', fn () => redirect()->route(auth()->check() ? 'home' : 'login'));

Route::middleware('auth')->group(function () {
    Route::post('/sair', [AuthController::class, 'logout'])->name('logout');
    Route::get('/inicio', [DashboardController::class, 'home'])->name('home');

    // Ficha do próprio membro
    Route::get('/minha-ficha', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::put('/minha-ficha', [ProfileController::class, 'update'])->name('profile.update');
    Route::get('/membros/{user}/foto', [MemberController::class, 'photo'])->name('members.photo');

    // Administrador e Responsável do Coro
    Route::middleware('can:staff')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
        Route::get('/dashboard/dados', [DashboardController::class, 'stats'])->name('dashboard.stats');
        Route::get('/organograma', [OrgChartController::class, 'index'])->name('orgchart');
        Route::get('/relatorios', [ReportController::class, 'index'])->name('reports.index');
        Route::get('/relatorios/{report}.{format}', [ReportController::class, 'download'])
            ->whereIn('format', ['pdf', 'xlsx'])->middleware('throttle:exports')->name('reports.download');

        Route::get('/membros', [MemberController::class, 'index'])->name('members.index');
        Route::get('/membros/{user}', [MemberController::class, 'show'])->name('members.show');
        Route::get('/membros/{user}/editar', [MemberController::class, 'edit'])->name('members.edit');
        Route::put('/membros/{user}', [MemberController::class, 'update'])->name('members.update');
    });

    // Só o Administrador Geral
    Route::middleware('can:admin')->group(function () {
        Route::put('/membros/{user}/acesso', [MemberController::class, 'updateAccess'])->name('members.access');
        Route::post('/membros/{user}/bloquear', [MemberController::class, 'block'])->name('members.block');
        Route::post('/membros/{user}/desbloquear', [MemberController::class, 'unblock'])->name('members.unblock');
        Route::delete('/membros/{user}', [MemberController::class, 'destroy'])->name('members.destroy');

        Route::get('/configuracoes', [SettingsController::class, 'edit'])->name('settings.edit');
        Route::put('/configuracoes', [SettingsController::class, 'update'])->name('settings.update');
        Route::get('/configuracoes/listas/{list}', [LookupController::class, 'index'])->name('lookups.index');
        Route::post('/configuracoes/listas/{list}', [LookupController::class, 'store'])->name('lookups.store');
        Route::put('/configuracoes/listas/{list}/{id}', [LookupController::class, 'update'])->whereNumber('id')->name('lookups.update');
        Route::delete('/configuracoes/listas/{list}/{id}', [LookupController::class, 'destroy'])->whereNumber('id')->name('lookups.destroy');

        Route::get('/auditoria', [AuditController::class, 'index'])->name('audit.index');
    });
});
