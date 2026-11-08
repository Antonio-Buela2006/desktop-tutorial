<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Listas parametrizáveis pelo Administrador Geral.
 * Nada disto está "hardcoded" no código: coros, áreas, vozes, categorias,
 * cargos e unidades do organograma vêm sempre da base de dados.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Perfis de acesso (Administrador Geral, Responsável do Coro, Membro).
        // O "slug" é a chave usada pelas Policies; o nome é editável.
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 40)->unique();
            $table->string('name', 80);
            $table->string('description', 255)->nullable();
            $table->timestamps();
        });

        // Grupos culturais (preparação para vários grupos no futuro).
        Schema::create('cultural_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // Coros (Coro A, Coro B, ...), sempre ligados a um grupo cultural.
        Schema::create('choirs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cultural_group_id')->constrained()->restrictOnDelete();
            $table->string('name', 80);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->unique(['cultural_group_id', 'name']);
        });

        foreach (['areas', 'parishes', 'voice_types'] as $name) {
            Schema::create($name, function (Blueprint $table) {
                $table->id();
                $table->string('name', 120)->unique();
                $table->unsignedSmallInteger('sort')->default(0);
                $table->boolean('active')->default(true);
                $table->timestamps();
            });
        }

        Schema::create('cultural_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120)->unique();
            // Categoria atribuída automaticamente a quem é corista.
            $table->boolean('is_choir_member')->default(false);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // Unidades do organograma (Direcção da Instituição > Coordenação Cultural > ...).
        Schema::create('org_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('org_units')->nullOnDelete();
            $table->string('name', 120);
            // Se verdadeiro, o organograma mostra os coros por baixo desta unidade.
            $table->boolean('shows_choirs')->default(false);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        // Cargos (Responsável do Coro, Adjunto, Secretário, ...).
        Schema::create('positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('org_unit_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 120)->unique();
            // Categoria de liderança para o relatório "liderança".
            $table->string('leadership_group', 40)->nullable();
            $table->boolean('is_leadership')->default(true);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 80)->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['settings', 'positions', 'org_units', 'cultural_categories', 'voice_types',
            'parishes', 'areas', 'choirs', 'cultural_groups', 'roles'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
