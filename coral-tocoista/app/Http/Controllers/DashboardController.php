<?php

namespace App\Http\Controllers;

use App\Services\StatsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function home(Request $request): RedirectResponse
    {
        return redirect()->route($request->user()->isStaff() ? 'dashboard' : 'profile.edit');
    }

    public function index(StatsService $stats): View
    {
        return view('dashboard', ['stats' => $stats->all()]);
    }

    /** Actualização "em tempo real" do dashboard (consultado periodicamente pela página). */
    public function stats(StatsService $stats): JsonResponse
    {
        return response()->json($stats->all());
    }
}
