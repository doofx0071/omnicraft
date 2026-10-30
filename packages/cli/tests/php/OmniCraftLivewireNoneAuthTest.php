<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class OmniCraftLivewireNoneAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_none_setup_does_not_register_login_or_registration_routes(): void
    {
        $this->assertFalse(Route::has('login'));
        $this->assertFalse(Route::has('register'));

        $this->get('/login')->assertNotFound();
        $this->get('/register')->assertNotFound();
        $this->get('/')->assertOk();
    }

    public function test_the_generated_sqlite_database_persists_user_records_without_an_auth_layer(): void
    {
        $user = User::factory()->create(['email' => 'none-mode@example.test']);

        $this->assertDatabaseHas('users', ['id' => $user->id, 'email' => 'none-mode@example.test']);
    }
}
