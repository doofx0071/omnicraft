<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OmniCraftLivewireNativeAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_can_register_with_hashed_passwords_and_an_authenticated_session(): void
    {
        $this->get('/register')->assertOk();
        $this->get('/login')->assertOk();

        $this->post(route('register.store'), [
            'name' => 'OmniCraft Auth User',
            'email' => 'native-auth@example.test',
            'password' => 'local-test-password',
            'password_confirmation' => 'local-test-password',
        ])->assertSessionHasNoErrors()
            ->assertRedirect(route('dashboard', absolute: false));

        $this->assertAuthenticated();
        $this->assertDatabaseHas('users', ['email' => 'native-auth@example.test']);

        $user = User::query()->where('email', 'native-auth@example.test')->firstOrFail();
        $this->assertTrue(Hash::check('local-test-password', $user->password));
        $this->assertNotSame('local-test-password', $user->password);
    }

    public function test_protected_dashboard_requires_a_verified_login_and_logout_clears_the_session(): void
    {
        $this->get('/dashboard')->assertRedirect(route('login'));

        $user = User::factory()->create([
            'email' => 'verified-user@example.test',
            'email_verified_at' => now(),
            'password' => Hash::make('local-test-password'),
        ]);

        $this->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'local-test-password',
        ])->assertSessionHasNoErrors()
            ->assertRedirect(route('dashboard', absolute: false));

        $this->assertAuthenticatedAs($user);
        $this->get('/dashboard')->assertOk();

        $this->post(route('logout'))->assertRedirect(route('home'));
        $this->assertGuest();
        $this->get('/dashboard')->assertRedirect(route('login'));
    }
}
