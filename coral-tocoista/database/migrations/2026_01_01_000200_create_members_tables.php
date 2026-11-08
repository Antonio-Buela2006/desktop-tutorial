<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cada membro é também um utilizador (entra com telefone + OTP, sem password).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_id')->constrained()->restrictOnDelete();

            // Dados pessoais
            $table->string('name', 160)->index();
            // Telefone angolano normalizado: 9 dígitos, começa por 9. Único.
            $table->char('phone', 9)->unique();
            $table->char('phone_alt', 9)->nullable();
            $table->string('email', 160)->nullable();
            $table->string('photo_path')->nullable();
            $table->enum('sex', ['M', 'F'])->nullable()->index();
            $table->date('birth_date')->nullable();
            $table->string('marital_status', 30)->nullable();
            $table->string('address', 255)->nullable();
            $table->string('profession', 120)->nullable();
            $table->string('education', 120)->nullable();

            // Dados religiosos
            $table->date('church_admission_date')->nullable();
            $table->boolean('baptized')->default(false)->index();
            $table->date('baptism_date')->nullable();
            $table->foreignId('parish_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('area_id')->constrained()->restrictOnDelete();

            // Dados corais
            $table->boolean('is_choir_member')->default(false)->index();
            $table->foreignId('choir_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('voice_type_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_instrumentalist')->default(false);
            $table->string('instrument', 120)->nullable();
            $table->date('choir_join_date')->nullable();

            // Estado, consentimento e sessão
            $table->timestamp('consent_at')->nullable();
            $table->timestamp('blocked_at')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('position_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('position_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'position_id']);
        });

        Schema::create('cultural_category_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cultural_category_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'cultural_category_id']);
        });

        // Códigos OTP — o código NUNCA é guardado em claro, só o hash.
        Schema::create('otp_codes', function (Blueprint $table) {
            $table->id();
            $table->char('phone', 9)->index();
            $table->string('code_hash');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->timestamp('invalidated_at')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('user_name', 160)->nullable(); // preservado mesmo que o utilizador seja eliminado
            $table->string('operation', 40)->index();
            $table->string('auditable_type', 80)->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->string('description', 255)->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
            $table->index(['auditable_type', 'auditable_id']);
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        foreach (['sessions', 'audit_logs', 'otp_codes', 'cultural_category_user', 'position_user', 'users'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
