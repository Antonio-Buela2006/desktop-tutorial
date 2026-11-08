<?php

namespace App\Http\Controllers;

use App\Models\Choir;
use App\Models\OrgUnit;
use App\Models\User;
use Illuminate\View\View;

class OrgChartController extends Controller
{
    public function index(): View
    {
        $units = OrgUnit::with(['positions.users:id,name'])->orderBy('sort')->get();
        $choirs = Choir::active()->ordered()
            ->withCount(['users as total' => fn ($q) => $q->where('is_choir_member', true)])->get();

        return view('orgchart', [
            'roots' => $units->whereNull('parent_id')->values(),
            'units' => $units,
            'choirs' => $choirs,
            'choristers' => User::where('is_choir_member', true)->count(),
        ]);
    }
}
