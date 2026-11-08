<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Seeder de PRODUÇÃO: apenas dados de referência (perfis, listas, organograma).
 * Não cria nenhum membro. Os dados fictícios de demonstração estão em DemoSeeder
 * e só correm explicitamente:  php artisan db:seed --class=DemoSeeder
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(ReferenceDataSeeder::class);
    }
}
