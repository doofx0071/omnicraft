<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OmniCraftLaravelSanctumAuthTest extends TestCase
{
    use RefreshDatabase;

    private function spaHeaders(): array
    {
        return [
            'Origin' => 'http://127.0.0.1:5173',
            'Referer' => 'http://127.0.0.1:5173/',
            'Accept' => 'application/json',
        ];
    }

    private function spaGet(string $uri)
    {
        return $this->withHeaders($this->spaHeaders())->getJson($uri);
    }

    private function spaPost(string $uri, array $data)
    {
        return $this->withHeaders($this->spaHeaders())->postJson($uri, $data);
    }

    private function spaDelete(string $uri)
    {
        return $this->withHeaders($this->spaHeaders())->deleteJson($uri);
    }

    public function test_registration_hashes_password_and_sign_in_restores_the_authenticated_user(): void
    {
        $this->spaPost('/api/auth/register', [
                'name' => 'Generated Test User',
                'email' => 'generated-auth@example.test',
                'password' => 'generated-test-password',
                'password_confirmation' => 'generated-test-password',
            ])
            ->assertCreated()
            ->assertJsonMissingPath('user.password');

        $user = User::query()->where('email', 'generated-auth@example.test')->firstOrFail();
        $this->assertTrue(Hash::check('generated-test-password', $user->password));
        $this->assertNotSame('generated-test-password', $user->password);
        $this->assertAuthenticatedAs($user, 'web');

        $this->spaGet('/api/me')
            ->assertOk()
            ->assertJsonPath('email', 'generated-auth@example.test');

        $this->spaPost('/api/auth/logout', [])->assertOk();

        $this->spaPost('/api/auth/login', [
            'email' => 'generated-auth@example.test',
            'password' => 'generated-test-password',
        ])->assertOk()->assertJsonPath('user.email', 'generated-auth@example.test');

        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_failed_sign_in_attempts_are_rate_limited(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.77']);

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $this->spaPost('/api/auth/login', [
                'email' => 'missing-user@example.test',
                'password' => 'incorrect-password',
            ])->assertUnprocessable();
        }

        $this->spaPost('/api/auth/login', [
            'email' => 'missing-user@example.test',
            'password' => 'incorrect-password',
        ])->assertTooManyRequests();
    }
}
