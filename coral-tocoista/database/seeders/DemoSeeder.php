<?php

namespace Database\Seeders;

use App\Models\CulturalCategory;
use App\Models\Position;
use App\Models\User;
use App\Services\MemberService;
use Illuminate\Database\Seeder;

/**
 * DADOS FICTÍCIOS DE DEMONSTRAÇÃO — nunca correr em produção com dados reais.
 *   php artisan db:seed --class=DemoSeeder
 * Todos os números começam por 9000 para serem facilmente identificáveis e eliminados.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction() && ! $this->command?->confirm('Está em PRODUÇÃO. Inserir dados fictícios?', false)) {
            return;
        }

        $this->call(ReferenceDataSeeder::class);
        $service = app(MemberService::class);
        $faker = fake('pt_PT');
        $phone = fn (int $n) => '9000'.str_pad((string) $n, 5, '0', STR_PAD_LEFT);

        // Administrador de demonstração: +244 900 000 001
        if (! User::where('phone', $phone(1))->exists()) {
            User::factory()->admin()->chorister()->baptized()->create(['name' => 'Administrador Demonstração', 'phone' => $phone(1)]);
        }
        // Responsável do Coro de demonstração: +244 900 000 002
        if (! User::where('phone', $phone(2))->exists()) {
            User::factory()->choirManager()->chorister()->create(['name' => 'Responsável Demonstração', 'phone' => $phone(2)]);
        }

        $others = CulturalCategory::where('is_choir_member', false)->pluck('id');
        for ($i = 3; $i <= 60; $i++) {
            if (User::where('phone', $phone($i))->exists()) {
                continue;
            }
            $f = User::factory();
            $f = $i % 3 === 0 ? $f : $f->chorister();
            $f = $i % 2 === 0 ? $f->baptized() : $f;
            $u = $f->create(['phone' => $phone($i), 'name' => $faker->name()]);
            $cats = $i % 4 === 0 ? $others->random(rand(1, 2))->all() : [];
            $service->syncCategories($u, $cats);
        }
        foreach ([1, 2] as $n) {
            $service->syncCategories(User::where('phone', $phone($n))->first(), []);
        }

        // Atribuir alguns cargos de liderança a membros fictícios.
        $leaders = User::where('phone', 'like', '9000%')->where('is_choir_member', true)->orderBy('id')->get();
        foreach (Position::where('is_leadership', true)->orderBy('sort')->get() as $k => $pos) {
            if ($k === 3) {
                continue; // deixa um cargo vago para mostrar "Vago" no organograma
            }
            if ($u = $leaders->get($k + 1)) {
                $u->positions()->syncWithoutDetaching([$pos->id]);
            }
        }
    }
}
